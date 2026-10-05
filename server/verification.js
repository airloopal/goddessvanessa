async function educationVerificationAPI(request,env,url,{user,email,owner}){
 const admin=url.pathname==='/api/education/verifications';
 if(!user)return json({error:'Start your application in this browser to request verification.'},401);
 if(admin&&!owner)return json({error:'Only Goddess can review verification requests.'},403);
 const key='education-verification:'+user;
 const decode=row=>row?{key:row.id,revision:row.revision,...JSON.parse(row.content)}:null;
 const mine=async()=>decode(await db(env).prepare('SELECT id,content,revision FROM prototype_settings WHERE id=?').bind(key).first());
 if(request.method==='GET'){
  if(!admin)return json({request:await mine()});
  const rows=await db(env).prepare("SELECT id,content,revision FROM prototype_settings WHERE id LIKE 'education-verification:%' ORDER BY CASE WHEN (content::jsonb->>'status')='pending' THEN 0 ELSE 1 END,updated_at DESC LIMIT 200").all();
  return json({requests:(rows.results||[]).map(decode)});
 }
 if(request.method!==(admin?'PUT':'POST'))return json({error:'Method not allowed'},405);
 const body=await educationBody(request,url,6000);if(body instanceof Response)return body;
 const now=new Date().toISOString();
 if(!admin){
  if(!await chatLimit(env,'verification:'+await chatHash(request.headers.get('cf-connecting-ip')||'unknown'),10,3600000))return json({error:'Too many requests. Try again later.'},429);
  if(typeof body.name!=='string'||!body.name.trim()||body.name.length>80)return json({error:'Enter your name or nickname (up to 80 characters).'},400);
  const {config}=await educationConfig(env);const plan=config.agreement.entryPlans.find(p=>p.id===body.entryId);
  if(!plan)return json({error:'Choose an entry plan first.'},400);
  const record={id:crypto.randomUUID(),name:body.name.trim(),email:email||null,entry:plan,status:'pending',createdAt:now,updatedAt:now,videoUrl:'',message:''};
  await db(env).prepare('INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(id) DO NOTHING').bind(key,JSON.stringify(record),now).run();
  return json({request:await mine()});
 }
 if(body.action==='close'){
  if(body.confirm!==true||typeof body.key!=='string'||!body.key.startsWith('education-verification:')||body.key.length>220||!Number.isInteger(body.revision)||body.revision<1)return json({error:'Confirm closing this verification.'},400);
  const saved=await db(env).prepare("UPDATE prototype_settings SET content=(content::jsonb || jsonb_build_object('closed',true))::text,revision=revision+1,updated_at=? WHERE id=? AND revision=?").bind(now,body.key,body.revision).run();
  return saved.meta.changes?json({ok:true}):json({error:'This request changed. Refresh before closing.'},409);
 }
 if(typeof body.key!=='string'||!body.key.startsWith('education-verification:')||body.key.length>220||!Number.isInteger(body.revision)||body.revision<1||typeof body.message!=='string'||body.message.length>2000||typeof body.videoUrl!=='string'||body.videoUrl.length>2000)return json({error:'Check the verification reply fields.'},400);
 let videoUrl;
 if(/^\/api\/media\/[a-f0-9-]{36}$/.test(body.videoUrl)){const file=await db(env).prepare('SELECT user_id,scope,mime FROM media_files WHERE id=?').bind(body.videoUrl.split('/').at(-1)).first();if(!file||file.scope!=='verification'||!file.mime.startsWith('video/')||file.user_id!==body.key.slice('education-verification:'.length))return json({error:'Choose a video uploaded for this verification request.'},400);videoUrl=body.videoUrl;}
 else{let video;try{video=new URL(body.videoUrl);}catch{return json({error:'Upload a video or use a direct HTTPS MP4 or WebM link.'},400);}if(video.protocol!=='https:'||video.username||video.password||! /\.(mp4|webm)$/i.test(video.pathname)||/[\s<>"\\]/.test(body.videoUrl))return json({error:'Use a direct HTTPS MP4 or WebM video link.'},400);videoUrl=video.href;}
 const old=decode(await db(env).prepare('SELECT id,content,revision FROM prototype_settings WHERE id=?').bind(body.key).first());if(!old)return json({error:'Request not found'},404);
 const {key:omitKey,revision:omitRevision,...record}=old;Object.assign(record,{status:'ready',videoUrl,message:body.message.trim(),updatedAt:now});
 const saved=await db(env).prepare('UPDATE prototype_settings SET content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(record),now,body.key,body.revision).run();
 if(!saved.meta?.changes)return json({error:'This request changed. Refresh before sending your reply.'},409);
 return json({request:{key:body.key,revision:body.revision+1,...record}});
}
