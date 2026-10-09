// Administrator-approved private contract invitation; never a payment receipt.
const entryEntitled=entry=>['paid','granted'].includes(entry?.status);
async function contractEntryGrant(env,user){const row=await db(env).prepare('SELECT content,revision FROM prototype_settings WHERE id=?').bind('entry-grant:'+user).first();if(!row)return null;const grant=JSON.parse(row.content);return grant.status==='granted'&&grant.approvedBy==='goddess'?{...grant,_revision:row.revision}:null;}
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

async function individualContractConfig(env,user,published){const grant=user?await contractEntryGrant(env,user):null;return {...published,individualRevision:grant?.agreementRevision||0,config:grant?.agreement?{...published.config,agreement:{...published.config.agreement,...grant.agreement}}:published.config};}
async function contractEditorAPI(request,env,url,owner){
 if(!owner)return json({error:'Only Goddess can edit individual contracts.'},403);
 if(request.method==='GET'){
  const rows=await db(env).prepare("SELECT g.id,g.content,g.revision,c.content AS contact FROM prototype_settings g LEFT JOIN prototype_settings c ON c.id='sub-contact:'||substring(g.id from 13) WHERE g.id LIKE 'entry-grant:%' ORDER BY g.updated_at DESC LIMIT 100").all();
  const published=await educationConfig(env),contracts=[];
  for(const r of rows.results||[]){const g=JSON.parse(r.content);if(g.status!=='granted'||g.approvedBy!=='goddess'||!g.skipQuestions)continue;const contact=r.contact?JSON.parse(r.contact):{},user=r.id.slice(12),saved=await db(env).prepare('SELECT reference,snapshot FROM education_enrolments WHERE user_id=?').bind(user).first(),state=await squarePaymentState(env,user);contracts.push({id:r.id,name:contact.name||'Invited applicant',email:contact.email||'',revision:r.revision,agreement:(saved?JSON.parse(saved.snapshot).agreement:null)||g.agreement||{title:published.config.agreement.title,body:published.config.agreement.body,acceptableUse:published.config.agreement.acceptableUse},locked:!!g.contractLocked||!!saved||!!state.contract});}
  return json({contracts});
 }
 if(request.method!=='PUT')return json({error:'Method not allowed.'},405);
 const p=await educationBody(request,url,INDIVIDUAL_CONTRACT_LIMITS.requestBytes);if(p instanceof Response)return p;
 if(Object.keys(p).some(k=>!['id','revision','agreement'].includes(k))||typeof p.id!=='string'||!/^entry-grant:application:[a-f0-9]{64}$/.test(p.id)||!Number.isInteger(p.revision)||!p.agreement||typeof p.agreement!=='object'||Array.isArray(p.agreement)||Object.keys(p.agreement).some(k=>!['title','body','acceptableUse'].includes(k))||!validIndividualContractText(p.agreement))return json({error:'Provide a title (up to 160 characters), contract text (up to 250,000) and acceptable-use policy (up to 100,000).'},400);
 const user=p.id.slice(12),grant=await contractEntryGrant(env,user);if(!grant||!grant.skipQuestions)return json({error:'Individual contract not found.'},404);
 if(grant.contractLocked||await db(env).prepare('SELECT reference FROM education_enrolments WHERE user_id=?').bind(user).first()||(await squarePaymentState(env,user)).contract)return json({error:'This contract is signed or checkout has started. Its terms are locked.'},409);
 const next={...grant,agreementUpdatedAt:new Date().toISOString(),agreementUpdatedBy:'goddess',agreement:Object.fromEntries(Object.entries(p.agreement).map(([k,v])=>[k,v.trim()])),agreementRevision:(grant.agreementRevision||0)+1};
 const saved=await squareWrite(env,p.id,next,p.revision);return saved.meta.changes?json({ok:true,revision:p.revision+1}):json({error:'A newer version was saved or signing began. Reload before editing.'},409);
}
