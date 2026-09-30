import {base32,totpStep,sealSecret,openSecret,mfaProof,newRecoveryCodes,recoveryHash} from './mfa.js';
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
 const getUser=async()=>{if(identity)return identity;const t=token(request);let user=null;if(t){const row=await getDB().prepare("SELECT s.content AS session,c.content AS credential,c.revision FROM prototype_settings s JOIN prototype_settings c ON c.id=? WHERE s.id=? AND s.revision=c.revision").bind(credentialId,'goddess-session:'+digest(t)).first();if(row){const session=JSON.parse(row.session),credential=JSON.parse(row.credential);if(session.expires>Date.now()&&session.userId===credential.userId&&(!credential.mfa||session.mfa===true))user={id:credential.userId,email:'danielvernontp@gmail.com',email_confirmed_at:'verified-code'};}}return identity={data:{user},error:null};};
 return {client:{auth:{getUser}},getDB,setCookie(value,maxAge){cookie=cookieName+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+maxAge;},apply(response){const out=new Response(response.body,{status:response.status,headers:response.headers});if(cookie)out.headers.append('Set-Cookie',cookie);out.headers.set('Cache-Control','private, no-store');return out;}};
}
export async function verifiedRequest(request,client,env={}){const headers=new Headers(request.headers);headers.delete('oai-authenticated-user-id');headers.delete('oai-authenticated-user-email');headers.delete('cf-connecting-ip');const {data:{user},error}=await client.auth.getUser();if(!error&&user?.email_confirmed_at&&user.email?.toLowerCase()==='danielvernontp@gmail.com'){headers.set('oai-authenticated-user-id',user.id);headers.set('oai-authenticated-user-email',user.email);}if(env.VERCEL==='1'){const ip=request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for');if(ip)headers.set('cf-connecting-ip',ip);}return new Request(request,{headers});}
async function limited(DB,request,env,scope){const ip=env.VERCEL==='1'?(request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'unknown'):'local';const now=Date.now(),period=15*60000;for(const [key,max] of [[scope+':ip:'+digest(ip),5],[scope+':global',30]]){const row=await DB.prepare('INSERT INTO chat_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN chat_limits.expires<=? THEN 1 ELSE chat_limits.count+1 END,expires=CASE WHEN chat_limits.expires<=? THEN excluded.expires ELSE chat_limits.expires END RETURNING count').bind(key,now+period,now,now).first();if(row.count>max)return true;}return false;}
export async function authAPI(request,context,env){const path=new URL(request.url).pathname;
 if(path==='/api/auth/email'||path==='/api/auth/callback')return json({error:'Goddess now signs in with her private access code.'},403);
 if(!['/api/auth/code','/api/auth/code-change','/api/auth/logout','/api/auth/session','/api/auth/mfa','/api/auth/mfa-start','/api/auth/mfa-enable','/api/auth/mfa-disable'].includes(path))return json({error:'Not found.'},404);
 if(path==='/api/auth/mfa'&&request.method==='GET'){const {data:{user}}=await context.client.auth.getUser();if(!user)return json({error:'Goddess access required.'},401);const row=await (env.DB||context.getDB()).prepare('SELECT content FROM prototype_settings WHERE id=?').bind(credentialId).first();const c=JSON.parse(row.content);return json({enabled:!!c.mfa,recoveryRemaining:c.mfa?.recoveryHashes?.length||0});}
 if(path==='/api/auth/session'&&request.method==='GET'){const {data:{user}}=await context.client.auth.getUser();if(!user)return json({error:'Goddess access required.'},401);const row=await (env.DB||context.getDB()).prepare('SELECT content FROM prototype_settings WHERE id=?').bind(credentialId).first();const c=JSON.parse(row.content);return json({ok:true,initialCode:c.initial===true});}
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Request origin rejected.'},403);
 const DB=env.DB||context.getDB();
 if(path==='/api/auth/logout'){const t=token(request);if(t)await DB.prepare('DELETE FROM prototype_settings WHERE id=?').bind('goddess-session:'+digest(t)).run();context.setCookie('',0);return json({ok:true});}
 let body;try{const text=await boundedText(request,2048);body=JSON.parse(text);if(!body||typeof body!=='object')throw Error();}catch(error){return json({error:error.status===413?'Request too large.':'Invalid request.'},error.status===413?413:400);}
 if(path==='/api/auth/code-change'||path.startsWith('/api/auth/mfa-')){const {data:{user}}=await context.client.auth.getUser();if(!user)return json({error:'Goddess access required.'},401);}
 if(await limited(DB,request,env,path==='/api/auth/code'?'goddess-login':'goddess-change')){const r=json({error:'Too many attempts. Please wait 15 minutes before trying again.'},429);r.headers.set('Retry-After','900');return r;}
 const row=await DB.prepare('SELECT content,revision FROM prototype_settings WHERE id=?').bind(credentialId).first();if(!row)return json({error:'Goddess access has not been configured yet.'},503);const credential=JSON.parse(row.content),code=path==='/api/auth/code'?body.code:path.startsWith('/api/auth/mfa-')?body.code:body.oldCode;
 if(!await matches(code,credential))return json({error:path==='/api/auth/code'?'That Goddess access code is incorrect. Please try again.':'The current code is incorrect. Your code has not been changed.'},401);
 const pendingId='goddess-mfa-pending:'+digest(token(request)||'');
 if(path==='/api/auth/mfa-start'){
  if(credential.mfa)return json({error:'Two-step verification is already enabled.'},409);
  if(credential.initial||code.length<12)return json({error:'First change your access code to 12 digits in Settings, then sign in again.'},400);
  const secret=base32(randomBytes(20)),pending={envelope:await sealSecret(secret,code),revision:row.revision,expires:Date.now()+600000};
  await DB.prepare('INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at').bind(pendingId,JSON.stringify(pending),new Date().toISOString()).run();
  return json({secret,expiresAt:pending.expires});
 }
 if(path==='/api/auth/mfa-enable'){
  if(credential.mfa)return json({error:'Two-step verification is already enabled.'},409);
  const pendingRow=await DB.prepare('SELECT content FROM prototype_settings WHERE id=?').bind(pendingId).first(),pending=pendingRow?JSON.parse(pendingRow.content):null;
  if(!pending||pending.expires<=Date.now()||pending.revision!==row.revision)return json({error:'Setup expired. Start again.'},409);
  const secret=await openSecret(pending.envelope,code),step=totpStep(secret,body.factor);
  if(step===null)return json({error:'That authenticator code is incorrect. Try the newest code.'},401);
  const recoveryCodes=newRecoveryCodes(),next={...credential,mfa:{envelope:pending.envelope,lastStep:step,recoveryHashes:recoveryCodes.map(recoveryHash),enabledAt:new Date().toISOString()}};
  const changed=await DB.prepare('UPDATE prototype_settings SET content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(next),new Date().toISOString(),credentialId,row.revision).run();
  if(changed.meta.changes!==1)return json({error:'Your settings changed. Sign in again.'},409);
  await DB.prepare('DELETE FROM prototype_settings WHERE id=?').bind(pendingId).run();context.setCookie('',0);
  return json({ok:true,recoveryCodes,message:'Two-step verification is enabled. Save these recovery codes securely, then sign in again.'});
 }
 const proof=await mfaProof(credential,code,body.factor);
 if(!proof)return json({error:'Enter a fresh authenticator code or an unused recovery code.',mfaRequired:true},401);
 if(path==='/api/auth/mfa-disable'){
  if(!credential.mfa)return json({error:'Two-step verification is not enabled.'},409);
  const next={...credential};delete next.mfa;
  const changed=await DB.prepare('UPDATE prototype_settings SET content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND content=?').bind(JSON.stringify(next),new Date().toISOString(),credentialId,row.revision,row.content).run();
  if(changed.meta.changes!==1)return json({error:'Your settings changed. Sign in again.'},409);context.setCookie('',0);return json({ok:true,message:'Two-step verification was disabled. All sessions have ended.'});
 }
 if(path==='/api/auth/code-change'){
  if(credential.mfa&&(!/^\d{12}$/.test(body.newCode||'')))return json({error:'Use 12 digits while two-step verification is enabled.'},400);
  if(typeof body.newCode!=='string'||!/^\d{6,12}$/.test(body.newCode)||/^(\d)\1+$/.test(body.newCode)||['123456','654321','12345678','123456789','1234567890'].includes(body.newCode))return json({error:'Choose 6–12 digits. Avoid repeated digits and simple sequences.'},400);
  if(body.newCode!==body.confirmCode)return json({error:'The new codes do not match.'},400);
  if(body.newCode===body.oldCode)return json({error:'Choose a different code from your current one.'},400);
  const next={...await hashCode(body.newCode),userId:credential.userId,initial:false,...(credential.mfa?{mfa:{...proof.record.mfa,envelope:await sealSecret(await openSecret(credential.mfa.envelope,code),body.newCode)}}:{})};const result=await DB.prepare('UPDATE prototype_settings SET content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND content=?').bind(JSON.stringify(next),new Date().toISOString(),credentialId,row.revision,row.content).run();if(result.meta.changes!==1)return json({error:'The code changed in another session. Sign in again.'},409);
  context.setCookie('',0);return json({ok:true,message:'Your code has been changed. All Goddess sessions have ended. Sign in with your new code.'});
 }
 if(credential.mfa){const consumed=await DB.prepare('UPDATE prototype_settings SET content=? WHERE id=? AND revision=? AND content=?').bind(JSON.stringify(proof.record),credentialId,row.revision,row.content).run();if(consumed.meta.changes!==1)return json({error:'This verification code was already used. Try a fresh code.'},409);}
 const t=randomBytes(32).toString('hex'),expires=Date.now()+ttl;
 await DB.prepare('INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES (?,?,?,?)').bind('goddess-session:'+digest(t),JSON.stringify({expires,userId:credential.userId,mfa:proof.verified}),row.revision,new Date().toISOString()).run();
 await DB.prepare("DELETE FROM prototype_settings WHERE id LIKE 'goddess-session:%' AND updated_at<?").bind(new Date(Date.now()-ttl).toISOString()).run();context.setCookie(t,ttl/1000);
 return json({ok:true,initialCode:credential.initial===true,redirect:credential.initial?'/dashboard.html#settings':safeReturn(body.returnTo)});
}
