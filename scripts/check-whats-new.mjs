import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {database} from '../server/platform/database.js';
import worker from '../dist/server/index.js';
import {handle} from '../api/index.js';
const sql=new PGlite();await sql.exec('CREATE ROLE anon;CREATE ROLE authenticated;');await sql.exec(fs.readFileSync('supabase/schema.sql','utf8'));
const env={DB:database(sql),SQUARE_ENVIRONMENT:'production'},ids=[crypto.randomUUID(),crypto.randomUUID()],tokens=['a'.repeat(48),'b'.repeat(48)];
for(let i=0;i<2;i++){await env.DB.prepare("INSERT INTO chat_students(id,user_id,name,email,status,created_at) VALUES(?,?,?,?,'active',?)").bind(ids[i],'updates-test-'+i,'Synthetic Sub '+i,'synthetic'+i+'@example.test',Date.now()).run();await env.DB.prepare('INSERT INTO chat_sessions(hash,student_id,expires_at) VALUES(?,?,?)').bind(Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(tokens[i]))).toString('hex'),ids[i],Date.now()+3600000).run();}
async function call({method='GET',data,index=0,anonymous=false,admin=false,studentRole=!admin,origin='https://academy.test',query='',mode='production',gateway=false,spoof=false}={}){
 const headers={origin,...(!anonymous?{cookie:'__Host-vanessa_student='+tokens[index]}:{}),...(studentRole?{'x-chat-role':'student'}:{'x-chat-role':'admin'}),...(admin||spoof?{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'danielvernontp@gmail.com'}:{}),...(data?{'content-type':'application/json'}:{})};
 const req=new Request('https://academy.test'+(gateway?'/api/index?__path=chat/whats-new&path=chat/whats-new'+(query?'&'+query:''):'/api/chat/whats-new'+(query?'?'+query:'')),{method,headers,...(data?{body:JSON.stringify(data)}:{})});
 const e={...env,SQUARE_ENVIRONMENT:mode};const r=gateway?await handle(req,e,{DB:e.DB,BUCKET:{},auth:{client:{auth:{getUser:async()=>({data:{user:null},error:null})}},apply:r=>r}}):await worker.fetch(req,e);
 return {status:r.status,data:await r.json(),headers:r.headers};
}
assert.equal((await call({anonymous:true})).status,403);assert.equal((await call({anonymous:true,method:'PATCH',data:{id:'sub-welcome-20261018'}})).status,403);
let sub=await call(),goddess=await call({admin:true});assert.equal(sub.status,200);assert.equal(sub.data.audience,'sub');assert.equal(goddess.data.audience,'goddess');assert.equal(sub.data.items[0].read,false);assert.equal(goddess.data.items[0].read,false);assert.ok(!JSON.stringify(sub.data).includes('Your dashboard, at a glance'));assert.ok(!JSON.stringify(goddess.data).includes('Welcome to your private space'));assert.match(sub.headers.get('cache-control'),/no-store/);
const subId=sub.data.items[0].id,ownerId=goddess.data.items[0].id;
for(const q of ['audience=goddess','studentId='+ids[1],'user=owner','role=admin','id='+ownerId])assert.equal((await call({query:q})).status,400);
for(const data of [{id:ownerId},{id:subId,studentId:ids[1]},{id:subId,audience:'goddess'},{ids:[subId]},{id:'unknown'},{id:'<img onerror=alert(1)>'}])assert.equal((await call({method:'PATCH',data})).status,400);
assert.equal((await call({method:'DELETE',data:{}})).status,405);assert.equal((await call({method:'POST',data:{id:subId}})).status,405);
assert.equal((await call({method:'PATCH',data:{id:subId},origin:'https://evil.test'})).status,403);
assert.equal((await call({studentRole:false})).status,403,'Sub cookie cannot access Goddess audience');
assert.equal((await call({admin:true,studentRole:true})).data.audience,'sub','Explicit Sub context remains Sub even with Goddess auth');
assert.equal((await call({anonymous:true,spoof:true,gateway:true})).status,403,'Gateway strips forged owner headers');
assert.equal((await call({gateway:true})).status,200,'Rewrite metadata is compatible');
const saved=await call({method:'PATCH',data:{id:subId},gateway:true});assert.equal(saved.status,200);assert.equal(saved.data.items[0].read,true);assert.equal((await call()).data.items[0].read,true);assert.equal((await call({index:1})).data.items[0].read,false,'Another Sub remains unread');assert.equal((await call({admin:true})).data.items[0].read,false,'Goddess remains unread');assert.equal((await call({mode:'sandbox'})).data.items[0].read,false,'Sandbox does not inherit Live read state');
const marker=await env.DB.prepare("SELECT content,updated_at FROM prototype_settings WHERE id=?").bind('whats-new:production:'+ids[0]+':'+subId).first();await Promise.all([call({method:'PATCH',data:{id:subId}}),call({method:'PATCH',data:{id:subId}})]);assert.deepEqual(await env.DB.prepare("SELECT content,updated_at FROM prototype_settings WHERE id=?").bind('whats-new:production:'+ids[0]+':'+subId).first(),marker,'Repeated acknowledgements are idempotent');assert.equal((await call({admin:true,method:'PATCH',data:{id:ownerId}})).data.items[0].read,true);
await env.DB.prepare("UPDATE chat_students SET status='suspended' WHERE id=?").bind(ids[1]).run();assert.equal((await call({index:1})).status,403);await env.DB.prepare("UPDATE chat_students SET status='active' WHERE id=?").bind(ids[1]).run();await env.DB.prepare('UPDATE chat_sessions SET expires_at=? WHERE student_id=?').bind(Date.now()-1000,ids[1]).run();assert.equal((await call({index:1})).status,403);
// Each branch keeps its existing deletion flow; both remove the new read markers.
await env.DB.prepare('INSERT INTO prototype_settings(id,content,revision,updated_at) VALUES(?,?,1,?)').bind('account-life:'+ids[0],JSON.stringify({until:Date.now()-1,deletion:'approved',reason:'Taking a personal break',decidedAt:Date.now()}),new Date().toISOString()).run();
const lifecycle=fs.existsSync('server/account-management.js');const deletion=await worker.fetch(new Request('https://academy.test/api/chat/'+(lifecycle?'account-management':'account'),{method:lifecycle?'POST':'DELETE',headers:{origin:'https://academy.test','x-chat-role':'student',cookie:'__Host-vanessa_student='+tokens[0],'content-type':'application/json'},body:JSON.stringify(lifecycle?{action:'delete',revision:1}:{confirm:true})}),env);assert.equal(deletion.status,200);assert.equal(await env.DB.prepare("SELECT id FROM prototype_settings WHERE id=?").bind('whats-new:production:'+ids[0]+':'+subId).first(),null);
for(const file of ['dashboard.html','chat.html','feed.html']){const html=fs.readFileSync('dist/public/'+file,'utf8');assert.ok(html.includes('whats-new.js'));assert.ok(html.includes('whats-new.css'));}
const source=fs.readFileSync('public/whats-new.js','utf8');assert.ok(!source.includes('localStorage'));assert.ok(!source.includes('innerHTML=data'));assert.match(source,/esc\(h.text\)/);assert.match(source,/credentials:'same-origin',cache:'no-store'/);assert.match(source,/event.persisted/);
await sql.close();console.log('What’s New passed: server-selected audiences, separate accounts/environments, unread persistence, idempotency, forged headers/selectors, CSRF, suspended/expired sessions, account deletion, escaped rendering and built assets.');
