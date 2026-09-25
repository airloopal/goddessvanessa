'use strict';
window.ChatLoading=(()=>{
 let timers=[],overlay=null;
 function cancel(){timers.forEach(clearTimeout);timers=[];overlay?.remove();overlay=null;const app=(document.getElementById('education-app')||document.getElementById('client-chat')||document.getElementById('application'));if(!app)return;app.inert=false;app.removeAttribute('aria-busy');app.classList.remove('chat-revealing');app.querySelector('.application-main')?.classList.remove('step-is-loading');}
 function later(fn,ms){timers.push(setTimeout(fn,ms));}
 function step(){
  cancel();const app=(document.getElementById('education-app')||document.getElementById('client-chat')||document.getElementById('application')),main=app.querySelector('.application-main');if(new URLSearchParams(location.search).has('visual')||!main||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  overlay=document.createElement('div');overlay.className='step-skeleton';overlay.setAttribute('role','status');overlay.innerHTML='<span class="sr-only">Preparing the next step</span><div aria-hidden="true"><i class="step-skeleton-title"></i><i class="step-skeleton-line"></i><i class="step-skeleton-line short"></i><div class="step-skeleton-cards"><i></i><i></i></div><i class="step-skeleton-action"></i></div>';
  main.classList.add('step-is-loading');main.append(overlay);app.inert=true;app.setAttribute('aria-busy','true');later(()=>{cancel();app.classList.add('chat-revealing');document.getElementById('step-main')?.focus({preventScroll:true});later(()=>app.classList.remove('chat-revealing'),180);},450);
 }
 function start(options={}){
  if(new URLSearchParams(location.search).has('visual'))return;const fast=options.fast===true;
  cancel();const app=(document.getElementById('education-app')||document.getElementById('client-chat')||document.getElementById('application'));if(!fast&&!app.querySelector('.chat-main'))return;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  overlay=document.createElement('div');overlay.className='chat-loading'+(fast?' step-loading':'');overlay.setAttribute('role','status');overlay.setAttribute('aria-live','polite');
  overlay.innerHTML=`<div class="casting-stage"><svg class="casting-letter" viewBox="0 0 300 300" aria-hidden="true"><defs><linearGradient id="cast-gold" x1="0" y1="0" x2="1" y2=".4"><stop stop-color="#7a4b14"/><stop offset=".25" stop-color="#e9bd62"/><stop offset=".48" stop-color="#fff0b0"/><stop offset=".64" stop-color="#bd8530"/><stop offset=".83" stop-color="#f5d988"/><stop offset="1" stop-color="#8d5818"/></linearGradient><clipPath id="cast-v"><text x="150" y="239" text-anchor="middle" font-family="LibreBaskerville,Georgia,serif" font-size="240" font-weight="700">V</text></clipPath></defs><text class="casting-depth" x="153" y="243" text-anchor="middle">V</text><text class="casting-outline" x="150" y="239" text-anchor="middle">V</text><g clip-path="url(#cast-v)"><g class="liquid-rise"><path class="liquid-back" fill="#b98637" d="M-300 15 Q-225 -7 -150 15 T0 15 T150 15 T300 15 T450 15 T600 15 V400 H-300Z"/><path class="liquid-front" fill="url(#cast-gold)" d="M-300 20 Q-225 -5 -150 20 T0 20 T150 20 T300 20 T450 20 T600 20 V400 H-300Z"/></g><rect class="casting-solid" width="300" height="300" fill="url(#cast-gold)"/><rect class="casting-glint" x="-100" y="0" width="28" height="350" fill="#fff9d5" transform="rotate(-20 150 150)"/></g></svg><p class="casting-label">Preparing your space</p><span class="casting-caption">Your conversation is almost ready</span></div><div class="chat-skeleton" aria-hidden="true"><div class="skeleton-header"><i class="skeleton-avatar"></i><div><i class="skeleton-line"></i><i class="skeleton-line short"></i></div></div><div class="skeleton-thread"><i class="skeleton-bubble"></i><i class="skeleton-bubble outgoing"></i><i class="skeleton-bubble small"></i></div><div class="skeleton-bottom"><div class="skeleton-chips"><i></i><i></i><i></i></div><i class="skeleton-input"></i></div></div>`;
  if(fast){overlay.querySelector('.casting-label').textContent='Preparing the next step';overlay.querySelector('.casting-caption').textContent='';overlay.querySelector('.chat-skeleton').remove();}document.body.append(overlay);app.inert=true;app.setAttribute('aria-busy','true');
  const finish=()=>{const stage=overlay;if(!stage)return;stage.classList.add('loader-exit');app.inert=false;app.removeAttribute('aria-busy');app.classList.add('chat-revealing');later(()=>{stage.remove();if(overlay===stage)overlay=null;app.classList.remove('chat-revealing');document.getElementById(fast?'step-main':'client-message')?.focus({preventScroll:true});},reduced?0:fast?180:450);};
  if(reduced){overlay.classList.add('reduced');later(finish,fast?0:120);return;}
  later(()=>{overlay?.classList.add('cast-complete');},fast?420:1500);
  if(!fast)later(()=>{overlay?.classList.add('show-skeleton');},1950);
  later(finish,fast?650:2550);
 }
 return{start,cancel,step};
})();
