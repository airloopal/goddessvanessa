const EDUCATION_OWNER='danielvernontp@gmail.com';
async function educationConfig(env,which='published'){const row=await db(env).prepare('SELECT content,revision,updated_at FROM prototype_settings WHERE id = ?').bind('education-'+which).first();return {config:educationWithAgreement(row?JSON.parse(row.content):EDUCATION_DEFAULTS),revision:row?.revision||0,updatedAt:row?.updated_at||null};}
async function educationAPI(request,env,url){
 const path=url.pathname,dispatchUser=request.headers.get('oai-authenticated-user-id'),dispatchEmail=request.headers.get('oai-authenticated-user-email'),owner=!!dispatchUser&&dispatchEmail?.toLowerCase()===EDUCATION_OWNER;
 const codeStudent=owner?null:await chatStudent(request,env),user=codeStudent?.user_id||dispatchUser,email=codeStudent?.email||dispatchEmail;
 if(path==='/api/education/identity'&&request.method==='GET')return json({signedIn:!!user,owner,email:email||null});
 if(['/api/education/verification','/api/education/verifications'].includes(path))return educationVerificationAPI(request,env,url,{user,email,owner});
 const which=path.split('/').at(-1);
 if(path==='/api/education/published'||path==='/api/education/draft'){
  if(!(which==='published'&&request.method==='GET')&&!owner)return json({error:'Sign in with the site owner account to edit or publish courses.'},403);
  if(request.method==='GET')return json(await educationConfig(env,which));
  if(request.method!=='PUT')return json({error:'Method not allowed'},405);
  const p=await educationBody(request,url,400000);if(p instanceof Response)return p;
  if(!Number.isInteger(p.revision)||p.revision<0||!validEducation(p.config))return json({error:'Check the fields: keep at least one path and lesson, use unique answer options, and supply a valid HTTPS URL for video blocks.'},400);
  const stamp=new Date().toISOString(),key='education-'+which,data=JSON.stringify(p.config);
  const r=p.revision===0?await db(env).prepare('INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(id) DO NOTHING').bind(key,data,stamp).run():await db(env).prepare('UPDATE prototype_settings SET content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(data,stamp,key,p.revision).run();
  return r.meta?.changes?json({revision:p.revision+1,updatedAt:stamp}):json({error:'Someone saved a newer version. Export your changes, then reload before saving.'},409);
 }
 if(path==='/api/education/enrolments'){
  if(!owner)return json({error:'Only the site owner can view learner records.'},403);
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  const rows=await db(env).prepare('SELECT reference,name,path_id,snapshot,completed,created_at,updated_at FROM education_enrolments ORDER BY updated_at DESC LIMIT 200').all();
  return json({enrolments:(rows.results||[]).map(r=>({...r,snapshot:JSON.parse(r.snapshot),completed:JSON.parse(r.completed)}))});
 }
 if(path!=='/api/education/enrolment'&&path!=='/api/education/progress')return json({error:'Not found'},404);
 if(!user)return json({error:'Sign in with ChatGPT to save your enrolment and lesson progress.'},401);
 const read=async()=>{const r=await db(env).prepare('SELECT reference,name,path_id,answers,snapshot,completed,created_at,updated_at FROM education_enrolments WHERE user_id=?').bind(user).first();return r?{...r,answers:JSON.parse(r.answers),snapshot:JSON.parse(r.snapshot),completed:JSON.parse(r.completed)}:null;};
 if(request.method==='GET')return json({enrolment:await read()});
 if(request.method!=='PUT')return json({error:'Method not allowed'},405);
 const p=await educationBody(request,url,20000);if(p instanceof Response)return p;
 const {config,revision}=await educationConfig(env);
 const now=new Date().toISOString();
 if(path==='/api/education/progress'){
  if(!config.features.progress)return json({error:'Lesson completion is currently turned off.'},400);
  if(typeof p.completed!=='boolean'||!config.lessons.some(l=>l.id===p.lessonId))return json({error:'Choose a current lesson.'},400);
  const existing=await read();if(!existing)return json({error:'Enrol before saving lesson progress.'},409);
  // Apply one lesson change atomically, so separate tabs cannot overwrite one another.
  if(p.completed)await db(env).prepare("UPDATE education_enrolments SET completed=CASE WHEN EXISTS(SELECT 1 FROM json_each(completed) WHERE value=?) THEN completed ELSE json_insert(completed,'$[#]',?) END,updated_at=? WHERE user_id=?").bind(p.lessonId,p.lessonId,now,user).run();
  else await db(env).prepare("UPDATE education_enrolments SET completed=(SELECT json_group_array(value) FROM json_each(education_enrolments.completed) WHERE value<>?),updated_at=? WHERE user_id=?").bind(p.lessonId,now,user).run();
  return json({enrolment:await read()});
 }
 if(typeof p.name!=='string'||p.name.trim().length<2||p.name.length>100||!config.paths.some(x=>x.id===p.pathId)||p.accepted!==true||!p.answers||typeof p.answers!=='object'||Array.isArray(p.answers))return json({error:'Enter your name, choose a learning path and confirm your enrolment.'},400);
 const answerKeys=Object.keys(p.answers);if(answerKeys.some(k=>!config.questions.some(q=>q.id===k)))return json({error:'The questionnaire changed. Please reload and review your answers.'},409);
 if(config.features.questionnaire&&config.questions.some(q=>!q.options.includes(p.answers[q.id])))return json({error:'Answer each learning question using a current option.'},400);
 if(!config.features.questionnaire&&answerKeys.length)return json({error:'The questionnaire is currently disabled.'},400);
 const review=p.review;
 if(!review||review.revision!==revision)return json({error:'The agreement or rates changed. Reload and review the current version before confirming.'},409);
 const entry=config.agreement.entryPlans.find(x=>x.id===review.entryId),contract=config.agreement.contractPlans.find(x=>x.id===review.contractId);
 if(!entry||!contract||typeof review.email!=='string'||review.email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(review.email)||typeof review.signature!=='string'||review.signature.trim()!==p.name.trim()||review.ageConfirmed!==true||review.aupAccepted!==true||review.read!==true||review.entryReviewed!==true)return json({error:'Confirm your email, scroll through the agreement, type your matching full name and accept the age and acceptable-use confirmations.'},400);
 const agreement={id:'REVIEW-'+crypto.randomUUID(),revision,title:config.agreement.title,body:config.agreement.body,acceptableUse:config.agreement.acceptableUse,entry,contract,email:review.email.trim(),signature:review.signature.trim(),ageConfirmed:true,aupAccepted:true,acknowledgedAt:now,paymentStatus:'not_collected',scope:'Educational review preview'};
 const snapshot={path:config.paths.find(x=>x.id===p.pathId),questions:config.features.questionnaire?config.questions.map(q=>({title:q.title,answer:p.answers[q.id]})):[],notice:'Educational review preview. No payment collected.',agreement};
 const enrolmentWrite=db(env).prepare('INSERT INTO education_enrolments (user_id,reference,name,path_id,answers,snapshot,completed,created_at,updated_at) VALUES (?,?,?,?,?,?,?, ?,?) ON CONFLICT(user_id) DO UPDATE SET name=excluded.name,path_id=excluded.path_id,answers=excluded.answers,snapshot=excluded.snapshot,updated_at=excluded.updated_at').bind(user,'LEARN-'+crypto.randomUUID(),p.name.trim(),p.pathId,JSON.stringify(p.answers),JSON.stringify(snapshot),'[]',now,now);
 const reviewWrite=db(env).prepare('INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES (?,?,1,?)').bind('education-review-'+agreement.id,JSON.stringify({userId:user,name:p.name.trim(),...agreement}),now);
 await db(env).batch([enrolmentWrite,reviewWrite]);
 let access;try{access=await provisionStudent(env,{user,name:p.name.trim(),email:review.email.trim(),origin:url.origin});}catch(error){console.error('student_provision_failed',error.message);access={created:false,emailStatus:'failed'};}
 return json({enrolment:await read(),access});
}
async function educationBody(request,url,limit){if(request.headers.get('origin')!==url.origin)return json({error:'Request origin rejected'},403);if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required'},415);const raw=await request.text();if(raw.length>limit)return json({error:'Request too large'},413);try{const p=JSON.parse(raw);return p&&typeof p==='object'&&!Array.isArray(p)?p:json({error:'Invalid JSON object'},400);}catch{return json({error:'Invalid JSON'},400);}}
