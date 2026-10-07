const FUNNEL_STAGES=['paths','entry','intro','questions','review','payment'];
const funnelLabels={paths:'Starting point',entry:'Entry plan',intro:'Introduction & tribute',questions:'About you',review:'Review & signing',payment:'Contract payment'};
const funnelSteps=questions=>FUNNEL_STAGES.filter(s=>questions||s!=='questions');
async function applicationFunnel(request,env,url,{owner,applicant}){
 const now=Date.now();
 if(request.method==='POST'){
  if(owner||!applicant||request.headers.get('x-education-context')!=='application')return json({error:'An application session is required.'},403);
  const body=await educationBody(request,url,1000);if(body instanceof Response)return body;
  if(Object.keys(body).some(k=>!['stage','visible'].includes(k))||!FUNNEL_STAGES.includes(body.stage)||typeof body.visible!=='boolean')return json({error:'Invalid application step.'},400);
  if(!await chatLimit(env,'funnel:'+await chatHash(applicant),240,3600000)||!await chatLimit(env,'funnel-ip:'+await chatHash(request.headers.get('cf-connecting-ip')||'unknown'),12000,3600000))return json({error:'Activity limit reached.'},429);
  const {config}=await educationConfig(env);if(body.stage==='questions'&&!config.features.questionnaire)return json({error:'This step is unavailable.'},400);
  // Payment milestones come from private server records, never the browser.
  const key='application-funnel:'+await chatHash(applicant),stamp=new Date(now).toISOString(),record={id:crypto.randomUUID(),user:applicant,startedAt:now,lastAt:now,stage:body.stage,visible:body.visible,hasQuestions:config.features.questionnaire,reached:{paths:now,[body.stage]:now},contractKey:await squareKey(env,applicant,'contract'),entryKey:await squareKey(env,applicant,'entry')};
  const saved=await db(env).prepare("INSERT INTO prototype_settings(id,content,revision,updated_at) VALUES(?,?,1,?) ON CONFLICT(id) DO UPDATE SET content=(prototype_settings.content::jsonb || excluded.content::jsonb || jsonb_build_object('id',prototype_settings.content::jsonb->'id','startedAt',prototype_settings.content::jsonb->'startedAt','hasQuestions',prototype_settings.content::jsonb->'hasQuestions','reached',(excluded.content::jsonb->'reached') || (prototype_settings.content::jsonb->'reached')))::text,revision=prototype_settings.revision+1,updated_at=excluded.updated_at RETURNING revision").bind(key,JSON.stringify(record),stamp).first();
  if(saved.revision===1)await db(env).prepare("DELETE FROM prototype_settings WHERE id LIKE 'application-funnel:%' AND (content::jsonb->>'startedAt')::bigint<?").bind(now-30*86400000).run();
  return json({ok:true});
 }
 if(!owner||request.headers.get('x-chat-role')==='student')return json({error:'Goddess access required.'},403);
 if(request.method!=='GET')return json({error:'Method not allowed.'},405);
 const period=url.searchParams.get('period')||'today';if(!['today','7d','30d'].includes(period))return json({error:'Choose a valid period.'},400);
 const since=period==='today'?new Date(now).setUTCHours(0,0,0,0):now-(period==='7d'?7:30)*86400000;
 const rows=await db(env).prepare("SELECT f.content,e.name,e.reference,e.created_at AS signed_at,p.content::jsonb->>'status' AS payment_status,t.content::jsonb->>'status' AS tribute_status FROM prototype_settings f LEFT JOIN education_enrolments e ON e.user_id=f.content::jsonb->>'user' LEFT JOIN prototype_settings p ON p.id=f.content::jsonb->>'contractKey' LEFT JOIN prototype_settings t ON t.id=f.content::jsonb->>'entryKey' WHERE f.id LIKE 'application-funnel:%' AND (f.content::jsonb->>'startedAt')::bigint>=? ORDER BY f.updated_at DESC").bind(since).all();
 const {config}=await educationConfig(env),steps=funnelSteps(config.features.questionnaire),counts=Object.fromEntries(FUNNEL_STAGES.map(s=>[s,0]));let completed=0,active=0,signed=0;
 const applicants=rows.results.map(row=>{const p=JSON.parse(row.content),ownSteps=funnelSteps(p.hasQuestions),confirmed=!!row.signed_at&&row.payment_status==='paid',hasSigned=!!row.signed_at;let stage=hasSigned?'payment':p.stage;let highest=Math.max(0,...Object.keys(p.reached).map(s=>FUNNEL_STAGES.indexOf(s)),hasSigned?5:0);
  for(const s of FUNNEL_STAGES)if(FUNNEL_STAGES.indexOf(s)<=highest&&(s!=='questions'||p.hasQuestions))counts[s]++;
  const live=p.visible&&p.lastAt>now-90000&&!confirmed;if(live)active++;if(confirmed)completed++;if(hasSigned)signed++;
  return {id:p.id,name:row.name||'Applicant '+p.id.slice(0,6).toUpperCase(),reference:row.reference||null,stage,step:ownSteps.indexOf(stage)+1,totalSteps:ownSteps.length,label:confirmed?'Payment confirmed':funnelLabels[stage],active:!!live,completed:confirmed,signed:hasSigned,tributePaid:row.tribute_status==='paid',startedAt:p.startedAt,lastAt:p.lastAt};
 });
 return json({checkedAt:now,period,since,activeWindowSeconds:90,retentionDays:30,started:rows.results.length,active,signed,completed,conversion:rows.results.length?Math.round(completed/rows.results.length*100):0,stages:steps.map((id,i)=>({id,label:funnelLabels[id],step:i+1,count:counts[id]})),applicants:applicants.sort((a,b)=>Number(b.active)-Number(a.active)||b.lastAt-a.lastAt).slice(0,50),totalApplicants:applicants.length});
}
