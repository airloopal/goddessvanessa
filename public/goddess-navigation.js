'use strict';
(()=>{
 const paths={
 status:'M3 12h4l3-8 4 16 3-8h4',chat:'M4 4h16v12H9l-5 4V4',overview:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
 applications:'M6 3h12v18H6zM9 7h6M9 11h6M9 15h4',video:'M3 6h12v12H3zM15 10l6-4v12l-6-4',photo:'M3 3h18v18H3zM3 17l6-6 4 4 3-3 5 5M7 7h.01',microphone:'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5M5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8',
 edit:'m4 16 12-12 4 4L8 20H4zM14 6l4 4',history:'M4 5v5h5M4 10a8 8 0 1 1 1 8M12 7v5l3 2',bell:'M6 9a6 6 0 0 1 12 0v6l2 3H4l2-3V9M10 21h4',external:'M14 3h7v7M21 3 10 14M10 3H3v18h18v-7',back:'M20 12H4m6-6-6 6 6 6',next:'M4 12h16m-6-6 6 6-6 6',close:'M6 6l12 12M6 18 18 6',send:'m3 3 19 9-19 9 4-9-4-9m4 9h15',download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',key:'M14 9a5 5 0 1 1-10 0 5 5 0 0 1 10 0m-1 3 8 8m-4-4 3-3',book:'M12 5C8 3 5 3 2 4v16c3-1 6-1 10 1V5m0 0c4-2 7-2 10-1v16c-3-1-6-1-10 1',copy:'M8 8h13v13H8zM16 8V3H3v13h5',check:'m4 12 5 5L20 6',trash:'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15',pause:'M8 4v16M16 4v16',debug:'M8 8h8v10H8zM9 8V5h6v3M3 10h5m8 0h5M3 16h5m8 0h5M12 8v10'
 };
 function key(el){if(paths[el.dataset.navIcon])return el.dataset.navIcon;const tab=el.dataset.tab;if(tab)return {chats:'chat',overview:'overview',applications:'applications',verifications:'video',content:'edit'}[tab];
 const t=(el.getAttribute('aria-label')||el.textContent).trim().toLowerCase();
 for(const [pattern,k] of [[/status/,'status'],[/debug|issues/,'debug'],[/changelog/,'history'],[/notification/,'bell'],[/refresh|reload|retry/,'history'],[/download/,'download'],[/copy/,'copy'],[/code|sign in/,'key'],[/video|verification/,'video'],[/photo/,'photo'],[/voice/,'microphone'],[/send|reply/,'send'],[/visual|content|theme|edit/,'edit'],[/application/,'applications'],[/back|dashboard/,'back'],[/conversation|chat/,'chat'],[/tour|walkthrough|around/,'book'],[/close|not now|^×$/,'close'],[/next/,'next'],[/finish|done|save|publish|reactivate/,'check'],[/delete/,'trash'],[/suspend/,'pause']])if(pattern.test(t))return k;
 if(el.matches('a[target="_blank"],.status-links a'))return 'external';return null;
 }
 function decorate(){document.querySelectorAll('#dashboard-nav a,#dashboard-nav button,.dashboard-links a,.dashboard-links button,#dashboard-main .quiet,#dashboard-main .p-button,#status-main a,#status-main button,dialog button,#floating-chat-toggle,#floating-chat button').forEach(el=>{
 if(el.querySelector('svg')||el.matches('[data-student],.floating-conversation-row'))return;const k=key(el);if(!k)return;
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','goddess-action-icon');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[k]);svg.append(path);el.prepend(svg);el.classList.add('goddess-icon-action');
 });}
 decorate();let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;decorate();});}).observe(document.body,{childList:true,subtree:true});
})();
