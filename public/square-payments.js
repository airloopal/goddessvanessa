'use strict';
let squarePromoCode='';
function squareDisplayPlan(plan,stage){if(!plan)return plan;const saved=squareState[stage]?.plan;if(saved?.id===plan.id&&(!squareState[stage].canChangePromo||(saved.promoCode||'')===squarePromoCode))return saved;return squarePromoCode?{...plan,originalAmount:plan.amount,amount:Math.round(plan.amount*(squarePromoCode==='SUB25'?75:50)/100),promoCode:squarePromoCode}:plan;}
let squareState={mode:'off',ready:false,entry:null,contract:null};
const squareEnabled=()=>!educationPreview&&squareState.mode!=='off';
const squareEntryPaid=()=>['paid','granted'].includes(squareState.entry?.status)&&squareState.entry.plan.id===entryId;
const squareDraftKey='vanessa-square-application'+(new URLSearchParams(location.search).get('invitation')==='1'?'-contract-invitation':'');
async function squareFetchTimed(path,options,ms){options={...options,headers:educationRequestHeaders(path,options?.headers)};if(typeof AbortSignal!=='undefined'&&typeof AbortSignal.timeout==='function')return fetch(path,{...options,signal:AbortSignal.timeout(ms)});if(typeof AbortController!=='function')return fetch(path,options);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),ms);try{return await fetch(path,{...options,signal:controller.signal});}finally{clearTimeout(timer);}}
let squareDraftRevision=0,squareDraftTimer=null,squareDraftFlight=false,squareDraftDirty=false,squareResumeToken='';
function squareDraftValue(){return {pathId,entryId,contractId,answers:Object.fromEntries(Object.entries(answers).filter(([,v])=>!Array.isArray(v)||v.length)),learnerName,learnerEmail,screen};}
function squareSaveDraft(){try{sessionStorage.setItem(squareDraftKey,JSON.stringify({...squareDraftValue(),learnerPhone,squarePromoCode,applicationKey:squareState.applicationKey,savedAt:Date.now()}));}catch{/* Optional storage never blocks payment. */}if(!squareState.applicationKey||squareState.invitation||educationPreview||!['paths','entry','intro','questions','review'].includes(screen))return;squareDraftDirty=true;clearTimeout(squareDraftTimer);squareDraftTimer=setTimeout(()=>void squarePersistDraft(),1000);}
async function squarePersistDraft(keepalive=false){if(squareDraftFlight||!squareDraftDirty||squareDraftRevision<0)return;squareDraftFlight=true;squareDraftDirty=false;try{const response=await fetch('/api/education/application-progress',{method:'POST',keepalive,headers:educationRequestHeaders('application-progress',{'Content-Type':'application/json'}),body:JSON.stringify({...squareDraftValue(),revision:squareDraftRevision})});const result=await response.json();if(!response.ok){const error=Error(result.error||'Draft save unavailable');error.status=response.status;throw error;}squareDraftRevision=result.revision;}catch(error){if(error.status===409)squareDraftRevision=-1;}finally{squareDraftFlight=false;if(squareDraftDirty)void squarePersistDraft();}}
function squareResumeControl(){if(squareResumeToken&&!app.querySelector('[data-copy-resume]')){const save=document.createElement('button');save.type='button';save.className='quiet';save.dataset.copyResume='1';save.textContent='Copy private resume link';save.onclick=async()=>{try{await navigator.clipboard.writeText(location.origin+location.pathname+'?resume=1#'+squareResumeToken);save.textContent='Copied — keep this link private';}catch{save.textContent='Save this page address to resume later';}};app.querySelector('.step-actions')?.after(save);}}
async function squareEnsureResumeLink(){if(squareResumeToken||squareState.invitation||!squareState.applicationKey)return;try{const result=await eduAPI('application-resume-link','POST',{});if(!/^[a-f0-9]{64}$/.test(result.token))return;squareResumeToken=result.token;history.replaceState(null,'',location.pathname+'?resume=1#'+squareResumeToken);squareResumeControl();}catch{/* Existing checkout and payment verification remain available. */}}

async function squareInit(){
 squareState=await eduAPI('payments');if(!squareEnabled())return;
 squareDraftRevision=squareState.draft?.revision||0;
 let draft=squareState.draft;try{const local=JSON.parse(sessionStorage.getItem(squareDraftKey)||'null');if(local&&squareState.applicationKey&&local.applicationKey===squareState.applicationKey&&(!draft||local.savedAt>Date.parse(draft.updated_at||'')))draft=local;}catch{}
 if(draft&&!enrolment){squarePromoCode=['SUB50','SUB25'].includes(draft.squarePromoCode)?draft.squarePromoCode:'';pathId=draft.pathId||'';entryId=draft.entryId||'';contractId=draft.contractId||'';answers=draft.answers||{};learnerName=draft.learnerName||'';learnerEmail=draft.learnerEmail||'';learnerPhone=draft.learnerPhone||'';screen=['paths','entry','intro','questions','review'].includes(draft.screen)?draft.screen:'paths';}
 const paymentReturn=new URLSearchParams(location.search).has('payment');
 if(paymentReturn&&!squareState.entry)throw Error('Your saved Entry checkout could not be found in this browser. Reopen your private resume link or contact Goddess. Do not pay Entry again.');
 const pendingCheckout=[squareState.entry,squareState.contract].some(p=>p?.status==='pending');
 if((paymentReturn||pendingCheckout)&&squareState.ready){try{squareState={...squareState,...await eduAPI('payments/refresh','POST',{})};}catch{/* Keep the saved status and provide a retry control. */}if(paymentReturn){history.replaceState(null,'',location.pathname+(new URLSearchParams(location.search).get('invitation')==='1'?'?invitation=1':squareResumeToken?'?resume=1#'+squareResumeToken:''));if(!draft&&!enrolment)screen=squareState.contract?'review':'intro';}}
 if(squareState.contact&&!enrolment){learnerName=learnerName||squareState.contact.name||'';learnerEmail=learnerEmail||squareState.contact.email||'';learnerPhone=learnerPhone||squareState.contact.phone||'';pathId=squareState.contact.pathId||pathId||'';}
 if(squareState.entry){squarePromoCode=squareState.entry.plan.promoCode||'';entryId=squareState.entry.plan.id;entryReviewed=squareEntryPaid();}
 if(squareState.invitation){contractId=squareState.invitation.contractId;squarePromoCode=squareState.invitation.promoCode;pathId=course.paths.some(p=>p.id===squareState.invitation.pathId)?squareState.invitation.pathId:course.paths[0].id;learnerName=squareState.contact?.name||'';learnerEmail=squareState.contact?.email||'';answers={};screen='review';}
 if(squareState.contract){contractId=squareState.contract.plan.id;screen='review';}
 else if(squareEntryPaid()&&['paths','entry','intro'].includes(screen)&&pathId&&!enrolment){screen=course.features.questionnaire?'questions':'review';squareSaveDraft();}
 if(squareEntryPaid())await squareEnsureResumeLink();
}
// A late tokenization result is discarded after timeout; only this awaited result
// can submit a charge. HTTP retries always keep the original attempt identity.
async function squareAuthenticationSurface(run){
 const dialog=typeof entryDialog!=='undefined'?entryDialog:null,version=squareFormVersion;
 const modal=dialog?.open&&dialog.matches(':modal');
 const closeWithoutDisposing=()=>{dialog.dataset.squareSkipClose=String(Number(dialog.dataset.squareSkipClose||0)+1);dialog.close();};
 if(modal){closeWithoutDisposing();dialog.show();}
 try{return await run();}finally{if(modal&&dialog.open&&version===squareFormVersion){closeWithoutDisposing();dialog.showModal();}}
}
function squareReportBankIssue(stage,error){
 const issue=error.code==='bank_verification_timeout'?'bank_verification_timeout':error.code==='bank_policy_blocked'?'bank_policy_blocked':'bank_verification_failed';
 void squareFetchTimed('/api/education/payments/diagnostic',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stage,issue})},5000).catch(()=>{});
}
async function squareHostedRecovery(stage,button,message){
 if(button.disabled||!squareRequireAcknowledgement(stage,message))return;squareSetPaymentReady(stage,button,false);
 const alternative=button.parentElement.querySelector('[data-square-hosted-recovery]');if(alternative)alternative.disabled=true;
 button.disabled=true;squareNotice(message,'loading','Opening your saved checkout','You’ll return here after completing payment.');squareSaveDraft();
 try{await squareDisposeCard();const result=await eduAPI('payments/fallback','POST',{stage,planId:stage==='entry'?entryId:contractId,revision:configRevision,promoCode:squarePromoCode,pathId,contact:{email:learnerEmail.trim()}});
  if(result.paid){await squareRefresh();if(stage==='entry')squareEntryDialog();return;}
  const url=new URL(result.url);if(url.protocol!=='https:'||url.hostname!==(squareState.mode==='sandbox'?'sandbox.square.link':'square.link'))throw Error('The checkout address could not be verified.');location.assign(url.href);
 }catch(error){squareNotice(message,'retry','Checkout needs another try',error.message);squareButton(button,'retry','Resume saved checkout');button.onclick=()=>squareHostedRecovery(stage,button,message);squareSetPaymentReady(stage,button,true);}
}
let squareCard=null,squareFormVersion=0;
async function squareDisposeCard(){squareFormVersion++;const card=squareCard;squareCard=null;if(card)await card.destroy().catch(()=>{});}
// Acknowledgements are scoped to this page and the selected fee, never persisted as payment proof.
const squareAcknowledgements={entry:'',contract:''};
function squareAcknowledgementKey(stage){return JSON.stringify([stage,stage==='entry'?entryId:contractId,configRevision,squarePromoCode]);}
function squarePaymentAcknowledged(stage){const box=document.getElementById('square-'+stage+'-acknowledge');return box?box.checked:squareAcknowledgements[stage]===squareAcknowledgementKey(stage);}
function squareRefundNoticeHTML(stage){const text=stage==='entry'?'I understand that this payment is a voluntary gift so therefore non-refundable.':'I understand this is a paid contractual agreement. The Agreement and Acceptable Use Policy applies.';return '<label class="square-payment-acknowledgement"><input type="checkbox" id="square-'+stage+'-acknowledge" required '+(squareAcknowledgements[stage]===squareAcknowledgementKey(stage)?'checked':'')+'><span id="square-'+stage+'-refund-notice">'+text+'</span></label>';}
function squareBindAcknowledgement(stage,button){const box=document.getElementById('square-'+stage+'-acknowledge');if(!box)return;box.onchange=()=>{squareAcknowledgements[stage]=box.checked?squareAcknowledgementKey(stage):'';if(button.id==='enrol-now')updateReviewControls();else squareSyncPaymentReady(stage,button);};}
function squareSyncPaymentReady(stage,button){const ready=button.dataset.squareReady==='1',confirmation=button.dataset.squareConfirmation==='1';button.disabled=!ready||(!confirmation&&!squarePaymentAcknowledged(stage));const recovery=button.parentElement.querySelector('[data-square-hosted-recovery]');if(recovery)recovery.disabled=!ready||!squarePaymentAcknowledged(stage);}
function squareSetPaymentReady(stage,button,ready,confirmation=false){button.dataset.squareReady=ready?'1':'0';button.dataset.squareConfirmation=confirmation?'1':'0';squareSyncPaymentReady(stage,button);}
function squareRequireAcknowledgement(stage,message){if(squarePaymentAcknowledged(stage))return true;squareNotice(message,'retry','Please tick the checkbox','Confirm the payment acknowledgement before continuing.');document.getElementById('square-'+stage+'-acknowledge')?.focus();return false;}
function squareCardHTML(){return '<div id="square-card-container" aria-label="Secure card details"></div><p class="muted">Secure card payment. Your card details are encrypted and stay with our payment provider.</p>';}
function squareCheckout(stage){if(stage!=='contract')return;squareSaveDraft();screen='review';squareContractPanel();}
function squareBillingContact(){const names=learnerName.trim().split(/\s+/).filter(Boolean),contact={};if(names.length){contact.givenName=names[0];if(names.length>1)contact.familyName=names.slice(1).join(' ');}const email=learnerEmail.trim();if(/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email))contact.email=email;return contact;}
function squareCheckoutActions(){
 squareButton(document.getElementById('lightbox-verification'),'video','Request verification');
 squareButton(document.getElementById('square-refresh'),'retry','Check payment status',true);
 squareButton(document.getElementById('square-contract-refresh'),'retry','Check payment status',true);
 const refresh=document.getElementById('square-refresh'),actions=entryDialog?.querySelector('.entry-lightbox-actions');if(refresh&&actions)actions.insertBefore(refresh,document.getElementById('square-entry-pay'));
}
function squareEntrySuccess(plan){
 entryDialog.innerHTML='<div class="entry-lightbox-top"><span class="overline">'+squareLabel()+'</span><button class="quiet" id="lightbox-close" aria-label="Close entry checkout">×</button></div><h2 id="entry-lightbox-title" class="square-success-heading" tabindex="-1">Entry confirmed</h2><div id="entry-lightbox-status"></div><div class="square-success-summary">'+eduEscape(plan?.name||'Entry')+' · '+gbp(plan?.amount||0)+'</div><p class="muted square-success-caption">Your entry is paid. The contract fee is a separate payment later.</p><button class="p-button square-success-continue" id="square-entry-pay">Continue application</button>';
 squareNotice(document.getElementById('entry-lightbox-status'),'success','Payment successful','Your entry payment has been confirmed. You’re ready for the next step.');
 void squareEnsureResumeLink();squareSaveDraft();
 document.getElementById('lightbox-close').onclick=closeEntryLightbox;
 document.getElementById('square-entry-pay').onclick=()=>{entryReviewed=true;closeEntryLightbox();move(screens()[screens().indexOf('intro')+1]);};
 squareButton(document.getElementById('square-entry-pay'),'next','Continue application');document.getElementById('entry-lightbox-title').focus({preventScroll:true});
}
async function squareMountCard(stage,buttonId,statusId){
 await squareDisposeCard();const version=squareFormVersion,button=document.getElementById(buttonId),message=document.getElementById(statusId);
 if(!button||!message)return;squareBindAcknowledgement(stage,button);squareSetPaymentReady(stage,button,false);squareNotice(message,'loading','Preparing secure checkout','Your card form will appear here.');
 try{
  const prepared=await eduAPI('payments/prepare','POST',{stage,planId:stage==='entry'?entryId:contractId,revision:configRevision,promoCode:squarePromoCode,pathId,...(stage==='contract'?{contact:{email:learnerEmail.trim()}}:{})});
  if(version!==squareFormVersion||!button.isConnected)return;
  await squareEnsureResumeLink();
  if(prepared.paid){await squareRefresh();if(stage==='entry')squareEntryDialog();return;}
  if(prepared.hosted){squareNotice(message,'retry','Continue your secure checkout','An earlier checkout is already saved. Resume it or check its status before starting another payment.');squareButton(button,'card','Resume saved checkout');button.onclick=()=>squareHostedRecovery(stage,button,message);squareSetPaymentReady(stage,button,true);return;}
  let attemptId=prepared.resumeAttempt||null,pendingSource=null;
  button.parentElement.querySelector('[data-square-hosted-recovery]')?.remove();let recovery=null;
  if(!attemptId){await squareLoadSDK(squareState.mode);if(version!==squareFormVersion||!button.isConnected)return;const payments=window.Square.payments(prepared.applicationId,prepared.locationId);const card=await payments.card();if(version!==squareFormVersion||!button.isConnected){await card.destroy();return;}squareCard=card;await card.attach('#square-card-container');}

  if(attemptId)squareNotice(message,'retry','Let’s confirm your payment','A previous attempt is awaiting confirmation. Retry to check it safely.');else{message.replaceChildren();message.className='';}squareSetPaymentReady(stage,button,true,!!attemptId);squareButton(button,attemptId?'retry':'card',attemptId?'Retry confirmation':'Confirm & Pay '+gbp(prepared.plan.amount));
  button.onclick=async()=>{
   if(button.disabled||(!attemptId&&!squareRequireAcknowledgement(stage,message)))return;squareSetPaymentReady(stage,button,false,!!attemptId);if(recovery)recovery.disabled=true;squareNotice(message,'loading',attemptId?'Confirming your payment':'Verify with your bank',attemptId?'Checking the same payment safely.':'Complete any bank prompt, then return to this page. Bank approval is followed by payment confirmation.');squareSaveDraft();
   try{
    let sourceId=pendingSource;
    if(!attemptId){const result=await squareAuthenticationSurface(()=>squareTokenize(squareCard,{amount:(prepared.plan.amount/100).toFixed(2),currencyCode:'GBP',intent:'CHARGE',customerInitiated:true,sellerKeyedIn:false,billingContact:stage==='contract'?squareBillingContact():{}}));if(result.status!=='OK')throw Error(result.status==='Cancel'?'Verification cancelled. No payment was submitted.':'Please check your card details and try again.');if(version!==squareFormVersion||!button.isConnected)return;sourceId=result.token;pendingSource=sourceId;attemptId=crypto.randomUUID();}
    const response=await squareFetchTimed('/api/education/payments/charge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stage,planId:prepared.plan.id,revision:configRevision,promoCode:squarePromoCode,attemptId,...(sourceId?{sourceId}:{})}),},25000);
    const result=await response.json();
    if(!result.paid){if(result.retryCard){attemptId=null;await squareMountCard(stage,buttonId,statusId);squareNotice(message,'retry','Please try again',result.error||'Check your card details and retry.');return;}throw Error(result.error||'Your payment is being checked. Retry confirmation.');}
    await squareDisposeCard();squareState=await eduAPI('payments');entryReviewed=squareEntryPaid();
    if(stage==='entry'){renderLearning();squareEntryDialog();}else squareContractPanel();
   }catch(error){if(version!==squareFormVersion||!button.isConnected)return;squareNotice(message,'retry',attemptId?'Confirmation is taking longer':'Please try again',error.name==='TimeoutError'?'The connection timed out. Retry confirmation to check this same payment safely.':error.message||'Retry to check the same payment safely.');squareButton(button,'retry',attemptId?'Retry confirmation':'Retry card payment');if(!attemptId){squareReportBankIssue(stage,error);await squareDisposeCard();button.onclick=()=>squareMountCard(stage,buttonId,statusId);}squareSetPaymentReady(stage,button,true,!!attemptId);}
  };
 }catch(error){squareNotice(message,'retry','Checkout needs another try',error.message);squareSetPaymentReady(stage,button,true);squareButton(button,'retry','Retry checkout');button.onclick=()=>squareMountCard(stage,buttonId,statusId);}
}
async function squareRefresh(){squareState={...squareState,...await eduAPI('payments/refresh','POST',{})};entryReviewed=squareEntryPaid();renderLearning();}
function squareLabel(){return squareState.mode==='sandbox'?'Sandbox test · No real payment':'Secure card payment';}
function squareEntryDialog(){
 void squareDisposeCard();clearInterval(verificationPoll);entryDialogView='payment';const plan=entryPlan(),paid=squareEntryPaid();if(paid&&squareState.entry.granted){entryDialog.innerHTML='<button type="button" class="quiet lightbox-close" aria-label="Close entry checkout">×</button><h2>Entry granted by Goddess</h2><p>No entry payment is claimed or required. Continue to review and sign your monthly contract.</p><button type="button" class="p-button" data-grant-continue>Continue to contract</button>';entryDialog.querySelector('.lightbox-close').onclick=closeEntryLightbox;entryDialog.querySelector('[data-grant-continue]').onclick=()=>{closeEntryLightbox();screen='review';renderLearning();};return;}if(paid){squareEntrySuccess(squareState.entry.plan);return;}
 entryDialog.innerHTML='<div class="entry-lightbox-top"><span class="overline">'+squareLabel()+'</span><button class="quiet" id="lightbox-close" aria-label="Close entry checkout">×</button></div><h2 id="entry-lightbox-title" tabindex="-1">'+(paid?'Entry confirmed.':'Your entry fee.')+'</h2><section class="entry-payment-card"><span>'+eduEscape(plan?.name||'Select a plan')+'</span><strong>'+gbp(plan?.amount||0)+'</strong><small>One entry fee · Contract fee paid separately</small></section><p class="muted">'+(paid?'Your payment has been confirmed.':squareState.ready?'Enter your card details below to confirm your entry.':'Checkout is being configured. Please return shortly.')+'</p>'+(!paid&&squareState.ready?squareCardHTML():'')+'<div id="entry-lightbox-status" role="status"></div>'+squareRefundNoticeHTML('entry')+'<div class="entry-lightbox-actions"><button class="quiet" id="lightbox-verification">Request verification</button><button class="p-button" id="square-entry-pay" aria-describedby="square-entry-refund-notice" '+(!paid&&!squareState.ready?'disabled':'')+'>'+(paid?'Continue':'Pay '+gbp(plan?.amount||0))+'</button></div>'+(squareState.entry&&!paid?'<button class="quiet" id="square-refresh">Check payment status</button>':'');
 document.getElementById('lightbox-close').onclick=closeEntryLightbox;document.getElementById('lightbox-verification').onclick=showEntryVerification;
 document.getElementById('square-entry-pay').disabled=true;
 squareCheckoutActions();
 if(!paid&&squareState.ready)void squareMountCard('entry','square-entry-pay','entry-lightbox-status');
 document.getElementById('square-refresh')?.addEventListener('click',async e=>{e.currentTarget.disabled=true;try{await squareRefresh();squareEntryDialog();}catch(error){document.getElementById('entry-lightbox-status').textContent=error.message;e.target.disabled=false;}});
}
function squareContractPanel(){
 window.ApplicationTracking?.record('payment');
 void squareDisposeCard();
 const p=squareState.contract,paid=p?.status==='paid',expired=paid&&p.expiresAt&&Date.parse(p.expiresAt)<=Date.now();
 app.innerHTML='<main class="application-main square-contract-panel"><span class="overline">'+squareLabel()+'</span><h1>'+(expired?'Your access period has ended.':paid?'Payment confirmed.':'Complete your contract payment.')+'</h1><p>'+(expired?'Contact the academy to arrange another access period.':paid?'Your application and payment are saved. The academy will issue your access code.':'Your signed contract is saved. Confirm the amount and pay below to complete your application.')+'</p><section class="price-breakdown"><div><span>'+eduEscape(p?.plan.name||contractPlan()?.name||'Contract')+'</span><strong>'+gbp(p?.plan.amount||contractPlan()?.amount||0)+'</strong></div>'+(p?.expiresAt?'<p>Access ends: '+eduEscape(new Date(p.expiresAt).toLocaleString())+'</p>':'')+'</section>'+(!paid?squareCardHTML():'')+'<div id="learning-status" role="status"></div>'+(!paid?squareRefundNoticeHTML('contract'):'')+'<div class="step-actions">'+(paid?'<a class="p-button" href="access.html'+(new URLSearchParams(location.search).get('invitation')==='1'?'?invitation=1':'')+'">Open Sub Access</a>':'<button class="p-button" id="square-contract-pay" aria-describedby="square-contract-refund-notice">Pay securely</button><button class="quiet" id="square-contract-refresh">Check payment status</button>')+'</div></main>';
 if(p?.receiptUrl){try{const url=new URL(p.receiptUrl);if(url.protocol==='https:'&&url.hostname==='squareup.com'){const link=document.createElement('a');link.href=url.href;link.textContent='View Square receipt';link.className='quiet';link.target='_blank';link.rel='noopener';app.querySelector('.step-actions').append(link);}}catch{}}
 if(!document.getElementById('square-contract-heading')){const heading=app.querySelector('h1');heading.id='square-contract-heading';heading.tabIndex=-1;heading.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
 squareCheckoutActions();squareResumeControl();
 if(paid&&!expired)squareNotice(document.getElementById('learning-status'),'success','Payment successful','Your contract payment is confirmed and saved.');
 if(!paid)void squareMountCard('contract','square-contract-pay','learning-status');
 document.getElementById('square-contract-refresh')?.addEventListener('click',async e=>{e.currentTarget.disabled=true;try{await squareRefresh();}catch(error){status(error.message);e.target.disabled=false;}});
}
function squareDecorate(){if(!squareEnabled())return;
 if(screen==='intro'&&!squareEntryPaid()){const note=document.createElement('p');note.className='muted';note.textContent='Already paid Entry? Reopen your private resume link or contact Goddess before paying again.';app.querySelector('.step-actions')?.before(note);}
 squareResumeControl();
 if((!squareState.entry||squareState.entry.canChangePromo)&&['entry','intro'].includes(screen)){const host=document.createElement('section');host.className='promo-code-panel';host.innerHTML='<label for="square-promo">Have a promo code?</label><div><input id="square-promo" maxlength="32" autocomplete="off" autocapitalize="characters" value="'+eduEscape(squarePromoCode)+'" placeholder="Enter code"><button class="quiet" type="button" id="square-promo-apply">Apply</button></div><p role="status">'+(squarePromoCode?squarePromoCode+' applied · '+(squarePromoCode==='SUB25'?25:50)+'% off your entry and contract fees.':'Apply before opening payment.')+'</p>';const anchor=document.getElementById('open-entry-payment')?.closest('section')||app.querySelector('.step-actions');if(anchor)anchor.before(host);else app.append(host);host.querySelector('button').onclick=async()=>{const b=host.querySelector('button');b.disabled=true;try{const result=await eduAPI('payments/promo','POST',{promoCode:host.querySelector('input').value});squarePromoCode=result.promoCode;invalidateAgreement();squareSaveDraft();renderLearning();}catch(e){host.querySelector('p').textContent=e.message;b.disabled=false;}};}
 if(squareEntryPaid()&&['questions','review'].includes(screen)&&!squareState.contract){const confirmed=document.createElement('p');confirmed.className='notice';confirmed.setAttribute('role','status');confirmed.textContent=squareState.entry?.granted?'Entry granted by Goddess. No entry charge is required.':'Entry payment confirmed. Continue your application.';app.querySelector('h1')?.after(confirmed);}
 if(squarePromoCode&&!app.querySelector('.promo-code-panel')){const note=document.createElement('p');note.className='promo-applied';note.textContent=squareState.entry?.granted?squarePromoCode+' applied · Monthly contract: '+gbp(contractPlan()?.amount||0):squarePromoCode+' applied · '+(squarePromoCode==='SUB25'?25:50)+'% off entry and contract fees.';app.querySelector('h1')?.after(note);}
 app.querySelectorAll('[name="entry-plan"]').forEach(el=>{if(squareState.entry)el.disabled=el.value!==squareState.entry.plan.id;});
 const statusEl=app.querySelector('.entry-payment-status');if(statusEl)statusEl.textContent=squareState.entry?.granted?'Granted by Goddess':squareEntryPaid()?'Paid':'Not paid';
 if(squareState.invitation){app.querySelectorAll('[name=contract-plan]').forEach(el=>el.disabled=el.value!==squareState.invitation.contractId);}
 const next=document.getElementById('enrol-now');if(next){squareButton(next,'sign','Confirm & Pay');next.setAttribute('aria-describedby','square-contract-refund-notice');if(!document.getElementById('square-contract-refund-notice'))next.closest('.step-actions').insertAdjacentHTML('beforebegin',squareRefundNoticeHTML('contract'));squareBindAcknowledgement('contract',next);updateReviewControls();}
 const textMap=[['Payment processing is not connected. No money is collected in this preview.',squareLabel()],['Entry review confirmed · No payment collected.',squareState.entry?.granted?'Entry granted by Goddess. No entry charge is required.':squareEntryPaid()?'Entry paid · Payment confirmed.':'Entry payment required.'],['No payment has been collected. An entry fee will only appear as paid after a payment provider confirms it.',squareState.entry?.granted?'Your entry is granted by Goddess. The monthly contract is a separate one-off payment.':squareEntryPaid()?'Your entry is paid. The contract fee is a separate one-off payment.':'Your entry payment must be completed first.'],['Review preview only · No payment is collected. Saved reviews remain in your sub record; chat messages are temporary.',squareLabel()+' · One-off payments. No automatic renewal.']];
 for(const el of app.querySelectorAll('p'))for(const [before,after]of textMap)if(el.textContent===before)el.textContent=after;
 const age=document.getElementById('review-age');if(age){const text=age.parentElement.lastChild;if(text.nodeType===3)text.textContent='I am 18 or older, have reviewed this agreement and accept its acceptable-use policy. I understand the contract fee is a separate one-off payment.';}
 const entryButton=document.getElementById('open-entry-payment');if(entryButton)entryButton.textContent=squareState.entry?.granted?'Entry granted':squareEntryPaid()?'Entry paid':'Pay entry fee';
}

