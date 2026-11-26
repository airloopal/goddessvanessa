// Commercial journeys are separate from essential account notifications.
const COMMERCIAL_END=Date.parse('2026-12-01T00:00:00Z');
const COMMERCIAL_START=Date.parse('2026-11-25T00:00:00Z');
const COMMERCIAL_WEEK=7*86400000;
async function commercialSettings(env){const r=await squareRecord(env,'commercial-settings:'+squareMode(env));return {enabled:r?.enabled===true,blackFriday:r?.blackFriday===true};}
function commercialPrice(env,settings,plan,now=Date.now()){
 if(squareMode(env)!=='production'||!settings.blackFriday||now<COMMERCIAL_START||now>=COMMERCIAL_END)return {...plan};
 return {...plan,amount:Math.round(plan.amount*85/100),originalAmount:plan.amount,offerId:'black-friday-2026',discountPercent:15,offerEndsAt:new Date(COMMERCIAL_END).toISOString()};
}
function commercialHTML({title,text,link,label,eyebrow='HOUSE OF VANESSA',footer='A private account reminder. No attachments or access codes are included.',unsubscribe=null}){
 const esc=noticeEscape,origin='https://houseofvanessa.com';
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:Poppins;src:url('+origin+'/fonts/poppins-400-latin.woff2) format("woff2");font-weight:400}@font-face{font-family:Poppins;src:url('+origin+'/fonts/poppins-600-latin.woff2) format("woff2");font-weight:600}@media(max-width:600px){.email-pad{padding:26px 22px!important}.email-title{font-size:30px!important}}</style></head><body style="margin:0;background:#f5edf2;color:#291822;font-family:Poppins,Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">'+esc(title)+'</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#fffafd;border:1px solid #ddbacb;border-radius:24px;overflow:hidden"><tr><td align="center" style="background:#edbfd4;padding:30px 24px"><img src="'+origin+'/images/brand/vanessa-wordmark.png" width="148" alt="Goddess Vanessa" style="display:block;width:148px;height:auto"><p style="font-size:10px;letter-spacing:4px;color:#633048;margin:16px 0 0">HOUSE OF VANESSA</p></td></tr><tr><td class="email-pad" style="padding:34px"><p style="font-size:11px;letter-spacing:2px;font-weight:600;color:#9b305f;margin:0 0 18px">'+esc(eyebrow)+'</p><h1 class="email-title" style="font-size:36px;line-height:1.2;font-weight:600;margin:0 0 24px;letter-spacing:-1px">'+esc(title)+'</h1>'+text.split('\n\n').map(p=>'<p style="font-size:15px;line-height:1.75;margin:0 0 18px;white-space:pre-wrap;overflow-wrap:anywhere">'+esc(p)+'</p>').join('')+'<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0"><tr><td bgcolor="#9b305f" style="border-radius:28px"><a href="'+esc(link)+'" style="display:inline-block;padding:15px 26px;color:#fff;text-decoration:none;font-weight:600;font-size:15px">'+esc(label)+'</a></td></tr></table><p style="border-top:1px solid #ead6e1;padding-top:22px;font-size:11px;line-height:1.7;color:#765966">'+esc(footer)+(unsubscribe?'<br><a href="'+esc(unsubscribe)+'" style="color:#765966">Unsubscribe from offers</a> · <a href="'+origin+'/email-preferences.html" style="color:#765966">Email preferences</a>':'')+'</p></td></tr></table></td></tr></table></body></html>';
}
async function commercialPreferenceKey(email){return 'marketing-preference:'+await chatHash(email.trim().toLowerCase());}
async function commercialSavePreference(env,student,enabled){
 const key=await commercialPreferenceKey(student.email),old=await squareRecord(env,key),token=old?.unsubscribeToken||chatToken(),now=new Date().toISOString();
 const value={enabled,emailHash:key.split(':')[1],studentId:student.id,consentVersion:'offers-weekly-v1',...(enabled?{consentedAt:now}:{unsubscribedAt:now}),unsubscribeToken:token,...(old?.ownerExcluded===true?{ownerExcluded:true}: {})};
 await db(env).batch([db(env).prepare('INSERT INTO prototype_settings(id,content,revision,updated_at) VALUES(?,?,1,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,revision=prototype_settings.revision+1,updated_at=excluded.updated_at').bind(key,JSON.stringify(value),now),db(env).prepare('INSERT INTO prototype_settings(id,content,revision,updated_at) VALUES(?,?,1,?) ON CONFLICT(id) DO NOTHING').bind('marketing-unsubscribe:'+await chatHash(token),JSON.stringify({key}),now)]);
 return {enabled};
}
function commercialContent(kind,name,discount=false,expired=false){
 const hello='Hi '+String(name||'there').split(/\s+/)[0]+',',offer=discount?'\n\nBlack Friday: 15% off your next Contract purchase until 30 November, 23:59 UK time. Renewals and upgrades only. One offer per purchase; no stacking.':'',common=expired?'\n\nYour new term starts once your payment is confirmed. No automatic charge. Keep your existing login code and conversation.':'\n\nYour next plan starts after your current paid term. No automatic charge. Keep your existing login code and conversation.';
 if(kind==='black-friday')return {title:'Your next chapter. 15% less.',subject:'House of Vanessa · Your Black Friday invitation',text:hello+(expired?'\n\nReturn to your private access with a new Contract that suits you.':'\n\nContinue your private access with a Contract that suits you.')+offer+common,label:'Choose your next Contract',path:'/plans.html'};
 if(kind==='renewal')return {title:'Keep your membership going.',subject:'House of Vanessa · Choose your next Contract',text:hello+(expired?'\n\nYour previous Contract has ended. Choose a new Contract to return to your conversation.':'\n\nYour current access is nearing its end. Choose your next Contract to keep your conversation going.')+offer+common,label:'Renew Membership',path:'/plans.html'};
 if(kind==='upgrade')return {title:'Make room for more.',subject:'House of Vanessa · Explore your next plan',text:hello+'\n\nExplore a longer Contract for your next term, at the price shown before you pay.'+offer+common,label:'Explore Contract plans',path:'/plans.html'};
 return {title:'A little extra, by choice.',subject:'House of Vanessa · A gift for Goddess',text:hello+'\n\nIf you would like to send a little extra, explore Goddess’s Feed and choose a gift on a post you enjoy.\n\nGifts are optional and full price. This gift is non-refundable. No automatic charge.',label:'Explore Goddess’s Feed',path:'/feed.html'};
}
async function commercialEligible(env,s){
 if(!s||s.status!=='active'||!noticeEmail(s.email))return false;
 const p=await squareRecord(env,await commercialPreferenceKey(s.email));if(!p?.enabled||p.ownerExcluded===true||p.studentId!==s.id||p.consentVersion!=='offers-weekly-v1')return false;
 const life=await accountRecord(env,s.id);if(life.until>Date.now()||['pending','approved','deleting','deleted'].includes(life.deletion))return false;
 if(await squareAccessAllowed(env,s.user_id))return true;
 const {entry,contract}=await squarePaymentState(env,s.user_id);
 return entryEntitled(entry)&&contract?.status==='paid'&&Number.isFinite(Date.parse(contract.expiresAt));
}
async function commercialPayload(env,s,kind){
 s=await db(env).prepare('SELECT id,user_id,name,email,status FROM chat_students WHERE id=?').bind(s.id).first();
 if(!await commercialEligible(env,s))return null;
 const settings=await commercialSettings(env),p=await squareRecord(env,await commercialPreferenceKey(s.email)),origin=noticeOrigin(env);
 if(!settings.enabled||!origin||squareMode(env)!=='production')return null;
 const discount=!!commercialPrice(env,settings,{amount:100}).offerId;
 if(kind==='black-friday'&&!discount)return null;
 const expired=!await squareAccessAllowed(env,s.user_id);
 if(expired&&kind==='gift')return null;
 if(expired&&kind==='upgrade')kind='renewal';
 const c=commercialContent(kind,s.name,kind!=='gift'&&discount,expired),unsubscribe=origin+'/email-preferences.html?unsubscribe='+p.unsubscribeToken;
 return {from:env.EMAIL_FROM,to:[s.email],subject:c.subject,text:c.text+'\n\n'+origin+c.path+'\n\nUnsubscribe from offers: '+unsubscribe,html:commercialHTML({...c,link:origin+c.path,eyebrow:kind==='black-friday'?'BLACK FRIDAY · 15% OFF':'YOUR MEMBERSHIP',footer:'Optional member offers · At most one promotional email every seven days. Message and account alerts are separate.',unsubscribe}),headers:{'List-Unsubscribe':'<'+origin+'/api/email/unsubscribe?token='+p.unsubscribeToken+'>','List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}};
}
async function commercialDispatch(env){
 if(squareMode(env)!=='production'||noticeFixture(env)||noticeTestMode(env)||!noticeEnabled(env)||!noticeOrigin(env)||!(await commercialSettings(env)).enabled)return;
 const now=Date.now(),token=crypto.randomUUID(),leaseKey='commercial-lease:production';
 const lock=await db(env).prepare("INSERT INTO prototype_settings(id,content,revision,updated_at) VALUES(?,?,1,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,revision=prototype_settings.revision+1,updated_at=excluded.updated_at WHERE COALESCE((prototype_settings.content::jsonb->>'until')::bigint,0)<? RETURNING id").bind(leaseKey,JSON.stringify({token,until:now+120000}),new Date(now).toISOString(),now).run();if(!lock.meta.changes)return;
 try{
  const rows=await db(env).prepare("SELECT s.id,s.user_id,s.name,s.email,s.status FROM chat_students s JOIN prototype_settings p ON p.id LIKE 'marketing-preference:%' AND p.content::jsonb->>'studentId'=s.id AND p.content::jsonb->>'enabled'='true' WHERE s.status='active' ORDER BY s.created_at LIMIT 500").all();let attempts=0;
  for(const s of rows.results){
   if(attempts>=2||Date.now()-now>12000)break;
   if(!await commercialEligible(env,s))continue;
   const key='marketing-delivery:'+await chatHash(s.email.trim().toLowerCase()),prior=await squareRecord(env,key);
   if(prior?.lastAcceptedAt&&now-prior.lastAcceptedAt<COMMERCIAL_WEEK||prior?.state==='review'||prior?.nextAttempt>now)continue;
   let kind=prior?.pending?.kind;
   if(!kind){const {contract}=await squarePaymentState(env,s.user_id),end=Date.parse(contract?.expiresAt),settings=await commercialSettings(env);kind=commercialPrice(env,settings,{amount:100}).offerId?'black-friday':Number.isFinite(end)&&end-now<=COMMERCIAL_WEEK?'renewal':prior?.lastKind==='upgrade'?'gift':'upgrade';if(!contract?.expiresAt||squarePublic(contract)?.plan?.id==='infinite')kind='gift';}
   let pending=prior?.pending||{id:crypto.randomUUID(),kind,createdAt:now,attempts:0};
   if(now-pending.createdAt>=20*3600000||pending.attempts>=4){await commercialDeliveryWrite(env,key,{...prior,state:'review',pending});continue;}
   const payload=await commercialPayload(env,s,kind);if(!payload){if(prior?.pending)await commercialDeliveryWrite(env,key,{...prior,state:'review'});continue;}
   pending={...pending,attempts:pending.attempts+1};await commercialDeliveryWrite(env,key,{...prior,pending,state:'sending'});
   if(!await commercialPayload(env,s,kind))continue;
   attempts++;
   try{const r=await (env.EMAIL_FETCH||fetch)('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'commercial-'+pending.id},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)}),data=await r.json().catch(()=>({}));
    if(r.ok&&data.id)await commercialDeliveryWrite(env,key,{state:'accepted',lastAcceptedAt:now,lastKind:kind,providerId:data.id,studentId:s.id});
    else await commercialDeliveryWrite(env,key,{...prior,state:r.status===429||r.status>=500?'pending':'review',pending,nextAttempt:now+3600000});
   }catch{await commercialDeliveryWrite(env,key,{...prior,state:'pending',pending,nextAttempt:now+3600000});}
  }
 }finally{await db(env).prepare("UPDATE prototype_settings SET content=jsonb_set(content::jsonb,'{until}','0'::jsonb)::text WHERE id=? AND content::jsonb->>'token'=?").bind(leaseKey,token).run();}
}
async function commercialDeliveryWrite(env,key,value){delete value._revision;await db(env).prepare('INSERT INTO prototype_settings(id,content,revision,updated_at) VALUES(?,?,1,?) ON CONFLICT(id) DO UPDATE SET content=excluded.content,revision=prototype_settings.revision+1,updated_at=excluded.updated_at').bind(key,JSON.stringify(value),new Date().toISOString()).run();}
async function commercialAPI(request,env,url){
 if(url.pathname==='/api/email/unsubscribe'){
  const token=url.searchParams.get('token');if(!/^[a-f0-9]{48}$/.test(token||''))return json({error:'This unsubscribe link is unavailable.'},404);
  const map=await squareRecord(env,'marketing-unsubscribe:'+await chatHash(token));if(!map?.key?.startsWith('marketing-preference:'))return json({error:'This unsubscribe link is unavailable.'},404);
  if(request.method==='GET')return json({available:true});if(request.method!=='POST')return json({error:'Method not allowed'},405);
  await db(env).prepare("UPDATE prototype_settings SET content=(content::jsonb||jsonb_build_object('enabled',false,'unsubscribedAt',?::text))::text,revision=revision+1,updated_at=? WHERE id=?").bind(new Date().toISOString(),new Date().toISOString(),map.key).run();return json({enabled:false});
 }
 if(url.pathname==='/api/email/admin'){
  const owner=!!request.headers.get('oai-authenticated-user-id')&&request.headers.get('oai-authenticated-user-email')?.toLowerCase()===EDUCATION_OWNER&&request.headers.get('x-chat-role')!=='student';if(!owner)return json({error:'Goddess access required'},403);
  if(request.method==='GET'){const settings=await commercialSettings(env),counts=await db(env).prepare("SELECT content::jsonb->>'state' AS state,COUNT(*)::int AS count FROM prototype_settings WHERE id LIKE 'marketing-delivery:%' GROUP BY 1").all();const subscribed=await db(env).prepare("SELECT COUNT(*)::int AS count FROM prototype_settings WHERE id LIKE 'marketing-preference:%' AND content::jsonb->>'enabled'='true' AND COALESCE(content::jsonb->>'ownerExcluded','false')<>'true'").first();return json({settings,subscribed:subscribed.count,counts:counts.results,samples:['black-friday','renewal','upgrade','gift'].map(kind=>{const c=commercialContent(kind,'Alex',true);return {title:c.title,html:commercialHTML({...c,link:'https://houseofvanessa.com'+c.path,unsubscribe:'https://houseofvanessa.com/email-preferences.html',footer:'Preview only. No email is being sent.'})};})});}
  if(request.method!=='POST')return json({error:'Method not allowed'},405);const body=await educationBody(request,url,1000);if(body instanceof Response)return body;
  if(typeof body.enabled!=='boolean'||typeof body.blackFriday!=='boolean'||Object.keys(body).some(k=>!['enabled','blackFriday'].includes(k)))return json({error:'Choose the email and offer switches.'},400);
  await commercialDeliveryWrite(env,'commercial-settings:'+squareMode(env),{enabled:body.enabled,blackFriday:body.blackFriday,approvedAt:new Date().toISOString()});return json({ok:true});
 }
 const s=await billingAccount(request,env);if(!s||request.headers.get('oai-authenticated-user-id'))return json({error:'Sign in to your Sub account to manage email preferences.'},401);
 if(request.method==='GET'){const p=await squareRecord(env,await commercialPreferenceKey(s.email));return json({enabled:p?.enabled===true&&p.studentId===s.id});}
 if(request.method!=='POST')return json({error:'Method not allowed'},405);const body=await educationBody(request,url,1000);if(body instanceof Response)return body;
 if(typeof body.enabled!=='boolean'||Object.keys(body).some(k=>k!=='enabled'))return json({error:'Choose your own email preference.'},400);
 return json(await commercialSavePreference(env,s,body.enabled));
}
