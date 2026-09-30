import {randomBytes,scrypt as scryptCallback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {boundedText} from './request-body.js';
import {productionDatabase} from './database.js';
const scrypt=promisify(scryptCallback),credentialId='goddess-credential',cookieName='__Host-goddess_session',ttl=12*3600000;
const digest=value=>createHash('sha256').update(value).digest('hex');
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
export const safeReturn=value=>typeof value==='string'&&/^\/(?!\/)/.test(value)&&!/[\\\r\n]/.test(value)?value:'/dashboard.html';
export async function hashCode(code){const salt=randomBytes(24).toString('hex');return {salt,hash:(await scrypt(code,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024})).toString('hex')};}
async function matches(code,record){if(typeof code!=='string'||code.length>64||!/^[a-f0-9]{128}$/.test(record.hash||'')||!/^[a-f0-9]{48}$/.test(record.salt||''))return false;const value=await scrypt(code,record.salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});return timingSafeEqual(value,Buffer.from(record.hash,'hex'));}
function token(request){const raw=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);return /^[a-f0-9]{64}$/.test(raw||'')?raw:null;}
export function authContext(request,env){let cookie=null;const getDB=()=>env.DB||productionDatabase(env);let identity;
 const getUser=async()=>{if(identity)return identity;const t=token(request);let user=null;if(t){const row=await getDB().prepare("SELECT s.content AS session,c.content AS credential,c.revision FROM prototype_settings s JOIN prototype_settings c ON c.id=? WHERE s.id=? AND s.revision=c.revision").bind(credentialId,'goddess-session:'+digest(t)).first();if(row){const session=JSON.parse(row.session),credential=JSON.parse(row.credential);if(session.expires>Date.now()&&session.userId===credential.userId)user={id:credential.userId,email:'danielvernontp@gmail.com',email_confirmed_at:'verified-code'};}}return identity={data:{user},error:null};};
 return {client:{auth:{getUser}},getDB,setCookie(value,maxAge){cookie=cookieName+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+maxAge;},apply(response){const out=new Response(response.body,{status:response.status,headers:response.headers});if(cookie)out.headers.append('Set-Cookie',cookie);out.headers.set('Cache-Control','private, no-store');return out;}};
}
export async function verifiedRequest(request,client,env={}){const headers=new Headers(request.headers);headers.delete('oai-authenticated-user-id');headers.delete('oai-authenticated-user-email');headers.delete('cf-connecting-ip');const {data:{user},error}=await client.auth.getUser();if(!error&&user?.email_confirmed_at&&user.email?.toLowerCase()==='danielvernontp@gmail.com'){headers.set('oai-authenticated-user-id',user.id);headers.set('oai-authenticated-user-email',user.email);}if(env.VERCEL==='1'){const ip=request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for');if(ip)headers.set('cf-connecting-ip',ip);}return new Request(request,{headers});}
async function limited(DB,request,env,scope){const ip=env.VERCEL==='1'?(request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'unknown'):'local';const now=Date.now(),period=15*60000;for(const [key,max] of [[scope+':ip:'+digest(ip),5],[scope+':global',30]]){const row=await DB.prepare('INSERT INTO chat_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN chat_limits.expires<=? THEN 1 ELSE chat_limits.count+1 END,expires=CASE WHEN chat_limits.expires<=? THEN excluded.expires ELSE chat_limits.expires END RETURNING count').bind(key,now+period,now,now).first();if(row.count>max)return true;}return false;}
export async function authAPI(request,context,env){const path=new URL(request.url).pathname;
 if(path==='/api/auth/email'||path==='/api/auth/callback')return json({error:'Goddess now signs in with her private access code.'},403);
 if(!['/api/auth/code','/api/auth/code-change','/api/auth/logout','/api/auth/session'].includes(path))return json({error:'Not found.'},404);
 if(path==='/api/auth/session'&&request.method==='GET'){const {data:{user}}=await context.client.auth.getUser();if(!user)return json({error:'Goddess access required.'},401);const row=await (env.DB||context.getDB()).prepare('SELECT content FROM prototype_settings WHERE id=?').bind(credentialId).first();const c=JSON.parse(row.content);return json({ok:true,initialCode:c.initial===true});}
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Request origin rejected.'},403);
 const DB=env.DB||context.getDB();
 if(path==='/api/auth/logout'){const t=token(request);if(t)await DB.prepare('DELETE FROM prototype_settings WHERE id=?').bind('goddess-session:'+digest(t)).run();context.setCookie('',0);return json({ok:true});}
 let body;try{const text=await boundedText(request,2048);body=JSON.parse(text);if(!body||typeof body!=='object')throw Error();}catch(error){return json({error:error.status===413?'Request too large.':'Invalid request.'},error.status===413?413:400);}
 if(path==='/api/auth/code-change'){const {data:{user}}=await context.client.auth.getUser();if(!user)return json({error:'Goddess access required.'},401);}
 if(await limited(DB,request,env,path==='/api/auth/code'?'goddess-login':'goddess-change')){const r=json({error:'Too many attempts. Please wait 15 minutes before trying again.'},429);r.headers.set('Retry-After','900');return r;}
 const row=await DB.prepare('SELECT content,revision FROM prototype_settings WHERE id=?').bind(credentialId).first();if(!row)return json({error:'Goddess access has not been configured yet.'},503);const credential=JSON.parse(row.content),code=path==='/api/auth/code'?body.code:body.oldCode;
 if(!await matches(code,credential))return json({error:path==='/api/auth/code'?'That Goddess access code is incorrect. Please try again.':'The current code is incorrect. Your code has not been changed.'},401);
 if(path==='/api/auth/code-change'){
  if(typeof body.newCode!=='string'||!/^\d{6,12}$/.test(body.newCode)||/^(\d)\1+$/.test(body.newCode)||['123456','654321','12345678','123456789','1234567890'].includes(body.newCode))return json({error:'Choose 6–12 digits. Avoid repeated digits and simple sequences.'},400);
  if(body.newCode!==body.confirmCode)return json({error:'The new codes do not match.'},400);
  if(body.newCode===body.oldCode)return json({error:'Choose a different code from your current one.'},400);
  const next={...await hashCode(body.newCode),userId:credential.userId,initial:false};const result=await DB.prepare('UPDATE prototype_settings SET content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(next),new Date().toISOString(),credentialId,row.revision).run();if(result.meta.changes!==1)return json({error:'The code changed in another session. Sign in again.'},409);
  context.setCookie('',0);return json({ok:true,message:'Your code has been changed. All Goddess sessions have ended. Sign in with your new code.'});
 }
 const t=randomBytes(32).toString('hex'),expires=Date.now()+ttl;
 await DB.prepare('INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES (?,?,?,?)').bind('goddess-session:'+digest(t),JSON.stringify({expires,userId:credential.userId}),row.revision,new Date().toISOString()).run();
 await DB.prepare("DELETE FROM prototype_settings WHERE id LIKE 'goddess-session:%' AND updated_at<?").bind(new Date(Date.now()-ttl).toISOString()).run();context.setCookie(t,ttl/1000);
 return json({ok:true,initialCode:credential.initial===true,redirect:credential.initial?'/dashboard.html#settings':safeReturn(body.returnTo)});
}
