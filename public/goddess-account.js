'use strict';
(()=>{
 const account=document.querySelector('.goddess-account'),button=document.getElementById('goddess-account-toggle'),panel=document.getElementById('goddess-account-panel');if(!account||!button||!panel)return;
 function close(restore=false){panel.hidden=true;button.setAttribute('aria-expanded','false');if(restore)button.focus();}
 function open(){panel.hidden=false;button.setAttribute('aria-expanded','true');}
 button.addEventListener('click',()=>panel.hidden?open():close());
 button.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();open();panel.querySelector('button,a,input')?.focus();}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.preventDefault();close(true);}});
 document.addEventListener('click',e=>{if(!panel.hidden&&!account.contains(e.target))close();});
 account.addEventListener('focusout',()=>queueMicrotask(()=>{if(!account.contains(document.activeElement))close();}));
 panel.addEventListener('click',e=>{if(e.target.closest('a,button'))close();});
 document.getElementById('account-settings').addEventListener('click',()=>{document.querySelector('#dashboard-nav [data-tab="settings"]')?.click();const heading=document.querySelector('#dashboard-main h1');if(heading){heading.setAttribute('tabindex','-1');heading.focus();}});
})();
