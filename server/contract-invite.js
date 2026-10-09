// Administrator-approved private contract invitation; never a payment receipt.
const entryEntitled=entry=>['paid','granted'].includes(entry?.status);
async function contractEntryGrant(env,user){const row=await db(env).prepare('SELECT content FROM prototype_settings WHERE id=?').bind('entry-grant:'+user).first();if(!row)return null;const grant=JSON.parse(row.content);return grant.status==='granted'&&grant.approvedBy==='goddess'?grant:null;}
async function contractInviteSession(request,env){const token=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-vanessa_contract_invite=([a-f0-9]{48})(?:;|$)/)?.[1];if(!token)return null;const row=await db(env).prepare('SELECT content FROM prototype_settings WHERE id=?').bind('contract-invite-session:'+await chatHash(token)).first();if(!row)return null;const session=JSON.parse(row.content);if(session.expiresAt<=Date.now())return null;const invite=await squareRecord(env,session.inviteKey);if(!invite||invite.status!=='active'||invite.expiresAt<=Date.now()||!await contractEntryGrant(env,invite.user))return null;return invite.user;}
async function redeemContractInvite(request,env,url){
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 const body=await educationBody(request,url,1000);if(body instanceof Response)return body;
 if(Object.keys(body).some(k=>k!=='token')||typeof body.token!=='string'||! /^[a-f0-9]{64}$/.test(body.token))return json({error:'This invitation is unavailable.'},400);
 if(!await chatLimit(env,'contract-invite-ip:'+await chatHash(request.headers.get('cf-connecting-ip')||'unknown'),60,3600000))return json({error:'Please wait before retrying.'},429);
 const key='contract-invite:'+await chatHash(body.token),invite=await squareRecord(env,key);if(!invite||invite.status!=='active'||invite.expiresAt<=Date.now()||!await contractEntryGrant(env,invite.user))return json({error:'This invitation is unavailable or has expired. Contact Goddess.'},404);
 const token=chatToken(),expiresAt=Math.min(invite.expiresAt,Date.now()+12*3600000);
 await db(env).prepare('INSERT INTO prototype_settings(id,content,revision,updated_at) VALUES(?,?,1,?)').bind('contract-invite-session:'+await chatHash(token),JSON.stringify({inviteKey:key,expiresAt}),new Date().toISOString()).run();
 await db(env).prepare("DELETE FROM prototype_settings WHERE id LIKE 'contract-invite-session:%' AND (content::jsonb->>'expiresAt')::bigint<?").bind(Date.now()).run();
 const response=json({ok:true});response.headers.set('Set-Cookie','__Host-vanessa_contract_invite='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+Math.max(1,Math.floor((expiresAt-Date.now())/1000)));return response;
}
