import assert from 'node:assert/strict';
import {request,env} from './check-education.mjs';
const ref=await env.DB.prepare("SELECT reference FROM education_enrolments WHERE user_id='learner-test'").first();
const issued=await request('/api/chat/students',{method:'POST',account:'owner',data:{reference:ref.reference}});
const session=await request('/api/chat/session',{method:'POST',data:{code:issued.data.code}}),cookie=session.headers.get('set-cookie').split(';')[0],student=(await env.DB.prepare("SELECT id FROM chat_students WHERE user_id='learner-test'").first()).id;
const worker=(await import('../dist/server/index.js')).default;let staged;
env.BUCKET={async signUpload(){return 'https://storage.test/upload';},async staged(){return new Blob([staged]);},async put(){},async deleteStaged(){},async delete(){}};
const id=crypto.randomUUID(),png=new Uint8Array([137,80,78,71,13,10,26,10]);staged=png;
// SUM(integer) is bigint; pg/PGlite aggregate numeric values can be strings.
await env.DB.prepare('INSERT INTO media_files (id,storage_key,student_id,user_id,scope,role,name,mime,size,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),'test',student,'learner-test','chat','client','Test','image/png',5631516,Date.now()).run();
const used=await env.DB.prepare("SELECT COALESCE(SUM(size),0) AS size FROM media_files WHERE user_id='learner-test'").first();assert.equal(Number(used.size),5631516);
const prepare=await request('/api/media/prepare',{method:'POST',cookie,data:{id,scope:'chat',student,name:'test.png',type:'image/png',size:png.length}});assert.equal(prepare.status,200);
const complete=await request('/api/media/complete',{method:'POST',cookie,data:{id}});assert.equal(complete.status,200);assert.equal((await request('/api/media/complete',{method:'POST',cookie,data:{id}})).status,200);
for(let i=0;i<21;i++)await env.DB.prepare('INSERT INTO media_files (id,storage_key,student_id,user_id,scope,role,name,mime,size,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),'quota-'+i,student,'learner-test','chat','client','Quota test','image/png',50*1024*1024,Date.now()).run();
assert.equal((await request('/api/media/prepare',{method:'POST',cookie,data:{id:crypto.randomUUID(),scope:'chat',student,name:'test.png',type:'image/png',size:png.length}})).status,413);
const response=await worker.fetch(new Request('https://academy.test/api/media/upload?scope=chat&student='+student,{method:'POST',headers:{origin:'https://academy.test',cookie,'content-type':'image/png','x-upload-id':crypto.randomUUID()},body:png}),env);assert.equal(response.status,413);
console.log('Media quota checks passed: small file after prior uploads, direct completion, retry and genuinely full allowance rejection.');
