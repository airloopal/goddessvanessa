// Private transactional notification outbox. No card data, access codes or attachments.
const noticeEmail=value=>typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)&&!/[\r\n]/.test(value);
const noticeEnabled=env=>env.TRANSACTIONAL_EMAIL_ENABLED==='true'&&emailReady(env)&&env.SQUARE_ENVIRONMENT==='production';
const noticeOrigin=env=>{try{const u=new URL(env.SQUARE_SITE_URL);return u.protocol==='https:'&&['houseofvanessa.com','www.houseofvanessa.com'].includes(u.hostname)?u.origin:null;}catch{return null;}};
async function notifyEvent(env,kind,key,data){const id='notice:'+await chatHash(kind+':'+key),now=Date.now();await db(env).prepare('INSERT INTO prototype_settings(id,content,revision,updated_at) VALUES(?,?,1,?) ON CONFLICT(id) DO NOTHING').bind(id,JSON.stringify({kind,...data,createdAt:now,state:'pending',attempts:0}),new Date(now).toISOString()).run();}
async function noticeUnread(env,now=Date.now(),enqueue=true){
 const rows=await db(env).prepare("SELECT s.id,s.name,s.email,s.user_id,m.sender,MIN(m.created_at) AS oldest,MAX(m.seq) AS latest,COALESCE(st.read_seq,0) AS read_seq FROM chat_students s JOIN chat_messages m ON m.student_id=s.id LEFT JOIN chat_state st ON st.student_id=s.id AND st.role=CASE WHEN m.sender='client' THEN 'admin' ELSE 'client' END WHERE s.status='active' AND m.seq>COALESCE(st.read_seq,0) GROUP BY s.id,s.name,s.email,s.user_id,m.sender,st.read_seq HAVING MIN(m.created_at)<=? ORDER BY MIN(m.created_at) LIMIT 100").bind(now-300000).all();
 if(enqueue)for(const row of rows.results)await notifyEvent(env,'unread',row.id+':'+row.sender+':'+row.read_seq,{studentId:row.id,recipient:row.sender==='client'?'admin':'client',readSeq:row.read_seq,seq:row.latest});
 return rows.results;
}
async function noticeExpiry(env,now=Date.now()){
 const rows=await db(env).prepare("SELECT s.id,s.email,s.name,s.user_id,p.content FROM chat_students s JOIN prototype_settings p ON p.content::jsonb->>'user'=s.user_id AND p.content::jsonb->>'stage'='contract' WHERE s.status='active' AND p.id LIKE 'sq-production-c-%' AND p.content::jsonb->>'status'='paid' AND p.content::jsonb->>'expiresAt' IS NOT NULL LIMIT 500").all();
 for(const row of rows.results){const p=JSON.parse(row.content),end=Date.parse(p.expiresAt),remaining=end-now,total=end-Date.parse(p.paidAt);if(remaining<=0)continue;const threshold=remaining<=3600000?'1h':remaining<=86400000&&total>86400000?'24h':remaining<=7*86400000&&total>7*86400000?'7d':null;if(threshold)await notifyEvent(env,'expiry',row.id+':'+p.expiresAt+':'+threshold,{studentId:row.id,expiresAt:p.expiresAt,threshold});}
}
async function noticePayload(env,n){
 const origin=noticeOrigin(env);if(!origin)return null;
 let student=n.studentId?await db(env).prepare('SELECT id,user_id,name,email,status FROM chat_students WHERE id=?').bind(n.studentId).first():null;
 if(n.studentId&&(!student||student.status!=='active'))return null;
 let to=n.email||student?.email,subject='House of Vanessa · Account update',body='';
 if(n.kind==='unread'){
  const sender=n.recipient==='admin'?'client':'admin',state=await db(env).prepare('SELECT read_seq FROM chat_state WHERE student_id=? AND role=?').bind(student.id,n.recipient).first();if((state?.read_seq||0)>=n.seq)return null;
  const m=await db(env).prepare('SELECT body,attachment_id,created_at FROM chat_messages WHERE student_id=? AND sender=? AND seq>? AND seq<=? ORDER BY seq DESC LIMIT 1').bind(student.id,sender,state?.read_seq||0,n.seq).first();if(!m)return null;
  to=n.recipient==='admin'?env.ADMIN_NOTIFICATION_EMAIL:student.email;
  const preview=m.attachment_id?'Shared attachment':m.body.replace(/[\r\n\t]+/g,' ').slice(0,120);
  subject='House of Vanessa · Unread message';body='You have an unread message'+(n.recipient==='admin'?' from '+student.name:' from Goddess Vanessa')+'.\n\n'+preview+'\n\nOpen your conversation: '+origin+(n.recipient==='admin'?'/dashboard.html':'/chat.html');
 }else if(n.kind==='expiry'){
  const {contract}=await squarePaymentState(env,student.user_id);if(contract?.status!=='paid'||contract.expiresAt!==n.expiresAt||Date.parse(n.expiresAt)<=Date.now())return null;
  subject='House of Vanessa · Your contract is ending soon';body='Your contract ends '+new Date(n.expiresAt).toISOString()+'.\n\nChoose a plan to renew or extend your access. There is no automatic charge.\n\n'+origin+'/plans.html';
 }else{const labels={payment:'Payment confirmed',application:'Application received',access:'Chat access ready',renewal:'Contract extended'};subject='House of Vanessa · '+(labels[n.kind]||'Account update');body=(labels[n.kind]||'Account update')+'.'+(n.plan?'\n\nPlan: '+n.plan:'')+(n.expiresAt?'\nAccess ends: '+n.expiresAt:'')+'\n\n'+origin+(n.kind==='access'?'/access.html':n.kind==='renewal'?'/plans.html':'/application.html');}
 if(!noticeEmail(to))return null;
 return {from:env.EMAIL_FROM,to:[to],subject,text:body+'\n\nThis is a transactional account notification. Your private access code is never included.'};
}
async function noticeDispatch(env){
 if(!noticeEnabled(env))return {enabled:false,sent:0};
 const abandoned=await db(env).prepare("SELECT id,content,revision FROM prototype_settings WHERE id LIKE 'notice:%' AND content::jsonb->>'state'='sending' AND updated_at<? LIMIT 20").bind(new Date(Date.now()-120000).toISOString()).all();for(const row of abandoned.results){const n=JSON.parse(row.content);await db(env).prepare('UPDATE prototype_settings SET content=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify({...n,state:Date.now()-n.createdAt<20*3600000?'pending':'review'}),row.id,row.revision).run();}
 await noticeUnread(env);await noticeExpiry(env);
 const rows=await db(env).prepare("SELECT id,content,revision FROM prototype_settings WHERE id LIKE 'notice:%' AND content::jsonb->>'state'='pending' ORDER BY updated_at LIMIT 20").all();let sent=0;const stopAt=Date.now()+20000;
 for(const row of rows.results){if(Date.now()>stopAt)break;const n=JSON.parse(row.content);if(n.nextAttempt&&n.nextAttempt>Date.now())continue;const payload=await noticePayload(env,n);if(!payload){await db(env).prepare('UPDATE prototype_settings SET content=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify({...n,state:'skipped'}),row.id,row.revision).run();continue;}
  const claimed={...n,state:'sending',payload:n.payload||payload,startedAt:Date.now(),attempts:n.attempts+1};const locked=await db(env).prepare('UPDATE prototype_settings SET content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(claimed),new Date().toISOString(),row.id,row.revision).run();if(!locked.meta.changes)continue;
  // Resend idempotency is valid for 24h; uncertain sends are never retried outside it.
  let state='review';try{const response=await (env.EMAIL_FETCH||fetch)('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':row.id},body:JSON.stringify(claimed.payload),signal:AbortSignal.timeout(10000)});if(response.ok&&(await response.json()).id){state='accepted';sent++;}else if(response.status===429||response.status>=500)state='pending';}catch{state='pending';}
  if(claimed.attempts>=5||Date.now()-claimed.createdAt>20*3600000&&state==='pending')state='review';
  const {payload:discard,...safe}=claimed;await db(env).prepare('UPDATE prototype_settings SET content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify({...safe,...(state==='pending'?{payload:claimed.payload}:{}),state,nextAttempt:Date.now()+60000}),new Date().toISOString(),row.id,row.revision+1).run();
 }
 return {enabled:true,sent};
}
async function notificationAPI(request,env,url){
 if(url.pathname==='/api/cron/notifications'){
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  if(typeof env.CRON_SECRET!=='string'||env.CRON_SECRET.length<32||request.headers.get('authorization')!=='Bearer '+env.CRON_SECRET)return json({error:'Unauthorized'},401);
  return json(await noticeDispatch(env));
 }
 const owner=!!request.headers.get('oai-authenticated-user-id')&&request.headers.get('oai-authenticated-user-email')?.toLowerCase()===EDUCATION_OWNER&&request.headers.get('x-chat-role')!=='student';if(!owner)return json({error:'Goddess access required'},403);if(request.method!=='GET')return json({error:'Method not allowed'},405);
 const unread=await noticeUnread(env,Date.now(),false);const rows=await db(env).prepare("SELECT id,content FROM prototype_settings WHERE id LIKE 'notice:%' ORDER BY updated_at DESC LIMIT 60").all();
 return json({emailReady:noticeEnabled(env),events:rows.results.map(r=>{const n=JSON.parse(r.content);return {id:r.id,kind:n.kind,studentId:n.studentId||null,at:n.createdAt,state:n.state,plan:n.plan||null,expiresAt:n.expiresAt||null};}),unread:unread.filter(r=>r.sender==='client').map(r=>({studentId:r.id,name:r.name,at:r.oldest})),schedulerReady:typeof env.CRON_SECRET==='string'&&env.CRON_SECRET.length>=32});
}
