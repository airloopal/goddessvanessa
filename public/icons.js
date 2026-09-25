'use strict';
(()=>{
 const NS='http://www.w3.org/2000/svg';
 const paths={
 arrow:'M6 12h12m-5-5 5 5-5 5',back:'M18 12H6m5-5-5 5 5 5',
 spark:'m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3Z',
 book:'M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1m0-14c3-2 6-2 9-1v14c-3-1-6-1-9 1V6',
 shield:'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6L12 3m-4 9 3 3 5-6',
 profile:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2c0-4 16-4 16 0v2',
 clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0m-9-5v5l4 2',
 close:'m7 7 10 10M17 7 7 17',
 reset:'M4 9a8 8 0 1 1 0 6M4 4v5h5',
 save:'M5 3h12l4 4v14H3V3h2m2 0v6h10V3M7 21v-8h10v8',
 cloud:'M7 17H6a4 4 0 1 1 1-8 6 6 0 0 1 12 0 4 4 0 0 1-1 8h-1m-5 4V11m-4 4 4-4 4 4',
 load:'M7 16H6a4 4 0 1 1 1-8 6 6 0 0 1 12 0 4 4 0 0 1-1 8h-1m-5-4v9m-4-4 4 4 4-4',
 download:'M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4',
 upload:'M12 16V4m-4 4 4-4 4 4M4 17v4h16v-4',
 desktop:'M3 4h18v13H3V4m9 13v4m-5 0h10',
 mobile:'M7 2h10v20H7V2m4 17h2',
 trash:'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
 external:'M14 3h7v7m0-7L10 14M10 3H3v18h18v-7',
 check:'m5 12 4 4L19 6',
 edit:'m4 16 12-12 4 4L8 20H4v-4m10-10 4 4'
 };
 function choose(el){if(paths[el.getAttribute('data-icon')])return el.getAttribute('data-icon');const id=el.id,t=(el.textContent||el.getAttribute('aria-label')||'').toLowerCase();
  if(el.matches('.option'))return 'spark';
  if(id==='cloud-save')return 'cloud';if(id==='cloud-load')return 'load';
  if(id==='export')return 'download';if(el.matches('.upload'))return 'upload';
  if(id==='save')return 'save';if(id==='desktop')return 'desktop';if(id==='mobile')return 'mobile';
  if(id==='back')return 'back';if(id==='progress-open')return 'profile';
  if(id==='guidance'||el.dataset.info==='terms')return 'book';if(el.dataset.info==='privacy')return 'shield';
  if(id==='sign'||t.includes('sign preview'))return 'edit';if(t.includes('download'))return 'download';if(t.includes('acknowledgement')&&el.matches('a'))return 'shield';if(id==='excerpt')return 'book';if(id==='restart'||id==='reset'||t.includes('retry'))return 'reset';
  if(el.classList.contains('close')||t==='✕')return 'close';
  if(t.includes('delete'))return 'trash';if(t.includes('resume'))return 'clock';
  if(t.includes('understood'))return 'check';if(el.matches('a'))return 'external';
  return 'arrow';
 }
 function decorate(){document.querySelectorAll('button,a.textbtn,label.upload').forEach(el=>{
  if(el.closest('#landing-header')||el.matches('.donation-amounts button')){el.querySelectorAll(':scope > .fluid-icon').forEach(n=>n.remove());el.classList.remove('has-fluid-icon');return;}
  const key=choose(el),existing=el.querySelector(':scope > .fluid-icon');if(existing?.dataset.iconKey===key)return;if(existing)existing.remove();const svg=document.createElementNS(NS,'svg');svg.dataset.iconKey=key;svg.setAttribute('viewBox','0 0 28 28');svg.setAttribute('class','fluid-icon');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  const bg=document.createElementNS(NS,'rect');bg.setAttribute('x','0');bg.setAttribute('y','0');bg.setAttribute('width','28');bg.setAttribute('height','28');bg.setAttribute('rx','9');bg.setAttribute('class','icon-wash');svg.append(bg);
  const p=document.createElementNS(NS,'path');p.setAttribute('d',paths[key]);p.setAttribute('transform','translate(4 4) scale(.8333)');p.setAttribute('fill','none');p.setAttribute('stroke','currentColor');p.setAttribute('stroke-width','1.65');p.setAttribute('stroke-linecap','round');p.setAttribute('stroke-linejoin','round');svg.append(p);
  for(const n of el.childNodes)if(n.nodeType===3)n.textContent=n.textContent.replace(/[↗→←✕]/g,'').trim();
  el.querySelectorAll(':scope > span[aria-hidden="true"]').forEach(n=>{if(/^[→←↗\s]+$/.test(n.textContent))n.remove();});
  el.prepend(svg);el.classList.add('has-fluid-icon');
 });}
 let queued=false;const observer=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;decorate();});});
 window.HouseIcons={refresh:decorate};decorate();observer.observe(document.body,{childList:true,subtree:true});
})();
