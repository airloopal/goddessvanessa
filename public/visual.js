'use strict';
window.HouseVisual=(()=>{
 const editing=new URLSearchParams(location.search).has('visual')&&parent!==window;
 let viewport='desktop';
 let scope=document.body.dataset.visualScope||(location.pathname.includes('agreement')?'agreement':'journey:0:Beginner'),config={version:2,edits:{}},selecting=true,selected='',lastList='',pending=false;
 const baseline=new WeakMap(),catalog=new Map();
 const cssNames={color:'color',backgroundColor:'background-color',borderColor:'border-color',fontSize:'font-size',fontFamily:'font-family',fontWeight:'font-weight',textAlign:'text-align',padding:'padding',borderRadius:'border-radius',borderWidth:'border-width',letterSpacing:'letter-spacing',lineHeight:'line-height',width:'width',maxWidth:'max-width',minHeight:'min-height',height:'height',margin:'margin',paddingTop:'padding-top',paddingRight:'padding-right',paddingBottom:'padding-bottom',paddingLeft:'padding-left',display:'display',flexDirection:'flex-direction',flexWrap:'flex-wrap',justifyContent:'justify-content',alignItems:'align-items',gap:'gap',gridTemplateColumns:'grid-template-columns',order:'order',objectFit:'object-fit',objectPosition:'object-position',opacity:'opacity',boxShadow:'box-shadow',textTransform:'text-transform',fontStyle:'font-style',textDecoration:'text-decoration',backgroundSize:'background-size',backgroundPosition:'background-position',borderStyle:'border-style'};
 function path(el){if(el===document.body)return 'body';const parts=[];while(el&&el!==document.body){const tag=el.tagName.toLowerCase();if(el.id){parts.unshift('#'+el.id);break;}const sib=Array.from(el.parentElement?.children||[]).filter(x=>x.tagName===el.tagName&&!x.classList.contains('fluid-icon')&&!x.hasAttribute('data-visual-added'));parts.unshift(tag+':nth-of-type('+(sib.indexOf(el)+1)+')');el=el.parentElement;}return parts.join('>');}
 function locked(el){return !!el.closest('.demo-banner,.chat-warning,.charge-zero,#terms,#prototype-terms,.consent-line,#receipt,#signature-preview,#action-status,#loading,.signature-card .check');}
 function allowed(el){return !el.closest('svg,script,style,#frame,#signature-preview')&&!['SCRIPT','STYLE','LINK','META','BR'].includes(el.tagName);}
 function keyFor(el){let group=scope;if(scope!=='landing'&&scope!=='access'&&scope!=='walkthrough'&&!scope.startsWith('dashboard:')&&!scope.startsWith('application:')&&!scope.startsWith('education:')&&(el===document.body||el.closest('header,footer,aside')||el.matches('body>.preview')))group='shared';if(el.closest('#progress-dialog'))group='dialog:progress';if(el.closest('#info'))group='dialog:'+(window.HouseVisual.dialog||'guidance');if(el.closest('#demo-dialog')&&document.getElementById('demo-dialog').dataset.visualState)group='popup:'+document.getElementById('demo-dialog').dataset.visualState;return group+'|'+path(el);}
 function syncNodes(){
 const active=(config.nodes||[]).filter(n=>n.scope===scope),ids=new Set(active.map(n=>n.id));
 document.querySelectorAll('[data-visual-added]').forEach(el=>{if(!ids.has(el.id))el.remove();});
 const previous=new Map();
 for(const n of active){let anchor;try{anchor=Array.from(document.querySelectorAll('[data-visual-path]')).find(x=>x.getAttribute('data-visual-path')===n.anchor)||document.querySelector(n.anchor);}catch{continue;}if(!anchor)continue;
 let el=document.getElementById(n.id);if(!el){el=document.createElement(n.tag);el.id=n.id;el.dataset.visualAdded='true';if(n.tag==='img'){el.src='/images/editorial-portrait.jpg';el.alt='Choose an image';}else if(n.tag==='video'){el.src='/images/hero-loop.mp4';el.controls=true;}else if(n.tag==='a'){el.href='#';el.textContent='New link';}else if(n.tag!=='hr')el.textContent=n.tag==='h2'?'New heading':n.tag==='section'?'New section':'Your text here';}
 const group=n.anchor+'|'+n.placement,prev=previous.get(group);
 if(n.placement==='inside'){if(prev){if(prev.nextElementSibling!==el)prev.after(el);}else if(el.parentElement!==anchor)anchor.append(el);}
 else{const before=prev||anchor;if(before!==document.body&&before.nextElementSibling!==el)before.after(el);}
 previous.set(group,el);
 }
 }
 function paint(){pending=false;catalog.clear();document.querySelectorAll('body,body *').forEach(el=>{if(allowed(el))el.setAttribute('data-visual-path',path(el));});syncNodes();
  document.querySelectorAll('body,body *').forEach(el=>{
   if(!allowed(el))return;
   let base=baseline.get(el);if(!base){const nodes=Array.from(el.childNodes).filter(n=>n.nodeType===3&&n.textContent.trim());base={nodes,text:nodes.map(n=>n.textContent),styles:{},placeholder:el.getAttribute('placeholder'),href:el.getAttribute('href'),icon:el.getAttribute('data-icon'),src:el.getAttribute('src'),alt:el.getAttribute('alt')};for(const [p,css] of Object.entries(cssNames))base.styles[p]={value:el.style.getPropertyValue(css),priority:el.style.getPropertyPriority(css)};base.backgroundImage={value:el.style.getPropertyValue('background-image'),priority:el.style.getPropertyPriority('background-image')};baseline.set(el,base);}
   const key=keyFor(el),change=config.edits[key]||(key.startsWith('popup:entry|')?config.edits['application:2|'+path(el)]:null)||{};const lock=locked(el);const mobile=editing?viewport==='mobile':innerWidth<=600,tablet=editing?viewport==='tablet':innerWidth>600&&innerWidth<=1000;const effective={...change.style,...(mobile||tablet?change.tabletStyle:{}),...(mobile?change.mobileStyle:{})};
   base.nodes.forEach((n,i)=>{if(base.lastText&&n.textContent!==base.lastText[i])base.text[i]=n.textContent;const v=!lock&&Array.isArray(change.text)&&typeof change.text[i]==='string'?change.text[i]:base.text[i];if(n.textContent!==v)n.textContent=v;});base.lastText=base.nodes.map(n=>n.textContent);
   for(const [p,css] of Object.entries(cssNames)){const value=effective[p];if(value!==undefined){if(el.style.getPropertyValue(css)!==value||el.style.getPropertyPriority(css)!=='important')el.style.setProperty(css,value,'important');}else{const b=base.styles[p];if(el.style.getPropertyValue(css)!==b.value||el.style.getPropertyPriority(css)!==b.priority){if(b.value)el.style.setProperty(css,b.value,b.priority);else el.style.removeProperty(css);}}}
   if(change.removed)el.style.setProperty('display','none','important');
   const img=change.backgroundImage?{value:'url("'+change.backgroundImage+'")',priority:'important'}:effective.backgroundColor!==undefined?{value:'none',priority:'important'}:base.backgroundImage;if(el.style.getPropertyValue('background-image')!==img.value){if(img.value)el.style.setProperty('background-image',img.value,img.priority);else el.style.removeProperty('background-image');}
   if(el.matches('img,video')){const src=change.src??base.src;if(src!==null&&el.getAttribute('src')!==src)el.setAttribute('src',src);const alt=change.alt??base.alt;if(alt!==null&&el.getAttribute('alt')!==alt)el.setAttribute('alt',alt);}
   if(base.placeholder!==null){const value=change.placeholder??base.placeholder;if(el.getAttribute('placeholder')!==value)el.setAttribute('placeholder',value);}
   if(el.matches('a')&&base.href!==null){const href=change.href??base.href;if(el.getAttribute('href')!==href)el.setAttribute('href',href);}
   if(el.matches('button,a.textbtn,label.upload')){if(change.icon)el.setAttribute('data-icon',change.icon);else if(base.icon)el.setAttribute('data-icon',base.icon);else el.removeAttribute('data-icon');}
   if(editing){el.setAttribute('data-vkey',key);el.classList.toggle('visual-selected',key===selected);const computed=getComputedStyle(el),styles={};for(const p of Object.keys(cssNames))styles[p]=computed[p];catalog.set(key,{key,tag:el.tagName.toLowerCase(),label:(el.getAttribute('aria-label')||base.text.join(' ').trim()||el.id||el.className||el.tagName).slice(0,95),text:base.nodes.map(n=>n.textContent),baseText:base.text,styles,placeholder:el.getAttribute('placeholder'),href:el.matches('a')?el.getAttribute('href'):null,icon:el.matches('button,a.textbtn,label.upload')?(el.getAttribute('data-icon')||'arrow'):null,src:el.matches('img,video')?el.getAttribute('src'):null,alt:el.matches('img,video')?el.getAttribute('alt'):null,backgroundImage:change.backgroundImage||'',locked:lock,shared:key.startsWith('shared|')});}
  });
  window.HouseIcons?.refresh();
  if(editing){const data=Array.from(catalog.values());const encoded=JSON.stringify(data);if(encoded!==lastList){lastList=encoded;parent.postMessage({type:'visual:elements',scope,elements:data},location.origin);}}
 }
 function schedule(){if(!pending){pending=true;queueMicrotask(paint);}}
 if(editing){
  const style=document.createElement('style');style.textContent='.visual-selected{outline:2px solid #79edff!important;outline-offset:3px!important}';document.head.append(style);
  document.addEventListener('click',e=>{if(!selecting)return;const el=e.target.closest?.('[data-vkey]');if(!el)return;e.preventDefault();e.stopImmediatePropagation();selected=el.getAttribute('data-vkey');schedule();parent.postMessage({type:'visual:select',key:selected},location.origin);},true);
  window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent)return;const d=e.data;if(d?.type==='visual:config'&&d.config?.version===2&&d.config.edits){config=d.config;viewport=d.viewport||'desktop';schedule();}if(d?.type==='visual:refresh'){lastList='';schedule();}if(d?.type==='visual:mode'){selecting=d.selecting!==false;selected='';schedule();}if(d?.type==='visual:select'){selected=d.key||'';schedule();}});
 }else{fetch('/api/visual/published').then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{if(d.config?.version===2){config=d.config;viewport=d.viewport||'desktop';schedule();}}).catch(()=>{});}
 window.addEventListener('resize',schedule);
 new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});schedule();
 return{scope(value){scope=value;schedule();},dialog:'guidance'};
})();
