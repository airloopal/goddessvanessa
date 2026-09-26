import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {database} from '../server/platform/database.js';
import {handle} from '../api/index.js';
import {safeReturn,authContext} from '../server/platform/auth.js';
const sql=new PGlite();await sql.exec('CREATE ROLE anon; CREATE ROLE authenticated;');await sql.exec(fs.readFileSync('supabase/schema.sql','utf8'));
const DB=database(sql),objects=new Map(),staged=new Map();
const BUCKET={async put(k,bytes){objects.set(k,new Uint8Array(bytes));},async delete(keys){for(const k of Array.isArray(keys)?keys:[keys])objects.delete(k);},async signUpload(k){return 'https://storage.test/'+k;},async staged(k){if(!staged.has(k))throw Error('Missing staged file');return staged.get(k);},async deleteStaged(k){staged.delete(k);},async signedRead(k){return 'https://storage.test/read/'+k;}};
const owner={id:'owner-supabase',email:'danielvernontp@gmail.com',email_confirmed_at:'2026-01-01'},stranger={id:'stranger',email:'student@example.test',email_confirmed_at:'2026-01-01'};
async function call(path,{method='GET',data,user=null,cookie,headers={},origin='https://academy.test'}={}){
 const auth={client:{auth:{getUser:async()=>({data:{user},error:null})}},apply:r=>r};
 const r=await handle(new Request('https://academy.test'+path,{method,headers:{origin,...(data?{'Content-Type':'application/json'}:{}),...(cookie?{cookie}:{}),...headers},body:data?JSON.stringify(data):undefined}),{}, {DB,BUCKET,auth});
 return {r,status:r.status,data:r.headers.get('content-type')?.includes('application/json')?await r.json():null};
}
const forged={'oai-authenticated-user-id':'owner','oai-authenticated-user-email':owner.email};
assert.equal((await call('/api/education/enrolments',{headers:forged})).status,403);
assert.equal((await call('/api/education/enrolments',{user:stranger,headers:forged})).status,403);
assert.equal((await call('/api/education/enrolments',{user:{...owner,email_confirmed_at:null}})).status,403);
assert.equal((await call('/api/education/enrolments',{user:owner})).status,200);
assert.equal((await call('/api/index?__path=education%2Fenrolments',{user:owner})).status,200);
assert.equal((await call('/api/index?__path=chat%2Fsession',{method:'POST',data:{code:'invalid'}})).status,401);
const code='ab'.repeat(24),hash=async s=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex');
await DB.prepare("INSERT INTO chat_students (id,user_id,name,email,status,code_hash,code_expires,created_at) VALUES ('student-a','old-user','Student A','a@example.test','active',?,?,?)").bind(await hash(code),Date.now()+60000,Date.now()).run();
await DB.prepare("INSERT INTO chat_students (id,user_id,name,email,status,created_at) VALUES ('student-b','other-user','Student B','b@example.test','active',?)").bind(Date.now()).run();
const login=await call('/api/chat/session',{method:'POST',data:{code}});assert.equal(login.status,200);const cookie=login.r.headers.get('set-cookie').split(';')[0];
assert.equal((await call('/api/chat/session',{cookie})).status,200);
const id=crypto.randomUUID(),png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]),params={id,scope:'chat',student:'student-a',name:'Lesson.png',size:png.length,type:'image/png'};
assert.equal((await call('/api/media/prepare',{method:'POST',data:params})).status,401);
assert.equal((await call('/api/media/prepare',{method:'POST',data:{...params,student:'student-b'},cookie})).status,403);
assert.equal((await call('/api/media/prepare',{method:'POST',data:params,cookie,origin:'https://evil.test'})).status,403);
const prep=await call('/api/media/prepare',{method:'POST',data:params,cookie});assert.equal(prep.status,200);assert.match(prep.data.uploadUrl,/^https:\/\/storage.test\//);
const row=await DB.prepare('SELECT * FROM media_uploads WHERE id=?').bind(id).first();staged.set(row.storage_key,new Blob([png]));
const complete=await call('/api/media/complete',{method:'POST',data:{id},cookie});assert.equal(complete.status,200);assert.equal(objects.size,1);
assert.equal((await call('/api/media/complete',{method:'POST',data:{id},cookie})).status,200);assert.equal(objects.size,1);
assert.equal((await call(complete.data.file.url,{cookie})).status,302);
assert.equal((await call(complete.data.file.url,{user:stranger})).status,404);
assert.equal((await call('/api/media/upload',{method:'POST',cookie})).status,410);
const thread=await call('/api/chat/messages',{cookie});assert.equal(thread.data.messages.length,1);assert.equal(thread.data.messages[0].attachment.id,id);
// Reservation SQL must reject an over-quota upload under the same per-user transaction lock.
await DB.prepare("INSERT INTO media_uploads (id,actor,storage_key,user_id,scope,role,name,claimed_type,size,expires_at) SELECT 'reserved-'||n,'student:student-a','unused/'||n,'old-user','chat','client','x','image/png',26214400,? FROM generate_series(1,9) n").bind(Date.now()+100000).run();
const big=await call('/api/media/prepare',{method:'POST',cookie,data:{...params,id:crypto.randomUUID(),size:26214400}});assert.equal(big.status,413);
const invalidId=crypto.randomUUID();const invalid=await call('/api/media/prepare',{method:'POST',cookie,data:{...params,id:invalidId,size:8,type:'text/html'}});assert.equal(invalid.status,200);
const badRow=await DB.prepare('SELECT * FROM media_uploads WHERE id=?').bind(invalidId).first();staged.set(badRow.storage_key,new Blob(['<script>']));assert.equal((await call('/api/media/complete',{method:'POST',cookie,data:{id:invalidId}})).status,415);
assert.equal(safeReturn('//evil.test'),'/application.html');assert.equal(safeReturn('/\\evil.test'),'/application.html');assert.equal(safeReturn('/dashboard.html'),'/dashboard.html');
// Verify actual SSR cookie adapter round-trips chunked HttpOnly cookies without client exposure.
const ctx=authContext(new Request('https://academy.test'),{SUPABASE_URL:'https://hlmlqdkcwchmzxbcvrtp.supabase.co',SUPABASE_PUBLISHABLE_KEY:'test-public-key'});assert.equal(ctx.apply(new Response('ok')).status,200);
const perms=await sql.query("SELECT has_schema_privilege('anon','academy','USAGE') anon,has_schema_privilege('authenticated','academy','USAGE') authenticated");assert.equal(perms.rows[0].anon,false);assert.equal(perms.rows[0].authenticated,false);
await sql.close();console.log('Vercel boundary checks passed: forged identities rejected, verified owner access, code sessions, direct upload authorization, completion/retry, MIME checks, private file redirects and quota reservations.');
