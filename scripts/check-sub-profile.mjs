import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {database} from '../server/platform/database.js';
import worker from '../dist/server/index.js';
const sql=new PGlite();await sql.exec('CREATE ROLE anon;CREATE ROLE authenticated;');await sql.exec(fs.readFileSync('supabase/schema.sql','utf8'));const env={DB:database(sql)},ids=[crypto.randomUUID(),crypto.randomUUID()],tokens=['a'.repeat(48),'b'.repeat(48)];
for(let i=0;i<2;i++){await env.DB.prepare("INSERT INTO chat_students(id,user_id,name,email,status,created_at) VALUES(?,?,?,?,'active',?)").bind(ids[i],'bio-user-'+i,'Sample Sub '+i,'sample'+i+'@example.test',Date.now()).run();await env.DB.prepare('INSERT INTO chat_sessions(hash,student_id,expires_at) VALUES(?,?,?)').bind(Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(tokens[i]))).toString('hex'),ids[i],Date.now()+3600000).run();}
async function call(path='self-profile',{method='GET',data,index=0,anonymous=false,admin=false,origin='https://academy.test'}={}){const r=await worker.fetch(new Request('https://academy.test/api/chat/'+path,{method,headers:{origin,...(anonymous||admin?{}:{cookie:'__Host-vanessa_student='+tokens[index],'x-chat-role':'student'}),...(admin?{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'danielvernontp@gmail.com'}:{}),...(data?{'content-type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})}),env);return {status:r.status,data:await r.json(),headers:r.headers};}
assert.equal((await call('self-profile',{anonymous:true})).status,403);assert.equal((await call('self-profile',{admin:true})).status,403);
let p=await call();assert.equal(p.status,200);assert.equal(p.data.profile.revision,0);assert.deepEqual(Object.keys(p.data.profile).sort(),['bio','name','revision','updatedAt']);assert.match(p.headers.get('cache-control'),/no-store/);
const bio='<img src=x onerror=alert(1)>\nhttps://example.test · About me';
const save=await call('self-profile',{method:'PUT',data:{bio,revision:0}});assert.equal(save.status,200);assert.equal(save.data.profile.revision,1);assert.equal((await call()).data.profile.bio,bio,'bio persists on reload');assert.equal((await call('self-profile',{index:1})).data.profile.bio,'','other Sub cannot read bio');
assert.equal((await call('self-profile?student='+ids[1])).status,400);assert.equal((await call('self-profile',{method:'PUT',data:{studentId:ids[1],bio:'overwrite',revision:0}})).status,400);
assert.equal((await call('profile?student='+ids[0],{index:1})).status,403,'Sub cannot read Goddess notes/contact');
assert.equal((await call('self-profile',{method:'PUT',data:{bio:'stale',revision:0}})).status,409);
assert.equal((await call('self-profile',{method:'PUT',data:{bio:'forged',revision:1},origin:'https://evil.test'})).status,403);
for(const data of [{bio:'x'.repeat(1201),revision:1},{bio:null,revision:1},{bio:'ok',revision:-1},{bio:'ok',revision:1,notes:'overwrite'},{bio:'bad\u0000',revision:1}])assert.equal((await call('self-profile',{method:'PUT',data})).status,400);
assert.equal((await call('self-profile',{method:'POST',data:{bio:'bad',revision:1}})).status,405);
assert.equal((await call('profile',{method:'PUT',admin:true,data:{studentId:ids[0],notes:'Private owner notes',labels:['Regular'],revision:0}})).status,200);
p=await call('profile?student='+ids[0],{admin:true});assert.equal(p.data.profile.bio,bio);assert.equal(p.data.profile.notes,'Private owner notes');assert.ok(!JSON.stringify((await call()).data).includes('Private owner notes'));
await env.DB.prepare('INSERT INTO education_enrolments(user_id,reference,name,path_id,snapshot,completed,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind('bio-user-0','BIO-FIXTURE','Sample Sub 0','test','{}','[]',new Date().toISOString(),new Date().toISOString()).run();
const ownerRecords=await worker.fetch(new Request('https://academy.test/api/education/enrolments',{headers:{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'danielvernontp@gmail.com'}}),env);assert.equal(ownerRecords.status,200);assert.equal((await ownerRecords.json()).enrolments[0].bio,bio,'All Subs exposes bio to Goddess');
assert.equal((await call('self-profile',{anonymous:true,method:'PUT',data:{bio:'forged',revision:0}})).status,403);
assert.equal((await call('self-profile',{method:'PUT',data:{bio:'   ',revision:1}})).status,200);assert.equal((await call()).data.profile.bio,'');assert.equal((await call('profile?student='+ids[0],{admin:true})).data.profile.notes,'Private owner notes','bio does not overwrite owner notes');
// Concurrent tabs cannot silently overwrite the same revision.
const race=await Promise.all([call('self-profile',{method:'PUT',data:{bio:'First',revision:2}}),call('self-profile',{method:'PUT',data:{bio:'Second',revision:2}})]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
await env.DB.prepare("UPDATE chat_students SET status='suspended' WHERE id=?").bind(ids[0]).run();assert.equal((await call()).status,403);await env.DB.prepare("UPDATE chat_students SET status='active' WHERE id=?").bind(ids[0]).run();
await env.DB.prepare('UPDATE chat_sessions SET expires_at=? WHERE student_id=?').bind(Date.now()-1000,ids[1]).run();assert.equal((await call('self-profile',{index:1})).status,403);
const adminSource=fs.readFileSync('public/admin-support.js','utf8'),cards=fs.readFileSync('public/education-dashboard.js','utf8');assert.match(adminSource,/safe\(p.bio/);assert.match(cards,/eduEscape\(e.bio/);assert.ok(!fs.readFileSync('public/sub-profile.js','utf8').includes('localStorage'),'private bio is never cached in local storage');
await env.DB.prepare('UPDATE chat_limits SET count=30 WHERE key=?').bind('profile-save:'+ids[0]).run();assert.equal((await call('self-profile',{method:'PUT',data:{bio:'Too many saves',revision:3}})).status,429);
assert.equal((await call('account',{method:'DELETE',data:{confirm:true}})).status,200);assert.equal(await env.DB.prepare('SELECT id FROM prototype_settings WHERE id=?').bind('sub-bio:'+ids[0]).first(),null,'deleting Sub removes bio');
await sql.close();console.log('Sub profile passed: private persistence, isolation, session expiry, CSRF, strict fields/length, concurrency conflicts, separate Goddess notes, escaped rendering and deletion cleanup.');
