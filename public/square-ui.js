'use strict';
// Shared Square card SDK, bank-verification timing and payment feedback.
let squareSDKPromise=null;
function squareAwait(promise,ms,message){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]).finally(()=>clearTimeout(timer));}
async function squareTokenize(card,details,ms=180000){
 let blocked;
 const policy=new Promise((_,reject)=>{blocked=e=>{if(['form-action','frame-src'].includes(e.effectiveDirective))reject(Object.assign(Error('Bank verification could not open securely. Close and reopen the card form to retry.'),{code:'bank_policy_blocked'}));};window.addEventListener('securitypolicyviolation',blocked);});
 try{return await squareVerificationAwait(Promise.race([card.tokenize(details),policy]),ms,'Bank verification timed out. No payment was submitted by this attempt. Reopen checkout to try again.');}
 finally{window.removeEventListener('securitypolicyviolation',blocked);}
}
// Allow time spent in the bank app without discarding its successful return.
function squareVerificationAwait(promise,ms,message,wallMs=600000){
 let timer,wallTimer,remaining=ms,visibleSince=null,settled=false;
 const doc=typeof document==='undefined'?null:document;
 return new Promise((resolve,reject)=>{
  const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(wallTimer);doc?.removeEventListener('visibilitychange',visibility);error?reject(error):resolve(value);};
  const expire=()=>finish(Object.assign(Error(message),{code:'bank_verification_timeout'}));
  const visibility=()=>{clearTimeout(timer);if(visibleSince!==null)remaining-=Date.now()-visibleSince;visibleSince=null;if(remaining<=0){expire();return;}if(!doc?.hidden){visibleSince=Date.now();timer=setTimeout(expire,remaining);}};
  doc?.addEventListener('visibilitychange',visibility);wallTimer=setTimeout(expire,wallMs);visibility();Promise.resolve(promise).then(value=>finish(null,value),error=>finish(error));
 });
}

function squareLoadSDK(mode){
 if(window.Square)return Promise.resolve();
 if(!squareSDKPromise)squareSDKPromise=new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=mode==='sandbox'?'https://sandbox.web.squarecdn.com/v1/square.js':'https://web.squarecdn.com/v1/square.js';el.onload=resolve;el.onerror=()=>{el.remove();squareSDKPromise=null;reject(Error('The secure card form could not load. Please close and reopen checkout.'));};document.head.append(el);});
 return squareSDKPromise;
}

function squareIcon(kind){const paths={card:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h3"/>',retry:'<path d="M20 7v5h-5M20 12a8 8 0 1 0-2 6"/>',video:'<rect x="3" y="6" width="12" height="12" rx="3"/><path d="m15 10 6-3v10l-6-3Z"/>',next:'<path d="M4 12h16m-6-6 6 6-6 6"/>',sign:'<path d="m14 4 6 6M4 20l5-1L21 7l-5-5L4 14v6ZM12 21h9"/>'};return '<svg class="square-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[kind]||paths.card)+'</svg>';}
function squareButton(button,kind,label,compact=false){if(!button)return;button.innerHTML=squareIcon(kind)+(compact?'':'<span>'+eduEscape(label)+'</span>');button.setAttribute('aria-label',label);button.title=label;button.classList.add('square-action');button.classList.toggle('square-icon-only',compact);}

function squareNotice(el,state,title,detail=''){
 if(!el)return;
 el.className='square-notice square-notice--'+state;
 el.setAttribute('role',state==='retry'?'alert':'status');
 el.innerHTML='<span class="square-notice-art" aria-hidden="true"><span class="square-notice-card"></span><svg viewBox="0 0 48 48"><circle class="square-notice-ring" cx="24" cy="24" r="20"/><path class="square-notice-check" d="m14 24 7 7 14-15"/><path class="square-notice-retry" d="M33 19a11 11 0 1 0 1 10M33 12v8h-8"/></svg></span><strong>'+eduEscape(title)+'</strong>'+(detail?'<span class="square-notice-detail">'+eduEscape(detail)+'</span>':'');
}
