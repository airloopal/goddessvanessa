'use strict';
let squareState={mode:'off',ready:false,entry:null,contract:null};
const squareEnabled=()=>!educationPreview&&squareState.mode!=='off';
const squareEntryPaid=()=>squareState.entry?.status==='paid'&&squareState.entry.plan.id===entryId;
const squareDraftKey='vanessa-square-application';
function squareSaveDraft(){sessionStorage.setItem(squareDraftKey,JSON.stringify({pathId,entryId,contractId,answers,learnerName,learnerEmail,screen}));}
async function squareInit(){
 squareState=await eduAPI('payments');if(!squareEnabled())return;
 try{const d=JSON.parse(sessionStorage.getItem(squareDraftKey)||'null');if(d&&!enrolment){pathId=d.pathId||'';entryId=d.entryId||'';contractId=d.contractId||'';answers=d.answers||{};learnerName=d.learnerName||'';learnerEmail=d.learnerEmail||'';screen=d.screen||'paths';}}catch{}
 if(new URLSearchParams(location.search).has('payment')&&squareState.ready){try{squareState=await eduAPI('payments/refresh','POST',{});}catch{/* Keep the saved status and provide a retry control. */}history.replaceState(null,'',location.pathname);screen=squareState.contract?'review':'intro';}
 if(squareState.entry){entryId=squareState.entry.plan.id;entryReviewed=squareEntryPaid();}
 if(squareState.contract){contractId=squareState.contract.plan.id;screen='review';}
}
async function squareCheckout(stage){
 squareSaveDraft();const result=await eduAPI('payments/checkout','POST',{stage,planId:stage==='entry'?entryId:contractId,revision:configRevision});
 if(result.paid){squareState=await eduAPI('payments');entryReviewed=squareEntryPaid();renderLearning();return;}
 const target=new URL(result.url);if(target.protocol!=='https:'||!['square.link','sandbox.square.link'].includes(target.hostname))throw Error('Could not open Square checkout.');location.assign(target.href);
}
async function squareRefresh(){squareState=await eduAPI('payments/refresh','POST',{});entryReviewed=squareEntryPaid();renderLearning();}
function squareLabel(){return squareState.mode==='sandbox'?'Sandbox test · No real payment':'Secured by Square';}
function squareEntryDialog(){
 clearInterval(verificationPoll);entryDialogView='payment';const plan=entryPlan(),paid=squareEntryPaid();
 entryDialog.innerHTML='<div class="entry-lightbox-top"><span class="overline">'+squareLabel()+'</span><button class="quiet" id="lightbox-close" aria-label="Close entry checkout">×</button></div><h2 id="entry-lightbox-title" tabindex="-1">'+(paid?'Entry confirmed.':'Your entry fee.')+'</h2><section class="entry-payment-card"><span>'+eduEscape(plan?.name||'Select a plan')+'</span><strong>'+gbp(plan?.amount||0)+'</strong><small>One entry fee · Contract fee paid separately</small></section><p class="muted">'+(paid?'Square has confirmed this payment.':squareState.ready?'Continue to Square to complete your payment.':'Checkout is being configured. Please return shortly.')+'</p><p id="entry-lightbox-status" role="status"></p><div class="entry-lightbox-actions"><button class="quiet" id="lightbox-verification">Request verification</button><button class="p-button" id="square-entry-pay" '+(!paid&&!squareState.ready?'disabled':'')+'>'+(paid?'Continue':'Pay '+gbp(plan?.amount||0))+'</button></div>'+(squareState.entry&&!paid?'<button class="quiet" id="square-refresh">Check payment status</button>':'');
 document.getElementById('lightbox-close').onclick=closeEntryLightbox;document.getElementById('lightbox-verification').onclick=showEntryVerification;
 document.getElementById('square-entry-pay').onclick=async e=>{if(paid){entryReviewed=true;closeEntryLightbox();move(screens()[screens().indexOf('intro')+1]);return;}e.currentTarget.disabled=true;try{await squareCheckout('entry');}catch(error){document.getElementById('entry-lightbox-status').textContent=error.message;document.getElementById('square-entry-pay').disabled=false;}};
 document.getElementById('square-refresh')?.addEventListener('click',async e=>{e.currentTarget.disabled=true;try{await squareRefresh();squareEntryDialog();}catch(error){document.getElementById('entry-lightbox-status').textContent=error.message;e.target.disabled=false;}});
}
function squareContractPanel(){
 const p=squareState.contract,paid=p?.status==='paid',expired=paid&&p.expiresAt&&Date.parse(p.expiresAt)<=Date.now();
 app.innerHTML='<main class="application-main"><span class="overline">'+squareLabel()+'</span><h1>'+(expired?'Your access period has ended.':paid?'Payment confirmed.':'Complete your contract payment.')+'</h1><p>'+(expired?'Contact the academy to arrange another access period.':paid?'Your application and payment are saved. The academy will issue your access code.':'Your signed application is saved. Continue to Square or check the status of a recent payment.')+'</p><section class="price-breakdown"><div><span>'+eduEscape(p?.plan.name||contractPlan()?.name||'Contract')+'</span><strong>'+gbp(p?.plan.amount||contractPlan()?.amount||0)+'</strong></div>'+(p?.expiresAt?'<p>Access ends: '+eduEscape(new Date(p.expiresAt).toLocaleString())+'</p>':'')+'</section><p id="learning-status" role="status"></p><div class="step-actions">'+(paid?'<a class="p-button" href="access.html">Open Sub Access</a>':'<button class="p-button" id="square-contract-pay">Continue to Square</button><button class="quiet" id="square-contract-refresh">Check payment status</button>')+'</div></main>';
 if(p?.receiptUrl){try{const url=new URL(p.receiptUrl);if(url.protocol==='https:'&&url.hostname==='squareup.com'){const link=document.createElement('a');link.href=url.href;link.textContent='View Square receipt';link.className='quiet';link.target='_blank';link.rel='noopener';app.querySelector('.step-actions').append(link);}}catch{}}
 document.getElementById('square-contract-pay')?.addEventListener('click',async e=>{e.currentTarget.disabled=true;try{await squareCheckout('contract');}catch(error){status(error.message);e.target.disabled=false;}});
 document.getElementById('square-contract-refresh')?.addEventListener('click',async e=>{e.currentTarget.disabled=true;try{await squareRefresh();}catch(error){status(error.message);e.target.disabled=false;}});
}
function squareDecorate(){if(!squareEnabled())return;
 app.querySelectorAll('[name="entry-plan"]').forEach(el=>{if(squareState.entry)el.disabled=el.value!==squareState.entry.plan.id;});
 const statusEl=app.querySelector('.entry-payment-status');if(statusEl)statusEl.textContent=squareEntryPaid()?'Paid':'Not paid';
 const next=document.getElementById('enrol-now');if(next)next.textContent='Sign & continue to payment';
 const textMap=[['Payment processing is not connected. No money is collected in this preview.',squareLabel()],['Entry review confirmed · No payment collected.',squareEntryPaid()?'Entry paid · Confirmed by Square.':'Entry payment required.'],['No payment has been collected. An entry fee will only appear as paid after a payment provider confirms it.',squareEntryPaid()?'Your entry is paid. The contract fee is a separate one-off payment.':'Your entry payment must be completed first.'],['Review preview only · No payment is collected. Saved reviews remain in your student record; chat messages are temporary.',squareLabel()+' · One-off payments. No automatic renewal.']];
 for(const el of app.querySelectorAll('p'))for(const [before,after]of textMap)if(el.textContent===before)el.textContent=after;
 const age=document.getElementById('review-age');if(age){const text=age.parentElement.lastChild;if(text.nodeType===3)text.textContent='I am 18 or older, have reviewed this agreement and accept its acceptable-use policy. I understand the contract fee is a separate one-off payment.';}
 const entryButton=document.getElementById('open-entry-payment');if(entryButton)entryButton.textContent=squareEntryPaid()?'Entry paid':'Pay entry fee';
}
