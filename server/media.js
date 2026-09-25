const MEDIA_MAX=25*1024*1024;
function mediaType(bytes,claimed){const b=new Uint8Array(bytes),str=(a,n)=>String.fromCharCode(...b.slice(a,a+n));
 if(b[0]===0xff&&b[1]===0xd8&&b[2]===0xff)return 'image/jpeg';
 if(b[0]===137&&str(1,3)==='PNG'&&b[4]===13&&b[5]===10)return 'image/png';
 if(['GIF87a','GIF89a'].includes(str(0,6)))return 'image/gif';
 if(str(0,4)==='RIFF'&&str(8,4)==='WEBP')return 'image/webp';
 if(str(0,4)==='RIFF'&&str(8,4)==='WAVE')return 'audio/wav';
 if(str(0,4)==='OggS')return 'audio/ogg';
 if(str(0,3)==='ID3'||b[0]===255&&(b[1]&224)===224)return 'audio/mpeg';
 if(str(4,4)==='ftyp')return claimed==='audio/mp4'?'audio/mp4':'video/mp4';
 if(b[0]===26&&b[1]===69&&b[2]===223&&b[3]===163)return claimed.startsWith('audio/')?'audio/webm':'video/webm';
 if(str(0,5)==='%PDF-')return 'application/pdf';return null;
}
async function mediaBytes(request){const reader=request.body?.getReader();if(!reader)throw Error('Choose a file.');const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MEDIA_MAX){await reader.cancel();throw Error('Files must be 25 MB or smaller.');}chunks.push(value);}const out=new Uint8Array(size);let offset=0;for(const part of chunks){out.set(part,offset);offset+=part.byteLength;}return out;}
const mediaDescriptor=file=>({id:file.id,name:file.name,mime:file.mime,size:file.size,url:'/api/media/'+file.id});
async function mediaDeleteStudent(env,id){const rows=await db(env).prepare('SELECT storage_key FROM media_files WHERE student_id=?').bind(id).all();if(rows.results.length&&!env.BUCKET)throw Error('File storage unavailable.');for(let i=0;i<rows.results.length;i+=100)await env.BUCKET.delete(rows.results.slice(i,i+100).map(f=>f.storage_key));await db(env).prepare('DELETE FROM media_files WHERE student_id=?').bind(id).run();}
async function mediaAPI(request,env,url){
 const dispatchUser=request.headers.get('oai-authenticated-user-id'),owner=!!dispatchUser&&request.headers.get('oai-authenticated-user-email')?.toLowerCase()===EDUCATION_OWNER,student=await chatStudent(request,env),method=request.method;
 if(!owner&&!student&&!dispatchUser)return json({error:'Sign in to access this file.'},401);
 if(!env.BUCKET)return json({error:'File storage is temporarily unavailable.'},503);
 if(url.pathname==='/api/media/upload'&&method==='POST'){
  if(request.headers.get('origin')!==url.origin)return json({error:'Request origin rejected.'},403);
  const scope=url.searchParams.get('scope'),id=request.headers.get('x-upload-id');if(!/^[a-f0-9-]{36}$/.test(id||''))return json({error:'Invalid upload identifier.'},400);
  const asOwner=owner&&request.headers.get('x-chat-role')!=='student';let target,userId,role=asOwner?'admin':'client';
  if(scope==='chat'){const studentId=asOwner?url.searchParams.get('student'):student?.id;if(!studentId)return json({error:'Choose a conversation.'},403);if(!asOwner&&url.searchParams.get('student')!==studentId)return json({error:'Conversation unavailable.'},403);target=await db(env).prepare("SELECT id,user_id FROM chat_students WHERE id=? AND status='active'").bind(studentId).first();if(!target)return json({error:'Conversation unavailable.'},403);userId=target.user_id;}
  else if(scope==='verification'&&asOwner){const key=url.searchParams.get('request');if(!key?.startsWith('education-verification:'))return json({error:'Choose a verification request.'},400);const record=await db(env).prepare('SELECT id FROM prototype_settings WHERE id=?').bind(key).first();if(!record)return json({error:'Request not found.'},404);userId=key.slice('education-verification:'.length);}
  else return json({error:'Upload unavailable.'},403);
  const old=await db(env).prepare('SELECT * FROM media_files WHERE id=?').bind(id).first();if(old){if(old.user_id!==userId||old.scope!==scope||old.role!==role||old.student_id!==(target?.id||null))return json({error:'Upload identifier conflict.'},409);return json({file:mediaDescriptor(old)});}
  if(!await chatLimit(env,'upload:'+userId+':'+role,20,3600000))return json({error:'Upload limit reached. Please try again in an hour.'},429);
  if(Number(request.headers.get('content-length'))>MEDIA_MAX)return json({error:'Files must be 25 MB or smaller.'},413);
  let bytes;try{bytes=await mediaBytes(request);}catch(error){return json({error:error.message},413);}if(!bytes.byteLength)return json({error:'Choose a non-empty file.'},400);
  const mime=mediaType(bytes,request.headers.get('content-type')||'');if(!mime||scope==='verification'&&!mime.startsWith('video/'))return json({error:scope==='verification'?'Choose an MP4 or WebM video.':'Use a JPG, PNG, GIF, WebP, MP4, WebM, MP3, WAV, OGG, M4A or PDF file.'},415);
  const used=await db(env).prepare('SELECT COALESCE(SUM(size),0) AS size FROM media_files WHERE user_id=?').bind(userId).first();if(used.size+bytes.byteLength>250*1024*1024)return json({error:'This student’s 250 MB file allowance is full.'},413);
  let name;try{name=decodeURIComponent(request.headers.get('x-file-name')||'Attachment');}catch{return json({error:'Invalid file name.'},400);}name=name.replace(/[\x00-\x1f\x7f/\\]/g,'_').slice(0,150)||'Attachment';
  const key=scope+'/'+(target?.id||await chatHash(userId))+'/'+id,now=Date.now();await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:mime}});
  try{const writes=[db(env).prepare('INSERT INTO media_files (id,storage_key,student_id,user_id,scope,role,name,mime,size,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,key,target?.id||null,userId,scope,role,name,mime,bytes.byteLength,now)];if(scope==='chat')writes.push(db(env).prepare('INSERT INTO chat_messages (id,student_id,sender,body,attachment_id,created_at) VALUES (?,?,?,?,?,?)').bind(id,target.id,role,name,id,now));await db(env).batch(writes);}catch(error){const concurrent=await db(env).prepare('SELECT id FROM media_files WHERE id=?').bind(id).first();if(!concurrent)await env.BUCKET.delete(key);throw error;}
  return json({file:mediaDescriptor({id,name,mime,size:bytes.byteLength})});
 }
 if(!['GET','HEAD'].includes(method))return json({error:'Method not allowed.'},405);
 const id=url.pathname.slice('/api/media/'.length);if(!/^[a-f0-9-]{36}$/.test(id))return json({error:'File not found.'},404);
 const file=await db(env).prepare('SELECT * FROM media_files WHERE id=?').bind(id).first();if(!file)return json({error:'File not found.'},404);
 if(!owner){if(file.scope==='chat'){if(!student||student.id!==file.student_id)return json({error:'File not found.'},404);}else{const user=student?.user_id||dispatchUser;if(user!==file.user_id)return json({error:'File not found.'},404);const record=await db(env).prepare('SELECT content FROM prototype_settings WHERE id=?').bind('education-verification:'+user).first();const v=record?JSON.parse(record.content):{};if(v.status!=='ready'||v.videoUrl!=='/api/media/'+id)return json({error:'File not found.'},404);}}
 let offset=0,end=file.size-1,partial=false;const range=request.headers.get('range');if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||!match[1]&&!match[2])return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+file.size}});if(!match[1])offset=Math.max(0,file.size-Number(match[2]));else{offset=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(end)||offset>end||offset>=file.size)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+file.size}});partial=true;}
 const object=await env.BUCKET.get(file.storage_key,partial?{range:{offset,length:end-offset+1}}:undefined);if(!object)return json({error:'File unavailable.'},404);
 const download=file.mime==='application/pdf'||url.searchParams.has('download'),headers={'Content-Type':file.mime,'Content-Length':String(partial?end-offset+1:file.size),'Accept-Ranges':'bytes','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Content-Disposition':(download?'attachment':'inline')+"; filename*=UTF-8''"+encodeURIComponent(file.name)};if(partial)headers['Content-Range']='bytes '+offset+'-'+end+'/'+file.size;return new Response(method==='HEAD'?null:object.body,{status:partial?206:200,headers});
}
