import {overview} from './overview.js';
import {release,changelog} from './releases.js';
const ownerEmail='danielvernontp@gmail.com';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
const categories=['auth','education','chat','media','visual','health','payments'];
const issues={bank_verification_timeout:'A browser reported a bank verification timeout.',bank_policy_blocked:'A browser reported that bank verification was blocked by security policy.',bank_verification_failed:'A browser reported an incomplete bank verification.',auth_email_limit:'Sign-in email sending limit reached.',auth_email_failed:'Sign-in email could not be sent.',service_error:'A server request failed.',request_limited:'A request was rate limited.'};
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
 if(new URL(request.url).pathname==='/api/admin/overview')return json(await bounded(()=>overview(database())));
 const checks=[],started=Date.now();let DB,events=[],historyAvailable=false,counts=null;
 const probe=async(id,name,fn)=>{const start=Date.now();try{const detail=await bounded(fn);checks.push({id,name,state:'ok',detail,ms:Date.now()-start});}catch{checks.push({id,name,state:'error',detail:'The check failed or timed out. Review the provider logs, then try again.',ms:Date.now()-start});}};
 await Promise.all([
  probe('database','Applications & chat database',async()=>{DB=database();await DB.prepare('SELECT 1 FROM education_enrolments LIMIT 1').all();await DB.prepare('SELECT 1 FROM chat_students LIMIT 1').all();await DB.prepare('SELECT 1 FROM chat_messages LIMIT 1').all();return 'Application, account and message tables respond. This is a read check.';}),
  probe('storage','Private file storage',async()=>{const bucket=storage();if(!bucket?.health)throw Error('unconfigured');await bucket.health();return 'Both upload and media buckets respond and are private. Upload/download has not been tested by this check.';})
 ]);
 if(DB&&checks.find(c=>c.id==='database')?.state==='ok'){
  try{const rows=await bounded(()=>DB.prepare("SELECT content FROM prototype_settings WHERE id LIKE 'diagnostic:%' AND updated_at>=? ORDER BY updated_at DESC,id DESC LIMIT 50").bind(new Date(Date.now()-7*86400000).toISOString()).all());events=rows.results.flatMap(r=>{try{const e=JSON.parse(r.content);return Object.hasOwn(issues,e.issue)&&/^[a-f0-9-]{36}$/.test(e.requestId)?[{at:e.at,area:categories.includes(e.area)?e.area:'platform',status:Number(e.status),requestId:e.requestId,source:e.source==='browser'?'browser':'server',message:issues[e.issue]}]:[];}catch{return [];}});historyAvailable=true;}catch{}
  try{counts=await bounded(()=>DB.prepare("SELECT (SELECT COUNT(*) FROM education_enrolments) AS applications,(SELECT COUNT(*) FROM chat_students WHERE status='active') AS active_students,(SELECT COUNT(*) FROM chat_messages) AS messages").first());}catch{}
 }
 const emailConfigured=!!env.RESEND_API_KEY&&typeof env.EMAIL_FROM==='string'&&!/[\r\n]/.test(env.EMAIL_FROM)&&/[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/.test(env.EMAIL_FROM);
 checks.push({id:'email',name:'Goddess-issued code emails',state:emailConfigured?'unverified':'attention',detail:emailConfigured?'Sender settings are present. Delivery has not been tested; check the result when Vanessa issues a code.':'Email delivery is not configured. Vanessa can copy and share codes privately.'});
 checks.push({id:'admin',name:'Goddess sign-in',state:'ok',detail:'Your private Goddess code session is verified. New sign-ins use your access code.'});
 checks.push({id:'access',name:'Sub access',state:'info',detail:'Only Goddess issues codes. An application session does not open chat.'});
 const mode=['production','sandbox'].includes(env.SQUARE_ENVIRONMENT)?env.SQUARE_ENVIRONMENT:'off';
 const paymentReady=mode!=='off'&&!!(env.SQUARE_ACCESS_TOKEN&&env.SQUARE_LOCATION_ID&&env.SQUARE_WEBHOOK_SIGNATURE_KEY&&env.SQUARE_WEBHOOK_URL&&env.SQUARE_SITE_URL)&&(mode!=='production'||env.SQUARE_LIVE_ENABLED==='true');
 if(paymentReady){
  await probe('payments','Square connection',async()=>{
   const base=mode==='production'?'https://connect.squareup.com':'https://connect.squareupsandbox.com';
   const response=await (env.SQUARE_FETCH||fetch)(base+'/v2/locations/'+encodeURIComponent(env.SQUARE_LOCATION_ID),{headers:{Authorization:'Bearer '+env.SQUARE_ACCESS_TOKEN,'Square-Version':'2025-01-23'},signal:AbortSignal.timeout(6000)});
   if(!response.ok)throw Error('provider_unavailable');const data=await response.json();
   if(data.location?.id!==env.SQUARE_LOCATION_ID||data.location?.status!=='ACTIVE'||data.location?.currency!=='GBP')throw Error('location_unavailable');
   return (mode==='production'?'Live':'Sandbox')+' Square credentials and active GBP location verified by a read-only API request. No charge made; bank authentication is not tested.';
  });
 }else checks.push({id:'payments',name:'Square connection',state:'attention',detail:'Square checkout is unavailable. Check the payment settings.'});
 const bankEvents=events.filter(e=>e.source==='browser'&&e.area==='payments'&&Date.parse(e.at)>Date.now()-86400000);
 checks.push({id:'bank-authentication',name:'Bank verification & checkout recovery',state:bankEvents.length?'attention':'unverified',detail:bankEvents.length?bankEvents.length+' recent browser reports need review. These are client reports, not proof of a bank or payment failure. Square-hosted recovery is available only before a charge attempt.':'Bank verification needs an end-to-end test with an issuer. Bank-app switches are allowed within bounded deadlines; untouched checkouts can continue on Square in the same tab. Existing charge attempts are reconciled before retry.'});
 const commit=/^[a-f0-9]{7,40}$/i.test(env.VERCEL_GIT_COMMIT_SHA||'')?env.VERCEL_GIT_COMMIT_SHA.slice(0,7):null;
 return json({release,checkedAt:new Date().toISOString(),durationMs:Date.now()-started,environment:env.VERCEL_ENV==='production'?'Production':env.VERCEL_ENV==='preview'?'Preview':'Local / unspecified',commit,checks,counts,events,historyAvailable,historyNote:'Up to 50 server failures, rate limits and allowlisted bank-verification browser reports from the last 7 days. Browser reports are unverified and rate limited; they contain no card data, tokens, names, email addresses, codes, URLs or arbitrary error text. Other browser errors and full provider logs are not included.'});
}
