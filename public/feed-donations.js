'use strict';
// The feed stays open. Only Square's secure fields receive card details.
window.FeedDonations=(()=>{
 const checkouts=new Map();let active=null;
 function open(post,onSuccess=()=>{},student={}){
  if(active){active.focus();return;}const d=document.createElement('dialog');active=d;d.className='feed-dialog feed-donation';d.setAttribute('aria-labelledby','feed-donation-title');
  d.innerHTML='<header><h2 id="feed-donation-title">Donate to Goddess</h2><button type="button" class="quiet" data-close aria-label="Close donation">'+AdminIcons.svg('close')+'</button></header><p class="feed-donation-summary">You’re donating <strong data-amount>'+FeedUI.money(post.donationAmount)+'</strong> to Goddess Vanessa for this post.</p><p class="feed-payment-note">One donation. Your contract stays the same.</p><section data-card-panel><div id="feed-square-card" aria-label="Secure card details"></div><p class="feed-payment-note">Secured by Square. Your card details stay with Square.</p></section><div data-payment-status role="status"></div><button class="p-button" type="button" data-pay disabled></button>';
  document.body.append(d);const button=d.querySelector('[data-pay]'),message=d.querySelector('[data-payment-status]'),close=d.querySelector('[data-close]'),panel=d.querySelector('[data-card-panel]');let card=null,version=0,closed=false,authenticating=false,skipCloses=0,prepared=null,attemptId=null,pendingSource=null;
  const alive=v=>!closed&&v===version&&d.isConnected;
  async function dispose(){const old=card;card=null;if(old)await old.destroy().catch(()=>{});}
  const setBusy=busy=>{button.disabled=busy;close.disabled=busy;};
  function finish(){if(closed)return;closed=true;version++;active=null;pendingSource=null;void dispose();d.remove();}
  close.onclick=()=>d.close();d.addEventListener('cancel',e=>{if(authenticating||button.disabled)e.preventDefault();});d.addEventListener('close',()=>{if(skipCloses>0){skipCloses--;return;}finish();});d.showModal();
  function success(amount){pendingSource=null;attemptId=null;checkouts.delete(post.id);void dispose();panel.hidden=true;d.querySelector('[data-amount]').textContent=FeedUI.money(amount);squareNotice(message,'success','Payment successful','Your '+FeedUI.money(amount)+' donation to Goddess Vanessa is confirmed. Thank you.');squareButton(button,'next','Back to your feed');setBusy(false);button.onclick=()=>d.close();onSuccess(amount);}
  async function authentication(run){authenticating=true;const modal=d.open&&d.matches(':modal');if(modal){skipCloses++;d.close();d.show();}
   try{return await run();}finally{if(modal&&!closed&&d.open){skipCloses++;d.close();d.showModal();}authenticating=false;}
  }
  async function prepare(){const v=++version;setBusy(true);panel.hidden=false;squareNotice(message,'loading','Preparing secure checkout','Your card form will appear here.');await dispose();if(!alive(v))return;
   try{const id=checkouts.get(post.id)||crypto.randomUUID();checkouts.set(post.id,id);prepared=await FeedUI.api('donate/prepare','POST',{id,postId:post.id,revision:post.revision});if(!alive(v))return;checkouts.set(post.id,prepared.id);d.querySelector('[data-amount]').textContent=FeedUI.money(prepared.amount);
    if(prepared.paid){success(prepared.amount);return;}
    if(prepared.hosted){panel.hidden=true;squareNotice(message,'retry','Your earlier checkout is still open','Complete that payment on Square, then check its status here.');squareButton(button,'retry','Check payment status');button.onclick=()=>checkHosted();setBusy(false);return;}
    attemptId=prepared.resumeAttempt||null;pendingSource=null;
    if(!attemptId){await squareAwait(squareLoadSDK(prepared.mode),20000,'The secure card form took too long to load. Please retry.');if(!alive(v))return;const payments=window.Square.payments(prepared.applicationId,prepared.locationId);const created=await payments.card({style:cardStyle()});if(!alive(v)){await created.destroy();return;}card=created;await card.attach('#feed-square-card');if(!alive(v)){await dispose();return;}message.replaceChildren();message.className='';squareButton(button,'card','Confirm & Pay '+FeedUI.money(prepared.plan.amount));}
    else{panel.hidden=true;squareNotice(message,'retry','Let’s confirm your payment','A previous attempt is awaiting confirmation. Retry to check it safely.');squareButton(button,'retry','Retry confirmation');}
    button.onclick=()=>pay(v);setBusy(false);
   }catch(e){if(!alive(v))return;squareNotice(message,'retry','Checkout needs another try',e.message);squareButton(button,'retry','Retry checkout');button.onclick=prepare;setBusy(false);}
  }
  function cardStyle(){return {input:{color:'#2e2029',fontSize:'16px',backgroundColor:'#fffafd'},'input::placeholder':{color:'#725969'},'.input-container':{borderColor:'#d6b5c8',borderRadius:'10px'},'.input-container.is-focus':{borderColor:'#9c345e'},'.input-container.is-error':{borderColor:'#a52242'},'.message-text':{color:'#725969'},'.message-text.is-error':{color:'#a52242'}};}
  async function pay(v){if(button.disabled||!alive(v))return;setBusy(true);squareNotice(message,'loading',attemptId?'Confirming your payment':'Verify with your bank',attemptId?'Checking the same payment safely.':'Complete any bank prompt, then return here.');
   try{if(!attemptId){const parts=String(student.name||'').trim().split(/\s+/);const result=await authentication(()=>squareTokenize(card,{amount:(prepared.plan.amount/100).toFixed(2),currencyCode:'GBP',intent:'CHARGE',customerInitiated:true,sellerKeyedIn:false,billingContact:{...(parts[0]?{givenName:parts[0],familyName:parts.slice(1).join(' ')}:{})}}));if(!alive(v))return;if(result.status!=='OK')throw Error(result.status==='Cancel'?'Verification cancelled. No payment was submitted.':'Please check your card details and try again.');pendingSource=result.token;attemptId=crypto.randomUUID();}
    const result=await FeedUI.api('donate/charge','POST',{id:prepared.id,postId:post.id,attemptId,...(pendingSource?{sourceId:pendingSource}:{})});if(!alive(v))return;
    if(result.paid){success(result.amount);return;}
    throw Object.assign(Error(result.error||'Your payment is still being checked. Retry confirmation.'),{retrySame:true});
   }catch(e){if(!alive(v))return;if(e.retryCard){attemptId=null;pendingSource=null;await prepare();if(!closed)squareNotice(message,'retry','Please try again',e.message);return;}
    squareNotice(message,'retry',attemptId?'Confirmation is taking longer':'Please try again',e.name==='TimeoutError'?'The connection timed out. Retry confirmation to check this same payment safely.':e.message);
    squareButton(button,'retry',attemptId?'Retry confirmation':'Retry payment');if(e.status===409)button.onclick=prepare;setBusy(false);
   }
  }
  async function checkHosted(){setBusy(true);try{const r=await FeedUI.api('donation-status','POST',{id:prepared.id,postId:post.id});if(closed)return;if(r.status==='paid'){success(r.amount);return;}squareNotice(message,'retry','Payment is not confirmed yet','Your earlier Square checkout is still pending.');const u=new URL(prepared.url);if(u.protocol!=='https:'||u.hostname!==(prepared.mode==='sandbox'?'sandbox.square.link':'square.link'))throw Error('The earlier checkout is unavailable.');squareButton(button,'card','Continue earlier checkout');button.onclick=()=>location.assign(u.href);}catch(e){if(!closed)squareNotice(message,'retry','Please try again',e.message);}if(!closed)setBusy(false);}
  void prepare();return d;
 }
 return {open};
})();
