// Private learning-support conversations. Codes are random, single-use and stored only as hashes.
const chatHash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const chatToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(24))).map(x=>x.toString(16).padStart(2,'0')).join('');
const chatCookie=(token,age)=>'vanessa_student='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+age;
async function chatStudent(request,env){const token=request.headers.get('cookie')?.match(/(?:^|;\s*)vanessa_student=([a-f0-9]{48})(?:;|$)/)?.[1];if(!token)return null;const student=await db(env).prepare("SELECT s.* FROM chat_students s JOIN chat_sessions a ON a.student_id=s.id WHERE a.hash=? AND a.expires_at>? AND s.status='active'").bind(await chatHash(token),Date.now()).first();return student&&await squareAccessAllowed(env,student.user_id)?student:null;}
async function chatLimit(env,key,max,period){const now=Date.now();const row=await db(env).prepare('INSERT INTO chat_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN chat_limits.expires<=? THEN 1 ELSE chat_limits.count+1 END,expires=CASE WHEN chat_limits.expires<=? THEN excluded.expires ELSE chat_limits.expires END RETURNING count').bind(key,now+period,now,now).first();return row.count<=max;}
async function chatAPI(request,env,url){
 const path=url.pathname.slice('/api/chat/'.length),method=request.method,owner=!!request.headers.get('oai-authenticated-user-id')&&request.headers.get('oai-authenticated-user-email')?.toLowerCase()===EDUCATION_OWNER&&request.headers.get('x-chat-role')!=='student',now=Date.now();
 let body={};if(!['GET','HEAD'].includes(method)){body=await educationBody(request,url,8000);if(body instanceof Response)return body;}
 if(path==='capabilities'&&method==='GET')return json({email:false,codeDelivery:'platform',uploads:!!env.BUCKET,maxUploadBytes:MEDIA_MAX});

 if(path==='session'&&method==='POST'){
  const ip=request.headers.get('cf-connecting-ip')||'unknown';if(!await chatLimit(env,'login:'+await chatHash(ip),20,15*60*1000))return json({error:'Too many attempts. Try again in 15 minutes.'},429);
  const code=typeof body.code==='string'?body.code.trim().toLowerCase():'';
  if(!/^[a-f0-9]{48}$/.test(code))return json({error:'This code is invalid or has expired. Ask Goddess for a new code.'},401);
  // Atomic consumption prevents two requests from redeeming one code.
  const student=await db(env).prepare("UPDATE chat_students SET code_hash=NULL,code_expires=0 WHERE code_hash=? AND code_expires>? AND status='active' RETURNING id,name,user_id").bind(await chatHash(code),now).first();
  if(!student)return json({error:'This code is invalid or has expired. Ask Goddess for a new code.'},401);
  if(!await squareAccessAllowed(env,student.user_id))return json({error:'Your contract payment is incomplete or access has expired.'},402);
  const token=chatToken();await db(env).batch([db(env).prepare('DELETE FROM chat_sessions WHERE student_id=? OR expires_at<=?').bind(student.id,now),db(env).prepare('INSERT INTO chat_sessions (hash,student_id,expires_at) VALUES (?,?,?)').bind(await chatHash(token),student.id,now+30*86400000)]);
  const response=json({student:{id:student.id,name:student.name}});response.headers.set('Set-Cookie',chatCookie(token,30*86400));return response;
 }
 if(path==='session'&&method==='DELETE'){const token=request.headers.get('cookie')?.match(/(?:^|;\s*)vanessa_student=([a-f0-9]{48})(?:;|$)/)?.[1];if(token)await db(env).prepare('DELETE FROM chat_sessions WHERE hash=?').bind(await chatHash(token)).run();const response=json({ok:true});response.headers.set('Set-Cookie',chatCookie('',0));return response;}
 const student=await chatStudent(request,env);
 if(path==='request-code'||path==='code-requests')return chatCodeRequests(request,env,url,{owner,student,body,method,now,path});
 if(path==='session'&&method==='GET')return student?json({student:{id:student.id,name:student.name,email:student.email}}):json({error:'Enter your access code to open your conversation.'},401);
 if(path==='students'){
  if(!owner)return json({error:'Goddess access required.'},403);
  if(method==='GET'){const rows=await db(env).prepare("SELECT s.id,s.name,s.email,s.status,s.created_at,(SELECT body FROM chat_messages WHERE student_id=s.id ORDER BY seq DESC LIMIT 1) AS last_message,(SELECT MAX(seq) FROM chat_messages WHERE student_id=s.id) AS last_seq,(SELECT COUNT(*) FROM chat_messages WHERE student_id=s.id AND sender='client' AND seq>COALESCE((SELECT MAX(read_seq) FROM chat_state WHERE student_id=s.id AND role='admin'),0)) AS unread FROM chat_students s ORDER BY last_seq DESC NULLS LAST,s.created_at DESC LIMIT 200").all();return json({students:rows.results||[]});}
  if(method==='POST'){
   let record;if(body.reference)record=await db(env).prepare('SELECT user_id,name,snapshot FROM education_enrolments WHERE reference=?').bind(String(body.reference)).first();
   else if(body.studentId)record=await db(env).prepare('SELECT user_id,name,email FROM chat_students WHERE id=?').bind(String(body.studentId)).first();
   if(!record)return json({error:'Choose a saved application or student.'},404);
   if(!await squareAccessAllowed(env,record.user_id))return json({error:'The contract payment is incomplete, refunded or expired.'},402);
   const email=record.email||JSON.parse(record.snapshot).agreement?.email;if(!email)return json({error:'This application needs an email address.'},400);
   const code=chatToken(),id=crypto.randomUUID();const result=await db(env).prepare("INSERT INTO chat_students (id,user_id,name,email,status,code_hash,code_expires,created_at) VALUES (?,?,?,?,'active',?,?,?) ON CONFLICT(user_id) DO UPDATE SET code_hash=excluded.code_hash,code_expires=excluded.code_expires,status='active',name=excluded.name,email=excluded.email RETURNING id").bind(id,record.user_id,record.name,email,await chatHash(code),now+86400000,now).first();
   await db(env).prepare('DELETE FROM chat_sessions WHERE student_id=?').bind(result.id).run();await db(env).prepare('DELETE FROM prototype_settings WHERE id=?').bind('code-request:'+result.id).run();return json({studentId:result.id,code,expiresAt:now+86400000,email,emailSent:false,emailStatus:'platform_only'});
  }
  if(method==='PATCH'&&['active','suspended'].includes(body.status)){const r=await db(env).prepare('UPDATE chat_students SET status=?,code_hash=NULL,code_expires=0 WHERE id=? RETURNING id').bind(body.status,String(body.studentId||'')).first();if(!r)return json({error:'Student not found.'},404);await db(env).prepare('DELETE FROM chat_sessions WHERE student_id=?').bind(r.id).run();return json({ok:true});}
  return json({error:'Method not allowed'},405);
 }
 if(path==='presence'&&method==='PUT'){if(!owner)return json({error:'Goddess access required.'},403);await db(env).prepare("INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES ('chat-presence',?,1,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at").bind(JSON.stringify({online:body.online===true,until:now+60000}),new Date(now).toISOString()).run();return json({ok:true});}
 if(!owner&&!student)return json({error:'Your session has ended. Please enter a new access code.'},401);
 const role=owner?'admin':'client',id=owner?(url.searchParams.get('student')||body.studentId):student.id;
 if(!id)return json({error:'Choose a conversation.'},400);
 if(!owner&&((body.studentId&&body.studentId!==id)||(url.searchParams.has('student')&&url.searchParams.get('student')!==id)))return json({error:'Conversation unavailable.'},403);
 const target=owner?await db(env).prepare('SELECT id,status FROM chat_students WHERE id=?').bind(id).first():student;
 if(!target)return json({error:'Conversation not found.'},404);
 if(path==='messages'&&method==='GET'){
  const before=Number(url.searchParams.get('before')||Number.MAX_SAFE_INTEGER);if(!Number.isSafeInteger(before)||before<1)return json({error:'Invalid page.'},400);
  const rows=await db(env).prepare('SELECT seq,id,sender AS "from",body AS text,created_at AS at,attachment_id FROM chat_messages WHERE student_id=? AND seq<? ORDER BY seq DESC LIMIT 100').bind(id,before).all();
  const states=await db(env).prepare('SELECT role,MAX(typing_until) AS typing_until,MAX(read_seq) AS read_seq FROM chat_state WHERE student_id=? GROUP BY role').bind(id).all();
  const p=await db(env).prepare("SELECT content FROM prototype_settings WHERE id='chat-presence'").first(),presence=p?JSON.parse(p.content):{};
  return json({messages:await chatAttachments(env,(rows.results||[]).reverse()),hasMore:rows.results.length===100,states:states.results,online:presence.online===true&&presence.until>now,status:target.status});
 }
 if(path==='messages'&&method==='POST'){
  if(target.status!=='active')return json({error:'This account is suspended.'},403);
  if(typeof body.text!=='string'||!body.text.trim()||body.text.length>1000||typeof body.id!=='string'||!/^[a-f0-9-]{36}$/.test(body.id))return json({error:'Write a message of up to 1,000 characters.'},400);
  if(!await chatLimit(env,'send:'+id+':'+role,60,60000))return json({error:'Please wait a moment before sending more messages.'},429);
  const r=await db(env).prepare('INSERT INTO chat_messages (id,student_id,sender,body,created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(body.id,id,role,body.text.trim(),now).run();
  const message=await db(env).prepare('SELECT seq,id,sender AS "from",body AS text,created_at AS at,attachment_id FROM chat_messages WHERE id=? AND student_id=? AND sender=?').bind(body.id,id,role).first();
  if(!message)return json({error:'Message identifier conflict. Please retry.'},409);return json({message});
 }
 if(path==='state'&&method==='PUT'){
  const latest=await db(env).prepare('SELECT COALESCE(MAX(seq),0) AS seq FROM chat_messages WHERE student_id=?').bind(id).first();
  const read=Number.isSafeInteger(body.readSeq)?Math.max(0,Math.min(body.readSeq,latest.seq)):0;
  // Serialized batch avoids duplicate state rows without accepting client-owned identities.
  await db(env).batch([db(env).prepare('INSERT INTO chat_state (student_id,role,typing_until,read_seq) VALUES (?,?,0,0) ON CONFLICT(student_id,role) DO NOTHING').bind(id,role),db(env).prepare('UPDATE chat_state SET typing_until=CASE WHEN ?::integer=1 THEN ?::bigint ELSE typing_until END,read_seq=GREATEST(read_seq,?::bigint) WHERE student_id=? AND role=?').bind(typeof body.typing==='boolean'?1:0,body.typing===true?now+5000:0,read,id,role)]);return json({ok:true});
 }
 if(path==='account'&&!owner){
  if(method==='PATCH'&&body.action==='deactivate'){await db(env).batch([db(env).prepare("UPDATE chat_students SET status='suspended',code_hash=NULL,code_expires=0 WHERE id=?").bind(id),db(env).prepare('DELETE FROM chat_sessions WHERE student_id=?').bind(id)]);return json({ok:true});}
  if(method==='DELETE'&&body.confirm===true){await mediaDeleteStudent(env,id);await db(env).prepare('DELETE FROM prototype_settings WHERE id=?').bind('code-request:'+id).run();await db(env).batch(['chat_messages','chat_state','chat_sessions'].map(table=>db(env).prepare('DELETE FROM '+table+' WHERE student_id=?').bind(id)).concat([db(env).prepare('DELETE FROM chat_students WHERE id=?').bind(id)]));const response=json({ok:true});response.headers.set('Set-Cookie',chatCookie('',0));return response;}
 }
 return json({error:'Not found'},404);
}

async function chatAttachments(env,messages){const ids=messages.map(m=>m.attachment_id).filter(Boolean);if(!ids.length)return messages;const rows=await db(env).prepare('SELECT id,name,mime,size FROM media_files WHERE id IN ('+ids.map(()=>'?').join(',')+')').bind(...ids).all();const files=new Map(rows.results.map(f=>[f.id,mediaDescriptor(f)]));return messages.map(m=>({...m,attachment:files.get(m.attachment_id)||null}));}

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
  if(!target)return json({error:'Student not found.'},404);
  if(body.decision==='approved'&&(target.status!=='active'||!await squareAccessAllowed(env,target.user_id)))return json({error:'This student needs active paid contract access before a replacement can be approved.'},402);
  const row=await db(env).prepare("UPDATE prototype_settings SET content=(content::jsonb || jsonb_build_object('status',?::text,'reviewedAt',?::bigint))::text,revision=revision+1,updated_at=? WHERE id=? AND content::jsonb->>'id'=? AND content::jsonb->>'status'='pending' RETURNING content").bind(body.decision,now,new Date(now).toISOString(),'code-request:'+target.id,String(body.requestId||'')).first();
  return row?json({request:JSON.parse(row.content)}):json({error:'This request has already been reviewed. Refresh the list.'},409);
 }
 if(!student||owner)return json({error:'Open your existing student chat to request a replacement code.'},403);
 const key='code-request:'+student.id;
 const read=async()=>{const row=await db(env).prepare('SELECT content FROM prototype_settings WHERE id=?').bind(key).first();return row?JSON.parse(row.content):null;};
 if(method==='GET'){const value=await read();if(value?.status==='issued'&&!student.code_hash)value.status='used';return json({request:value});}
 if(method!=='POST')return json({error:'Method not allowed'},405);
 if(body.action==='collect'){
  const existing=await read();
  if(!existing||!['approved','issued'].includes(existing.status))return json({error:'Your replacement request needs approval first.'},409);
  if(now-existing.reviewedAt>=86400000)return json({error:'This approval expired. Request another code.'},410);
  const token=request.headers.get('cookie').match(/(?:^|;\s*)vanessa_student=([a-f0-9]{48})(?:;|$)/)[1];
  const code=(await chatHash('replacement-code:'+token+':'+existing.id)).slice(0,48),hash=await chatHash(code),expiresAt=existing.reviewedAt+86400000;
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
