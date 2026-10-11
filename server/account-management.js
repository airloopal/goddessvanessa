const accountReasons=['Cost or financial circumstances','Taking a personal break','Not using the platform','The experience is not right for me','Privacy or another reason'];
async function accountRecord(env,id){const r=await db(env).prepare('SELECT content,revision FROM prototype_settings WHERE id=?').bind('account-life:'+id).first();return r?{...JSON.parse(r.content),revision:r.revision}:{revision:0};}
async function accountRestore(env,id){const a=await accountRecord(env,id);if(a.until&&a.until<=Date.now()&&!a.endedAt&&!['pending','approved','deleting','deleted'].includes(a.deletion)){const next={...a,endedAt:Date.now()};delete next.revision;await db(env).batch([db(env).prepare('UPDATE prototype_settings SET content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(next),new Date().toISOString(),'account-life:'+id,a.revision),db(env).prepare("UPDATE chat_students SET status='active' WHERE id=? AND status='suspended' AND EXISTS(SELECT 1 FROM prototype_settings WHERE id=? AND revision=? AND (content::jsonb->>'endedAt')::bigint=?)").bind(id,'account-life:'+id,a.revision+1,next.endedAt)]);}return a;}
async function accountIdentity(request,env){const chat=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-vanessa_student=([a-f0-9]{48})(?:;|$)/)?.[1];if(chat){const s=await db(env).prepare('SELECT s.* FROM chat_students s JOIN chat_sessions a ON a.student_id=s.id WHERE a.hash=? AND a.expires_at>?').bind(await chatHash(chat),Date.now()).first();if(s)return s;}const token=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-vanessa_account=([a-f0-9]{48})(?:;|$)/)?.[1];if(!token)return null;return db(env).prepare("SELECT s.* FROM prototype_settings p JOIN chat_students s ON s.id=p.content::jsonb->>'studentId' WHERE p.id=? AND (p.content::jsonb->>'expires')::bigint>?").bind('account-session:'+await chatHash(token),Date.now()).first();}
async function accountSave(env,id,value,revision){return revision===0?db(env).prepare('INSERT INTO prototype_settings(id,content,revision,updated_at) VALUES(?,?,1,?) ON CONFLICT(id) DO NOTHING').bind('account-life:'+id,JSON.stringify(value),new Date().toISOString()).run():squareWrite(env,'account-life:'+id,value,revision);}
async function accountManagement(request,env,url,{owner,method,body,now}){
 if(owner&&method==='GET'){const rows=await db(env).prepare("SELECT s.id,s.name,s.status,p.content,p.revision FROM chat_students s JOIN prototype_settings p ON p.id='account-life:'||s.id ORDER BY p.updated_at DESC LIMIT 200").all();return json({accounts:rows.results.map(r=>({studentId:r.id,name:r.name,status:r.status,...JSON.parse(r.content),revision:r.revision}))});}
 const s=owner?await db(env).prepare('SELECT * FROM chat_students WHERE id=?').bind(String(body.studentId||'')).first():await accountIdentity(request,env);if(!s)return json({error:'Sign in to manage your account.'},401);
 if(!owner&&(Object.keys(body).some(k=>!['action','days','revision','reason'].includes(k))||url.searchParams.size))return json({error:'Your account is selected by your session.'},400);
 const a=await accountRecord(env,s.id);
 if(method==='GET')return json({name:s.name,account:a,reasons:accountReasons,canRequest:!!a.until&&a.until<=now});
 if(method!=='POST')return json({error:'Method not allowed.'},405);
 if(!Number.isSafeInteger(body.revision)||body.revision!==a.revision)return json({error:'Account changed. Refresh before continuing.'},409);
 if(!await chatLimit(env,'account-manage:'+s.id,20,3600000))return json({error:'Please wait before trying again.'},429);
 let next={...a};delete next.revision;
 if(owner){
  if(Object.keys(body).some(k=>!['action','revision','studentId'].includes(k)))return json({error:'Invalid account action fields.'},400);
  if(body.action==='retention-payment')return accountRetentionPayment(env,s,a,now,url);
  if(!['approve','decline','reactivate'].includes(body.action))return json({error:'Choose Approve, Decline or Reactivate.'},400);
  if(body.action==='reactivate'){if(['approved','deleting'].includes(a.deletion))return json({error:'Resolve the deletion request first.'},409);next={...next,until:now,endedAt:now,deletion:'cancelled'};}
  else {if(a.deletion!=='pending')return json({error:'No pending deletion request.'},409);next.deletion=body.action==='approve'?'approved':'declined';next.decidedAt=now;}
 }else{
  if(body.action==='deactivate'){
   if(![7,14,30].includes(body.days)||s.status!=='active'||a.deletion==='approved'||a.until>now)return json({error:'Choose a 7, 14 or 30 day break from an active account.'},400);
   next={...next,startedAt:now,until:now+body.days*86400000,days:body.days,deletion:null,reason:null,offer:null,endedAt:null};
  }else if(['begin-deletion','resume','accept-offer','request-delete'].includes(body.action)){
   if(!a.until||a.until>now||['pending','approved','deleting','deleted'].includes(a.deletion))return json({error:'Wait until your deactivation period ends.'},409);
   if(body.action==='accept-offer'&&a.retentionPayment)return json({error:'Your personal retention payment has already been arranged.'},409);
   if(['accept-offer','request-delete'].includes(body.action)&&a.deletion!=='considering')return json({error:'Choose to continue with deletion before reviewing this offer.'},409);
   if(body.action==='begin-deletion')next={...next,deletion:'considering'};
   else if(body.action==='resume')next={...next,endedAt:now,deletion:'cancelled'};
   else if(body.action==='request-delete'){if(!accountReasons.includes(body.reason))return json({error:'Please choose a reason.'},400);next={...next,offer:'declined',deletion:'pending',reason:body.reason,requestedAt:now,requestId:crypto.randomUUID()};}
   else next={...next,offer:'accepted',offerAt:now,endedAt:now,deletion:'cancelled'};
  }else if(body.action==='delete'){
   if(!['approved','deleting'].includes(a.deletion)||!a.decidedAt||!a.reason||a.until>now)return json({error:'Goddess must approve your deletion request first.'},403);
   const claimed=await accountSave(env,s.id,{...next,deletion:'deleting'},a.revision);if(!claimed.meta.changes)return json({error:'Account changed. Refresh.'},409);
   await deleteChatAccount(env,s.id);const r=json({ok:true,deleted:true});r.headers.append('Set-Cookie',chatCookie('',0));r.headers.append('Set-Cookie','__Host-vanessa_account=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0');return r;
  }else return json({error:'Choose an account action.'},400);
 }
 const saved=await accountSave(env,s.id,next,a.revision);if(!saved.meta.changes)return json({error:'Account changed. Refresh.'},409);
 if(body.action==='deactivate'||body.action==='request-delete'){
  await db(env).batch([db(env).prepare("UPDATE chat_students SET status='suspended' WHERE id=?").bind(s.id),db(env).prepare('DELETE FROM chat_sessions WHERE student_id=?').bind(s.id)]);
 }else if(body.action==='reactivate'||body.action==='resume'||body.action==='accept-offer')await db(env).prepare("UPDATE chat_students SET status='active' WHERE id=?").bind(s.id).run();
 const r=json({ok:true,account:{...next,revision:a.revision+1}});
 if(!owner&&body.action==='deactivate'){const token=chatToken();await db(env).prepare('INSERT INTO prototype_settings(id,content,revision,updated_at) VALUES(?,?,1,?)').bind('account-session:'+await chatHash(token),JSON.stringify({studentId:s.id,expires:now+90*86400000}),new Date(now).toISOString()).run();r.headers.append('Set-Cookie','__Host-vanessa_account='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=7776000');r.headers.append('Set-Cookie',chatCookie('',0));}
 return r;
}

async function accountRetentionPayment(env,s,a,now,url){
 if(a.offer!=='accepted'||a.retentionPayment)return json({error:'No unused personal retention offer.'},409);
 const current=await squareRecord(env,await squareKey(env,s.user_id,'contract')),existing=await squareRecord(env,await squareKey(env,s.user_id,'support'));
 if(!current||current.status!=='paid'||existing)return json({error:'Goddess must review this account’s existing payment or extension before creating another offer.'},409);
 const {config}=await educationConfig(env),base=config.agreement.contractPlans.find(p=>p.id===current.plan.id);if(!base)return json({error:'Contract plan unavailable.'},409);
 const token=chatToken()+chatToken().slice(0,16),key=await squareKey(env,s.user_id,'support'),offer={user:s.user_id,mode:squareMode(env),stage:'support',status:'pending',plan:{...squarePriced(base,'SUB25')},retention:true,email:s.email,offerHash:await chatHash(token),offerExpiresAt:now+30*86400000,idempotencyKey:crypto.randomUUID(),createdAt:new Date(now).toISOString()};
 const next={...a,retentionPayment:key};delete next.revision;
 const result=await db(env).batch([
 db(env).prepare('UPDATE prototype_settings SET content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? RETURNING id').bind(JSON.stringify(next),new Date(now).toISOString(),'account-life:'+s.id,a.revision),
 db(env).prepare("INSERT INTO prototype_settings(id,content,revision,updated_at) SELECT ?,?,1,? WHERE EXISTS(SELECT 1 FROM prototype_settings WHERE id=? AND revision=? AND content::jsonb->>'retentionPayment'=?) ON CONFLICT(id) DO NOTHING RETURNING id").bind(key,JSON.stringify(offer),new Date(now).toISOString(),'account-life:'+s.id,a.revision+1,key)
 ]);
 if(!result[0].meta.changes||!result[1].meta.changes)return json({error:'Offer changed. Refresh before trying again.'},409);
 return json({ok:true,url:new URL('/support-payment.html',url.origin).href+'#'+token,amount:offer.plan.amount});
}

async function accountLogin(request,env,body,now){
 if(Object.keys(body).some(k=>k!=='code'))return json({error:'Enter your current Sub code.'},400);
 if(!await chatLimit(env,'account-login:'+await chatHash(request.headers.get('cf-connecting-ip')||'unknown'),20,900000))return json({error:'Too many attempts. Try again in 15 minutes.'},429);
 const code=typeof body.code==='string'?body.code.trim().toLowerCase():'';
 if(!/^[a-f0-9]{48}$/.test(code))return json({error:'Account management code is invalid.'},401);
 const s=await db(env).prepare("SELECT s.id FROM chat_students s JOIN prototype_settings p ON p.id='account-life:'||s.id WHERE s.code_hash=? AND p.content::jsonb->>'until' IS NOT NULL AND COALESCE(p.content::jsonb->>'deletion','') NOT IN ('deleting','deleted')").bind(await chatHash(code)).first();
 if(!s)return json({error:'Account management code is invalid.'},401);
 const token=chatToken();await db(env).prepare("INSERT INTO prototype_settings(id,content,revision,updated_at) SELECT ?,?,1,? WHERE EXISTS(SELECT 1 FROM chat_students WHERE id=? AND code_hash=?)").bind('account-session:'+await chatHash(token),JSON.stringify({studentId:s.id,expires:now+90*86400000}),new Date(now).toISOString(),s.id,await chatHash(code)).run();
 const r=json({ok:true});r.headers.append('Set-Cookie','__Host-vanessa_account='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=7776000');return r;
}
