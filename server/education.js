const EDUCATION_OWNER='danielvernontp@gmail.com';
// A private browser capability for applications, never a chat login.
async function applicationUser(request){const token=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-vanessa_application=([a-f0-9]{48})(?:;|$)/)?.[1];return token?'application:'+await chatHash(token):null;}
async function educationConfig(env,which='published'){const row=await db(env).prepare('SELECT content,revision,updated_at FROM prototype_settings WHERE id = ?').bind('education-'+which).first();return {config:educationWithAgreement(row?JSON.parse(row.content):EDUCATION_DEFAULTS),revision:row?.revision||0,updatedAt:row?.updated_at||null};}
async function educationAPI(request,env,url){
 const path=url.pathname,dispatchUser=request.headers.get('oai-authenticated-user-id'),dispatchEmail=request.headers.get('oai-authenticated-user-email'),owner=!!dispatchUser&&dispatchEmail?.toLowerCase()===EDUCATION_OWNER;
 const codeStudent=owner?null:await chatStudent(request,env),user=codeStudent?.user_id||dispatchUser||await applicationUser(request),email=codeStudent?.email||dispatchEmail;
 if(path==='/api/education/application-session'){
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  const body=await educationBody(request,url,1000);if(body instanceof Response)return body;
  if(!await chatLimit(env,'application-session:'+await chatHash(request.headers.get('cf-connecting-ip')||'unknown'),30,3600000))return json({error:'Too many requests. Try again later.'},429);
  const response=json({ok:true});response.headers.set('Cache-Control','private, no-store');
  if(!user)response.headers.set('Set-Cookie','__Host-vanessa_application='+chatToken()+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=2592000');
  return response;
 }
 if(path==='/api/education/identity'&&request.method==='GET')return json({signedIn:!!(codeStudent||dispatchUser),application:!!user,owner,email:email||null});
 if(['/api/education/verification','/api/education/verifications'].includes(path))return educationVerificationAPI(request,env,url,{user,email,owner});
 if(path.startsWith('/api/education/payments'))return squareAPI(request,env,url,{user,owner});
 const which=path.split('/').at(-1);
 if(path==='/api/education/published'||path==='/api/education/draft'){
  if(!(which==='published'&&request.method==='GET')&&!owner)return json({error:'Sign in with the Goddess account to edit or publish courses.'},403);
  if(request.method==='GET')return json(await educationConfig(env,which));
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
  const rows=await db(env).prepare('SELECT user_id,reference,name,path_id,snapshot,completed,created_at,updated_at FROM education_enrolments ORDER BY updated_at DESC LIMIT 200').all();
  return json({enrolments:await Promise.all((rows.results||[]).map(async r=>{const {user_id,...record}=r;const payments=squareMode(env)==='off'?null:await squarePaymentState(env,user_id);return {...record,snapshot:JSON.parse(r.snapshot),completed:JSON.parse(r.completed),payments:payments?{entry:squarePublic(payments.entry),contract:squarePublic(payments.contract)}:null};}))});
 }
 if(path!=='/api/education/enrolment'&&path!=='/api/education/progress')return json({error:'Not found'},404);
 if(!user)return json({error:'Start your application in this browser before saving.'},401);
 const read=async()=>{const r=await db(env).prepare('SELECT reference,name,path_id,answers,snapshot,completed,created_at,updated_at FROM education_enrolments WHERE user_id=?').bind(user).first();return r?{...r,answers:JSON.parse(r.answers),snapshot:JSON.parse(r.snapshot),completed:JSON.parse(r.completed)}:null;};
 if(request.method==='GET')return json({enrolment:await read()});
 if(request.method!=='PUT')return json({error:'Method not allowed'},405);
 const p=await educationBody(request,url,20000);if(p instanceof Response)return p;
 if(path==='/api/education/enrolment'&&!await chatLimit(env,'application-submit:'+await chatHash(request.headers.get('cf-connecting-ip')||'unknown'),20,3600000))return json({error:'Too many submissions. Try again later.'},429);
 const {config,revision}=await educationConfig(env);
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
 const answerKeys=Object.keys(p.answers);if(answerKeys.some(k=>!config.questions.some(q=>q.id===k)))return json({error:'The questionnaire changed. Please reload and review your answers.'},409);
 if(config.features.questionnaire&&config.questions.some(q=>!validEducationAnswer(q,p.answers[q.id])))return json({error:'Choose at least one current option for each question.'},400);
 if(!config.features.questionnaire&&answerKeys.length)return json({error:'The questionnaire is currently disabled.'},400);
 if(squareMode(env)!=='off'){const {entry,contract}=await squarePaymentState(env,user);if(entry?.status!=='paid'||entry.plan.id!==p.review.entryId)return json({error:'Complete your entry payment before submitting the application.'},402);if(contract)return json({error:'Your contract checkout is already saved. Complete that checkout or contact the academy to amend it.'},409);}
 const review=p.review;
 if(!review||review.revision!==revision)return json({error:'The agreement or rates changed. Reload and review the current version before confirming.'},409);
 const entry=config.agreement.entryPlans.find(x=>x.id===review.entryId),contract=config.agreement.contractPlans.find(x=>x.id===review.contractId);
 if(!entry||!contract||typeof review.email!=='string'||review.email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(review.email)||typeof review.signature!=='string'||review.signature.trim()!==p.name.trim()||review.ageConfirmed!==true||review.aupAccepted!==true||review.read!==true||review.entryReviewed!==true)return json({error:'Confirm your email, scroll through the agreement, type your matching full name and accept the age and acceptable-use confirmations.'},400);
 const agreement={id:'REVIEW-'+crypto.randomUUID(),revision,title:config.agreement.title,body:config.agreement.body,acceptableUse:config.agreement.acceptableUse,entry,contract,email:review.email.trim(),signature:review.signature.trim(),ageConfirmed:true,aupAccepted:true,acknowledgedAt:now,paymentStatus:squareMode(env)==='off'?'not_collected':'entry_paid_contract_due',scope:squareMode(env)==='off'?'Educational review preview':'Educational application'};
 const snapshot={path:config.paths.find(x=>x.id===p.pathId),questions:config.features.questionnaire?config.questions.map(q=>({title:q.title,answer:p.answers[q.id]})):[],notice:squareMode(env)==='off'?'Educational review preview. No payment collected.':'Entry payment confirmed. Contract payment is separate.',agreement};
 const enrolmentWrite=db(env).prepare('INSERT INTO education_enrolments (user_id,reference,name,path_id,answers,snapshot,completed,created_at,updated_at) VALUES (?,?,?,?,?,?,?, ?,?) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name,path_id=excluded.path_id,answers=excluded.answers,snapshot=excluded.snapshot,updated_at=excluded.updated_at').bind(user,'LEARN-'+crypto.randomUUID(),p.name.trim(),p.pathId,JSON.stringify(p.answers),JSON.stringify(snapshot),'[]',now,now);
 const reviewWrite=db(env).prepare('INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES (?,?,1,?)').bind('education-review-'+agreement.id,JSON.stringify({userId:user,name:p.name.trim(),...agreement}),now);
 await db(env).batch([enrolmentWrite,reviewWrite]);
 return json({enrolment:await read(),access:{status:'awaiting_admin',codeIssued:false}});
}
async function educationBody(request,url,limit){if(request.headers.get('origin')!==url.origin)return json({error:'Request origin rejected'},403);if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required'},415);let raw;try{raw=await boundedText(request,limit);}catch(error){return json({error:error.status===413?'Request too large':'Invalid request body'},error.status===413?413:400);}try{const p=JSON.parse(raw);return p&&typeof p==='object'&&!Array.isArray(p)?p:json({error:'Invalid JSON object'},400);}catch{return json({error:'Invalid JSON'},400);}}
