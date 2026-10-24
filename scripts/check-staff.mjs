import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {database} from '../server/platform/database.js';
import {handle} from '../api/index.js';
const sql=new PGlite();await sql.exec('CREATE ROLE anon;CREATE ROLE authenticated;');await sql.exec(fs.readFileSync('supabase/schema.sql','utf8'));const DB=database(sql);
const owner={id:'owner-test',email:'danielvernontp@gmail.com',email_confirmed_at:'test'},objects=new Map(),staged=new Map();
const BUCKET={async signUpload(key){return 'https://storage.test/upload/'+key;},async staged(key){if(!staged.has(key))throw Error('Not uploaded');return staged.get(key);},async put(key,bytes){if(objects.has(key))throw Error('Exists');objects.set(key,bytes);},async signedRead(key){return 'https://storage.test/read/'+key;},async delete(key){objects.delete(key);},async deleteStaged(key){staged.delete(key);}};
let assertions=0;
async function call(path,{body,method=body?'POST':'GET',cookie,user=null,origin='https://sandbox.test',headers={},preview=true}={}){const auth={client:{auth:{getUser:async()=>({data:{user},error:null})}},apply:r=>r};const r=await handle(new Request('https://sandbox.test'+(path.startsWith('/api/')?path:'/api/staff/'+path),{method,headers:{origin,'Content-Type':'application/json',...(cookie?{cookie}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})}),{VERCEL_ENV:preview?'preview':'production'},{DB,BUCKET,auth});return {status:r.status,headers:r.headers,data:r.headers.get('content-type')?.includes('json')?await r.json():null,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
function eq(actual,expected,why){assertions++;assert.equal(actual,expected,why);}
async function clearLimits(){await DB.prepare("DELETE FROM chat_limits WHERE key LIKE 'staff:%'").run();}
async function create(name,role){const r=await call('team',{user:owner,body:{name,email:name.toLowerCase()+'@example.test',role}});eq(r.status,201);return {id:r.data.id,email:name.toLowerCase()+'@example.test',password:r.data.temporaryPassword};}
async function login(person){await clearLimits();const r=await call('login',{body:{email:person.email,password:person.password}});eq(r.status,200);return r;}
// No shared owner identity, environment bypass, self-registration or anonymous data.
eq((await call('session')).status,401);eq((await call('session',{user:owner,preview:false})).status,404);
eq((await call('session',{headers:{'oai-authenticated-user-id':owner.id,'oai-authenticated-user-email':owner.email,'x-staff-role':'goddess'}})).status,401);
eq((await call('team',{user:{...owner,email_confirmed_at:null}})).status,401);
eq((await call('team',{body:{name:'Intruder',role:'goddess'}})).status,401);
const a=await create('ChatterA','chatter'),b=await create('ChatterB','chatter'),social=await create('SocialA','social');
eq((await call('team',{user:owner,body:{name:'Duplicate',email:a.email,role:'chatter'}})).status,409);
eq((await call('team',{user:owner,body:{name:'Owner',email:'new@example.test',role:'goddess'}})).status,400);
const initial=await login(a);for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/'])assert.ok(initial.headers.get('set-cookie').includes(flag));assert.match(initial.cookie,/^__Host-vanessa_staff=/);
eq((await call('password',{cookie:initial.cookie,body:{currentPassword:a.password,password:'short'}})).status,400);
async function ready(person){const r=await login(person),password='Private-'+randomUUID();eq((await call('password',{cookie:r.cookie,body:{currentPassword:person.password,password}})).status,200);eq((await call('session',{cookie:r.cookie})).status,401);person.password=password;const session=await login(person);return session.cookie;}
const ca=await ready(a),cb=await ready(b),cs=await ready(social);
eq((await call('session',{cookie:ca})).data.user.role,'chatter');
eq((await call('team',{cookie:ca})).status,403);eq((await call('team',{cookie:ca,headers:{'x-staff-role':'goddess','oai-authenticated-user-id':owner.id,'oai-authenticated-user-email':owner.email}})).status,403);eq((await call('assignments',{cookie:ca})).status,403);
eq((await call('/api/education/enrolments',{cookie:ca})).status,403);eq((await call('/api/chat/students',{cookie:ca})).status,403);eq((await call('/api/auth/session',{cookie:ca})).status,401);
eq((await call('chats',{cookie:cs})).status,403);eq((await call('drafts',{cookie:ca})).status,403);
eq((await call('team',{user:owner,body:{name:'NoCSRF',email:'x@example.test',role:'chatter'},origin:'https://evil.test'})).status,403);
eq((await call('tickets',{cookie:ca,body:{padding:'x'.repeat(24001)}})).status,413);
for(let i=0;i<2;i++){const id=randomUUID();await DB.prepare("INSERT INTO chat_students(id,user_id,name,email,status,created_at) VALUES(?,?,?,?,'active',?)").bind(id,'synthetic-user-'+i,'Synthetic '+i,'sub'+i+'@example.test',Date.now()).run();if(i===0)a.studentId=id;else b.studentId=id;}
const assign=await call('assignments',{user:owner,method:'PUT',body:{studentId:a.studentId,staffId:a.id,revision:0}});eq(assign.status,200);
eq((await call('assignments',{user:owner,method:'PUT',body:{studentId:b.studentId,staffId:social.id,revision:0}})).status,400);
eq((await call('assignments',{user:owner,method:'PUT',body:{studentId:b.studentId,staffId:b.id,revision:0}})).status,200);
eq((await call('chats',{cookie:ca})).data.chats.length,1);eq((await call('thread?student='+b.studentId,{cookie:ca})).status,404);
eq((await call('notes?student='+b.studentId,{cookie:ca})).status,404);
eq((await call('state',{cookie:ca,method:'PUT',body:{studentId:b.studentId,readSeq:1}})).status,404);
const id=randomUUID(),payload={id,studentId:a.studentId,text:'A helpful reply',assignmentRevision:1,sender:'client',staffId:b.id};
eq((await call('message',{cookie:ca,body:payload})).status,200);eq((await call('message',{cookie:ca,body:payload})).status,200);
eq((await DB.prepare('SELECT COUNT(*) AS n FROM chat_messages WHERE id=?').bind(id).first()).n,1);
eq((await call('state',{cookie:ca,method:'PUT',body:{studentId:a.studentId,readSeq:999999999}})).status,200);
eq((await DB.prepare("SELECT read_seq FROM chat_state WHERE student_id=? AND role='admin'").bind(a.studentId).first()).read_seq,1,'read receipts clamp to this chat');
const thread=await call('thread?student='+a.studentId,{cookie:ca});eq(thread.data.messages[0].from,'admin');eq(thread.data.messages[0].staffName,'ChatterA');
eq((await call('message',{cookie:cb,body:{...payload,id:randomUUID()}})).status,404);
eq((await call('message',{cookie:ca,body:{...payload,id:randomUUID(),text:'https://throne.com/test'}})).status,400);
await DB.prepare("INSERT INTO prototype_settings(id,content,revision,updated_at) VALUES(?,?,1,?)").bind('chat-control:'+a.studentId,JSON.stringify({enabled:false}),new Date().toISOString()).run();
eq((await call('message',{cookie:ca,body:{...payload,id:randomUUID()}})).status,409);
await DB.prepare('DELETE FROM prototype_settings WHERE id=?').bind('chat-control:'+a.studentId).run();
eq((await call('notes',{cookie:ca,method:'PUT',body:{studentId:a.studentId,text:'Private handover',revision:0}})).status,200);
eq((await call('notes',{cookie:ca,method:'PUT',body:{studentId:a.studentId,text:'Stale update',revision:0}})).status,409);
eq((await call('notes?student='+a.studentId,{cookie:ca})).data.note.text,'Private handover');
eq((await call('assignments',{user:owner,method:'PUT',body:{studentId:a.studentId,staffId:b.id,revision:1}})).status,200);
eq((await call('thread?student='+a.studentId,{cookie:ca})).status,404);eq((await call('message',{cookie:ca,body:{...payload,id:randomUUID()}})).status,404);
eq((await call('message',{cookie:cb,body:{...payload,id:randomUUID(),assignmentRevision:1}})).status,409,'stale assignment version cannot send');
eq((await call('message',{cookie:cb,body:{...payload,id:randomUUID(),assignmentRevision:2}})).status,200);
// Attachment access is restricted to shared chat media within the assignment.
const imageId=randomUUID(),unsharedId=randomUUID(),assetKey='private/synthetic-photo';for(const [fid,sid] of [[imageId,b.studentId],[unsharedId,b.studentId]])await DB.prepare("INSERT INTO media_files(id,storage_key,student_id,user_id,scope,role,name,mime,size,created_at) VALUES(?,?,?,?,'chat','client','Photo','image/png',12,?)").bind(fid,assetKey+fid,sid,'synthetic-user-1',Date.now()).run();
await DB.prepare("INSERT INTO chat_messages(id,student_id,sender,body,attachment_id,created_at) VALUES(?,?,'client','Photo',?,?)").bind(randomUUID(),b.studentId,imageId,Date.now()).run();
eq((await call('media/'+imageId,{cookie:ca})).status,404);eq((await call('media/'+imageId,{cookie:cb})).status,302);eq((await call('media/'+imageId,{cookie:cs})).status,403);eq((await call('media/'+unsharedId,{cookie:cb})).status,404);
eq((await call('/api/media/'+imageId,{cookie:cb})).status,401,'staff cookie never grants global media access');
const ticket=randomUUID();eq((await call('tickets',{cookie:ca,body:{id:ticket,title:'Need advice',text:'Synthetic question',kind:'support'}})).status,201);
eq((await call('tickets',{cookie:cb})).data.tickets.length,0);eq((await call('tickets',{user:owner})).data.tickets.length,1);
eq((await call('tickets',{cookie:cb,method:'PATCH',body:{id:ticket,revision:1,text:'Cannot read this'}})).status,404);
eq((await call('tickets',{cookie:ca,method:'PATCH',body:{id:ticket,revision:1,status:'resolved'}})).status,403);
eq((await call('tickets',{user:owner,method:'PATCH',body:{id:ticket,revision:1,text:'Owner reply',status:'in_progress'}})).status,200);
eq((await call('tickets',{cookie:ca,method:'PATCH',body:{id:ticket,revision:1,text:'Stale'}})).status,409);
eq((await call('tickets',{cookie:ca,method:'PATCH',body:{id:ticket,revision:2,text:'Thank you'}})).status,200);
// Public-content assets cannot be sourced from private chat files or external URLs.
const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]),socialAsset=randomUUID();
eq((await call('asset-prepare',{cookie:ca,body:{id:socialAsset,type:'image/png',size:12}})).status,403);
eq((await call('asset-prepare',{cookie:cs,body:{id:randomUUID(),type:'image/svg+xml',size:12}})).status,400);
eq((await call('asset-prepare',{cookie:cs,body:{id:socialAsset,type:'image/png',size:png.length}})).status,200);staged.set('staff-social/sandbox/'+socialAsset,new Blob([png]));
eq((await call('asset-prepare',{cookie:cs,body:{id:socialAsset,type:'image/png',size:png.length}})).status,200,'lost prepare reply can recover');
eq((await call('asset-complete',{cookie:cs,body:{id:socialAsset}})).status,200);eq((await call('asset-complete',{cookie:cs,body:{id:socialAsset}})).status,200);
eq((await call('asset-prepare',{cookie:cs,body:{id:socialAsset,type:'image/png',size:png.length}})).data.completeOnly,true);
eq((await call('asset/'+socialAsset,{cookie:cs})).status,302);eq((await call('asset/'+socialAsset,{cookie:ca})).status,403);
const draft=randomUUID(),draftBody={id:draft,title:'Synthetic launch',instagram:'Instagram caption',tiktok:'TikTok caption',assets:[socialAsset],status:'draft',revision:0};
eq((await call('drafts',{cookie:cs,method:'PUT',body:{...draftBody,assets:[imageId]}})).status,400);
eq((await call('drafts',{cookie:cs,method:'PUT',body:{...draftBody,assets:['https://evil.test/photo.png']}})).status,400);
eq((await call('drafts',{cookie:cs,method:'PUT',body:{...draftBody,assets:Array.from({length:7},()=>randomUUID())}})).status,400);
eq((await call('drafts',{cookie:cs,method:'PUT',body:draftBody})).status,200);
eq((await call('drafts',{user:owner,method:'PATCH',body:{id:draft,status:'approved',revision:1,note:''}})).status,409,'unsubmitted drafts cannot be approved');
eq((await call('drafts',{cookie:cs,method:'PUT',body:{...draftBody,revision:1,status:'review'}})).status,200);
eq((await call('drafts',{cookie:cs,method:'PATCH',body:{id:draft,status:'approved',revision:2,note:''}})).status,403);
eq((await call('drafts',{user:owner,method:'PATCH',body:{id:draft,status:'approved',revision:1,note:''}})).status,409);
eq((await call('drafts',{user:owner,method:'PATCH',body:{id:draft,status:'approved',revision:2,note:'Approved'}})).status,200);
eq((await call('drafts',{cookie:cs,method:'PUT',body:{...draftBody,revision:3}})).status,409,'staff cannot silently edit approved copy');
eq((await call('drafts',{user:owner,method:'PATCH',body:{id:draft,status:'changes_requested',revision:3,note:'Change cover'}})).status,200);
eq((await call('drafts',{cookie:cs,method:'PUT',body:{...draftBody,revision:4,status:'review'}})).status,200);
eq((await call('publish',{user:owner,body:{id:draft}})).status,404,'no social publication endpoint');
// Role separation and immediate revocation, including re-enabling without session resurrection.
const records=(await call('team',{user:owner})).data.team;assert.ok(!JSON.stringify(records).includes('hash'));assert.ok(!JSON.stringify(records).includes('salt'));assert.ok(!JSON.stringify(records).includes(a.password));
const staff=records.find(x=>x.id===b.id);eq((await call('team',{user:owner,method:'PATCH',body:{id:b.id,revision:staff.revision,action:'disable'}})).status,200);
eq((await call('session',{cookie:cb})).status,401);eq((await call('thread?student='+b.studentId,{cookie:cb})).status,401);
eq((await call('team',{user:owner,method:'PATCH',body:{id:b.id,revision:staff.revision+1,action:'enable'}})).status,200);
eq((await call('session',{cookie:cb})).status,401);const cb2=(await login(b)).cookie;
const reset=await call('team',{user:owner,method:'PATCH',body:{id:b.id,revision:staff.revision+2,action:'reset'}});eq(reset.status,200);eq((await call('session',{cookie:cb2})).status,401);
await clearLimits();eq((await call('login',{body:{email:b.email,password:b.password}})).status,401);
eq((await call('logout',{cookie:ca,body:{},origin:'https://evil.test'})).status,403);eq((await call('logout',{cookie:ca,body:{}})).status,200);eq((await call('session',{cookie:ca})).status,401);
await clearLimits();for(let i=0;i<5;i++)eq((await call('login',{body:{email:'unknown@example.test',password:'not-a-password'}})).status,401);eq((await call('login',{body:{email:a.email,password:a.password}})).status,429);
const oldSession=await login(a);await DB.prepare("UPDATE prototype_settings SET content=(content::jsonb||jsonb_build_object('expires',0))::text WHERE id LIKE 'staff-session:%' AND content::jsonb->>'staffId'=?").bind(a.id).run();eq((await call('session',{cookie:oldSession.cookie})).status,401);
const permissions=await sql.query("SELECT has_schema_privilege('anon','academy','USAGE') AS anon,has_schema_privilege('authenticated','academy','USAGE') AS authenticated");eq(permissions.rows[0].anon,false);eq(permissions.rows[0].authenticated,false);
const source=fs.readFileSync('public/staff.js','utf8');assert.ok(!source.includes('localStorage.setItem(\'password'));assert.ok(source.includes('esc(m.text)'));assert.ok(fs.readFileSync('public/staff.css','utf8').includes('prefers-reduced-motion'));
await sql.close();console.log(`Staff security checks passed (${assertions} assertions): isolated sessions, temporary-password rotation, roles, assignments/reassignment, message idempotency, private media, support ownership, draft revisions/approvals, public/private media separation, origin checks, limits, revocation and Production gate. Synthetic local records only.`);
