import {release,changelog} from './releases.js';
const ownerEmail='danielvernontp@gmail.com';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
const categories=['auth','education','chat','media','visual','health'];
const issues={auth_email_limit:'Sign-in email sending limit reached.',auth_email_failed:'Sign-in email could not be sent.',service_error:'A server request failed.',request_limited:'A request was rate limited.'};
function category(path){const part=path.split('/')[2];return categories.includes(part)?part:'platform';}
export async function recordFailure(DB,{path,status,requestId,issue}){
 if(!DB||!((status>=500)||(status===429)))return;
 const at=new Date().toISOString(),event={at,area:category(path),status,requestId,issue:Object.hasOwn(issues,issue)?issue:(status===429?'request_limited':'service_error')};
 try{
  await DB.prepare('INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES (?,?,1,?)').bind('diagnostic:'+requestId,JSON.stringify(event),at).run();
  await DB.prepare("DELETE FROM prototype_settings WHERE id IN (SELECT id FROM prototype_settings WHERE id LIKE 'diagnostic:%' ORDER BY updated_at DESC,id DESC OFFSET 100) OR (id LIKE 'diagnostic:%' AND updated_at<?)").bind(new Date(Date.now()-7*86400000).toISOString()).run();
 }catch{/* Diagnostics must never replace the original response. */}
}
async function bounded(fn){let timer;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),8000);})]);}finally{clearTimeout(timer);}}
export async function statusAPI(request,env,{database,storage}){
 if(!request.headers.get('oai-authenticated-user-id')||request.headers.get('oai-authenticated-user-email')?.toLowerCase()!==ownerEmail)return json({error:'Goddess access required.'},403);
 if(request.method!=='GET')return json({error:'Method not allowed.'},405);
 if(new URL(request.url).pathname==='/api/admin/changelog')return json({release,changelog});
 const checks=[],started=Date.now();let DB,events=[],historyAvailable=false,counts=null;
 const probe=async(id,name,fn)=>{const start=Date.now();try{const detail=await bounded(fn);checks.push({id,name,state:'ok',detail,ms:Date.now()-start});}catch{checks.push({id,name,state:'error',detail:'The check failed or timed out. Review the provider logs, then try again.',ms:Date.now()-start});}};
 await Promise.all([
  probe('database','Applications & chat database',async()=>{DB=database();await DB.prepare('SELECT 1 FROM education_enrolments LIMIT 1').all();await DB.prepare('SELECT 1 FROM chat_students LIMIT 1').all();await DB.prepare('SELECT 1 FROM chat_messages LIMIT 1').all();return 'Application, account and message tables respond. This is a read check.';}),
  probe('storage','Private file storage',async()=>{const bucket=storage();if(!bucket?.health)throw Error('unconfigured');await bucket.health();return 'Both upload and media buckets respond and are private. Upload/download has not been tested by this check.';})
 ]);
 if(DB&&checks.find(c=>c.id==='database')?.state==='ok'){
  try{const rows=await bounded(()=>DB.prepare("SELECT content FROM prototype_settings WHERE id LIKE 'diagnostic:%' AND updated_at>=? ORDER BY updated_at DESC,id DESC LIMIT 50").bind(new Date(Date.now()-7*86400000).toISOString()).all());events=rows.results.flatMap(r=>{try{const e=JSON.parse(r.content);return Object.hasOwn(issues,e.issue)&&/^[a-f0-9-]{36}$/.test(e.requestId)?[{at:e.at,area:categories.includes(e.area)?e.area:'platform',status:Number(e.status),requestId:e.requestId,message:issues[e.issue]}]:[];}catch{return [];}});historyAvailable=true;}catch{}
  try{counts=await bounded(()=>DB.prepare("SELECT (SELECT COUNT(*) FROM education_enrolments) AS applications,(SELECT COUNT(*) FROM chat_students WHERE status='active') AS active_students,(SELECT COUNT(*) FROM chat_messages) AS messages").first());}catch{}
 }
 const emailConfigured=!!env.RESEND_API_KEY&&typeof env.EMAIL_FROM==='string'&&!/[\r\n]/.test(env.EMAIL_FROM)&&/[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/.test(env.EMAIL_FROM);
 checks.push({id:'email',name:'Goddess-issued code emails',state:emailConfigured?'unverified':'attention',detail:emailConfigured?'Sender settings are present. Delivery has not been tested; check the result when Vanessa issues a code.':'Email delivery is not configured. Vanessa can copy and share codes privately.'});
 checks.push({id:'admin',name:'Goddess sign-in',state:'ok',detail:'Your Goddess session is verified. This does not test a new sign-in email or its redirect.'});
 checks.push({id:'access',name:'Student access',state:'info',detail:'Only Goddess issues codes. An application session does not open chat.'});
 checks.push({id:'payments',name:'Payments',state:'attention',detail:'Not connected. Displayed entry and contract amounts do not collect money.'});
 const commit=/^[a-f0-9]{7,40}$/i.test(env.VERCEL_GIT_COMMIT_SHA||'')?env.VERCEL_GIT_COMMIT_SHA.slice(0,7):null;
 return json({release,checkedAt:new Date().toISOString(),durationMs:Date.now()-started,environment:env.VERCEL_ENV==='production'?'Production':env.VERCEL_ENV==='preview'?'Preview':'Local / unspecified',commit,checks,counts,events,historyAvailable,historyNote:'Up to 50 recorded server failures and rate limits from the last 7 days. Recording begins with this release. No message text, names, email addresses, codes or keys are stored. Browser errors and provider logs are not included.'});
}
