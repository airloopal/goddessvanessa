import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {database} from '../server/platform/database.js';
import {handle} from '../api/index.js';
const sql=new PGlite();await sql.exec('CREATE ROLE anon;CREATE ROLE authenticated;');await sql.exec(fs.readFileSync('supabase/schema.sql','utf8'));const DB=database(sql),owner={id:'verification-owner-fixture',email:'danielvernontp@gmail.com',email_confirmed_at:'2026-01-01'};
async function call(path,{method='GET',data,cookie,user=null,origin='https://academy.test'}={}){const auth={client:{auth:{getUser:async()=>({data:{user},error:null})}},apply:r=>r};const r=await handle(new Request('https://academy.test/api/education/'+path,{method,headers:{origin,...(cookie?{cookie}:{}),...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined}),{}, {DB,auth});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
const session=await call('application-session',{method:'POST',data:{}}),cookie=session.cookie;assert.equal(session.status,200);assert.ok(cookie);
const body={name:'Verification fixture',entryId:'basic'};
const burst=await Promise.all([0,1,2].map(()=>call('verification',{method:'POST',cookie,data:body})));assert.ok(burst.every(r=>r.status===200));const first=burst[0].data.request;assert.ok(first);assert.ok(burst.every(r=>r.data.request.id===first.id&&r.data.request.revision===1));
assert.equal((await DB.prepare("SELECT COUNT(*) n FROM prototype_settings WHERE id LIKE 'education-verification:%'").first()).n,1,'concurrent requests persist one row');
// Closing/reopening and a new page load reuse the host-only application cookie.
for(let i=0;i<3;i++){const read=await call('verification',{cookie});assert.equal(read.data.request.id,first.id);assert.equal(read.data.request.status,'pending');}
const resumed=await call('application-session',{method:'POST',cookie,data:{}});assert.equal(resumed.cookie,undefined,'reload must not rotate a valid application session');
const retry=await call('verification',{method:'POST',cookie,data:{...body,name:'Changed nickname'}});assert.equal(retry.data.request.id,first.id);assert.equal(retry.data.request.name,body.name);assert.equal(retry.data.request.createdAt,first.createdAt);assert.equal(retry.data.request.revision,1);
const reply=await call('verifications',{method:'PUT',user:owner,data:{key:first.key,revision:first.revision,videoUrl:'https://video.example.test/introduction.mp4',message:'Fixture introduction'}});assert.equal(reply.status,200);assert.equal(reply.data.request.status,'ready');
const afterReply=await call('verification',{method:'POST',cookie,data:body});assert.equal(afterReply.data.request.id,first.id);assert.equal(afterReply.data.request.status,'ready');assert.equal(afterReply.data.request.revision,reply.data.request.revision);assert.equal(afterReply.data.request.videoUrl,reply.data.request.videoUrl);
assert.equal((await call('verifications',{method:'PUT',user:owner,data:{action:'close',confirm:true,key:first.key,revision:reply.data.request.revision}})).status,200);
const closed=await call('verification',{cookie}),afterClose=await call('verification',{method:'POST',cookie,data:body});assert.equal(afterClose.data.request.id,first.id);assert.equal(afterClose.data.request.closed,true);assert.equal(afterClose.data.request.revision,closed.data.request.revision);assert.equal(afterClose.data.request.status,'ready');
const other=await call('application-session',{method:'POST',data:{}});assert.equal((await call('verification',{cookie:other.cookie})).data.request,null,'another application cannot read the first request');assert.equal((await call('verification')).status,401);
assert.equal((await DB.prepare("SELECT COUNT(*) n FROM prototype_settings WHERE id LIKE 'education-verification:%'").first()).n,1);
await sql.close();console.log('Verification duplicate protection passed: concurrent submits, popup reopen, page/session refresh, immutable first request, completed/closed retries, and private application isolation. One request per retained application session. No real requests or emails.');
