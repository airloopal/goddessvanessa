// Square-hosted checkout. Private records use the existing academy settings table.
// Nothing in this module accepts card data or trusts a browser-provided price.
function squareMode(env){return ['sandbox','production'].includes(env.SQUARE_ENVIRONMENT)?env.SQUARE_ENVIRONMENT:'off';}
function squareReady(env){return squareMode(env)!=='off'&&!!(env.SQUARE_ACCESS_TOKEN&&env.SQUARE_LOCATION_ID&&env.SQUARE_WEBHOOK_SIGNATURE_KEY&&env.SQUARE_WEBHOOK_URL&&env.SQUARE_SITE_URL)&&(squareMode(env)!=='production'||env.SQUARE_LIVE_ENABLED==='true');}
async function squareCall(env,path,body){
 const base=squareMode(env)==='production'?'https://connect.squareup.com':'https://connect.squareupsandbox.com';
 const r=await (env.SQUARE_FETCH||fetch)(base+'/v2/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+env.SQUARE_ACCESS_TOKEN,'Content-Type':'application/json','Square-Version':'2025-01-23'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
 if(!r.ok){const data=await r.json().catch(()=>({}));const e=Error('Square request failed ('+r.status+').');e.squareCodes=(data.errors||[]).map(x=>x.code);throw e;}return r.json();
}
async function squareRecord(env,key){const r=await db(env).prepare('SELECT content,revision FROM prototype_settings WHERE id=?').bind(key).first();return r?{...JSON.parse(r.content),_revision:r.revision}:null;}
async function squareWrite(env,key,value,revision){const {_revision,...clean}=value;return db(env).prepare('UPDATE prototype_settings SET content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(clean),new Date().toISOString(),key,revision).run();}
const squareKey=async(env,user,stage)=>'sq-'+squareMode(env)+'-'+stage[0]+'-'+(await chatHash(user)).slice(0,24);
function squarePublic(r){return r?{stage:r.stage,plan:r.plan,status:r.status,receiptUrl:r.receiptUrl||null,paidAt:r.paidAt||null,expiresAt:r.expiresAt||null}:null;}
function squareExpiry(plan,start){const d=new Date(start);if(plan==='infinite')return null;if(plan==='day')return new Date(d.getTime()+86400000).toISOString();const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+(plan==='quarter'?3:1));const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.toISOString();}
async function squarePaymentState(env,user){const [entry,contract]=await Promise.all(['entry','contract'].map(async stage=>squareRecord(env,await squareKey(env,user,stage))));return {entry,contract};}
async function squareAccessDeadline(env,user){
 if(squareMode(env)==='off')return Infinity;
 const {entry,contract}=await squarePaymentState(env,user);
 // Preserve manually approved learners who have no checkout records.
 if(!entry&&!contract)return Infinity;
 if(entry?.status!=='paid'||contract?.status!=='paid')return 0;
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
  if(r.paymentId&&r.paymentId!==p.id)return;
  // Re-fetching Square's current object avoids replaying stale webhook payloads.
  if(r.providerUpdatedAt&&p.updated_at<r.providerUpdatedAt)return;
  let status=r.status;
  if(p.status==='COMPLETED')status=p.refunded_money?.amount>0||r.status==='refund_review'?'refund_review':'paid';
  else if(['FAILED','CANCELED'].includes(p.status)&&r.status!=='paid')status='pending';
  const paidAt=r.paidAt||(status==='paid'?(p.card_details?.card_payment_timeline?.captured_at||p.updated_at):null);
  const next={...r,orderId:p.order_id,paymentId:p.id,status,paidAt,providerUpdatedAt:p.updated_at,receiptUrl:p.receipt_url||null,expiresAt:r.stage==='contract'&&paidAt?squareExpiry(r.plan.id,paidAt):null};
  const result=await squareWrite(env,key,next,r._revision);if(result.meta.changes)return;
 }
 throw Error('Concurrent payment update; retry required.');
}
async function squareReconcile(env,r){if(!r)return;if(r.paymentId)return squareApplyPayment(env,r.paymentId);if(!r.orderId)return;const {order}=await squareCall(env,'orders/'+encodeURIComponent(r.orderId));for(const t of order?.tenders||[])if(t.payment_id)await squareApplyPayment(env,t.payment_id);}
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
  const state=user?await squarePaymentState(env,user):{};
  return json({mode,ready,embeddedReady:ready&&!!env.SQUARE_APPLICATION_ID,applicationId:env.SQUARE_APPLICATION_ID||null,locationId:env.SQUARE_LOCATION_ID||null,entry:squarePublic(state.entry),contract:squarePublic(state.contract)});
 }
 if(!user)return json({error:'Start your application in this browser first.'},401);
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 const body=await educationBody(request,url,4000);if(body instanceof Response)return body;
 if(!ready)return json({error:'Payments are not available yet. Please try again later.'},503);
 if(!await chatLimit(env,'square:'+await chatHash(user),30,60000))return json({error:'Please wait before trying again.'},429);
 if(url.pathname==='/api/education/payments/refresh'){
  const state=await squarePaymentState(env,user);for(const r of [state.entry,state.contract])await squareReconcile(env,r);
  const fresh=await squarePaymentState(env,user);return json({mode,ready,entry:squarePublic(fresh.entry),contract:squarePublic(fresh.contract)});
 }
 const embedded=['/api/education/payments/prepare','/api/education/payments/charge'].includes(url.pathname);
 if(embedded&&!env.SQUARE_APPLICATION_ID)return json({error:'Card checkout is being configured. Please return shortly.'},503);
 if(!embedded&&url.pathname!=='/api/education/payments/checkout')return json({error:'Not found'},404);
 if(!['entry','contract'].includes(body.stage))return json({error:'Choose a payment stage.'},400);
 const {config,revision}=await educationConfig(env);
 if(body.revision!==revision)return json({error:'Rates changed. Reload the application before paying.',code:'settings_changed'},409);
 let plan=config.agreement[body.stage==='entry'?'entryPlans':'contractPlans'].find(p=>p.id===body.planId),agreementId=null,email=null;
 if(!plan||plan.amount<=0)return json({error:'Choose a valid plan.'},400);
 if(body.stage==='contract'){
  const {entry}=await squarePaymentState(env,user);if(entry?.status!=='paid')return json({error:'Complete your entry payment first.'},409);
  const row=await db(env).prepare('SELECT snapshot FROM education_enrolments WHERE user_id=?').bind(user).first();
  const agreement=row?JSON.parse(row.snapshot).agreement:null;
  if(!agreement||agreement.revision!==revision||agreement.contract.id!==plan.id||agreement.entry.id!==entry.plan.id)return json({error:'Save and sign the current agreement before paying.'},409);
  agreementId=agreement.id;email=agreement.email;
 }
 const key=await squareKey(env,user,body.stage);
 let r=await squareRecord(env,key);
 if(!r){
  const initial={method:embedded?'embedded':'hosted',user,stage:body.stage,plan,agreementId,mode,status:'pending',idempotencyKey:crypto.randomUUID(),createdAt:new Date().toISOString()};
  const returnURL=new URL('/application.html',env.SQUARE_SITE_URL);returnURL.searchParams.set('payment',body.stage);
  initial.request={idempotency_key:initial.idempotencyKey,order:{location_id:env.SQUARE_LOCATION_ID,reference_id:key,line_items:[{name:(body.stage==='entry'?'Entry fee — ':'Contract — ')+plan.name,quantity:'1',base_price_money:{amount:plan.amount,currency:'GBP'}}]},checkout_options:{redirect_url:returnURL.href,allow_tipping:false,ask_for_shipping_address:false},...(email?{pre_populated_data:{buyer_email:email}}:{})};
  await db(env).prepare('INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(id) DO NOTHING').bind(key,JSON.stringify(initial),initial.createdAt).run();r=await squareRecord(env,key);
 }
 if(r.plan.id!==plan.id||r.plan.amount!==plan.amount||(body.stage==='contract'&&r.agreementId!==agreementId))return json({error:'A checkout already exists for your earlier selection. Return to that selection or contact the academy before changing it.'},409);
 await squareReconcile(env,r);r=await squareRecord(env,key);
 if(r.status==='paid')return json({paid:true,payment:squarePublic(r)});
 if(r.status==='refund_review')return json({error:'This payment needs an administrator review.'},409);
 if(embedded)return squareEmbedded(request,env,url,body,key,r);
 if(r.method==='embedded')return json({error:'Please use the on-page card form.'},409);
 if(!r.checkoutUrl){
  const result=await squareCall(env,'online-checkout/payment-links',r.request),link=result.payment_link;
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
 if(r.cardAttempt.id!==body.attemptId)return json({error:'Another payment is being checked. Refresh its status before trying again.'},409);
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
