import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {database} from '../server/platform/database.js';
import {handle} from '../api/index.js';
import {recordFailure} from '../server/platform/diagnostics.js';
const sql=new PGlite();await sql.exec('CREATE ROLE anon;CREATE ROLE authenticated;');await sql.exec(fs.readFileSync('supabase/schema.sql','utf8'));const DB=database(sql);
const owner={id:'owner',email:'danielvernontp@gmail.com',email_confirmed_at:'2026-01-01'};
let probes=0;
async function call(path,{user=owner,method='GET',db=DB,bucket={health:async()=>{probes++;}},headers={},data,otp}={}){
 const auth={client:{auth:{getUser:async()=>({data:{user},error:null}),signInWithOtp:async()=>({error:otp})}},apply:r=>r};
 const response=await handle(new Request('https://academy.test/api/'+path,{method,headers:{origin:'https://academy.test',...headers},body:data?JSON.stringify(data):undefined}),{VERCEL_ENV:'production',VERCEL_GIT_COMMIT_SHA:'abcdef1234567'}, {DB:db,BUCKET:bucket,auth});return {status:response.status,headers:response.headers,body:await response.json()};
}
for(const user of [null,{id:'student',email:'student@example.test',email_confirmed_at:'2026-01-01'},{...owner,email_confirmed_at:null}]){
 for(const path of ['admin/status','admin/changelog'])assert.equal((await call(path,{user,headers:{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':owner.email}})).status,403);
}
assert.equal(probes,0);
assert.equal((await call('admin/status',{method:'POST'})).status,405);
let r=await call('admin/status');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.body.checks.find(c=>c.id==='database').state,'ok');assert.equal(r.body.checks.find(c=>c.id==='storage').state,'ok');assert.equal(r.body.checks.find(c=>c.id==='email').state,'attention');assert.equal(r.body.checks.find(c=>c.id==='payments').state,'attention');assert.equal(Number(r.body.counts.applications),0);
const broken={prepare(){throw Error('SECRET database credentials');}};
r=await call('admin/status',{db:broken,bucket:{health:async()=>{throw Error('SECRET bucket');}}});assert.equal(r.status,200);assert.equal(r.body.checks.filter(c=>c.state==='error').length,2);assert.equal(r.body.counts,null);assert.equal(r.body.historyAvailable,false);assert.ok(!JSON.stringify(r.body).includes('SECRET'));
assert.equal((await call('admin/changelog',{db:broken})).body.changelog.length,7);
const reference=crypto.randomUUID();await recordFailure(DB,{path:'/api/chat/messages?email=private@example.test',status:503,requestId:reference,issue:'private text'});
r=await call('admin/status');assert.equal(r.body.events[0].requestId,reference);assert.equal(r.body.events[0].area,'chat');assert.equal(r.body.events[0].message,'A server request failed.');assert.ok(!JSON.stringify(r.body).includes('private@example'));
await DB.prepare('INSERT INTO chat_limits (key,count,expires) VALUES (?,5,?)').bind('goddess-login:global',Date.now()+900000).run();
await recordFailure(DB,{path:'/api/auth/code',status:429,requestId:crypto.randomUUID()});
assert.equal((await call('admin/status')).body.events[0].message,'A request was rate limited.');
await DB.prepare('INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES (?,?,1,?)').bind('diagnostic:old','{}','2000-01-01').run();
for(let i=0;i<105;i++)await recordFailure(DB,{path:'/api/chat',status:503,requestId:crypto.randomUUID()});
assert.equal(Number((await DB.prepare("SELECT COUNT(*) n FROM prototype_settings WHERE id LIKE 'diagnostic:%'").first()).n),100);assert.equal(await DB.prepare("SELECT id FROM prototype_settings WHERE id='diagnostic:old'").first(),null);assert.equal((await call('admin/status')).body.events.length,50);
for(const file of fs.readdirSync('public').filter(f=>f.endsWith('.html')))assert.match(fs.readFileSync('public/'+file,'utf8'),/href="\/favicon.svg"/);
for(const file of ['favicon.svg','favicon.ico','apple-touch-icon.png','status.html','status.css','status.js'])assert.ok(fs.statSync('dist/public/'+file).size>0);
await sql.close();console.log('Status checks passed: verified owner only, safe degraded checks, changelog independence, curated errors, request references, bounded history and favicon assets.');
