async function directMediaAPI(request,env,url){
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 const body=await educationBody(request,url,4000);if(body instanceof Response)return body;
 if(!env.BUCKET?.signUpload)return json({error:'Private storage is not configured.'},503);
 const user=request.headers.get('oai-authenticated-user-id'),owner=!!user&&request.headers.get('oai-authenticated-user-email')?.toLowerCase()===EDUCATION_OWNER&&request.headers.get('x-chat-role')!=='student',student=await chatStudent(request,env);
 if(!owner&&!student)return json({error:'Sign in to upload a file.'},401);
 const actor=owner?'admin:'+user:'student:'+student.id,id=body.id;
 if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))return json({error:'Invalid upload identifier.'},400);
 if(url.pathname==='/api/media/complete'){
  const row=await db(env).prepare('SELECT * FROM media_uploads WHERE id=?').bind(id).first();
  if(!row||row.actor!==actor)return json({error:'Upload not found. Choose the file again.'},404);
  const old=await db(env).prepare('SELECT * FROM media_files WHERE id=?').bind(id).first();
  if(old)return json({file:mediaDescriptor(old)});
  if(row.expires_at<=Date.now())return json({error:'Upload expired. Choose the file again.'},410);
  const blob=await env.BUCKET.staged(row.storage_key);
  if(blob.size!==row.size)return json({error:'Uploaded size does not match. Choose the file again.'},400);
  const query=new URLSearchParams({scope:row.scope,student:row.student_id||'',request:'education-verification:'+row.user_id});
  const headers=new Headers(request.headers);headers.set('content-type',row.claimed_type);headers.set('x-upload-id',id);headers.set('x-file-name',encodeURIComponent(row.name));headers.set('content-length',String(blob.size));
  const incoming=new Request(url.origin+'/api/media/upload?'+query,{method:'POST',headers,body:blob});
  const result=await mediaAPI(incoming,env,new URL(incoming.url));
  if(result.ok){try{await env.BUCKET.deleteStaged(row.storage_key);}catch{console.error('staged_file_cleanup_pending');}}
  return result;
 }
 if(url.pathname!=='/api/media/prepare')return json({error:'Not found.'},404);
 if(!Number.isSafeInteger(body.size)||body.size<1||body.size>MEDIA_MAX||typeof body.name!=='string'||body.name.length>200||typeof body.type!=='string'||body.type.length>100)return json({error:'Choose a file of up to 25 MB.'},400);
 let target=null,userId;
 if(body.scope==='background'&&(body.size>8*1024*1024||!['image/jpeg','image/png','image/webp'].includes(body.type)))return json({error:'Choose a JPG, PNG or WebP image up to 8 MB.'},400);
 if(body.scope==='chat'||body.scope==='background'&&owner){
  const sid=owner?body.student:student?.id;if(!sid||(!owner&&body.student!==sid))return json({error:'Conversation unavailable.'},403);
  target=await db(env).prepare("SELECT id,user_id FROM chat_students WHERE id=? AND status='active'").bind(sid).first();if(!target)return json({error:'Conversation unavailable.'},403);userId=target.user_id;
 }else if(body.scope==='verification'&&owner){
  if(typeof body.request!=='string'||!body.request.startsWith('education-verification:'))return json({error:'Choose a verification request.'},400);
  if(!await db(env).prepare('SELECT id FROM prototype_settings WHERE id=?').bind(body.request).first())return json({error:'Request not found.'},404);
  userId=body.request.slice('education-verification:'.length);
 }else return json({error:'Upload unavailable.'},403);
 const previous=await db(env).prepare('SELECT * FROM media_uploads WHERE id=?').bind(id).first();
 if(previous){
  if(previous.actor!==actor||previous.user_id!==userId||previous.scope!==body.scope||previous.size!==body.size)return json({error:'Upload identifier conflict.'},409);
  const file=await db(env).prepare('SELECT * FROM media_files WHERE id=?').bind(id).first();if(file)return json({file:mediaDescriptor(file)});
  // Retry completion after a lost response, rather than allowing the upload token to be extended forever.
  if(previous.expires_at<=Date.now())return json({error:'Upload expired. Choose the file again.'},410);
  return json({id,completeOnly:true});
 }
 if(!await chatLimit(env,'prepare:'+actor,20,3600000))return json({error:'Upload limit reached. Try again in an hour.'},429);
 const name=body.name.replace(/[\x00-\x1f\x7f/\\]/g,'_').slice(0,150)||'Attachment',key=await chatHash(actor)+'/'+id;
 // Serialize quota reservations per student. Pending files count toward the allowance.
 const out=await db(env).batch([
  db(env).prepare('SELECT pg_advisory_xact_lock(hashtextextended(?::text,0))').bind(userId),
  db(env).prepare('INSERT INTO media_uploads (id,actor,storage_key,student_id,user_id,scope,role,name,claimed_type,size,expires_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COALESCE(SUM(size),0) FROM media_files WHERE user_id=?) + (SELECT COALESCE(SUM(u.size),0) FROM media_uploads u LEFT JOIN media_files f ON f.id=u.id WHERE u.user_id=? AND u.expires_at>? AND f.id IS NULL) + ?::bigint <= 262144000 RETURNING id').bind(id,actor,key,target?.id||null,userId,body.scope,owner?'admin':'client',name,body.type,body.size,Date.now()+2*3600000,userId,userId,Date.now(),body.size)
 ]);
 if(!out[1].meta.changes)return json({error:'This student’s 250 MB file allowance is full.'},413);
 try{return json({id,uploadUrl:await env.BUCKET.signUpload(key)});}catch(error){await db(env).prepare('DELETE FROM media_uploads WHERE id=?').bind(id).run();throw error;}
}
