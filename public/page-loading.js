'use strict';
(()=>{
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 if(new URLSearchParams(location.search).has('visual')||reduced?.matches)return;
 // Reveal content without covering it, blocking controls or waiting for a fake loader.
 document.body.classList.add('page-arriving');
 const style=document.createElement('style');style.textContent='body.page-arriving :is(.expectation-card,.stat-card,.access-card){animation:vanessa-content-in .22s ease-out}@media(prefers-reduced-motion:reduce){body.page-arriving *{animation:none!important}}';document.head.append(style);
 setTimeout(()=>{document.body.classList.remove('page-arriving');style.remove();},240);
 document.addEventListener('load',event=>{const image=event.target;if(reduced?.matches||!(image instanceof HTMLImageElement)||!image.matches('.feed-visual img,.gallery-stage>img,.sub-profile-avatar img'))return;image.classList.add('motion-image-ready');image.addEventListener('animationend',()=>image.classList.remove('motion-image-ready'),{once:true});},true);
})();
