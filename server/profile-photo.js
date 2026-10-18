// Small, private, environment-specific profile photos. No chat attachment is created.
const profilePhotoKey=(env,id)=>'sub-avatar:'+squareMode(env)+':'+id;
const profilePhotoURL=(id,version)=>/^[a-f0-9-]{36}$/.test(id||'')&&/^[a-f0-9-]{36}$/.test(version||'')?'/api/chat/profile-photo?student='+encodeURIComponent(id)+'&v='+version:null;
async function profilePhotoInfo(env,id){const row=await db(env).prepare('SELECT content,revision FROM prototype_settings WHERE id=?').bind(profilePhotoKey(env,id)).first();const photo=row?JSON.parse(row.content):null;return {row,photo,url:profilePhotoURL(id,photo?.version),revision:row?.revision||0};}
function profileJPEG(bytes){const b=new Uint8Array(bytes);if(b.length<20||b[0]!==255||b[1]!==216||b.at(-2)!==255||b.at(-1)!==217)return false;let i=2;while(i+4<b.length){if(b[i++]!==255)return false;let marker=b[i++];while(marker===255)marker=b[i++];if(marker===218||marker===217)return false;const n=(b[i]<<8)|b[i+1];if(n<2||i+n>b.length)return false;if([192,193,194].includes(marker)){if(n<8)return false;const h=(b[i+3]<<8)|b[i+4],w=(b[i+5]<<8)|b[i+6];return w>=64&&w<=512&&h===w;}i+=n;}return false;}
async function profilePhotoAPI(request,env,url){
 const method=request.method,asSub=request.headers.get('x-chat-role')==='student',owner=!asSub&&!!request.headers.get('oai-authenticated-user-id')&&request.headers.get('oai-authenticated-user-email')?.toLowerCase()===EDUCATION_OWNER,student=await chatStudent(request,env);
 if(!owner&&!student)return json({error:'Sign in to view your profile photo.'},403);
 if(!['GET','HEAD','POST','DELETE'].includes(method))return json({error:'Method not allowed.'},405);
 const keys=[...url.searchParams.keys()];if(keys.some(k=>!['student','v','meta','path','_'].includes(k)))return json({error:'Invalid photo request.'},400);
 let id=student?.id;const selected=url.searchParams.get('student');if(selected){if(!/^[a-f0-9-]{36}$/.test(selected)||!owner&&selected!==id)return json({error:'Photo not found.'},404);id=selected;}
 if(!id||!await db(env).prepare('SELECT id FROM chat_students WHERE id=?').bind(id).first())return json({error:'Photo not found.'},404);
 if(['POST','DELETE'].includes(method)){
  if(owner||!asSub||!student||selected||url.searchParams.has('meta')||url.searchParams.has('v'))return json({error:'Your photo is selected by your Sub session.'},403);
  if(request.headers.get('origin')!==url.origin)return json({error:'Request origin rejected.'},403);
 }
 const current=await profilePhotoInfo(env,id);
 if(['GET','HEAD'].includes(method)){
  if(url.searchParams.get('meta')==='1'){if(owner||selected)return json({error:'Open your own Sub profile.'},403);return json({photo:{url:current.url,revision:current.revision}});}
  if(!current.photo||!current.url)return json({error:'Photo not found.'},404);
  if(!env.BUCKET)return json({error:'Photo storage unavailable.'},503);
  if(env.BUCKET.signedRead)return new Response(null,{status:302,headers:{Location:await env.BUCKET.signedRead(current.photo.key),'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
  const object=await env.BUCKET.get(current.photo.key);if(!object)return json({error:'Photo not found.'},404);
  return new Response(method==='HEAD'?null:object.body,{headers:{'Content-Type':'image/jpeg','X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; sandbox",'Content-Disposition':'inline; filename="profile.jpg"'}});
 }
 if(!env.BUCKET)return json({error:'Photo storage unavailable.'},503);
 const revision=Number(request.headers.get('x-profile-photo-revision'));if(!/^\d+$/.test(request.headers.get('x-profile-photo-revision')||'')||!Number.isSafeInteger(revision)||revision<0||revision!==current.revision)return json({error:'Your photo changed. Reopen your profile and try again.'},409);
 if(!await chatLimit(env,'profile-photo:'+squareMode(env)+':'+student.id,20,3600000))return json({error:'Please wait before changing your photo again.'},429);
 let next={studentId:id,version:null,key:null};
 if(method==='POST'){
  if(request.headers.get('content-type')!=='image/jpeg')return json({error:'Choose a photo using the profile image picker.'},415);
  let raw;try{const reader=request.body?.getReader();if(!reader)return json({error:'Choose a photo.'},400);const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>256*1024){await reader.cancel();return json({error:'Profile photos must be 256 KB or smaller.'},413);}chunks.push(value);}raw=new Uint8Array(size);let offset=0;for(const part of chunks){raw.set(part,offset);offset+=part.length;}}catch{return json({error:'Could not read the photo.'},400);}
  if(!profileJPEG(raw))return json({error:'Use a square JPG photo between 64 and 512 pixels.'},415);
  const version=crypto.randomUUID(),key='profile-photo/'+squareMode(env)+'/'+id+'/'+version+'.jpg';next={studentId:id,version,key};await env.BUCKET.put(key,raw,{httpMetadata:{contentType:'image/jpeg'}});
 }else{const body=await educationBody(request,url,100);if(body instanceof Response)return body;if(Object.keys(body).length)return json({error:'No account selectors are accepted.'},400);}
 const stamp=new Date().toISOString();let result;
 try{result=revision===0?await db(env).prepare("INSERT INTO prototype_settings(id,content,revision,updated_at) SELECT ?,?,1,? WHERE EXISTS(SELECT 1 FROM chat_students WHERE id=? AND status='active') ON CONFLICT(id) DO NOTHING").bind(profilePhotoKey(env,id),JSON.stringify(next),stamp,id).run():await db(env).prepare("UPDATE prototype_settings SET content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM chat_students WHERE id=? AND status='active')").bind(JSON.stringify(next),stamp,profilePhotoKey(env,id),revision,id).run();}catch(error){if(next.key)await env.BUCKET.delete(next.key);throw error;}
 if(!result.meta.changes){if(next.key)await env.BUCKET.delete(next.key);return json({error:'Your photo changed. Reopen your profile and try again.'},409);}
 if(current.photo?.key){try{await env.BUCKET.delete(current.photo.key);}catch{console.error('profile_photo_cleanup_pending');}}
 return json({ok:true,photo:{url:profilePhotoURL(id,next.version),revision:revision+1}});
}
async function deleteProfilePhotos(env,id){const rows=await db(env).prepare("SELECT content FROM prototype_settings WHERE id LIKE 'sub-avatar:%' AND content::jsonb->>'studentId'=?").bind(id).all();const keys=rows.results.map(r=>JSON.parse(r.content).key).filter(Boolean);if(keys.length){if(!env.BUCKET)throw Error('Photo storage unavailable.');await env.BUCKET.delete(keys);}await db(env).prepare("DELETE FROM prototype_settings WHERE id LIKE 'sub-avatar:%' AND content::jsonb->>'studentId'=?").bind(id).run();}
