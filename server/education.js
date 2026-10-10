const EDUCATION_OWNER='danielvernontp@gmail.com';
// A private browser capability for applications, never a chat login.
async function applicationUser(request,env){if(request.headers.get('x-education-invite')==='contract')return env?contractInviteSession(request,env):null;const token=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-vanessa_application=([a-f0-9]{48})(?:;|$)/)?.[1];if(!token)return null;const hash=await chatHash(token);if(env){const session=await squareRecord(env,'application-recovery-session:'+hash);if(session){const recovery=await squareRecord(env,session.recoveryKey);return session.expiresAt>Date.now()&&recovery?.status==='active'&&recovery.expiresAt>Date.now()?recovery.user:null;}}return 'application:'+hash;}
async function educationConfig(env,which='published'){const row=await db(env).prepare('SELECT content,revision,updated_at FROM prototype_settings WHERE id = ?').bind('education-'+which).first();return {config:educationWithAgreement(row?JSON.parse(row.content):EDUCATION_DEFAULTS),revision:row?.revision||0,updatedAt:row?.updated_at||null};}
async function educationAPI(request,env,url){
 if(url.pathname==='/api/education/contract-invitation')return redeemContractInvite(request,env,url);
 const path=url.pathname,dispatchUser=request.headers.get('oai-authenticated-user-id'),dispatchEmail=request.headers.get('oai-authenticated-user-email'),owner=!!dispatchUser&&dispatchEmail?.toLowerCase()===EDUCATION_OWNER;
 if(path==='/api/education/payment-status')return adminPaymentsAPI(request,env,owner);
 if(path==='/api/education/individual-contracts')return contractEditorAPI(request,env,url,owner);
 if(path==='/api/education/application-recovery')return applicationRecovery(request,env,url,owner);
 const codeStudent=owner?null:await chatStudent(request,env),applicant=await applicationUser(request,env),applicationContext=request.headers.get('x-education-context')==='application';
 // Application pages use their own host-only capability, never an unrelated chat session.
 const user=applicationContext&&(!owner||request.headers.get('x-education-invite')==='contract')?applicant:codeStudent?.user_id||dispatchUser||applicant,email=applicationContext&&!owner?null:codeStudent?.email||dispatchEmail;
 if(path==='/api/education/application-session'){
  if(request.headers.get('x-education-invite')==='contract'&&!applicant)return json({error:'Reopen your private contract invitation to continue.'},403);
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  const body=await educationBody(request,url,1000);if(body instanceof Response)return body;
  if(!await chatLimit(env,'application-session:'+await chatHash(request.headers.get('cf-connecting-ip')||'unknown'),30,3600000))return json({error:'Too many requests. Try again later.'},429);
  const response=json({ok:true});response.headers.set('Cache-Control','private, no-store');
  if(!applicant)response.headers.set('Set-Cookie','__Host-vanessa_application='+chatToken()+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=2592000');
  return response;
 }
 if(path==='/api/education/application-progress')return applicationProgress(request,env,url,{applicant,applicationContext,owner});
 if(path==='/api/education/application-resume-link')return applicationResumeLink(request,env,url,{applicant,applicationContext,owner});
 if(path==='/api/education/application-funnel')return applicationFunnel(request,env,url,{owner,applicant});
 if(path==='/api/education/identity'&&request.method==='GET')return json({signedIn:!applicationContext&&!!(codeStudent||dispatchUser),application:!!user,applicationInProgress:!!applicant&&applicant!==codeStudent?.user_id,owner,email:email||null});
 if(['/api/education/verification','/api/education/verifications'].includes(path))return educationVerificationAPI(request,env,url,{user,email,owner});
 if(path.startsWith('/api/education/payments'))return squareAPI(request,env,url,{user,owner});
 const which=path.split('/').at(-1);
 if(path==='/api/education/published'||path==='/api/education/draft'){
  if(!(which==='published'&&request.method==='GET')&&!owner)return json({error:'Sign in with the Goddess account to edit or publish courses.'},403);
  if(request.method==='GET'){const published=await educationConfig(env,which);if(which==='published'&&request.headers.get('x-education-invite')==='contract'&&!applicant)return json({error:'Invitation unavailable.'},403);if(which==='published'&&applicationContext&&applicant)return json(await individualContractConfig(env,applicant,published));return json(published);}
  if(request.method!=='PUT')return json({error:'Method not allowed'},405);
  const p=await educationBody(request,url,400000);if(p instanceof Response)return p;
  if(!Number.isInteger(p.revision)||p.revision<0||!validEducation(p.config))return json({error:educationSettingsErrors(p.config)[0]||'Check the fields: keep at least one path and lesson, use unique answer options, and supply a valid HTTPS URL for video blocks.'},400);
  const stamp=new Date().toISOString(),key='education-'+which,data=JSON.stringify(p.config);
  const r=p.revision===0?await db(env).prepare('INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(id) DO NOTHING').bind(key,data,stamp).run():await db(env).prepare('UPDATE prototype_settings SET content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(data,stamp,key,p.revision).run();
  return r.meta?.changes?json({revision:p.revision+1,updatedAt:stamp}):json({error:'Someone saved a newer version. Export your changes, then reload before saving.'},409);
 }
 if(path==='/api/education/enrolments'){
  if(!owner)return json({error:'Only Goddess can view learner records.'},403);
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  const rows=await db(env).prepare("SELECT e.user_id,e.reference,e.name,e.path_id,e.snapshot,e.completed,e.created_at,e.updated_at,b.content::jsonb->>'bio' AS bio FROM education_enrolments e LEFT JOIN chat_students s ON s.user_id=e.user_id LEFT JOIN prototype_settings b ON b.id='sub-bio:'||s.id ORDER BY e.updated_at DESC LIMIT 200").all();
  return json({enrolments:await Promise.all((rows.results||[]).map(async r=>{const {user_id,...record}=r;const payments=squareMode(env)==='off'?null:await squarePaymentState(env,user_id);return {...record,snapshot:JSON.parse(r.snapshot),completed:JSON.parse(r.completed),payments:payments?{entry:squareAdminPayment(payments.entry),contract:squareAdminPayment(payments.contract)}:null};}))});
 }
 if(path!=='/api/education/enrolment'&&path!=='/api/education/progress')return json({error:'Not found'},404);
 if(!user)return json({error:'Start your application in this browser before saving.'},401);
 const read=async()=>{const r=await db(env).prepare('SELECT reference,name,path_id,answers,snapshot,completed,created_at,updated_at FROM education_enrolments WHERE user_id=?').bind(user).first();return r?{...r,answers:JSON.parse(r.answers),snapshot:JSON.parse(r.snapshot),completed:JSON.parse(r.completed)}:null;};
 if(request.method==='GET')return json({enrolment:await read()});
 if(request.method!=='PUT')return json({error:'Method not allowed'},405);
 const p=await educationBody(request,url,20000);if(p instanceof Response)return p;
 if(path==='/api/education/enrolment'&&!await chatLimit(env,'application-submit:'+await chatHash(request.headers.get('cf-connecting-ip')||'unknown'),20,3600000))return json({error:'Too many submissions. Try again later.'},429);
 const {config,revision,individualRevision}=await individualContractConfig(env,user,await educationConfig(env));
 const now=new Date().toISOString();
 if(path==='/api/education/progress'){
  if(!owner&&!await squareAccessAllowed(env,user))return json({error:'Your paid access is unavailable or has expired.'},402);
  if(!config.features.progress)return json({error:'Lesson completion is currently turned off.'},400);
  if(typeof p.completed!=='boolean'||!config.lessons.some(l=>l.id===p.lessonId))return json({error:'Choose a current lesson.'},400);
  const existing=await read();if(!existing)return json({error:'Enrol before saving lesson progress.'},409);
  // Apply one lesson change atomically, so separate tabs cannot overwrite one another.
  if(p.completed)await db(env).prepare("UPDATE education_enrolments SET completed=CASE WHEN completed::jsonb @> jsonb_build_array(?::text) THEN completed ELSE (completed::jsonb || jsonb_build_array(?::text))::text END,updated_at=? WHERE user_id=?").bind(p.lessonId,p.lessonId,now,user).run();
  else await db(env).prepare("UPDATE education_enrolments SET completed=(SELECT COALESCE(jsonb_agg(value),'[]'::jsonb)::text FROM jsonb_array_elements_text(education_enrolments.completed::jsonb) AS items(value) WHERE value<>?),updated_at=? WHERE user_id=?").bind(p.lessonId,now,user).run();
  return json({enrolment:await read()});
 }
 if(!p.review||p.review.revision!==revision)return json({error:'Application settings changed. Load the updated version and review it before confirming.',code:'settings_changed'},409);
 if(typeof p.name!=='string'||p.name.trim().length<2||p.name.length>100||!config.paths.some(x=>x.id===p.pathId)||p.accepted!==true||!p.answers||typeof p.answers!=='object'||Array.isArray(p.answers))return json({error:'Enter your name, choose a learning path and confirm your enrolment.'},400);
 const grant=await contractEntryGrant(env,user),invited=grant?.contractId==='month'&&grant?.promoCode==='SUB50'&&grant?.skipQuestions===true;
 if(invited&&((p.review.individualRevision||0)!==individualRevision||(grant.agreementRevision||0)!==individualRevision))return json({error:'Your individual agreement changed. Reload and review it again.',code:'settings_changed'},409);
 if(invited&&(p.review.contractId!=='month'||p.review.promoCode!=='SUB50'))return json({error:'This invitation is for the monthly contract with SUB50.'},400);
 const answerKeys=Object.keys(p.answers);if(answerKeys.some(k=>!config.questions.some(q=>q.id===k)))return json({error:'The questionnaire changed. Please reload and review your answers.'},409);
 if(!invited&&config.features.questionnaire&&config.questions.some(q=>!validEducationAnswer(q,p.answers[q.id])))return json({error:'Choose at least one current option for each question.'},400);
 if(!config.features.questionnaire&&answerKeys.length)return json({error:'The questionnaire is currently disabled.'},400);
 if(squareMode(env)!=='off'){const {entry,contract}=await squarePaymentState(env,user);if(!entryEntitled(entry)||entry.plan.id!==p.review.entryId)return json({error:'Complete your entry payment before submitting the application.'},402);if(contract)return json({error:'Your contract checkout is already saved. Complete that checkout or contact the academy to amend it.'},409);}
 const review=p.review;
 if(!review||review.revision!==revision)return json({error:'The agreement or rates changed. Reload and review the current version before confirming.'},409);
 let entry=config.agreement.entryPlans.find(x=>x.id===review.entryId),contract=config.agreement.contractPlans.find(x=>x.id===review.contractId);
 if(!entry||!contract||typeof review.email!=='string'||review.email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(review.email)||typeof review.signature!=='string'||review.signature.trim()!==p.name.trim()||review.ageConfirmed!==true||review.aupAccepted!==true||review.read!==true||review.entryReviewed!==true)return json({error:'Confirm your email, scroll through the agreement, type your matching full name and accept the age and acceptable-use confirmations.'},400);
 if(squareMode(env)!=='off'){const paid=await squarePaymentState(env,user);const promo=paid.entry?.plan.promoCode||squarePromo(review.promoCode);if(review.promoCode&&!squarePromo(review.promoCode))return json({error:'Invalid promo code.'},400);entry=paid.entry.plan;contract=squarePriced(contract,promo);}
 if(invited&&!grant.contractLocked){const locked=await squareWrite(env,'entry-grant:'+user,{...grant,contractLocked:true},grant._revision);if(!locked.meta.changes)return json({error:'Your agreement changed. Reload and review it again.',code:'settings_changed'},409);}
 const agreement={individualRevision,id:'REVIEW-'+crypto.randomUUID(),revision,title:config.agreement.title,body:config.agreement.body,acceptableUse:config.agreement.acceptableUse,entry,contract,email:review.email.trim(),...(typeof review.phone==='string'&&/^[+0-9 ()-]{7,32}$/.test(review.phone)?{phone:review.phone.trim()}:{}),signature:review.signature.trim(),ageConfirmed:true,aupAccepted:true,acknowledgedAt:now,paymentStatus:squareMode(env)==='off'?'not_collected':grant?'entry_granted_contract_due':'entry_paid_contract_due',scope:squareMode(env)==='off'?'Educational review preview':'Educational application'};
 const snapshot={path:config.paths.find(x=>x.id===p.pathId),questions:config.features.questionnaire&&!invited?config.questions.map(q=>({title:q.title,answer:p.answers[q.id]})):[],notice:squareMode(env)==='off'?'Educational review preview. No payment collected.':grant?'Entry granted by Goddess. No entry payment is claimed; contract payment is separate.':'Entry payment confirmed. Contract payment is separate.',agreement};
 const enrolmentWrite=db(env).prepare('INSERT INTO education_enrolments (user_id,reference,name,path_id,answers,snapshot,completed,created_at,updated_at) VALUES (?,?,?,?,?,?,?, ?,?) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name,path_id=excluded.path_id,answers=excluded.answers,snapshot=excluded.snapshot,updated_at=excluded.updated_at').bind(user,'LEARN-'+crypto.randomUUID(),p.name.trim(),p.pathId,JSON.stringify(p.answers),JSON.stringify(snapshot),'[]',now,now);
 const reviewWrite=db(env).prepare('INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES (?,?,1,?)').bind('education-review-'+agreement.id,JSON.stringify({userId:user,name:p.name.trim(),...agreement}),now);
 await db(env).batch([enrolmentWrite,reviewWrite]);
 return json({enrolment:await read(),access:{status:'awaiting_admin',codeIssued:false}});
}
async function educationBody(request,url,limit){if(request.headers.get('origin')!==url.origin)return json({error:'Request origin rejected'},403);if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required'},415);let raw;try{raw=await boundedText(request,limit);}catch(error){return json({error:error.status===413?'Request too large':'Invalid request body'},error.status===413?413:400);}try{const p=JSON.parse(raw);return p&&typeof p==='object'&&!Array.isArray(p)?p:json({error:'Invalid JSON object'},400);}catch{return json({error:'Invalid JSON'},400);}}

// Curated private failure metadata: never raw provider payloads, card tokens or customer text.
async function recordEducationFailure(env,path,error){
 try{const at=new Date().toISOString(),value={at,area:'education',status:503,issue:'service_error',source:'server',errorType:['Error','TypeError','ReferenceError','RangeError','AbortError','TimeoutError'].includes(error.name)?error.name:'Error',route:['/api/education/payments/prepare','/api/education/payments/fallback','/api/education/payments/checkout','/api/education/payments/refresh','/api/education/enrolment','/api/education/published'].includes(path)?path:'other'};
 const missing=error.name==='ReferenceError'&&error.message?.match(/^([A-Za-z_$][A-Za-z0-9_$]{0,80}) is not defined$/);if(missing)value.missingSymbol=missing[1];if(typeof error.code==='string'&&/^[0-9A-Z]{5}$/.test(error.code))value.databaseCode=error.code;
 if(Number.isInteger(error.squareStatus)&&error.squareStatus>=400&&error.squareStatus<=599){value.providerStatus=error.squareStatus;value.operation=['checkout-link','order-create','order-read','payment-create','payment-read','other'].includes(error.squareOperation)?error.squareOperation:'other';value.providerCodes=(error.squareCodes||[]).filter(c=>typeof c==='string'&&/^[A-Z_]{1,60}$/.test(c)).slice(0,5);}
 await db(env).prepare('INSERT INTO prototype_settings(id,content,revision,updated_at) VALUES(?,?,1,?)').bind('education-failure:'+crypto.randomUUID(),JSON.stringify(value),at).run();await db(env).prepare("DELETE FROM prototype_settings WHERE id IN (SELECT id FROM prototype_settings WHERE id LIKE 'education-failure:%' ORDER BY updated_at DESC,id DESC OFFSET 30)").run();
 }catch{/* Never replace or expose the original failure. */}
}

// Private administrator recovery capability restores an existing application, never its payment status.
async function applicationRecovery(request,env,url,owner){
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 const body=await educationBody(request,url,1000);if(body instanceof Response)return body;
 if(typeof body.token!=='string'||! /^[a-f0-9]{64}$/.test(body.token)||Object.keys(body).some(k=>k!=='token'))return json({error:'This recovery link is unavailable.'},400);
 if(!await chatLimit(env,'application-recovery:'+await chatHash(request.headers.get('cf-connecting-ip')||'unknown'),30,3600000))return json({error:'Please wait before retrying.'},429);
 const key='application-recovery:'+await chatHash(body.token),recovery=await squareRecord(env,key);
 if(!recovery||recovery.status!=='active'||recovery.expiresAt<=Date.now()||!/^application:[a-f0-9]{64}$/.test(recovery.user||''))return json({error:'This recovery link has expired or is unavailable. Contact Goddess.'},404);
 const saved=await db(env).prepare('SELECT reference FROM education_enrolments WHERE user_id=? AND reference=?').bind(recovery.user,recovery.reference).first(),state=await squarePaymentState(env,recovery.user);
 const checkoutResume=recovery.kind==='checkout_resume'&&recovery.entryKey===await squareKey(env,recovery.user,'entry')&&!!state.entry?.orderId&&['pending','paid'].includes(state.entry.status);
 if(!checkoutResume&&(!saved||state.entry?.status!=='paid'||state.entry.providerStatus!=='COMPLETED'||!state.entry.paymentId))return json({error:'This application cannot be recovered through this link. Contact Goddess.'},409);
 const token=chatToken(),expiresAt=Math.min(recovery.expiresAt,Date.now()+48*3600000);
 await db(env).prepare('INSERT INTO prototype_settings(id,content,revision,updated_at) VALUES(?,?,1,?)').bind('application-recovery-session:'+await chatHash(token),JSON.stringify({recoveryKey:key,expiresAt}),new Date().toISOString()).run();
 const response=json({ok:true});response.headers.set('Set-Cookie','__Host-vanessa_application='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+Math.max(1,Math.floor((expiresAt-Date.now())/1000)));return response;
}

async function applicationProgress(request,env,url,{applicant,applicationContext,owner}){
 if(!applicant||!applicationContext||owner||request.headers.get('x-education-invite'))return json({error:'Use your application session.'},403);
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 const p=await educationBody(request,url,20000);if(p instanceof Response)return p;
 const allowed=['pathId','entryId','contractId','screen','answers','learnerName','learnerEmail','revision'];
 if(Object.keys(p).some(k=>!allowed.includes(k))||!Number.isSafeInteger(p.revision)||p.revision<0||!['paths','entry','intro','questions','review'].includes(p.screen)||!p.answers||typeof p.answers!=='object'||Array.isArray(p.answers)||typeof p.learnerName!=='string'||p.learnerName.length>100||typeof p.learnerEmail!=='string'||p.learnerEmail.length>320)return json({error:'Invalid application draft.'},400);
 const {config}=await educationConfig(env);
 for(const [key,choices] of [['pathId',config.paths],['entryId',config.agreement.entryPlans],['contractId',config.agreement.contractPlans]])if(typeof p[key]!=='string'||p[key]&&!choices.some(x=>x.id===p[key]))return json({error:'Application choices have changed.'},409);
 for(const [id,value]of Object.entries(p.answers)){const question=config.questions.find(q=>q.id===id);if(!question||!validEducationAnswer(question,value))return json({error:'Invalid draft answers.'},400);}
 if(!await chatLimit(env,'application-progress:'+await chatHash(applicant),60,60000))return json({error:'Please wait before saving again.'},429);
 const key='application-progress:'+applicant,value=JSON.stringify(Object.fromEntries(allowed.filter(k=>k!=='revision').map(k=>[k,p[k]]))),at=new Date().toISOString();
 const result=p.revision===0?await db(env).prepare('INSERT INTO prototype_settings(id,content,revision,updated_at) VALUES(?,?,1,?) ON CONFLICT(id) DO NOTHING').bind(key,value,at).run():await db(env).prepare('UPDATE prototype_settings SET content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(value,at,key,p.revision).run();
 return result.meta.changes?json({ok:true,revision:p.revision+1}):json({error:'Application draft changed in another tab.'},409);
}
async function applicationResumeLink(request,env,url,{applicant,applicationContext,owner}){
 if(!applicant||!applicationContext||owner||request.headers.get('x-education-invite'))return json({error:'Use your application session.'},403);
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 const p=await educationBody(request,url,1000);if(p instanceof Response)return p;if(Object.keys(p).length)return json({error:'No application selector is accepted.'},400);
 const state=await squarePaymentState(env,applicant);if(!state.entry?.orderId||!['pending','paid'].includes(state.entry.status))return json({error:'Prepare your Entry checkout first.'},409);
 if(!await chatLimit(env,'application-resume-link:'+await chatHash(applicant),10,3600000))return json({error:'Please wait before making another resume link.'},429);
 const token=chatToken()+chatToken().slice(0,16),expiresAt=Date.now()+7*86400000,reference=await db(env).prepare('SELECT reference FROM education_enrolments WHERE user_id=?').bind(applicant).first();
 await db(env).prepare('INSERT INTO prototype_settings(id,content,revision,updated_at) VALUES(?,?,1,?)').bind('application-recovery:'+await chatHash(token),JSON.stringify({kind:'checkout_resume',user:applicant,reference:reference?.reference||null,entryKey:await squareKey(env,applicant,'entry'),status:'active',expiresAt}),new Date().toISOString()).run();
 return json({token,expiresAt});
}
