import assert from 'node:assert/strict';
import fs from 'node:fs';
import {generateKeyPairSync,sign,randomUUID,randomBytes,createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {database} from '../server/platform/database.js';
import {throneWebhook,handle} from '../api/index.js';
const sql=new PGlite();await sql.exec('CREATE ROLE anon;CREATE ROLE authenticated;');await sql.exec(fs.readFileSync('supabase/schema.sql','utf8'));const DB=database(sql);
const {publicKey,privateKey}=generateKeyPairSync('ed25519'),now=Date.now(),ref='GV-'+'A'.repeat(24);
await DB.prepare("INSERT INTO chat_students (id,user_id,name,email,status,created_at) VALUES ('gift-student','gift-user','Gift Student','gift@example.test','active',?)").bind(now).run();
await DB.prepare('INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES (?,?,1,?)').bind('throne-ref:gift-student',JSON.stringify({studentId:'gift-student',reference:ref,expiresAt:now+60000}),new Date(now).toISOString()).run();
const event={contract_version:'1',event_id:randomUUID(),event_type:'gift_purchased',data:{creator_id:'BJk2DI5LvAPbA3keyUw2z0T6ooR2',creator_username:'vvannessa',item_name:'Flowers',price:1200,currency:'GBP',message:ref}};
async function deliver(e=event,{old=false,bad=false,raw}={}){const timestamp=String(Math.floor(Date.now()/1000)-(old?600:0)),body=raw??JSON.stringify(e),signature=bad?'0'.repeat(128):sign(null,Buffer.from(timestamp+'.'+body),privateKey).toString('hex');return throneWebhook(new Request('https://academy.test/api/throne/webhook',{method:'POST',headers:{'x-signature-timestamp':timestamp,'x-signature-ed25519':signature},body}),DB,{publicKey});}
assert.equal((await deliver(event,{bad:true})).status,403);assert.equal((await deliver(event,{old:true})).status,403);
assert.equal((await deliver({...event,data:{...event.data,creator_username:'other'}})).status,400);
assert.equal((await deliver(event,{raw:'x'.repeat(17000)})).status,413);
for(const r of await Promise.all([deliver(),deliver()]))assert.equal(r.status,200);
let messages=await DB.prepare('SELECT body,student_id FROM chat_messages').all();assert.equal(messages.results.length,1);assert.equal(messages.results[0].student_id,'gift-student');assert.match(messages.results[0].body,/Throne confirmed your gift: Flowers/);
await deliver({...event,event_id:randomUUID(),data:{...event.data,message:undefined}});assert.equal((await DB.prepare('SELECT body FROM chat_messages').all()).results.length,1);
// Human-readable references remain isolated and ambiguous matches never post.
await DB.prepare('UPDATE prototype_settings SET content=? WHERE id=?').bind(JSON.stringify({studentId:'gift-student',reference:'Student: Gift Student',legacyReference:ref,expiresAt:now+60000}),'throne-ref:gift-student').run();
const baseline=(await DB.prepare('SELECT body FROM chat_messages').all()).results.length;
await deliver({...event,event_id:randomUUID(),data:{...event.data,message:'Thank you!\nStudent: Gift Student'}});
assert.equal((await DB.prepare('SELECT body FROM chat_messages').all()).results.length,baseline+1);
await deliver({...event,event_id:randomUUID(),data:{...event.data,message:ref}});
assert.equal((await DB.prepare('SELECT body FROM chat_messages').all()).results.length,baseline+2);
await deliver({...event,event_id:randomUUID(),data:{...event.data,message:'Student: Gift Student\nStudent: Someone Else'}});
assert.equal((await DB.prepare('SELECT body FROM chat_messages').all()).results.length,baseline+2);
await DB.prepare("INSERT INTO chat_students (id,user_id,name,email,status,created_at) VALUES ('other-gift-student','other-user','Gift Student','other@example.test','active',?)").bind(now).run();
await DB.prepare('INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES (?,?,1,?)').bind('throne-ref:other-gift-student',JSON.stringify({studentId:'other-gift-student',reference:'Student: Gift Student',expiresAt:now+60000}),new Date(now).toISOString()).run();
await deliver({...event,event_id:randomUUID(),data:{...event.data,message:'Student: Gift Student'}});
assert.equal((await DB.prepare('SELECT body FROM chat_messages').all()).results.length,baseline+2);
// New Sub references and old Student references both resolve after wording changes.
await DB.prepare('UPDATE prototype_settings SET content=? WHERE id=?').bind(JSON.stringify({studentId:'gift-student',reference:'Sub: Gift Student',legacyReference:'Student: Gift Student',expiresAt:now+60000}),'throne-ref:gift-student').run();
await DB.prepare('DELETE FROM prototype_settings WHERE id=?').bind('throne-ref:other-gift-student').run();
await deliver({...event,event_id:randomUUID(),data:{...event.data,message:'Sub: Gift Student'}});
await deliver({...event,event_id:randomUUID(),data:{...event.data,message:'Student: Gift Student'}});
assert.equal((await DB.prepare('SELECT body FROM chat_messages').all()).results.length,baseline+4);
const auth={client:{auth:{getUser:async()=>({data:{user:null},error:null})}},apply:r=>r};
// Migrating an existing Student reference must update the database, not only the response copy.
const token=randomBytes(24).toString('hex');
await DB.prepare('INSERT INTO chat_sessions (hash,student_id,expires_at) VALUES (?,?,?)').bind(createHash('sha256').update(token).digest('hex'),'gift-student',now+60000).run();
await DB.prepare('UPDATE prototype_settings SET content=? WHERE id=?').bind(JSON.stringify({studentId:'gift-student',reference:'Student: Gift Student',expiresAt:now+60000}),'throne-ref:gift-student').run();
const referenceRequest=()=>new Request('https://academy.test/api/chat/gift-reference',{method:'POST',headers:{origin:'https://academy.test',cookie:'__Host-vanessa_student='+token},body:'{}'});
const migrated=await handle(referenceRequest(),{},{DB,BUCKET:{},auth});assert.equal(migrated.status,200);const migratedBody=await migrated.json();assert(migratedBody.reference.startsWith('Sub: '));
const stored=JSON.parse((await DB.prepare('SELECT content FROM prototype_settings WHERE id=?').bind('throne-ref:gift-student').first()).content);assert.equal(stored.reference,migratedBody.reference);assert.equal(stored.legacyReference,'Student: Gift Student');
const repeat=await handle(referenceRequest(),{},{DB,BUCKET:{},auth});assert.equal((await repeat.json()).reference,migratedBody.reference);
const r=await handle(new Request('https://academy.test/api/chat/gift-reference',{method:'POST',headers:{origin:'https://academy.test'},body:'{}'}),{},{DB,BUCKET:{},auth});assert.equal(r.status,401);
console.log('Throne checks passed: signed delivery, wrong creator rejected, timestamp limit, body limit, concurrent duplicate protection, student isolation, unmatched gifts do not post, anonymous references rejected.');await sql.close();
