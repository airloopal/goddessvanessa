// Square-hosted checkout. Private records use the existing academy settings table.
// Nothing in this module accepts card data or trusts a browser-provided price.
function squareMode(env){return ['sandbox','production'].includes(env.SQUARE_ENVIRONMENT)?env.SQUARE_ENVIRONMENT:'off';}
function squareReady(env){return squareMode(env)!=='off'&&!!(env.SQUARE_ACCESS_TOKEN&&env.SQUARE_LOCATION_ID&&env.SQUARE_WEBHOOK_SIGNATURE_KEY&&env.SQUARE_WEBHOOK_URL&&env.SQUARE_SITE_URL)&&(squareMode(env)!=='production'||env.SQUARE_LIVE_ENABLED==='true');}
async function squareCall(env,path,body){
 const base=squareMode(env)==='production'?'https://connect.squareup.com':'https://connect.squareupsandbox.com';
 const r=await (env.SQUARE_FETCH||fetch)(base+'/v2/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+env.SQUARE_ACCESS_TOKEN,'Content-Type':'application/json','Square-Version':'2025-01-23'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
 if(!r.ok){const data=await r.json().catch(()=>({}));const e=Error('Square request failed ('+r.status+').');e.squareCodes=(data.errors||[]).map(x=>x.code);e.squareStatus=r.status;e.squareOperation=path==='online-checkout/payment-links'?'checkout-link':path==='orders'?'order-create':path.startsWith('orders/')?'order-read':path==='payments'?'payment-create':path.startsWith('payments/')?'payment-read':'other';throw e;}return r.json();
}
async function squareRecord(env,key){const r=await db(env).prepare('SELECT content,revision FROM prototype_settings WHERE id=?').bind(key).first();return r?{...JSON.parse(r.content),_revision:r.revision}:null;}
// A definitive email-prefill rejection creates no checkout. Recover once without
// that optional field; retain contact data, order/price and one shared retry key.
async function squareCheckoutLink(env,key,r){
 try{return await squareCall(env,'online-checkout/payment-links',r.request);}catch(error){
  if(error.squareStatus!==400||!error.squareCodes?.includes('INVALID_EMAIL_ADDRESS')||typeof r.request?.pre_populated_data?.buyer_email!=='string')throw error;
  const current=await squareRecord(env,key);if(current.checkoutUrl)return {payment_link:{url:current.checkoutUrl,order_id:current.orderId}};
  if(current.method!=='hosted'||current.status!=='pending'||current.paymentId||current.cardAttempt)throw error;
  if(typeof current.request?.pre_populated_data?.buyer_email==='string'){
   const prefill={...current.request.pre_populated_data};delete prefill.buyer_email;const request={...current.request,idempotency_key:crypto.randomUUID()};if(Object.keys(prefill).length)request.pre_populated_data=prefill;else delete request.pre_populated_data;
   await squareWrite(env,key,{...current,idempotencyKey:request.idempotency_key,request},current._revision);
  }
  const retry=await squareRecord(env,key);if(retry.checkoutUrl)return {payment_link:{url:retry.checkoutUrl,order_id:retry.orderId}};if(retry.method!=='hosted'||retry.status!=='pending'||retry.paymentId||retry.cardAttempt)throw error;
  return squareCall(env,'online-checkout/payment-links',retry.request);
 }
}
async function squareWrite(env,key,value,revision){const {_revision,_key,...clean}=value;return db(env).prepare('UPDATE prototype_settings SET content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(clean),new Date().toISOString(),key,revision).run();}
const squareKey=async(env,user,stage)=>'sq-'+squareMode(env)+'-'+stage[0]+'-'+(await chatHash(user)).slice(0,24);
function squarePromo(code){const normalized=typeof code==='string'?code.trim().toUpperCase():'';return ['SUB50','SUB25'].includes(normalized)?normalized:null;}
function squaredAmountMismatch(plan,signed,promo){return signed.amount!==squarePriced(plan,promo).amount||(promo&&!squarePromo(promo));}
function squarePriced(plan,promo){return promo?{...plan,originalAmount:plan.amount,amount:Math.round(plan.amount*(promo==='SUB25'?75:50)/100),promoCode:promo}:plan;}
function squarePublic(r){return r?{stage:r.stage,plan:r.plan,status:r.status,receiptUrl:r.receiptUrl||null,paidAt:r.paidAt||null,expiresAt:r.expiresAt||null,granted:r.status==='granted',canChangePromo:r.stage==='entry'&&r.status!=='granted'&&r.method==='embedded'&&r.status==='pending'&&!r.cardAttempt&&!r.paymentId}:null;}
function squareExpiry(plan,start){const d=new Date(start);if(plan==='infinite')return null;if(plan==='day')return new Date(d.getTime()+86400000).toISOString();const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+(plan==='quarter'?3:1));const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.toISOString();}
function squareContractExpiry(r,paidAt){const normal=squareExpiry(r.plan.id,paidAt);if(normal===null)return null;const grant=Date.parse(r.grantedExpiresAt);return Number.isFinite(grant)?new Date(Math.max(Date.parse(normal),grant)).toISOString():normal;}
async function squarePaymentState(env,user){const [entry,contract,support]=await Promise.all(['entry','contract','support'].map(async stage=>squareRecord(env,await squareKey(env,user,stage))));if(contract?.status==='paid'&&contract.expiresAt&&support?.status==='paid'&&Date.parse(support.expiresAt)>Date.parse(contract.expiresAt))contract.expiresAt=support.expiresAt;const grant=await contractEntryGrant(env,user);const effectiveEntry=grant&&entry?.status==='pending'&&entry.plan.id===grant.entryId?{...entry,status:'granted',plan:{...entry.plan,amount:0},grant}:entry;return {entry:effectiveEntry,contract};}
async function squareAccessDeadline(env,user){
 if(squareMode(env)==='off')return Infinity;
 const {entry,contract}=await squarePaymentState(env,user);
 // Preserve manually approved learners who have no checkout records.
 if(!entry&&!contract)return Infinity;
 if(!entryEntitled(entry)||contract?.status!=='paid')return 0;
 const end=contract.expiresAt?Date.parse(contract.expiresAt):Infinity;
 return end>Date.now()?end:0;
}
async function squareAccessAllowed(env,user){return (await squareAccessDeadline(env,user))>Date.now();}
async function squareApplyPayment(env,paymentId){
 const {payment:p}=await squareCall(env,'payments/'+encodeURIComponent(paymentId));if(!p?.order_id)return;
 const {order}=await squareCall(env,'orders/'+encodeURIComponent(p.order_id));const key=order?.reference_id;
 if(typeof key!=='string'||!key.startsWith('sq-'+squareMode(env)+'-'))return;
 for(let attempt=0;attempt<5;attempt++){
  const r=await squareRecord(env,key);if(!r)return;
  if(r.orderId&&r.orderId!==p.order_id)return;
  if(p.location_id!==env.SQUARE_LOCATION_ID||order.location_id!==env.SQUARE_LOCATION_ID||p.amount_money?.amount!==r.plan.amount||p.amount_money?.currency!=='GBP'||p.total_money?.amount!==r.plan.amount||p.total_money?.currency!=='GBP')return;
  if(r.method==='embedded'&&['FAILED','CANCELED'].includes(p.status))return;
  const replacing=r.paymentId&&r.paymentId!==p.id;
  if(replacing){
   if(r.status!=='pending'||r.paidAt||r.method!=='hosted')return;
   const {payment:previous}=await squareCall(env,'payments/'+encodeURIComponent(r.paymentId));
   if(previous?.order_id!==p.order_id||!['FAILED','CANCELED'].includes(previous.status))return;
  }
  // Re-fetching Square's current object avoids replaying stale webhook payloads.
  if(!replacing&&r.providerUpdatedAt&&p.updated_at<r.providerUpdatedAt)return;
  let status=r.status;
  if(p.status==='COMPLETED')status=p.refunded_money?.amount>0||r.status==='refund_review'?'refund_review':'paid';
  else if(['FAILED','CANCELED'].includes(p.status)&&r.status!=='paid')status='pending';
  const paidAt=r.paidAt||(status==='paid'?(p.card_details?.card_payment_timeline?.captured_at||p.updated_at):null);
  const next={...r,orderId:p.order_id,paymentId:p.id,status,paidAt,providerStatus:p.status,providerUpdatedAt:p.updated_at,receiptUrl:p.receipt_url||null,expiresAt:r.stage==='contract'&&paidAt?squareContractExpiry(r,paidAt):null};
  if(r.stage==='support'&&status==='paid'){const contract=await squareRecord(env,await squareKey(env,r.user,'contract'));if(!contract||contract.status!=='paid')return;next.expiresAt=r.expiresAt||squareExpiry('month',new Date(Math.max(Date.parse(paidAt),contract.expiresAt?Date.parse(contract.expiresAt):Date.parse(paidAt))).toISOString());}
  if(r.stage==='donation'&&r.cardAttempt&&['paid','refund_review'].includes(status))next.cardAttempt={id:r.cardAttempt.id,complete:true};
  const result=await squareWrite(env,key,next,r._revision);if(result.meta.changes){if(r.stage==='support'&&status==='paid')await db(env).prepare("UPDATE chat_students SET code_expires=GREATEST(code_expires,?) WHERE user_id=? AND status='active' AND code_hash IS NOT NULL").bind(Date.parse(next.expiresAt),r.user).run();return;}
 }
 throw Error('Concurrent payment update; retry required.');
}
async function squareReconcile(env,r){
 if(!r)return;const recordKey=r._key||await squareKey(env,r.user,r.stage);
 if(r.paymentId){await squareApplyPayment(env,r.paymentId);r=await squareRecord(env,recordKey);if(!r||r.status!=='pending')return;}
 if(!r.orderId)return;
 const {order}=await squareCall(env,'orders/'+encodeURIComponent(r.orderId));
 if(order?.id!==r.orderId||order.location_id!==env.SQUARE_LOCATION_ID)return;
 for(const t of order.tenders||[]){const paymentId=t.payment_id||t.id;if(typeof paymentId==='string'&&paymentId&&paymentId!==r.paymentId)await squareApplyPayment(env,paymentId);}
}
async function squareWebhook(request,env){
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 if(!squareReady(env))return json({error:'Payments are not configured.'},503);
 let raw;try{raw=await boundedText(request,1000000);}catch(error){return json({error:error.status===413?'Request too large':'Invalid request body'},error.status===413?413:400);}
 const signature=request.headers.get('x-square-hmacsha256-signature')||'';
 let bytes;try{bytes=Uint8Array.from(atob(signature),c=>c.charCodeAt(0));}catch{return json({error:'Invalid signature'},403);}
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.SQUARE_WEBHOOK_SIGNATURE_KEY),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(env.SQUARE_WEBHOOK_URL+raw)))return json({error:'Invalid signature'},403);
 let event;try{event=JSON.parse(raw);}catch{return json({error:'Invalid JSON'},400);}
 const object=event.data?.object;
 const paymentId=event.type?.startsWith('payment.')?object?.payment?.id:event.type?.startsWith('refund.')?object?.refund?.payment_id:null;
 if(paymentId)await squareApplyPayment(env,paymentId);
 return json({ok:true});
}
async function squareAPI(request,env,url,{user,owner}){
 if(url.pathname==='/api/education/payments/webhook')return squareWebhook(request,env);
 const mode=squareMode(env),ready=squareReady(env);
 if(url.pathname==='/api/education/payments'&&request.method==='GET'){
  const state=user?await squarePaymentState(env,user):{};const contact=user?await db(env).prepare('SELECT content FROM prototype_settings WHERE id=?').bind('sub-contact:'+user).first():null;
  const draft=user?await squareRecord(env,'application-progress:'+user):null;
  const grant=user?await contractEntryGrant(env,user):null;return json({applicationKey:user?(await chatHash(user)).slice(0,24):null,draft:draft?{...draft,revision:draft._revision}:null,invitation:request.headers.get('x-education-invite')==='contract'&&grant?{contractId:grant.contractId,promoCode:grant.promoCode,pathId:grant.pathId}:null,contact:contact?JSON.parse(contact.content):null,mode,ready,embeddedReady:ready&&!!env.SQUARE_APPLICATION_ID,applicationId:env.SQUARE_APPLICATION_ID||null,locationId:env.SQUARE_LOCATION_ID||null,entry:squarePublic(state.entry),contract:squarePublic(state.contract)});
 }
 if(url.pathname==='/api/education/payments/support')return squareSupportPayment(request,env,url);
 if(!user)return json({error:'Start your application in this browser first.'},401);
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 const body=await educationBody(request,url,4000);if(body instanceof Response)return body;
 if(!ready)return json({error:'Payments are not available yet. Please try again later.'},503);
 if(!await chatLimit(env,'square:'+await chatHash(user),30,60000))return json({error:'Please wait before trying again.'},429);
 if(url.pathname==='/api/education/payments/diagnostic'){
  const issues=['bank_verification_timeout','bank_policy_blocked','bank_verification_failed'];
  if(!['entry','contract'].includes(body.stage)||!issues.includes(body.issue)||Object.keys(body).some(k=>!['stage','issue'].includes(k)))return json({error:'Invalid diagnostic.'},400);
  if(!await squareRecord(env,await squareKey(env,user,body.stage)))return json({error:'Checkout unavailable.'},404);
  if(!await chatLimit(env,'square-diagnostic:'+await chatHash(user),4,3600000))return json({error:'Diagnostic limit reached.'},429);
  const at=new Date().toISOString(),requestId=crypto.randomUUID();
  await db(env).prepare('INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES (?,?,1,?)').bind('diagnostic:'+requestId,JSON.stringify({at,area:'payments',status:408,requestId,issue:body.issue,source:'browser'}),at).run();
  await db(env).prepare("DELETE FROM prototype_settings WHERE id IN (SELECT id FROM prototype_settings WHERE id LIKE 'diagnostic:%' ORDER BY updated_at DESC,id DESC OFFSET 100) OR (id LIKE 'diagnostic:%' AND updated_at<?)").bind(new Date(Date.now()-7*86400000).toISOString()).run();
  return json({ok:true});
 }
 if(url.pathname==='/api/education/payments/refresh'){
  const state=await squarePaymentState(env,user);for(const r of [state.entry,state.contract])await squareReconcile(env,r);
  const fresh=await squarePaymentState(env,user);return json({mode,ready,entry:squarePublic(fresh.entry),contract:squarePublic(fresh.contract)});
 }
 if(url.pathname==='/api/education/payments/promo'){const promo=squarePromo(body.promoCode);if(!promo)return json({error:'This promo code is not valid.'},400);const {config}=await educationConfig(env);return json({promoCode:promo,entryPlans:config.agreement.entryPlans.map(p=>squarePriced(p,promo)),contractPlans:config.agreement.contractPlans.map(p=>squarePriced(p,promo))});}
 const embedded=['/api/education/payments/prepare','/api/education/payments/charge'].includes(url.pathname);
 if(embedded&&!env.SQUARE_APPLICATION_ID)return json({error:'Card checkout is being configured. Please return shortly.'},503);
 if(!embedded&&!['/api/education/payments/checkout','/api/education/payments/fallback'].includes(url.pathname))return json({error:'Not found'},404);
 if(!['entry','contract'].includes(body.stage))return json({error:'Choose a payment stage.'},400);
 const {config,revision}=await educationConfig(env);
 if(body.revision!==revision)return json({error:'Rates changed. Reload the application before paying.',code:'settings_changed'},409);
 let plan=config.agreement[body.stage==='entry'?'entryPlans':'contractPlans'].find(p=>p.id===body.planId),agreementId=null,email=null;
 if(body.promoCode&&!squarePromo(body.promoCode))return json({error:'This promo code is not valid.'},400);
 let promo=squarePromo(body.promoCode);
 if(!plan||plan.amount<=0)return json({error:'Choose a valid plan.'},400);
 if(body.stage==='entry'&&await contractEntryGrant(env,user))return json({error:'Your entry is granted by Goddess. No entry charge is required.'},409);
 if(body.stage==='contract'){
  const {entry}=await squarePaymentState(env,user);if(!entryEntitled(entry))return json({error:'Complete your entry payment first.'},409);
  const row=await db(env).prepare('SELECT snapshot FROM education_enrolments WHERE user_id=?').bind(user).first();
  const agreement=row?JSON.parse(row.snapshot).agreement:null;
  const individualGrant=await contractEntryGrant(env,user);
  if(!agreement||(agreement.individualRevision||0)!==(individualGrant?.agreementRevision||0)||agreement.revision!==revision||agreement.contract.id!==plan.id||agreement.entry.id!==entry.plan.id)return json({error:'Save and sign the current agreement before paying.'},409);
  agreementId=agreement.id;email=agreement.email;promo=agreement.contract.promoCode||null;
  if(squaredAmountMismatch(plan,agreement.contract,promo))return json({error:'Review and sign the current contract price again.'},409);
 }
 plan=squarePriced(plan,promo);
 const key=await squareKey(env,user,body.stage);
 let r=await squareRecord(env,key);
 if(body.stage==='entry'&&!r){const c=body.contact;
 if(c!==undefined&&(!c||typeof c!=='object'||Array.isArray(c)))return json({error:'Enter a valid email address or leave it blank.'},400);
 const supplied=c?.email;if(supplied!==undefined&&typeof supplied!=='string')return json({error:'Enter a valid email address or leave it blank.'},400);
 const optionalEmail=(supplied||'').trim();if(optionalEmail&&(optionalEmail.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(optionalEmail)))return json({error:'Enter a valid email address or leave it blank.'},400);
 await db(env).prepare('INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(id) DO UPDATE SET content=(prototype_settings.content::jsonb || excluded.content::jsonb)::text,revision=prototype_settings.revision+1,updated_at=excluded.updated_at').bind('sub-contact:'+user,JSON.stringify({email:optionalEmail,pathId:config.paths.some(p=>p.id===body.pathId)?body.pathId:null}),new Date().toISOString()).run();email=optionalEmail||null;}

 if(!r){
  const initial={method:embedded?'embedded':'hosted',user,stage:body.stage,plan,agreementId,mode,status:'pending',idempotencyKey:crypto.randomUUID(),createdAt:new Date().toISOString()};
  // Return to the same site that owns the host-only application cookie.
  const returnURL=new URL('/application.html',url.origin);returnURL.searchParams.set('payment',body.stage);if(request.headers.get('x-education-invite')==='contract')returnURL.searchParams.set('invitation','1');
  initial.request={idempotency_key:initial.idempotencyKey,order:{location_id:env.SQUARE_LOCATION_ID,reference_id:key,line_items:[{name:(body.stage==='entry'?'Entry fee — ':'Contract — ')+plan.name,quantity:'1',base_price_money:{amount:plan.amount,currency:'GBP'}}]},checkout_options:{redirect_url:returnURL.href,allow_tipping:false,ask_for_shipping_address:false},...(email?{pre_populated_data:{buyer_email:email}}:{})};
  await db(env).prepare('INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(id) DO NOTHING').bind(key,JSON.stringify(initial),initial.createdAt).run();r=await squareRecord(env,key);
 }
 // Reprice only an untouched embedded entry checkout. Reconcile first so a paid
 // order can never be replaced; preserve all attempts and hosted payment links.
 if(body.stage==='entry'&&embedded&&r.method==='embedded'&&r.status==='pending'&&!r.cardAttempt&&!r.paymentId&&r.plan.id===plan.id&&r.plan.amount!==plan.amount){
  await squareReconcile(env,r);r=await squareRecord(env,key);
  if(r.status==='pending'&&!r.cardAttempt&&!r.paymentId){
   const next={...r,plan,idempotencyKey:crypto.randomUUID(),orderId:null};
   next.request={...r.request,idempotency_key:next.idempotencyKey,order:{...r.request.order,line_items:[{name:'Entry fee — '+plan.name,quantity:'1',base_price_money:{amount:plan.amount,currency:'GBP'}}]}};
   await squareWrite(env,key,next,r._revision);r=await squareRecord(env,key);
  }
 }
 if(r.plan.id!==plan.id||r.plan.amount!==plan.amount||(body.stage==='contract'&&r.agreementId!==agreementId))return json({error:'A checkout already exists for your earlier selection. Return to that selection or contact the academy before changing it.'},409);
 await squareReconcile(env,r);r=await squareRecord(env,key);
 if(r.status==='paid')return json({paid:true,payment:squarePublic(r)});
 if(r.status==='refund_review')return json({error:'This payment needs an administrator review.'},409);
 if(url.pathname==='/api/education/payments/fallback'&&r.method==='embedded'){
  // Reconciliation above must find no payment. A server-recorded definitive
  // failure (with its charge request discarded) may recover on hosted checkout.
  // Unknown/in-flight attempts remain locked; charge/fallback compete on revision.
  const failedAttempt=r.cardAttempt?.failed===true&&!r.cardAttempt.complete&&!r.cardAttempt.request;
  if(r.status!=='pending'||(r.cardAttempt&&!failedAttempt)||r.paymentId)return json({error:'A payment is already being checked. Use Check payment status before another checkout.'},409);
  const idempotencyKey=crypto.randomUUID(),{cardAttempt:discardedAttempt,...recoverable}=r;
  await squareWrite(env,key,{...recoverable,method:'hosted',orderId:null,idempotencyKey,request:{...r.request,idempotency_key:idempotencyKey}},r._revision);
  r=await squareRecord(env,key);
  if(r.method!=='hosted')return json({error:'Checkout changed. Check payment status before continuing.'},409);
 }
 if(embedded){if(r.method==='hosted'&&url.pathname.endsWith('/prepare'))return json({hosted:true,plan:r.plan,mode});return squareEmbedded(request,env,url,body,key,r);}
 if(r.method==='embedded')return json({error:'Please use the on-page card form.'},409);
 if(!r.checkoutUrl){
  const result=await squareCheckoutLink(env,key,r),link=result.payment_link;
  if(!link?.url||!link.order_id)throw Error('Square did not return a checkout.');
  const target=new URL(link.url);if(target.protocol!=='https:'||!['square.link','sandbox.square.link'].includes(target.hostname))throw Error('Unexpected checkout host.');
  for(let attempt=0;attempt<5;attempt++){
   r=await squareRecord(env,key);if(r.checkoutUrl)break;
   const saved=await squareWrite(env,key,{...r,checkoutUrl:link.url,orderId:link.order_id,linkId:link.id},r._revision);if(saved.meta.changes)break;
  }
  r=await squareRecord(env,key);
 }
 return json({url:r.checkoutUrl,mode});
}

// The browser supplies a single-use Square token, never a card number or price.
async function squareEmbedded(request,env,url,body,key,r){
 if(r.method!=='embedded')return json({error:'An earlier hosted checkout is still open. Complete it and use Check payment status before continuing.'},409);
 if(!r.orderId){
  const {order}=await squareCall(env,'orders',{idempotency_key:r.idempotencyKey,order:r.request.order});
  if(!order?.id)throw Error('Square did not return an order.');
  await squareWrite(env,key,{...r,orderId:order.id},r._revision);r=await squareRecord(env,key);
  if(!r.orderId)return json({error:'Checkout changed. Please try again.'},409);
 }
 if(url.pathname.endsWith('/prepare'))return json({plan:r.plan,mode:squareMode(env),applicationId:env.SQUARE_APPLICATION_ID,locationId:env.SQUARE_LOCATION_ID,resumeAttempt:r.cardAttempt&&!r.cardAttempt.failed&&!r.cardAttempt.complete?r.cardAttempt.id:null});
 if(typeof body.attemptId!=='string'||! /^[a-f0-9-]{36}$/.test(body.attemptId))return json({error:'Invalid payment attempt.'},400);
 if(!r.cardAttempt||r.cardAttempt.failed){
  if(r.cardAttempt?.id===body.attemptId)return json({error:'This card attempt was declined. Please try again.',retryCard:true},402);
  if(typeof body.sourceId!=='string'||!body.sourceId.startsWith('cnon:')||body.sourceId.length>1024)return json({error:'Enter your card in the secure payment form.'},400);
  const attempt={id:body.attemptId,request:{source_id:body.sourceId,idempotency_key:crypto.randomUUID(),amount_money:{amount:r.plan.amount,currency:'GBP'},location_id:env.SQUARE_LOCATION_ID,order_id:r.orderId,reference_id:key,autocomplete:true}};
  await squareWrite(env,key,{...r,cardAttempt:attempt},r._revision);r=await squareRecord(env,key);
 }
 if(r.method!=='embedded'||!r.cardAttempt||r.cardAttempt.id!==body.attemptId)return json({error:'Another payment is being checked. Refresh its status before trying again.'},409);
 let result;
 try{result=await squareCall(env,'payments',r.cardAttempt.request);}catch(e){
  const declines=['CARD_DECLINED','CVV_FAILURE','ADDRESS_VERIFICATION_FAILURE','CARD_EXPIRED','GENERIC_DECLINE','INSUFFICIENT_FUNDS','CARD_TOKEN_EXPIRED','CARD_TOKEN_USED','CARD_DECLINED_VERIFICATION_REQUIRED'];
  if(e.squareCodes?.some(c=>declines.includes(c))){
   const current=await squareRecord(env,key);
   if(current.status==='paid')return json({paid:true,payment:squarePublic(current)});
   if(current.cardAttempt?.id===body.attemptId)await squareWrite(env,key,{...current,cardAttempt:{id:body.attemptId,failed:true}},current._revision);
   return json({error:'The card was not accepted. Check your details or try another card.',retryCard:true},402);
  }
  return json({error:'Payment confirmation is delayed. Retry confirmation to check this same payment.',retrySame:true},503);
 }
 const p=result.payment;if(!p?.id) return json({error:'Payment confirmation is delayed. Retry confirmation.',retrySame:true},503);
 if(['FAILED','CANCELED'].includes(p.status)){const current=await squareRecord(env,key);if(current.status==='paid')return json({paid:true,payment:squarePublic(current)});if(current.cardAttempt?.id===body.attemptId)await squareWrite(env,key,{...current,cardAttempt:{id:body.attemptId,failed:true}},current._revision);return json({error:'The card payment was not completed. Please try another card.',retryCard:true},402);}
 // Read Square's authoritative payment and validate its order, amount, currency and location.
 await squareApplyPayment(env,p.id);
 const current=await squareRecord(env,key);
 if(current.status==='paid'||current.status==='refund_review'){
  // Discard the one-use token after a confirmed charge; preserve its attempt identity.
  await squareWrite(env,key,{...current,cardAttempt:{id:body.attemptId,complete:true}},current._revision);
  return json({paid:current.status==='paid',payment:squarePublic(current)});
 }
 return json({error:'Your payment is still being confirmed. Check payment status before trying another card.',retrySame:true},202);
}

// Private administrator-approved one-off support offer. No self-service plan creation.
async function squareSupportPayment(request,env,url){
 if(request.method!=='POST')return json({error:'Method not allowed.'},405);
 const body=await educationBody(request,url,1000);if(body instanceof Response)return body;
 if(Object.keys(body).some(k=>!['token','checkout'].includes(k))||typeof body.token!=='string'||! /^[a-f0-9]{64}$/.test(body.token)||typeof body.checkout!=='boolean')return json({error:'This payment link is unavailable.'},400);
 if(!squareReady(env))return json({error:'Payments are temporarily unavailable. Please retry.'},503);
 if(!await chatLimit(env,'support-offer-ip:'+await chatHash(request.headers.get('cf-connecting-ip')||'unknown'),300,60000))return json({error:'Please wait before retrying.'},429);
 const hash=await chatHash(body.token);if(!await chatLimit(env,'support-offer:'+hash,20,60000))return json({error:'Please wait before retrying.'},429);
 const row=await db(env).prepare("SELECT id,content,revision FROM prototype_settings WHERE id LIKE ? AND content::jsonb->>'offerHash'=? LIMIT 1").bind('sq-'+squareMode(env)+'-s-%',hash).first();if(!row)return json({error:'This payment link is unavailable.'},404);
 const key=row.id;let r={...JSON.parse(row.content),_revision:row.revision,_key:key};
 if(r.stage!=='support'||r.mode!==squareMode(env)||r.plan?.id!=='month'||!Number.isSafeInteger(r.plan.amount)||r.plan.amount<1)return json({error:'This payment link is unavailable.'},404);
 await squareReconcile(env,r);r=await squareRecord(env,key);
 if(r.status==='paid')return json({paid:true,amount:r.plan.amount,expiresAt:r.expiresAt});
 if(r.status==='refund_review')return json({error:'This payment needs Goddess’s review.'},409);
 if(r.offerExpiresAt<Date.now())return json({error:'This offer has expired. Please contact Goddess.'},410);
 if(!body.checkout)return json({paid:false,amount:r.plan.amount});
 if(!r.request){const request={idempotency_key:r.idempotencyKey,order:{location_id:env.SQUARE_LOCATION_ID,reference_id:key,line_items:[{name:'One-off access · 1 month · 50% discount',quantity:'1',base_price_money:{amount:r.plan.amount,currency:'GBP'}}]},checkout_options:{redirect_url:new URL('/support-payment.html',url.origin).href+'#'+body.token,allow_tipping:false,ask_for_shipping_address:false}};await squareWrite(env,key,{...r,request},r._revision);r=await squareRecord(env,key);}
 if(!r.checkoutUrl){const result=await squareCall(env,'online-checkout/payment-links',r.request),link=result.payment_link;let target;try{target=new URL(link?.url);}catch{return json({error:'Checkout unavailable. Please retry.'},503);}if(target.protocol!=='https:'||target.hostname!==(squareMode(env)==='production'?'square.link':'sandbox.square.link')||!link.order_id)return json({error:'Checkout unavailable. Please retry.'},503);for(let i=0;i<5;i++){r=await squareRecord(env,key);if(r.checkoutUrl)break;const saved=await squareWrite(env,key,{...r,checkoutUrl:link.url,orderId:link.order_id,linkId:link.id},r._revision);if(saved.meta.changes)break;}}
 r=await squareRecord(env,key);return r.checkoutUrl?json({paid:false,amount:r.plan.amount,url:r.checkoutUrl}):json({error:'Checkout is being prepared. Please retry.'},503);
}
