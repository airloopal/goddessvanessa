'use strict';
window.UIChat=(()=>{
 const icon=window.AdminIcons?.svg('crown')||'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 5 4 4-7 4 7 5-4-2 13H5L3 6Z"/></svg>';
 const time=at=>{if(!at)return '';const d=new Date(Number(at)),now=new Date();if(d.toDateString()===now.toDateString())return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);return d.toDateString()===yesterday.toDateString()?'Yesterday':d.toLocaleDateString([],{day:'numeric',month:'short'});};
 const tier=id=>['basic','advanced'].includes(id)?'<span class="entry-tier '+id+'" role="img" aria-label="'+(id==='advanced'?'Advanced':'Basic')+'" title="'+(id==='advanced'?'Advanced':'Basic')+'">'+icon+'</span>':'';
 let box=null,returnFocus=null;
 const photoTaps=new WeakMap();
 function secondPhotoTap(target,event){const previous=photoTaps.get(target),now=event.timeStamp;if(previous!==undefined&&now-previous>=0&&now-previous<=350){photoTaps.delete(target);return true;}photoTaps.set(target,now);return false;}
 function closeMedia(){if(!box)return;box.querySelector('video')?.pause();box.querySelector('.chat-media-view').replaceChildren();if(box.open)box.close();if(returnFocus?.isConnected)returnFocus.focus();}
 function openMedia(button){const photo=button.dataset.profilePhotoUrl,path=photo||button.dataset.chatMediaUrl,kind=photo?'image':button.dataset.chatMediaKind;if(photo?(!document.body.classList.contains('dashboard')||!window.SubAvatar?.valid(photo)):(!/^\/api\/media\/[a-f0-9-]{36}$/i.test(path)||!['image','video'].includes(kind)))return;
  if(!box){box=document.createElement('dialog');box.className='chat-media-lightbox';box.setAttribute('aria-label','Shared media preview');box.innerHTML='<button class="quiet chat-media-close" aria-label="Close media preview"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></button><div class="chat-media-view"></div>';document.body.append(box);box.querySelector('button').onclick=closeMedia;box.addEventListener('cancel',e=>{e.preventDefault();closeMedia();});box.addEventListener('click',e=>{if(e.target===box)closeMedia();});}
  box.classList.toggle('sub-profile-photo-lightbox',!!photo);returnFocus=button;const themed=button.closest('.chat-shell,.admin-conversation')||document.body,styles=getComputedStyle(themed);box.style.setProperty('--chat-panel',styles.getPropertyValue('--chat-panel')||styles.getPropertyValue('--dash-surface')||'#fff8fc');box.style.setProperty('--chat-ink',styles.getPropertyValue('--chat-ink')||styles.getPropertyValue('--dash-ink')||'#211920');const media=document.createElement(kind==='image'?'img':'video');media.src=path;if(kind==='video'){media.controls=true;media.playsInline=true;media.preload='metadata';media.setAttribute('aria-label','Shared video');}else media.alt=photo?(button.querySelector('img')?.alt||'Sub profile photo'):'Shared photo';if(photo)media.onclick=e=>{if(secondPhotoTap(media,e))closeMedia();};box.querySelector('.chat-media-view').replaceChildren(media);box.showModal();box.querySelector('button').focus();
 }
 document.addEventListener('click',e=>{const b=e.target.closest('[data-chat-media-url],[data-profile-photo-url]');if(b){e.preventDefault();if(!b.dataset.profilePhotoUrl||e.detail===0||secondPhotoTap(b,e))openMedia(b);}});
 function mountEmoji(form){if(!form)return;const input=form.querySelector('textarea,input:not([type=file])');if(!input)return;const existing=form.parentElement.querySelector('[data-emoji-toggle]');if(existing){if(existing.querySelectorAll('svg').length!==1||existing.textContent.trim())existing.innerHTML=AdminIcons.svg('smile');return;}
  const button=document.createElement('button');button.type='button';button.className='quiet emoji-toggle';button.dataset.emojiToggle='';button.innerHTML=AdminIcons.svg('smile');button.setAttribute('aria-label','Choose emoji');button.title='Choose emoji';button.setAttribute('aria-expanded','false');
  const panel=document.createElement('div');panel.className='emoji-picker';panel.hidden=true;panel.setAttribute('role','group');panel.setAttribute('aria-label','Emoji picker');
  for(const symbol of ['💗','❤️','🖤','👑','✨','🔥','😊','😉','😘','😍','😈','🥰','🙌','👍','👏','🎁','🌹','💋','🤍','😏','✅','⏳','🎉','🙏']){const item=document.createElement('button');item.type='button';item.textContent=symbol;item.setAttribute('aria-label',symbol);item.onclick=()=>{const start=input.selectionStart??input.value.length,end=input.selectionEnd??start;if(input.value.length-(end-start)+symbol.length>input.maxLength)return;input.setRangeText(symbol,start,end,'end');input.dispatchEvent(new Event('input',{bubbles:true}));panel.hidden=true;button.setAttribute('aria-expanded','false');input.focus();};panel.append(item);}
  (form.parentElement.querySelector('.chat-attachment-controls')||form).append(button);form.after(panel);button.onclick=()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));};panel.addEventListener('keydown',e=>{if(e.key==='Escape'){panel.hidden=true;button.setAttribute('aria-expanded','false');button.focus();}});
 }
 const lastSeen=at=>{const n=Number(at);if(!Number.isFinite(n)||n<=0)return 'Last seen not recorded yet';const d=new Date(n),today=new Date(),yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);const clock=d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});return 'Last seen '+(d.toDateString()===today.toDateString()?'today at '+clock:d.toDateString()===yesterday.toDateString()?'yesterday at '+clock:d.toLocaleDateString([],{day:'numeric',month:'short',year:'numeric'})+' at '+clock);};
 const country=code=>{try{return new Intl.DisplayNames(['en'],{type:'region'}).of(code);}catch{return code;}};return {time,lastSeen,tier,country,closeMedia,mountEmoji};
})();
function adminBanknoteBurst(host){
 if(!host||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||
    typeof Element==='undefined'||!Element.prototype.animate)return;
 const layer=document.createElement('div');
 layer.className='admin-banknote-burst';
 layer.setAttribute('aria-hidden','true');
 host.append(layer);
 const spread=Math.min(layer.clientWidth*.43,265);
 const animations=Array.from({length:18},(_,index)=>{
  const note=document.createElement('span');
  note.className='admin-banknote';
  layer.append(note);
  const direction=index%2===0?-1:1;
  const x=direction*spread*(.32+Math.random()*.68);
  const lift=48+Math.random()*64;
  const drift=72+Math.random()*92;
  const spin=direction*(90+Math.random()*110);
  return note.animate([
   {transform:'translate(-50%, -50%) scale(.35)',opacity:0},
   {transform:`translate(calc(-50% + ${x*.72}px), ${-lift}px) rotate(${spin*.4}deg) scale(1)`,opacity:1,offset:.33},
   {transform:`translate(calc(-50% + ${x}px), ${drift}px) rotate(${spin}deg) scale(.8)`,opacity:0}
  ],{duration:1150+Math.random()*400,delay:index*12,easing:'cubic-bezier(.18,.58,.3,1)',fill:'both'});
 });
 void Promise.allSettled(animations.map(animation=>animation.finished)).then(()=>layer.remove());
}
window.AdminCelebrations=(()=>{
 if(!document.body.classList.contains('dashboard')&&!document.body.hasAttribute?.('data-admin-celebrations'))return;
 const celebrations=[];
 let celebrated=new Set();
 let activeSince=Date.now();
 try{
  celebrated=new Set(JSON.parse(sessionStorage.getItem('vanessa-admin-celebrations')||'[]'));
  const previous=Number(sessionStorage.getItem('vanessa-admin-celebration-check'));
  if(previous>activeSince-60000&&previous<=activeSince)activeSince=previous;
 }catch{}
 function observe(events){
  enqueueCelebrations(events.filter(event=>event.at>=activeSince));
  try{sessionStorage.setItem('vanessa-admin-celebration-check',String(Date.now()));}catch{}
 }
 let showingCelebration=false;
 function enqueueCelebrations(events){
  for(const event of [...events].reverse()){
   const signed=event.kind==='contract-signed';
   const entry=event.kind==='payment'&&event.phase==='entry'&&event.confirmed===true;
   if((!signed&&!entry)||celebrated.has(event.id)||celebrations.some(queued=>queued.id===event.id))continue;
   celebrations.push(event);
  }
  showCelebration();
 }
 function showCelebration(){
  if(showingCelebration||document.hidden||!celebrations.length)return;
  const event=celebrations.shift();
  celebrated.add(event.id);
  if(celebrated.size>250)celebrated.delete(celebrated.values().next().value);
  try{sessionStorage.setItem('vanessa-admin-celebrations',JSON.stringify([...celebrated]));}catch{}
  showingCelebration=true;
  const notice=document.createElement('div');
  notice.className='admin-celebration';
  notice.setAttribute('role','status');
  notice.setAttribute('aria-atomic','true');
  if(typeof notice.showPopover==='function')notice.setAttribute('popover','manual');
  document.body.append(notice);
  if(typeof notice.showPopover==='function'){try{notice.showPopover();}catch{notice.removeAttribute('popover');}}
  const title=document.createElement('strong');
  const signed=event.kind==='contract-signed';
  title.textContent=signed?'Contract signed':'Entry payment confirmed';
  notice.append(title);
  if(signed){
   const name=document.createElement('span');
   name.textContent=event.name;
   notice.append(name);
  }
  adminBanknoteBurst(notice);
  setTimeout(()=>{notice.remove();showingCelebration=false;showCelebration();},3600);
 }
 document.addEventListener('visibilitychange',showCelebration);
 if(document.body.hasAttribute?.('data-admin-celebrations')&&window.top===window){
  let fetching=false;
  async function poll(){
   if(fetching||document.hidden)return;
   fetching=true;
   try{
    const response=await fetch('/api/chat/ui-activity',{cache:'no-store',headers:{'X-Chat-Role':'admin'},signal:AbortSignal.timeout(12000)});
    if(response.ok)observe((await response.json()).events);
   }catch{}finally{fetching=false;}
  }
  void poll();
  setInterval(poll,5000);
  document.addEventListener('visibilitychange',poll);
 }
 return {observe};
})();

window.UIActivityNotifications=(()=>{

 if(!document.body.classList.contains('dashboard')||document.body.hasAttribute?.('data-admin-celebrations'))return {active:false,poll:async()=>{}};
 let items=[],busy=false,started=false,audio=null,sound=true,seen=new Set(),cashBuffer=null,cashLoading=null,cashUntil=0,cashSources=new Set();
 try{seen=new Set(JSON.parse(localStorage.getItem('vanessa-activity-seen')||'[]'));sound=localStorage.getItem('vanessa-notification-sound')!=='off';}catch{}
 const save=()=>{try{localStorage.setItem('vanessa-activity-seen',JSON.stringify([...seen].slice(-1000)));localStorage.setItem('vanessa-notification-sound',sound?'on':'off');}catch{}};
 function unlock(){if(!sound)return;try{const C=window.AudioContext||window.webkitAudioContext;if(C){audio=audio||new C();audio.resume().catch(()=>{});loadCashRegister().catch(()=>{});}}catch{}}
 document.addEventListener('pointerdown',unlock,{passive:true});document.addEventListener('keydown',unlock,{passive:true});
 function loadCashRegister(){
  if(cashBuffer)return Promise.resolve(cashBuffer);if(cashLoading)return cashLoading;
  cashLoading=fetch('/sounds/fee-cash-register.wav',{credentials:'same-origin',cache:'force-cache',...(typeof AbortSignal!=='undefined'&&typeof AbortSignal.timeout==='function'?{signal:AbortSignal.timeout(12000)}:{})}).then(r=>{if(!r.ok)throw Error('Sound unavailable');return r.arrayBuffer();}).then(bytes=>audio.decodeAudioData(bytes)).then(buffer=>{cashBuffer=buffer;return buffer;}).catch(error=>{cashLoading=null;throw error;});return cashLoading;
 }
 async function kaChing(times=1){
  if(!sound||!audio||audio.state!=='running')return;
  try{const buffer=await loadCashRegister();if(!sound||audio.state!=='running')return;const start=Math.max(audio.currentTime+.015,cashUntil),gap=buffer.duration+.12,master=audio.createGain();master.gain.value=.95;master.connect(audio.destination);cashUntil=start+times*gap;let pending=times;
   for(let ring=0;ring<times;ring++){const source=audio.createBufferSource();source.buffer=buffer;source.connect(master);cashSources.add(source);source.onended=()=>{cashSources.delete(source);source.disconnect();if(--pending===0)master.disconnect();};source.start(start+ring*gap);}
  }catch{}
 }
 function chime(){if(!sound||!audio||audio.state!=='running')return;try{const t=audio.currentTime,master=audio.createGain(),limiter=audio.createDynamicsCompressor();master.gain.value=.8;limiter.threshold.value=-12;limiter.knee.value=12;limiter.ratio.value=4;limiter.attack.value=.003;limiter.release.value=.18;master.connect(limiter);limiter.connect(audio.destination);const notes=[1318.51,1567.98,2093,2637.02,2093,3135.96,4186];notes.forEach((hz,i)=>{const at=t+i*.085;for(const [partial,volume] of [[1,.24],[2.76,.035]]){const gain=audio.createGain(),tone=audio.createOscillator();tone.type='sine';tone.frequency.value=hz*partial;gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(volume,at+.008);gain.gain.exponentialRampToValueAtTime(.0001,at+1.15);tone.connect(gain);gain.connect(master);tone.start(at);tone.stop(at+1.2);tone.onended=()=>{tone.disconnect();gain.disconnect();};}});setTimeout(()=>{master.disconnect();limiter.disconnect();},2000);}catch{}}


 function badge(){const b=document.getElementById('notifications-toggle');if(!b)return;let ticker=b.querySelector('.notification-ticker');if(!ticker){ticker=document.createElement('span');ticker.className='notification-ticker';ticker.setAttribute('aria-hidden','true');b.append(ticker);}const count=items.filter(e=>!seen.has(e.id)).length+(window.WhatsNew?.unread?.()||0);ticker.hidden=!count;ticker.textContent=count>99?'99+':String(count);b.setAttribute('aria-label','Notifications · '+count+' new');b.title=count?count+' new notifications':'Notifications';}
 async function poll(){if(busy||typeof dashboardAllowed==='undefined'||!dashboardAllowed)return;busy=true;try{const d=await chatAPI('ui-activity'),fresh=started?d.events.filter(e=>!items.some(old=>old.id===e.id)&&!seen.has(e.id)):[];items=d.events;started=true;window.AdminCelebrations?.observe(d.events);if(fresh.length){const paid=fresh.filter(e=>e.kind==='payment'&&e.confirmed&&['entry','contract'].includes(e.phase));if(paid.length){kaChing(Math.min(8,paid.reduce((n,e)=>n+(e.phase==='contract'?2:1),0)));}else chime();for(const e of fresh)await window.AdminChatNotifications?.crucialAlert?.(e);}const dialog=document.getElementById('notification-centre');if(dialog?.open){render();ack();}badge();}catch{}finally{busy=false;}}
 function ack(){for(const e of items)seen.add(e.id);save();badge();}
 function render(){const host=document.getElementById('notification-items');if(!host)return;if(typeof renderCodeRequests==='function')renderCodeRequests();
 const labels={'application-start':'Application started',message:'Message',gift:'Gift received',payment:'Payment','contract-signed':'Contract signed',application:'Application',verification:'Verification request',code:'Access request',account:'Account request'},icons={'application-start':'applications',message:'chat',gift:'gift',payment:'payment','contract-signed':'applications',application:'applications',verification:'verification',code:'key',account:'user'};
 const rows=[],groups=new Map();for(const e of items){const group=e.kind==='message'&&e.studentId?'message:'+e.studentId:null;if(group&&groups.has(group)){groups.get(group).extra++;continue;}const row={...e,extra:0};rows.push(row);if(group)groups.set(group,row);}
 host.innerHTML=rows.length?rows.slice(0,40).map(e=>'<button type="button" class="crucial-notification" data-notice-id="'+eduEscape(e.id)+'"><span class="notification-symbol" aria-hidden="true">'+(window.AdminIcons?.svg(icons[e.kind]||'bell')||'')+'</span><span class="notification-copy"><span class="notification-heading"><span class="notification-topic">'+eduEscape(labels[e.kind]||'New activity')+'</span><time>'+eduEscape(UIChat.time(e.at))+'</time></span><strong>'+eduEscape(e.name||'A Sub')+'</strong><span class="notification-preview">'+eduEscape(e.text||'Something new to look at')+'</span>'+(e.extra?'<span class="notification-extra">'+e.extra+' more '+(e.extra===1?'message':'messages')+' in this chat</span>':'')+'</span></button>').join(''):'<p data-activity-empty>You’re all caught up.</p>';
 window.WhatsNew?.attach?.(host);
 host.querySelectorAll('[data-notice-id]').forEach(b=>b.onclick=async()=>{const e=items.find(x=>x.id===b.dataset.noticeId);if(e.kind==='account'){document.getElementById('notification-centre').close();await window.AccountManagement.open(e.studentId);return;}if(e.kind==='code'){await loadCodeRequests();document.getElementById('code-request-inbox')?.scrollIntoView({block:'nearest'});return;}document.getElementById('notification-centre').close();if(e.studentId&&e.section==='chats'){await loadStudents();const person=chatStudents.find(s=>s.id===e.studentId);if(person){selectedStudent=person;await PreviewChat.select(person.id);await navigateDashboard('chats');mobileChatOpen=true;renderDashboard();return;}}await navigateDashboard(e.section||'applications');if(e.kind==='application-start')document.getElementById('application-funnel')?.scrollIntoView({block:'start',behavior:'smooth'});});}
 function mountSound(){if(typeof tab==='undefined'||tab!=='settings'||document.getElementById('notification-sound-setting'))return;const card=document.createElement('section');card.id='notification-sound-setting';card.className='dash-card';card.innerHTML='<h2>Notification sound</h2><label><input type="checkbox" '+(sound?'checked':'')+'> Play notification sounds</label><button type="button" class="quiet" data-preview-twinkle>'+AdminIcons.svg('bell')+'Preview fairy twinkle</button><button type="button" class="quiet" data-preview-entry>'+AdminIcons.svg('payment')+'Preview Entry cash register</button><button type="button" class="quiet" data-preview-contract>'+AdminIcons.svg('payment')+'Preview Contract cash register</button><p class="muted">Fairy twinkle for activity; one cash-register sound for confirmed Entry and two for confirmed Contract. Sound starts after you interact with this dashboard; keep it open for live alerts.</p>';card.querySelector('input').onchange=e=>{sound=e.target.checked;save();if(!sound){for(const source of cashSources){try{source.stop();}catch{}}cashUntil=0;}if(sound){unlock();chime();}};card.querySelector('[data-preview-twinkle]').onclick=async()=>{unlock();if(audio)await audio.resume().catch(()=>{});chime();};for(const [selector,count]of [['[data-preview-entry]',1],['[data-preview-contract]',2]])card.querySelector(selector).onclick=async()=>{unlock();if(audio)await audio.resume().catch(()=>{});kaChing(count);};document.getElementById('dashboard-main').append(card);}
 function layout(){const nav=document.getElementById('dashboard-nav'),overview=nav?.querySelector('[data-tab="overview"]'),chats=nav?.querySelector('[data-tab="chats"]');if(overview&&nav.firstElementChild!==overview)nav.prepend(overview);if(chats&&overview.nextElementSibling!==chats)overview.after(chats);
  const live=document.getElementById('visitor-summary'),attention=document.getElementById('overview-next'),body=document.getElementById('overview-body');if(body&&live&&body.firstElementChild!==live)body.prepend(live);if(live&&attention&&live.nextElementSibling!==attention)live.after(attention);
  if(body){body.classList.add('refined-overview');}
  const host=document.querySelector('.conversation-labels');if(host&&typeof selectedStudent!=='undefined'&&selectedStudent){const name=document.querySelector('.chat-header-person>strong');if(name&&host.parentElement!==name)name.append(host);const id=['basic','advanced'].includes(selectedStudent.entry_tier)?selectedStudent.entry_tier:'';if(host.dataset.entryTier!==id||id&&!host.querySelector('.entry-tier')||!id&&host.childNodes.length){host.dataset.entryTier=id;host.innerHTML=UIChat.tier(id);}}
  mountSound();
 }
 document.addEventListener('dashboard-ready',()=>{const bell=document.getElementById('notifications-toggle');bell.addEventListener('click',async e=>{e.preventDefault();e.stopImmediatePropagation();await loadCodeRequests().catch(()=>{});await poll();render();const d=document.getElementById('notification-centre');if(!d.open)d.showModal();ack();},true);let pending=false;new MutationObserver(()=>{if(!pending){pending=true;requestAnimationFrame(()=>{pending=false;layout();});}}).observe(document.getElementById('dashboard-main'),{childList:true,subtree:true});layout();poll();});
 setInterval(poll,5000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
 async function open(){await loadCodeRequests().catch(()=>{});await poll();render();const d=document.getElementById('notification-centre');if(!d.open)d.showModal();ack();}
 return {poll,open,refreshBadge:badge,active:true};
})();


// Compact attachment tools while composing; existing controls and handlers are moved, never cloned.
function composerOverflowCompact(form,panel){const active=document.activeElement;return !!active?.matches?.('textarea,input:not([type=file]):not([type=checkbox]):not([type=radio]),[contenteditable="true"]')&&(form.contains(active)||panel.contains(active));}
(()=>{
 if(typeof MutationObserver==='undefined')return;
 const states=new Map(),selector='#client-composer,#admin-form,#floating-form';
 function update(s){const compact=s.open||composerOverflowCompact(s.form,s.panel);s.form.parentElement.classList.toggle('composer-tools-compact',compact);s.toggle.hidden=!compact;s.toggle.setAttribute('aria-expanded',String(s.open));s.icons.classList.toggle('is-open',s.open);}
 function scan(){
  for(const [form,s]of states)if(!form.isConnected){states.delete(form);}
  document.querySelectorAll(selector).forEach(form=>{
   const panel=form.parentElement.querySelector('.chat-attachment-controls'),send=form.querySelector('button[type="submit"],button:not([type])');if(!panel||!send)return;
   let s=states.get(form);if(!s){const icons=document.createElement('div'),toggle=document.createElement('button');icons.className='composer-overflow-icons';icons.id='composer-tools-'+form.id;icons.setAttribute('role','group');icons.setAttribute('aria-label','Message attachments and tools');toggle.type='button';toggle.className='quiet composer-overflow-toggle';toggle.hidden=true;toggle.setAttribute('aria-label','Message tools');toggle.setAttribute('aria-controls',icons.id);toggle.setAttribute('aria-expanded','false');toggle.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>';panel.prepend(icons);form.insertBefore(toggle,send);s={form,panel,icons,toggle,open:false};states.set(form,s);toggle.onclick=()=>{s.open=!s.open;update(s);};toggle.addEventListener('pointerdown',e=>e.preventDefault());}
   for(const child of [...panel.children])if(child!==s.icons&&child.matches('.composer-request-tools,[data-pick],[data-record],[data-emoji-toggle]'))s.icons.append(child);
   update(s);
  });
 }
 let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;scan();});}
 document.addEventListener('focusin',schedule);document.addEventListener('focusout',schedule);
 document.addEventListener('pointerdown',e=>{for(const s of states.values())if(s.open&&!s.icons.contains(e.target)&&!s.toggle.contains(e.target)){s.open=false;update(s);}},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')for(const s of states.values())if(s.open){s.open=false;update(s);s.toggle.focus();e.preventDefault();e.stopImmediatePropagation();}},true);
 new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});scan();
})();

// Dismiss chat action menus on touch/pointer outside, keyboard focus outside and Escape.
(()=>{
 function dismiss(target,escape=false){
  document.querySelectorAll('.conversation-actions-menu[open]').forEach(menu=>{
   if(!escape&&menu.contains(target))return;
   menu.open=false;if(escape)menu.querySelector('summary')?.focus();
  });
  const options=document.getElementById('account-options'),toggle=document.getElementById('account-toggle'),menu=toggle?.closest('.account-dropdown');
  if(options&&!options.hidden&&(escape||!menu?.contains(target))){options.hidden=true;toggle?.setAttribute('aria-expanded','false');if(escape)toggle?.focus();}
 }
 document.addEventListener('pointerdown',e=>dismiss(e.target),true);
 document.addEventListener('click',e=>dismiss(e.target),true);
 document.addEventListener('focusin',e=>dismiss(e.target));
 document.addEventListener('keydown',e=>{if(e.key==='Escape')dismiss(e.target,true);});
})();
