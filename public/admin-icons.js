/* Shared rounded 24px outline icons. Static SVG only; no device emoji or remote icon runtime. */
'use strict';
if(document.body?.classList?.contains('dashboard')){try{document.body.dataset.adminTheme=localStorage.getItem('vanessa-admin-theme')==='night'?'night':'day';}catch{}}
window.AdminIcons=(()=>{
 const shapes={
 "chevron-left":'<path d="m15 5-7 7 7 7"/>',
 "chevron-right":'<path d="m9 5 7 7-7 7"/>',
 compose:'<path d=""/>',
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z"/>',
 heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
 chat:'<path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9 9 0 0 1-4-.9L3 21l1.9-5a9 9 0 0 1-.9-4 8.4 8.4 0 0 1 8.5-9H13a8.4 8.4 0 0 1 8 8v.5Z"/>',
 overview:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
 applications:'<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M9 7h6M9 11h6M9 15h4"/>',
 video:'<rect x="3" y="6" width="12" height="12" rx="3"/><path d="m15 10 6-3v10l-6-3Z"/>',
 photo:'<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="12" cy="12" r="4"/>',
 microphone:'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 10v2a6 6 0 0 0 12 0v-2M12 18v3m-4 0h8"/>',
 edit:'<path d="m15 5 4 4M4 16 16 4a2.8 2.8 0 0 1 4 4L8 20H4v-4Z"/>',
 history:'<path d="M3 5v5h5M3 10a9 9 0 1 1 1 8M12 7v5l3 2"/>',
 refresh:'<path d="M20 7v5h-5M4 17v-5h5M20 12a8 8 0 0 0-14-5M4 12a8 8 0 0 0 14 5"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
 external:'<path d="M14 3h7v7M21 3 10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>',
 back:'<path d="M20 12H4m6-6-6 6 6 6"/>',next:'<path d="M4 12h16m-6-6 6 6-6 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',
 send:'<path d="m21 3-7 18-4-7-7-4 18-7ZM21 3 10 14"/>',reply:'<path d="M9 5 3 11l6 6v-4h4c4 0 6 2 8 6v-3c0-6-3-9-8-9H9V5Z"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
 key:'<circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-4-4 3-3m-6 3 3-3"/>',
 book:'<path d="M12 5C8 3 5 3 2 4v16c3-1 6-1 10 1V5m0 0c4-2 7-2 10-1v16c-3-1-6-1-10 1"/>',
 copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
 check:'<path d="m4 12 5 5L20 6"/>',checks:'<path d="m2 12 5 5L18 6M12 17l10-11"/>',
 trash:'<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',pause:'<path d="M8 4v16M16 4v16"/>',
 status:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',debug:'<rect x="7" y="7" width="10" height="13" rx="4"/><path d="M9 7V4h6v3M3 10h4m10 0h4M3 16h4m10 0h4M12 8v11"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2m-3-9-1.5 1.5m-11 11L3 21M3 3l1.5 1.5m14 14L21 21"/>',
 moon:'<path d="M21 13a9 9 0 0 1-10-10A9 9 0 1 0 21 13Z"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13"/><path d="M12 8H8a3 3 0 1 1 3-3l1 3ZM12 8h4a3 3 0 1 0-3-3l-1 3Z"/>',
 payment:'<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h3"/>',
 verification:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
 pin:'<path d="m9 3 6 0-1 6 4 4v2H6v-2l4-4-1-6ZM12 15v7"/>',
 smile:'<circle cx="12" cy="12" r="9"/><path d="M8 14a4 4 0 0 0 8 0M8 9h.01M16 9h.01"/>',
 attach:'<path d="m21 11-8 8a6 6 0 0 1-8-8l9-9a4 4 0 0 1 6 6l-9 9a2 2 0 0 1-3-3l8-8"/>',
 play:'<path d="m8 4 12 8-12 8V4Z"/>',search:'<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
 up:'<path d="M12 20V4m-6 6 6-6 6 6"/>',down:'<path d="M12 4v16m-6-6 6 6 6-6"/>',
 chevron:'<path d="m9 5 7 7-7 7"/>',chevronDown:'<path d="m6 9 6 6 6-6"/>',logout:'<path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4M13 8l5 4-5 4M8 12h13"/>',
 crown:'<path d="m3 6 5 4 4-7 4 7 5-4-2 13H5L3 6Z"/>',alert:'<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v4m0 4h.01"/>'
 };
 let composeSerial=0;
 const svg=(name,extra='')=>'<svg class="admin-icon '+extra+'" data-admin-icon="'+(shapes[name]?name:'alert')+'" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+(name==='compose'?'<defs><mask id="admin-compose-'+(++composeSerial)+'" style="mask-type:alpha"><image href="/images/brand/admin-feed-compose.png" width="24" height="24"/></mask></defs><rect width="24" height="24" fill="currentColor" stroke="none" mask="url(#admin-compose-'+composeSerial+')"/>':(shapes[name]||shapes.alert))+'</svg>';
 return Object.freeze({svg,names:Object.freeze(Object.keys(shapes))});
})();

// Authoring tools share the collection while keeping their established editor palette.
if(document.body?.classList?.contains('builder')||document.body?.classList?.contains('academy-builder'))(()=>{
 function decorate(){document.querySelectorAll('button,a.textbtn,label.upload,.academy-nav a').forEach(el=>{
 if(el.closest('iframe,.emoji-picker'))return;const text=(el.getAttribute('aria-label')||el.textContent).trim().toLowerCase();
 let name=el.dataset.adminActionIcon;for(const [p,k] of [[/close|cancel/,'close'],[/remove|delete/,'trash'],[/^up\b|move up/,'up'],[/^down\b|move down/,'down'],[/save|publish|apply/,'check'],[/preview/,'photo'],[/copy/,'copy'],[/reset|refresh/,'refresh'],[/back|dashboard/,'back'],[/add|insert/,'applications'],[/upload|image/,'photo'],[/desktop|tablet|mobile/,'overview'],[/sign in|access/,'key'],[/edit/,'edit']])if(!name&&p.test(text))name=k;
 if(!name||el.querySelector('[data-admin-icon]'))return;for(const n of el.childNodes)if(n.nodeType===3)n.textContent=n.textContent.replace(/[↑↓↗→←✕]/g,'').trim();el.insertAdjacentHTML('afterbegin',AdminIcons.svg(name));
 });}
 decorate();let pending=false;new MutationObserver(()=>{if(!pending){pending=true;requestAnimationFrame(()=>{pending=false;decorate();});}}).observe(document.body,{childList:true,subtree:true});
})();
