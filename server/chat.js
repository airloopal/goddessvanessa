// Only the authenticated Goddess can share links; keep the destination list explicit.
const chatLinkCandidates=text=>text.match(/(?:https?:\/\/|www\.)[^\s<>]+|\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<>]*)?/gi)||[];
function chatSafeLink(value){try{const u=new URL(value.replace(/[.,!?;:)]+$/,''));return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&['throne.com','www.throne.com','houseofvanessa.com','www.houseofvanessa.com'].includes(u.hostname.toLowerCase());}catch{return false;}}
// Private learning-support conversations. Codes are random, reusable until replacement or contract expiry, and stored only as hashes.
const chatHash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const chatToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(24))).map(x=>x.toString(16).padStart(2,'0')).join('');
const chatCookie=(token,age)=>'__Host-vanessa_student='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+age;
async function chatStudent(request,env){const token=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-vanessa_student=([a-f0-9]{48})(?:;|$)/)?.[1];if(!token)return null;const student=await db(env).prepare("SELECT s.* FROM chat_students s JOIN chat_sessions a ON a.student_id=s.id WHERE a.hash=? AND a.expires_at>? AND s.status='active'").bind(await chatHash(token),Date.now()).first();return student&&await squareAccessAllowed(env,student.user_id)?student:null;}
async function chatConversationEnabled(env,id){const r=await db(env).prepare('SELECT content FROM prototype_settings WHERE id=?').bind('chat-control:'+id).first();return !r||JSON.parse(r.content).enabled!==false;}
async function chatLimit(env,key,max,period){const now=Date.now();const row=await db(env).prepare('INSERT INTO chat_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN chat_limits.expires<=? THEN 1 ELSE chat_limits.count+1 END,expires=CASE WHEN chat_limits.expires<=? THEN excluded.expires ELSE chat_limits.expires END RETURNING count').bind(key,now+period,now,now).first();return row.count<=max;}
async function chatAPI(request,env,url){
 const path=url.pathname.slice('/api/chat/'.length),method=request.method,owner=!!request.headers.get('oai-authenticated-user-id')&&request.headers.get('oai-authenticated-user-email')?.toLowerCase()===EDUCATION_OWNER&&request.headers.get('x-chat-role')!=='student',now=Date.now();
 let body={};if(!['GET','HEAD'].includes(method)){body=await educationBody(request,url,8000);if(body instanceof Response)return body;}
 if(path==='capabilities'&&method==='GET'){const response=json({email:false,codeDelivery:'platform',uploads:!!env.BUCKET,maxUploadBytes:MEDIA_MAX});response.headers.set('Set-Cookie','__Host-vanessa_probe=1; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=120');return response;}

 if(path==='session'&&method==='POST'){
  if(body.cookieProbe===true&&!/(?:^|;\s*)__Host-vanessa_probe=1(?:;|$)/.test(request.headers.get('cookie')||''))return json({error:'This browser is blocking the session cookie. Enable cookies for this site and retry. Your access code has not been used.'},400);
  const ip=request.headers.get('cf-connecting-ip')||'unknown';if(!await chatLimit(env,'login:'+await chatHash(ip),20,15*60*1000))return json({error:'Too many attempts. Try again in 15 minutes.'},429);
  const code=typeof body.code==='string'?body.code.trim().toLowerCase():'';
  if(!/^[a-f0-9]{48}$/.test(code))return json({error:'This code is invalid or has expired. Ask Goddess for a new code.'},401);
  // Check contract access and the current code before creating a fresh session.
  const student=await db(env).prepare("SELECT id,name,user_id FROM chat_students WHERE code_hash=? AND code_expires>? AND status='active'").bind(await chatHash(code),now).first();
  if(!student)return json({error:'This code is invalid or has expired. Ask Goddess for a new code.'},401);
  const deadline=await squareAccessDeadline(env,student.user_id);if(deadline<=now)return json({error:'Your contract payment is incomplete or access has expired.'},402);
  const sessionExpires=Math.min(now+30*86400000,deadline),hash=await chatHash(code),token=chatToken();
  // Hold the student row lock through session rotation. Recheck the code inside
  // the transaction so a concurrently replaced code cannot create a session.
  const issued=await db(env).batch([
   db(env).prepare("UPDATE chat_students SET code_hash=code_hash WHERE id=? AND code_hash=? AND code_expires>? AND status='active' RETURNING id").bind(student.id,hash,now),
   db(env).prepare("DELETE FROM chat_sessions WHERE student_id=? AND EXISTS(SELECT 1 FROM chat_students WHERE id=? AND code_hash=? AND code_expires>? AND status='active')").bind(student.id,student.id,hash,now),
   db(env).prepare("INSERT INTO chat_sessions(hash,student_id,expires_at) SELECT ?,id,? FROM chat_students WHERE id=? AND code_hash=? AND code_expires>? AND status='active' RETURNING student_id").bind(await chatHash(token),sessionExpires,student.id,hash,now)
  ]);
  if(!issued[2].meta.changes)return json({error:'This code is invalid or has expired. Ask Goddess for a new code.'},401);
  const response=json({student:{id:student.id,name:student.name}});response.headers.set('Set-Cookie',chatCookie(token,Math.max(0,Math.floor((sessionExpires-now)/1000))));return response;
 }
 if(path==='session'&&method==='DELETE'){const sessionStudent=await chatStudent(request,env);const token=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-vanessa_student=([a-f0-9]{48})(?:;|$)/)?.[1];if(token)await db(env).prepare('DELETE FROM chat_sessions WHERE hash=?').bind(await chatHash(token)).run();if(sessionStudent)await db(env).prepare("DELETE FROM prototype_settings WHERE content::jsonb->>'studentId'=? AND id LIKE 'site-visit:%'").bind(sessionStudent.id).run();const response=json({ok:true});response.headers.set('Set-Cookie',chatCookie('',0));return response;}
 const student=await chatStudent(request,env);
 if(path==='request-code'||path==='code-requests')return chatCodeRequests(request,env,url,{owner,student,body,method,now,path});
 if(path==='plans'&&method==='GET'){if(!student||owner)return json({error:'Open your Sub account to view contract options.'},403);const {config}=await educationConfig(env),payments=await squarePaymentState(env,student.user_id);return json({plans:config.agreement.contractPlans,current:squarePublic(payments.contract)});}
 if(path==='session'&&method==='GET')return student?json({student:{id:student.id,name:student.name,email:student.email}}):json({error:'Enter your access code to open your conversation.'},401);
 if(path==='notifications'&&method==='GET'){if(!owner)return json({error:'Goddess access required.'},403);const latest=await db(env).prepare('SELECT COALESCE(MAX(seq),0) AS seq FROM chat_messages').first();const after=Number(url.searchParams.get('after')??latest.seq);if(!Number.isSafeInteger(after)||after<0)return json({error:'Invalid notification cursor.'},400);const rows=await db(env).prepare("SELECT m.seq,m.id,m.student_id AS student_id,s.name,m.body AS text,m.attachment_id,f.mime,f.name AS file_name FROM chat_messages m JOIN chat_students s ON s.id=m.student_id LEFT JOIN media_files f ON f.id=m.attachment_id WHERE m.seq>? AND (m.sender='client' OR m.id LIKE 'throne-gift:%') ORDER BY m.seq ASC LIMIT 100").bind(after).all();const events=rows.results.map(r=>({...r,text:r.attachment_id?mediaDisplayName(r.mime||'application/pdf'):r.text,file_name:r.attachment_id?mediaDisplayName(r.mime||'application/pdf'):null,kind:r.id.startsWith('throne-gift:')?'gift':r.mime?.startsWith('image/')?'image':r.mime?.startsWith('video/')?'video':r.mime?.startsWith('audio/')?'voice':'message'}));return json({events,cursor:events.length===100?events.at(-1).seq:latest.seq});}
 if(['profile','gallery','paid-activity','visits','visitor-stats'].includes(path))return chatSupport(request,env,url,{owner,student,body,path,method,now});
 if(path==='students'){
  if(!owner)return json({error:'Goddess access required.'},403);
  if(method==='GET'){const rows=await db(env).prepare("SELECT s.id,s.name,s.email,s.status,COALESCE((SELECT (content::jsonb->>'enabled')::boolean FROM prototype_settings WHERE id='chat-control:'||s.id),true) AS conversation_enabled,s.created_at,EXISTS(SELECT 1 FROM prototype_settings WHERE id='chat-pin:'||s.id AND content::jsonb->>'pinned'='true') AS pinned,EXISTS(SELECT 1 FROM prototype_settings WHERE id LIKE 'site-visit:%' AND content::jsonb->>'studentId'=s.id AND updated_at::timestamptz>CURRENT_TIMESTAMP - INTERVAL '90 seconds') AS online,(SELECT CASE WHEN attachment_id IS NOT NULL THEN 'Shared attachment' ELSE body END FROM chat_messages WHERE student_id=s.id ORDER BY seq DESC LIMIT 1) AS last_message,(SELECT MAX(created_at) FROM chat_messages WHERE student_id=s.id) AS last_at,(SELECT snapshot::jsonb->'agreement'->'entry'->>'id' FROM education_enrolments WHERE user_id=s.user_id) AS entry_tier,(SELECT MAX(seq) FROM chat_messages WHERE student_id=s.id) AS last_seq,(SELECT COUNT(*) FROM chat_messages WHERE student_id=s.id AND sender='client' AND seq>COALESCE((SELECT MAX(read_seq) FROM chat_state WHERE student_id=s.id AND role='admin'),0)) AS unread FROM chat_students s ORDER BY pinned DESC,last_seq DESC NULLS LAST,s.created_at DESC LIMIT 200").all();return json({students:rows.results||[]});}
  if(method==='POST'){
   let record;if(body.reference)record=await db(env).prepare('SELECT user_id,name,snapshot FROM education_enrolments WHERE reference=?').bind(String(body.reference)).first();
   else if(body.studentId)record=await db(env).prepare('SELECT user_id,name,email FROM chat_students WHERE id=?').bind(String(body.studentId)).first();
   if(!record)return json({error:'Choose a saved application or sub.'},404);
   const deadline=await squareAccessDeadline(env,record.user_id);if(deadline<=now)return json({error:'The contract payment is incomplete, refunded or expired.'},402);
   const codeExpires=Math.min(253402300799000,deadline);
   const email=record.email||(record.snapshot?JSON.parse(record.snapshot).agreement?.email:'')||'';
   const code=chatToken(),id=crypto.randomUUID();const result=await db(env).prepare("INSERT INTO chat_students (id,user_id,name,email,status,code_hash,code_expires,created_at) VALUES (?,?,?,?,'active',?,?,?) ON CONFLICT(user_id) DO UPDATE SET code_hash=excluded.code_hash,code_expires=excluded.code_expires,status='active',name=excluded.name,email=excluded.email RETURNING id").bind(id,record.user_id,record.name,email,await chatHash(code),codeExpires,now).first();
   await db(env).prepare('DELETE FROM chat_sessions WHERE student_id=?').bind(result.id).run();await db(env).prepare('DELETE FROM prototype_settings WHERE id=?').bind('code-request:'+result.id).run();return json({studentId:result.id,code,expiresAt:codeExpires,email,emailSent:false,emailStatus:'platform_only'});
  }
  if(method==='PATCH'&&Object.hasOwn(body,'pinned')){if(typeof body.pinned!=='boolean'||typeof body.studentId!=='string'||! /^[a-f0-9-]{36}$/.test(body.studentId)||Object.keys(body).some(k=>!['studentId','pinned'].includes(k)))return json({error:'Choose a chat to pin.'},400);const target=await db(env).prepare('SELECT id FROM chat_students WHERE id=?').bind(body.studentId).first();if(!target)return json({error:'Sub not found.'},404);await db(env).prepare('INSERT INTO prototype_settings(id,content,revision,updated_at) VALUES(?,?,1,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,revision=prototype_settings.revision+1,updated_at=excluded.updated_at').bind('chat-pin:'+target.id,JSON.stringify({pinned:body.pinned}),new Date(now).toISOString()).run();return json({ok:true,pinned:body.pinned});}
  if(method==='PATCH'&&typeof body.conversationEnabled==='boolean'){const target=await db(env).prepare('SELECT id FROM chat_students WHERE id=?').bind(String(body.studentId||'')).first();if(!target)return json({error:'Sub not found.'},404);await db(env).prepare('INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,revision=prototype_settings.revision+1,updated_at=excluded.updated_at').bind('chat-control:'+target.id,JSON.stringify({enabled:body.conversationEnabled}),new Date(now).toISOString()).run();return json({ok:true,conversationEnabled:body.conversationEnabled});}
  if(method==='PATCH'&&['active','suspended'].includes(body.status)){const r=await db(env).prepare('UPDATE chat_students SET status=?,code_hash=NULL,code_expires=0 WHERE id=? RETURNING id').bind(body.status,String(body.studentId||'')).first();if(!r)return json({error:'Sub not found.'},404);await db(env).prepare('DELETE FROM chat_sessions WHERE student_id=?').bind(r.id).run();return json({ok:true});}
  return json({error:'Method not allowed'},405);
 }
 if(path==='presence'){
  if(!owner)return json({error:'Goddess access required.'},403);
  if(!['GET','PUT'].includes(method))return json({error:'Method not allowed'},405);
  if(method==='PUT'){
   if(body.heartbeat===true){await db(env).prepare("UPDATE prototype_settings SET content=(content::jsonb || jsonb_build_object('until',?::bigint))::text,updated_at=? WHERE id='chat-presence'").bind(now+60000,new Date(now).toISOString()).run();}
   else{if(typeof body.online!=='boolean')return json({error:'Choose Online or Offline.'},400);await db(env).prepare("INSERT INTO prototype_settings(id,content,revision,updated_at) VALUES('chat-presence',?,1,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,revision=prototype_settings.revision+1,updated_at=excluded.updated_at").bind(JSON.stringify({online:body.online,until:now+60000}),new Date(now).toISOString()).run();}
  }
  const saved=await db(env).prepare("SELECT content FROM prototype_settings WHERE id='chat-presence'").first();return json({online:saved?JSON.parse(saved.content).online===true:false});
 }
 if(path==='broadcast'){
  if(!owner)return json({error:'Goddess access required.'},403);
  if(method!=='POST')return json({error:'Method not allowed'},405);
  if(typeof body.text!=='string'||!body.text.trim()||body.text.length>1000||typeof body.id!=='string'||! /^[a-f0-9-]{36}$/.test(body.id)||chatLinkCandidates(body.text).some(x=>!chatSafeLink(x)))return json({error:'Write up to 1,000 characters using approved links only.'},400);
  if(!await chatLimit(env,'broadcast:admin',10,3600000))return json({error:'Broadcast limit reached. Try later.'},429);
  const targets=await db(env).prepare("SELECT id,user_id FROM chat_students WHERE status='active' ORDER BY id LIMIT 1000").all(),eligible=[];
  for(const t of targets.results)if(await squareAccessAllowed(env,t.user_id)&&await chatConversationEnabled(env,t.id))eligible.push(t);
  const deliveryIds=await Promise.all(eligible.map(async t=>{const h=await chatHash('broadcast:'+body.id+':'+t.id);return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20,32);}));
  await db(env).batch(eligible.map((t,i)=>db(env).prepare("INSERT INTO chat_messages(id,student_id,sender,body,created_at) VALUES(?,?,'admin',?,?) ON CONFLICT(id) DO NOTHING").bind(deliveryIds[i],t.id,body.text.trim(),now)));
  return json({ok:true,recipients:eligible.length});
 }
 if(!owner&&!student)return json({error:'Your session has ended. Please enter a new access code.'},401);
 const role=owner?'admin':'client',id=owner?(url.searchParams.get('student')||body.studentId):student.id;
 if(!id)return json({error:'Choose a conversation.'},400);
 if(!owner&&((body.studentId&&body.studentId!==id)||(url.searchParams.has('student')&&url.searchParams.get('student')!==id)))return json({error:'Conversation unavailable.'},403);
 const target=owner?await db(env).prepare('SELECT id,status FROM chat_students WHERE id=?').bind(id).first():student;
 if(!target)return json({error:'Conversation not found.'},404);
 if(path==='background'){
  if(!owner)return json({error:'Only Vanessa can change conversation backgrounds.'},403);
  if(method==='GET')return json({background:await chatBackground(env,id)});
  if(method!=='PUT')return json({error:'Method not allowed'},405);
  if((body.color!==null&&(typeof body.color!=='string'||!/^#[0-9a-f]{6}$/i.test(body.color)))||!['plain','dots','grid','emojis'].includes(body.pattern)||!Number.isInteger(body.revision)||body.revision<0)return json({error:'Choose a colour and pattern.'},400);
  const imageId=body.imageId||null,overlay=body.overlay||'burgundy';
  if(!['pink','burgundy'].includes(overlay))return json({error:'Choose a pink or burgundy overlay.'},400);
  if(imageId){const file=typeof imageId==='string'&&await db(env).prepare("SELECT id FROM media_files WHERE id=? AND student_id=? AND scope='background' AND role='admin'").bind(imageId,id).first();if(!file)return json({error:'Upload an image for this conversation.'},400);}
  const value=JSON.stringify({color:body.color,pattern:body.pattern,imageId,overlay}),key='chat-background:'+id,stamp=new Date(now).toISOString();
  const result=body.revision===0?await db(env).prepare('INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(id) DO NOTHING').bind(key,value,stamp).run():await db(env).prepare('UPDATE prototype_settings SET content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(value,stamp,key,body.revision).run();
  if(!result.meta?.changes)return json({error:'This background changed in another window. Close and reopen the background editor.'},409);
  return json({background:{color:body.color,pattern:body.pattern,imageId,overlay,revision:body.revision+1}});
 }
 if(path==='messages'&&method==='GET'){
  if(!owner)await db(env).prepare('INSERT INTO prototype_settings(id,content,revision,updated_at) VALUES(?,?,1,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at').bind('site-visit:session:'+student.id,JSON.stringify({studentId:student.id}),new Date(now).toISOString()).run();
  const before=Number(url.searchParams.get('before')||Number.MAX_SAFE_INTEGER);if(!Number.isSafeInteger(before)||before<1)return json({error:'Invalid page.'},400);
  const rows=await db(env).prepare('SELECT seq,id,sender AS "from",body AS text,created_at AS at,attachment_id FROM chat_messages WHERE student_id=? AND seq<? ORDER BY seq DESC LIMIT 100').bind(id,before).all();
  const states=await db(env).prepare('SELECT role,MAX(typing_until) AS typing_until,MAX(read_seq) AS read_seq FROM chat_state WHERE student_id=? GROUP BY role').bind(id).all();
  const p=await db(env).prepare("SELECT content FROM prototype_settings WHERE id='chat-presence'").first(),presence=p?JSON.parse(p.content):{};
  return json({background:await chatBackground(env,id),messages:await chatAttachments(env,(rows.results||[]).reverse()),hasMore:rows.results.length===100,states:states.results,online:owner?await chatSubOnline(env,id):presence.online===true&&presence.until>now,studentOnline:await chatSubOnline(env,id),status:target.status,conversationEnabled:await chatConversationEnabled(env,id)});
 }
 if(path==='messages'&&method==='POST'){
  if(!await chatConversationEnabled(env,id))return json({error:'This conversation is paused. Vanessa will enable it when ready.'},403);
  if(target.status!=='active')return json({error:'This account is suspended.'},403);
  if(typeof body.text!=='string'||!body.text.trim()||body.text.length>1000||typeof body.id!=='string'||!/^[a-f0-9-]{36}$/.test(body.id))return json({error:'Write a message of up to 1,000 characters.'},400);
  const links=chatLinkCandidates(body.text);
  if(role==='client'&&links.length)return json({error:'Links are disabled for Sub messages. Please send plain text.'},400);
  if(role==='admin'&&links.some(link=>!chatSafeLink(link)))return json({error:'Use a full HTTPS link to Throne or House of Vanessa. Other link destinations are not allowed.'},400);
  if(!await chatLimit(env,'send:'+id+':'+role,60,60000))return json({error:'Please wait a moment before sending more messages.'},429);
  let reply=null;if(body.replyTo!==undefined&&body.replyTo!==null){if(typeof body.replyTo!=='string'||body.replyTo.length>130)return json({error:'Choose a message in this conversation.'},400);reply=await db(env).prepare('SELECT id,sender AS "from",body AS text,attachment_id FROM chat_messages WHERE id=? AND student_id=?').bind(body.replyTo,id).first();if(!reply)return json({error:'Choose a message in this conversation.'},400);if(reply.attachment_id)reply.text='Shared attachment';reply={id:reply.id,from:reply.from,text:reply.text.slice(0,240)};}
  if(reply){await db(env).prepare("WITH sent AS (INSERT INTO chat_messages(id,student_id,sender,body,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING RETURNING id) INSERT INTO prototype_settings(id,content,revision,updated_at) SELECT ?,?,1,? FROM sent ON CONFLICT(id) DO NOTHING").bind(body.id,id,role,body.text.trim(),now,'chat-reply:'+body.id,JSON.stringify({studentId:id,reply}),new Date(now).toISOString()).run();}
  else await db(env).prepare('INSERT INTO chat_messages(id,student_id,sender,body,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(body.id,id,role,body.text.trim(),now).run();
  const message=await db(env).prepare('SELECT seq,id,sender AS "from",body AS text,created_at AS at,attachment_id FROM chat_messages WHERE id=? AND student_id=? AND sender=?').bind(body.id,id,role).first();
  if(!message)return json({error:'Message identifier conflict. Please retry.'},409);
  return json({message:(await chatAttachments(env,[message]))[0]});
 }
 if(path==='state'&&method==='PUT'){
  const latest=await db(env).prepare('SELECT COALESCE(MAX(seq),0) AS seq FROM chat_messages WHERE student_id=?').bind(id).first();
  const read=Number.isSafeInteger(body.readSeq)?Math.max(0,Math.min(body.readSeq,latest.seq)):0;
  // Serialized batch avoids duplicate state rows without accepting client-owned identities.
  await db(env).batch([db(env).prepare('INSERT INTO chat_state (student_id,role,typing_until,read_seq) VALUES (?,?,0,0) ON CONFLICT(student_id,role) DO NOTHING').bind(id,role),db(env).prepare('UPDATE chat_state SET typing_until=CASE WHEN ?::integer=1 THEN ?::bigint ELSE typing_until END,read_seq=GREATEST(read_seq,?::bigint) WHERE student_id=? AND role=?').bind(typeof body.typing==='boolean'?1:0,body.typing===true&&await chatConversationEnabled(env,id)?now+5000:0,read,id,role)]);return json({ok:true});
 }
 if(path==='account'&&!owner){
  if(method==='PATCH'&&body.action==='deactivate'){await db(env).batch([db(env).prepare("UPDATE chat_students SET status='suspended',code_hash=NULL,code_expires=0 WHERE id=?").bind(id),db(env).prepare('DELETE FROM chat_sessions WHERE student_id=?').bind(id)]);return json({ok:true});}
  if(method==='DELETE'&&body.confirm===true){await mediaDeleteStudent(env,id);await db(env).prepare('DELETE FROM prototype_settings WHERE id=?').bind('chat-background:'+id).run();await db(env).prepare('DELETE FROM prototype_settings WHERE id=?').bind('code-request:'+id).run();await db(env).prepare('DELETE FROM prototype_settings WHERE id=?').bind('sub-profile:'+id).run();await db(env).prepare('DELETE FROM prototype_settings WHERE id=?').bind('chat-pin:'+id).run();await db(env).prepare("DELETE FROM prototype_settings WHERE id LIKE 'chat-reply:%' AND content::jsonb->>'studentId'=?").bind(id).run();await db(env).prepare("DELETE FROM prototype_settings WHERE id LIKE 'site-visit:%' AND content::jsonb->>'studentId'=?").bind(id).run();await db(env).batch(['chat_messages','chat_state','chat_sessions'].map(table=>db(env).prepare('DELETE FROM '+table+' WHERE student_id=?').bind(id)).concat([db(env).prepare('DELETE FROM chat_students WHERE id=?').bind(id)]));const response=json({ok:true});response.headers.set('Set-Cookie',chatCookie('',0));return response;}
 }
 return json({error:'Not found'},404);
}

async function chatSubOnline(env,id){const row=await db(env).prepare("SELECT 1 AS present FROM prototype_settings WHERE id LIKE 'site-visit:%' AND content::jsonb->>'studentId'=? AND updated_at>? LIMIT 1").bind(id,new Date(Date.now()-90000).toISOString()).first();return !!row;}
 async function chatAttachments(env,messages){
  if(!messages.length)return messages;
  const ids=messages.map(m=>m.attachment_id).filter(Boolean),files=new Map();
  if(ids.length){const rows=await db(env).prepare('SELECT id,name,mime,size FROM media_files WHERE id IN ('+ids.map(()=>'?').join(',')+')').bind(...ids).all();rows.results.forEach(f=>files.set(f.id,mediaDescriptor(f)));}
  const keys=messages.map(m=>'chat-reply:'+m.id),rows=await db(env).prepare('SELECT id,content FROM prototype_settings WHERE id IN ('+keys.map(()=>'?').join(',')+')').bind(...keys).all(),replies=new Map(rows.results.map(r=>[r.id.slice(11),JSON.parse(r.content).reply]));
  return messages.map(m=>({...m,text:m.attachment_id?(files.get(m.attachment_id)?.name||'Attachment'):m.text,attachment:files.get(m.attachment_id)||null,reply:replies.get(m.id)||null}));
 }
 
// Approval records contain no plaintext codes. Collection is bound to the existing
// authenticated chat session; repeated collection can safely recover a lost response.
async function chatCodeRequests(request,env,url,{owner,student,body,method,now,path}){
 if(path==='code-requests'){
  if(!owner)return json({error:'Goddess access required.'},403);
  if(method==='GET'){
   const rows=await db(env).prepare("SELECT p.content,s.id AS student_id,s.name FROM prototype_settings p JOIN chat_students s ON p.id='code-request:' || s.id WHERE p.content::jsonb->>'status'='pending' ORDER BY p.updated_at ASC LIMIT 200").all();
   return json({requests:rows.results.map(r=>({...JSON.parse(r.content),studentId:r.student_id,name:r.name}))});
  }
  if(method!=='PATCH'||!['approved','declined'].includes(body.decision))return json({error:'Choose Approve or Decline.'},400);
  const target=await db(env).prepare('SELECT id,user_id,status FROM chat_students WHERE id=?').bind(String(body.studentId||'')).first();
  if(!target)return json({error:'Sub not found.'},404);
  if(body.decision==='approved'&&(target.status!=='active'||!await squareAccessAllowed(env,target.user_id)))return json({error:'This sub needs active paid contract access before a replacement can be approved.'},402);
  if(body.decision==='approved'&&body.issueCode===true){
   const code=chatToken(),hash=await chatHash(code),expiresAt=Math.min(253402300799000,await squareAccessDeadline(env,target.user_id));
   const issued=await db(env).prepare("WITH reviewed AS (UPDATE prototype_settings SET content=(content::jsonb || jsonb_build_object('status','issued','issuedBy','goddess','reviewedAt',?::bigint,'expiresAt',?::bigint))::text,revision=revision+1,updated_at=? WHERE id=? AND content::jsonb->>'id'=? AND content::jsonb->>'status'='pending' RETURNING content) UPDATE chat_students SET code_hash=?,code_expires=? WHERE id=? AND status='active' AND EXISTS(SELECT 1 FROM reviewed) RETURNING (SELECT content FROM reviewed) AS content").bind(now,expiresAt,new Date(now).toISOString(),'code-request:'+target.id,String(body.requestId||''),hash,expiresAt,target.id).first();
   return issued?json({request:JSON.parse(issued.content),code,expiresAt}):json({error:'This request has already been reviewed. Refresh the list.'},409);
  }
  const row=await db(env).prepare("UPDATE prototype_settings SET content=(content::jsonb || jsonb_build_object('status',?::text,'reviewedAt',?::bigint))::text,revision=revision+1,updated_at=? WHERE id=? AND content::jsonb->>'id'=? AND content::jsonb->>'status'='pending' RETURNING content").bind(body.decision,now,new Date(now).toISOString(),'code-request:'+target.id,String(body.requestId||'')).first();
  return row?json({request:JSON.parse(row.content)}):json({error:'This request has already been reviewed. Refresh the list.'},409);
 }
 if(!student||owner)return json({error:'Open your existing sub chat to request a replacement code.'},403);
 const key='code-request:'+student.id;
 const read=async()=>{const row=await db(env).prepare('SELECT content FROM prototype_settings WHERE id=?').bind(key).first();return row?JSON.parse(row.content):null;};
 if(method==='GET'){const value=await read();if(value?.status==='issued'&&!student.code_hash)value.status='used';return json({request:value});}
 if(method!=='POST')return json({error:'Method not allowed'},405);
 if(body.action==='collect'){
  const existing=await read();
  if(existing?.issuedBy==='goddess')return json({error:'Vanessa has issued your replacement and will share it privately.'},409);
  if(!existing||!['approved','issued'].includes(existing.status))return json({error:'Your replacement request needs approval first.'},409);
  if(now-existing.reviewedAt>=86400000)return json({error:'This approval expired. Request another code.'},410);
  const token=request.headers.get('cookie').match(/(?:^|;\s*)__Host-vanessa_student=([a-f0-9]{48})(?:;|$)/)[1];
  const code=(await chatHash('replacement-code:'+token+':'+existing.id)).slice(0,48),hash=await chatHash(code),expiresAt=Math.min(253402300799000,await squareAccessDeadline(env,student.user_id));
  const result=await db(env).prepare("WITH approved AS (UPDATE prototype_settings SET content=(content::jsonb || jsonb_build_object('status','issued','expiresAt',?::bigint))::text,revision=revision+1 WHERE id=? AND content::jsonb->>'id'=? AND content::jsonb->>'status'='approved' RETURNING id) UPDATE chat_students SET code_hash=?,code_expires=? WHERE id=? AND status='active' AND EXISTS(SELECT 1 FROM approved) RETURNING id").bind(expiresAt,key,existing.id,hash,expiresAt,student.id).first();
  if(!result){const current=await db(env).prepare('SELECT code_hash,code_expires FROM chat_students WHERE id=?').bind(student.id).first();if(current?.code_hash!==hash||current.code_expires<=now)return json({error:'This code has been used or replaced. Request another code.'},409);}
  return json({code,expiresAt});
 }
 const existing=await read();
 if(existing?.status==='pending'||existing?.status==='approved'&&now-existing.reviewedAt<86400000)return json({request:existing});
 if(!await chatLimit(env,'code-request:'+student.id,3,86400000))return json({error:'You can request up to three replacement codes per day. Please try again later.'},429);
 const value={id:crypto.randomUUID(),status:'pending',requestedAt:now};
 const row=await db(env).prepare("INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,revision=prototype_settings.revision+1,updated_at=excluded.updated_at WHERE prototype_settings.content::jsonb->>'status'<>'pending' AND (prototype_settings.content::jsonb->>'status'<>'approved' OR (prototype_settings.content::jsonb->>'reviewedAt')::bigint<=?) RETURNING content").bind(key,JSON.stringify(value),new Date(now).toISOString(),now-86400000).first();
 return json({request:row?JSON.parse(row.content):await read()});
}

async function chatBackground(env,id){const row=await db(env).prepare('SELECT content,revision FROM prototype_settings WHERE id=?').bind('chat-background:'+id).first();return row?{...JSON.parse(row.content),revision:row.revision}:{color:null,pattern:'dots',revision:0};}

// Owner-only support data uses the existing private schema; no public profiles.
async function chatSupport(request,env,url,{owner,student,body,path,method,now}){
 if(path==='visits'&&method==='POST'){
  if(typeof body.id!=='string'||! /^[a-f0-9-]{36}$/.test(body.id))return json({error:'Invalid visit.'},400);
  const ip=await chatHash(request.headers.get('cf-connecting-ip')||'unknown');
  if(!await chatLimit(env,'visit:'+ip,180,3600000)||!await chatLimit(env,'visits-total',20000,3600000))return json({error:'Visit limit reached.'},429);
  const key='site-visit:'+await chatHash(body.id),stamp=new Date(now).toISOString();
  await db(env).prepare('INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at').bind(key,JSON.stringify({studentId:student?.id||null,...(env.VISITOR_LOCATION?{location:env.VISITOR_LOCATION}:{})}),stamp).run();
  await db(env).prepare("UPDATE prototype_settings SET content=(content::jsonb-'location')::text WHERE id LIKE 'site-visit:%' AND updated_at<? AND jsonb_exists(content::jsonb,'location')").bind(new Date(now-90000).toISOString()).run();
  await db(env).prepare("DELETE FROM prototype_settings WHERE id LIKE 'site-visit:%' AND updated_at<?").bind(new Date(now-86400000).toISOString()).run();return json({ok:true});
 }
 if(!owner&&!(student&&path==='gallery'&&method==='GET'))return json({error:'Goddess access required.'},403);
 if(path==='visitor-stats'&&method==='GET'){
  const rows=await db(env).prepare("SELECT COUNT(*) AS visits,COUNT(*) FILTER(WHERE updated_at>?) AS online FROM prototype_settings WHERE id LIKE 'site-visit:%' AND updated_at>=?").bind(new Date(now-90000).toISOString(),new Date(new Date(now).setUTCHours(0,0,0,0)).toISOString()).first();
  const people=await db(env).prepare("SELECT DISTINCT s.id,s.name FROM prototype_settings p JOIN chat_students s ON s.id=p.content::jsonb->>'studentId' WHERE p.id LIKE 'site-visit:%' AND p.updated_at>? AND s.status='active'").bind(new Date(now-90000).toISOString()).all();const places=await db(env).prepare("SELECT COALESCE(content::jsonb->'location'->>'country','Unknown') AS country,COALESCE(content::jsonb->'location'->>'city','') AS city,COUNT(*) AS visitors FROM prototype_settings WHERE id LIKE 'site-visit:%' AND updated_at>? GROUP BY 1,2 ORDER BY visitors DESC LIMIT 50").bind(new Date(now-90000).toISOString()).all();return json({visits:Number(rows.visits),online:Number(rows.online),subs:people.results,locations:places.results,windowSeconds:90});
 }
 if(path==='paid-activity'&&method==='GET'){
  const rows=await db(env).prepare("SELECT p.id,p.content,p.updated_at,c.content AS contact,e.name,e.reference,s.id AS student_id FROM prototype_settings p LEFT JOIN prototype_settings c ON c.id='sub-contact:'||(p.content::jsonb->>'user') LEFT JOIN education_enrolments e ON e.user_id=p.content::jsonb->>'user' LEFT JOIN chat_students s ON s.user_id=p.content::jsonb->>'user' WHERE p.id LIKE ? AND p.content::jsonb->>'status' IN ('paid','refund_review') ORDER BY p.updated_at DESC LIMIT 200").bind('sq-'+squareMode(env)+'-%').all();
  return json({events:rows.results.map(row=>{const p=JSON.parse(row.content),c=row.contact?JSON.parse(row.contact):{};return {id:row.id,name:c.name||row.name||'Entry applicant',email:c.email||'',phone:c.phone||'',reference:row.reference||null,studentId:row.student_id||null,stage:p.stage,status:p.status,amount:p.plan.amount,plan:p.plan.name,at:p.paidAt||p.createdAt||row.updated_at};})});
 }
 const id=url.searchParams.get('student')||body.studentId||student?.id;
 if(!owner&&id!==student?.id)return json({error:'Conversation unavailable.'},403);
 if(typeof id!=='string'||! /^[a-f0-9-]{36}$/.test(id))return json({error:'Choose a Sub.'},400);
 const target=await db(env).prepare('SELECT id,user_id,name,email,status,created_at FROM chat_students WHERE id=?').bind(id).first();if(!target)return json({error:'Sub not found.'},404);
 if(path==='gallery'&&method==='GET'){
  const before=Number(url.searchParams.get('before')||Number.MAX_SAFE_INTEGER);if(!Number.isSafeInteger(before)||before<1)return json({error:'Invalid gallery cursor.'},400);
  const rows=await db(env).prepare("SELECT m.seq,m.sender,m.created_at,f.id,f.name,f.mime,f.size FROM chat_messages m JOIN media_files f ON f.id=m.attachment_id WHERE m.student_id=? AND m.seq<? AND f.scope='chat' ORDER BY m.seq DESC LIMIT 60").bind(id,before).all();return json({files:rows.results.map(f=>({...mediaDescriptor(f),seq:f.seq,from:f.sender,at:f.created_at})),hasMore:rows.results.length===60});
 }
 if(path==='profile'){
  const key='sub-profile:'+id;
  if(method==='PUT'){
   if(Object.keys(body).some(k=>!['studentId','notes','labels','revision'].includes(k))||typeof body.notes!=='string'||body.notes.length>4000||!Number.isSafeInteger(body.revision)||body.revision<0)return json({error:'Use notes of up to 4,000 characters.'},400);
   if(body.labels!==undefined&&(!Array.isArray(body.labels)||body.labels.length>10||body.labels.some(x=>typeof x!=='string'||!x.trim()||x.length>24)))return json({error:'Use up to 10 labels of 24 characters.'},400);
   const value=JSON.stringify({notes:body.notes,labels:[...new Set((body.labels||[]).map(x=>x.trim()))]}),stamp=new Date(now).toISOString();
   const saved=body.revision===0?await db(env).prepare('INSERT INTO prototype_settings(id,content,revision,updated_at) VALUES(?,?,1,?) ON CONFLICT(id) DO NOTHING').bind(key,value,stamp).run():await db(env).prepare('UPDATE prototype_settings SET content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(value,stamp,key,body.revision).run();
   return saved.meta.changes?json({ok:true,revision:body.revision+1}):json({error:'These notes changed in another window. Reopen the profile before saving.'},409);
  }
  if(method==='GET'){
   const row=await db(env).prepare('SELECT content,revision FROM prototype_settings WHERE id=?').bind(key).first(),contact=await db(env).prepare('SELECT content FROM prototype_settings WHERE id=?').bind('sub-contact:'+target.user_id).first(),enrol=await db(env).prepare('SELECT reference,answers,snapshot,created_at FROM education_enrolments WHERE user_id=?').bind(target.user_id).first(),payments=await squarePaymentState(env,target.user_id);
   const {user_id,...person}=target;return json({profile:{...person,online:await chatSubOnline(env,id),contact:contact?JSON.parse(contact.content):{},application:enrol?{...enrol,answers:JSON.parse(enrol.answers),snapshot:JSON.parse(enrol.snapshot)}:null,payments:{entry:squarePublic(payments.entry),contract:squarePublic(payments.contract)},notes:row?JSON.parse(row.content).notes:'',labels:row?JSON.parse(row.content).labels||[]:[],revision:row?.revision||0}});
  }
 }
 return json({error:'Method not allowed.'},405);
}
