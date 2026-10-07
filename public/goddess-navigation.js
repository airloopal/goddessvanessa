 'use strict';
(()=>{
 function key(el){
 const explicit=el.dataset.navIcon||el.dataset.adminActionIcon;if(AdminIcons.names.includes(explicit))return explicit;
 if(el.id==='admin-theme-toggle')return document.body.dataset.adminTheme==='night'?'sun':'moon';
 if(el.id==='goddess-account-toggle')return 'user';if(el.id==='mobile-admin-more')return 'more';if(el.id==='goddess-logout')return 'logout';
 const tab=el.dataset.tab||el.dataset.mobileTab;if(tab)return {chats:'chat',overview:'overview',applications:'applications',feed:'compose',verifications:'verification',settings:'key',content:'edit'}[tab];
 if(el.matches('[data-reply-message]'))return 'reply';if(el.matches('[data-pin-student]'))return 'pin';if(el.matches('[data-emoji-toggle]'))return 'smile';
 const t=(el.getAttribute('aria-label')||el.textContent).trim().toLowerCase();
 for(const [pattern,k] of [[/cancel reply|close|not now|^×$/,'close'],[/choose emoji/,'smile'],[/attach/,'attach'],[/gift/,'gift'],[/status/,'status'],[/debug|issues/,'debug'],[/changelog/,'history'],[/notification/,'bell'],[/refresh|reload|retry/,'refresh'],[/download/,'download'],[/copy/,'copy'],[/code|sign in/,'key'],[/verification|authenticator/,'verification'],[/video/,'video'],[/photo|gallery|background/,'photo'],[/voice/,'microphone'],[/reply to/,'reply'],[/send|reply/,'send'],[/visual|content|edit/,'edit'],[/application|all subs/,'applications'],[/back|dashboard/,'back'],[/conversation|chat/,'chat'],[/tour|walkthrough|around/,'book'],[/next/,'next'],[/finish|done|save|publish|reactivate/,'check'],[/delete|remove/,'trash'],[/suspend|pause/,'pause'],[/profile|account/,'user'],[/log out/,'logout']])if(pattern.test(t))return k;
 if(el.matches('a[target="_blank"],.status-links a'))return 'external';return null;
 }
 function decorate(){document.querySelectorAll('#dashboard-nav a,#dashboard-nav button,.dashboard-links a,.dashboard-links button,#dashboard-main button,#dashboard-main .quiet,#dashboard-main .p-button,#status-main a,#status-main button,dialog button,#floating-chat-toggle,#floating-chat button').forEach(el=>{
 if(el.matches('.crucial-notification,.emoji-picker button,[data-student],.floating-conversation-row,.background-preset,[data-chat-media-url],.voice-note-play,.voice-note-download,.media-download-icon')||el.closest('.crucial-notification'))return;
 const k=key(el);if(!k)return;const existing=el.querySelector('svg');if(existing?.dataset.adminIcon===k)return;
 for(const n of el.childNodes)if(n.nodeType===3&&el.textContent.trim().length>1)n.textContent=n.textContent.replace(/[↗←→↑↓]/g,'');
 const markup=AdminIcons.svg(k,'goddess-action-icon');
 if(el.id==='admin-theme-toggle'||/^[×✕✖←→↓↩]$/.test(el.textContent.trim()))el.innerHTML=markup;
 else if(existing){const own=el.querySelector(':scope > svg');if(own)own.outerHTML=markup;else if(el.querySelector('.mobile-tool-symbol'))el.querySelector('.mobile-tool-symbol').innerHTML=markup;else return;}
 else el.insertAdjacentHTML('afterbegin',markup);
 el.classList.add('goddess-icon-action');
 });
 const account=document.querySelector('#goddess-account-toggle .account-chevron');if(account&&!account.dataset.adminIcon)account.outerHTML=AdminIcons.svg('chevronDown','account-chevron');
 document.querySelectorAll('.mobile-admin-tool-list>*>span:last-child').forEach(e=>{if(e.textContent.trim()==='›')e.innerHTML=AdminIcons.svg('chevron');});
 const search=document.querySelector('.conversation-search>svg');if(search&&!search.dataset.adminIcon)search.outerHTML=AdminIcons.svg('search');
 }
 decorate();let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate();});}).observe(document.body,{childList:true,subtree:true});
})();

// Mobile navigation uses the existing authenticated dashboard routes.
(()=>{
 const nav=document.getElementById('dashboard-nav');if(!nav||!nav.querySelector('[data-tab]'))return;
 const labels={overview:'Home',feed:'Feed',chats:'Chats',applications:'All Subs'};
 for(const [key,label] of Object.entries(labels)){const button=nav.querySelector('[data-tab="'+key+'"]');button.dataset.mobileLabel=label;button.setAttribute('aria-label',key==='overview'?'Overview':key==='content'?'Edit website':key==='chats'?'Conversations':label);}
 const more=document.createElement('button');more.id='mobile-admin-more';more.type='button';more.dataset.mobileLabel='More';more.setAttribute('aria-label','More admin tools');more.setAttribute('aria-haspopup','dialog');more.innerHTML='<svg class="goddess-action-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>More';nav.append(more);
 const sheet=document.createElement('dialog');sheet.id='mobile-admin-tools';sheet.setAttribute('aria-labelledby','mobile-admin-tools-title');sheet.innerHTML='<div class="mobile-sheet-handle" aria-hidden="true"></div><header><div><small>VANESSA’S SPACE</small><h2 id="mobile-admin-tools-title">More</h2></div><button type="button" class="quiet" data-mobile-close aria-label="Close admin tools">×</button></header><p class="mobile-sheet-note">Everything else, one tap away.</p><div class="mobile-admin-tool-list"><button type="button" data-mobile-tab="content"><span class="mobile-tool-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m16 3 5 5-12 12H4v-5L16 3Z M14 5l5 5"/></svg></span><span><strong>Edit</strong><small>Edit website content and theme</small></span><span aria-hidden="true">›</span></button><button type="button" data-mobile-tab="verifications"><span class="mobile-tool-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg></span><span><strong>Verification requests</strong><small>Review requests and send replies</small></span><span aria-hidden="true">›</span></button><a href="status.html"><span class="mobile-tool-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg></span><span><strong>System status</strong><small>Monitor connections and resolve issues</small></span><span aria-hidden="true">›</span></a><button type="button" data-mobile-tab="settings"><span class="mobile-tool-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/></svg></span><span><strong>Settings & security</strong><small>Access code and two-step verification</small></span><span aria-hidden="true">›</span></button><a href="status.html#changelog"><span class="mobile-tool-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5v5h5M4 10a8 8 0 1 1 1 8M12 7v5l3 2"/></svg></span><span><strong>What’s changed</strong><small>View platform updates</small></span><span aria-hidden="true">›</span></a></div>';document.body.append(sheet);
 more.onclick=()=>{if(!sheet.open)sheet.showModal();};
 sheet.querySelector('[data-mobile-close]').onclick=()=>sheet.close();
 sheet.addEventListener('click',event=>{if(event.target===sheet){const r=sheet.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)sheet.close();}});
 sheet.querySelectorAll('[data-mobile-tab]').forEach(button=>button.onclick=()=>{sheet.close();nav.querySelector('[data-tab="'+button.dataset.mobileTab+'"]').click();});
 const sync=()=>{const active=nav.querySelector('[data-tab][aria-current="page"]');const value=active&&!labels[active.dataset.tab]?'page':'false';if(more.getAttribute('aria-current')!==value)more.setAttribute('aria-current',value);document.body.dataset.mobileAdminTab=active?.dataset.tab||'overview';};
 new MutationObserver(sync).observe(nav,{attributes:true,attributeFilter:['aria-current'],subtree:true});sync();
 // Use visualViewport so the keyboard does not cover the navigation or reply field.
 const viewport=window.visualViewport;let viewportFrame=false;
 const keyboard=()=>{viewportFrame=false;if(viewport&&viewport.scale!==1)return;const height=viewport?.height||innerHeight,offset=viewport?.offsetTop||0,focused=document.activeElement?.matches?.('#admin-reply,#floating-reply'),raised=!!focused&&(innerHeight-height>100||height<500);document.body.classList.toggle('admin-keyboard-open',raised);const header=document.querySelector('body>.p-header'),top=raised?0:header?.getBoundingClientRect().height||80,nav=document.getElementById('dashboard-nav'),navRect=nav?.getBoundingClientRect(),reserve=raised?0:(navRect?Math.max(navRect.height,Number.isFinite(navRect.top)?height+offset-navRect.top:navRect.height):84);document.body.style.setProperty('--admin-viewport-height',height+'px');document.body.style.setProperty('--mobile-chat-top',(offset+top)+'px');document.body.style.setProperty('--mobile-chat-height',Math.max(100,height-top-reserve)+'px');const log=document.getElementById('admin-thread');if(focused&&log)log.scrollTop=log.scrollHeight;};
 const scheduleViewport=()=>{if(!viewportFrame){viewportFrame=true;requestAnimationFrame(keyboard);}};
 viewport?.addEventListener('resize',scheduleViewport,{passive:true});viewport?.addEventListener('scroll',scheduleViewport,{passive:true});addEventListener('resize',scheduleViewport,{passive:true});document.addEventListener('focusin',scheduleViewport);document.addEventListener('focusout',scheduleViewport);keyboard();
})();
