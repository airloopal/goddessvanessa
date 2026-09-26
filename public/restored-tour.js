'use strict';
function startDashboardTour(){
 const steps=[["#dashboard-nav", "Your dashboard", "Use this menu to move between conversations, saved applications and content."], ["#notifications-toggle", "Check recent updates", "Notifications lists recent saved applications. Select one to open the Applications section."], ["[data-tab=\"chats\"]", "Find your conversations", "The restored inbox has search, a conversation list and a reply box. This chat is a same-browser preview, separate from saved application records."], ["#floating-chat-toggle", "Keep chat close by", "Open this bubble for the compact inbox. Choose a guest to reply; use the back arrow to return to the list."], [".presence-preview-control", "Set your availability", "Open Account to change your Online or Offline availability. Students see this status in chat."], ["[data-tab=\"applications\"]", "Review applications", "Find saved names, references, answers and learning progress here. These are real saved educational enrolments."], ["#profile-previews", "Read someone\u2019s answers", "Search for a name or reference, then open View answers. Chat preview guests are not linked to these records."], ["[data-tab=\"overview\"]", "See your totals", "Overview shows your recent saved applications and published paths, lessons and questions."], ["[data-tab=\"content\"]", "Edit your content", "The content editor changes questions, options and lessons. Save a draft first, then publish when you are ready."], ["a[href=\"studio.html\"]", "Edit the page design", "Open Account → Visual editor. Select any supported page element to change text, colours, spacing, images and links. You can also add and remove elements."], ["[data-tab=\"verifications\"]", "Respond to verification requests", "Students can request a video introduction before continuing with entry. Open Verification, add a direct video link and a short message, then send the reply. The student can view it in their signed-in verification window."]];
 const trigger=document.createElement('button');trigger.type='button';trigger.className='quiet';trigger.id='dashboard-tour-start';trigger.dataset.navIcon='book';trigger.textContent='Dashboard tour';trigger.title='A plain-English guide to your dashboard';(document.getElementById('goddess-account-actions')||document.querySelector('.dashboard-links')).prepend(trigger);
 const shell=document.createElement('dialog');shell.id='dashboard-tour-shell';shell.setAttribute('aria-labelledby','tour-title');shell.setAttribute('aria-describedby','tour-description');document.body.append(shell);
 const dialog=document.createElement('section');dialog.id='dashboard-tour';dialog.setAttribute('aria-labelledby','tour-title');dialog.setAttribute('aria-describedby','tour-description');shell.append(dialog);
 const ring=document.createElement('div');ring.id='tour-highlight';ring.setAttribute('aria-hidden','true');ring.hidden=true;shell.prepend(ring);
 let index=0,target=null,previousFocus=null;const key='vanessa-dashboard-tour-seen-v1';
 let originalTab=null,replyDraft='',originalScroll=0;
 const stepTabs={2:'chats',5:'applications',6:'applications',7:'overview',8:'content'};
 function place(){
 if(!shell.open)return;const r=target?.getBoundingClientRect();if(!r)return;
 const left=Math.max(4,r.left-6),top=Math.max(4,r.top-6),right=Math.min(innerWidth-4,r.right+6),bottom=Math.min(innerHeight-4,r.bottom+6);
 ring.hidden=false;Object.assign(ring.style,{left:left+'px',top:top+'px',width:Math.max(0,right-left)+'px',height:Math.max(0,bottom-top)+'px'});
 const gap=18,pad=12;dialog.style.maxHeight=(innerHeight-24)+'px';const w=dialog.offsetWidth,h=dialog.offsetHeight,cx=(left+right)/2,cy=(top+bottom)/2;
 let side,x,y;
 if(innerWidth>=800&&innerWidth-right>=w+gap+pad){side='right';x=right+gap;y=cy-h/2;}
 else if(innerWidth>=800&&left>=w+gap+pad){side='left';x=left-gap-w;y=cy-h/2;}
 else if(innerHeight-bottom>=h+gap+pad){side='bottom';x=cx-w/2;y=bottom+gap;}
 else if(top>=h+gap+pad){side='top';x=cx-w/2;y=top-gap-h;}
 else {side=innerHeight-bottom>=top?'bottom':'top';const room=(side==='bottom'?innerHeight-bottom:top)-gap-pad;dialog.style.maxHeight=Math.max(120,room)+'px';x=cx-w/2;y=side==='bottom'?bottom+gap:top-gap-dialog.offsetHeight;}
 x=Math.max(pad,Math.min(x,innerWidth-w-pad));y=Math.max(pad,Math.min(y,innerHeight-dialog.offsetHeight-pad));dialog.style.left=x+'px';dialog.style.top=y+'px';dialog.dataset.side=side;
 dialog.style.setProperty('--tour-arrow',Math.max(22,Math.min(side==='left'||side==='right'?cy-y:cx-x,(side==='left'||side==='right'?dialog.offsetHeight:w)-22))+'px');
 }
 function show(){const nextTab=stepTabs[index];if(nextTab&&tab!==nextTab){tab=nextTab;renderDashboard();}const s=steps[index];target=document.querySelector(s[0])||document.querySelector(s[3]||'#dashboard-nav');if(target?.closest('#goddess-account-panel')?.hidden)target=document.getElementById('goddess-account-toggle');target?.scrollIntoView({block:'nearest',behavior:'instant'});dialog.innerHTML=`<div class="tour-top"><span>Dashboard guide · ${index+1} of ${steps.length}</span><button type="button" id="tour-close" aria-label="Close tour">×</button></div><progress max="${steps.length}" value="${index+1}" aria-label="Tour progress"></progress><h2 id="tour-title" tabindex="-1">${s[1]}</h2><p id="tour-description">${s[2]}</p><div class="tour-actions"><button type="button" class="quiet" id="tour-back" ${index===0?'disabled':''}>Back</button><button type="button" class="p-button" id="tour-next">${index===steps.length-1?'Finish':'Next'}</button></div><small>You can close this guide and replay it anytime.</small>`;dialog.querySelector('#tour-close').onclick=finish;dialog.querySelector('#tour-back').onclick=()=>{index--;show();};dialog.querySelector('#tour-next').onclick=()=>{if(index===steps.length-1)finish();else{index++;show();}};place();dialog.querySelector('#tour-title').focus({preventScroll:true});requestAnimationFrame(place);}
 function finish(){shell.close();}
 function start(){previousFocus=document.activeElement;originalTab=tab;originalScroll=scrollY;replyDraft=document.getElementById('admin-reply')?.value||'';index=0;document.getElementById('tour-invitation')?.remove();shell.showModal();show();}
 shell.addEventListener('close',()=>{ring.hidden=true;if(originalTab&&tab!==originalTab){tab=originalTab;renderDashboard();}const reply=document.getElementById('admin-reply');if(reply)reply.value=replyDraft;window.scrollTo(0,originalScroll);try{localStorage.setItem(key,'1');}catch{}(previousFocus?.isConnected?previousFocus:trigger).focus({preventScroll:true});});
 trigger.onclick=start;window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
 let seen=false;try{seen=localStorage.getItem(key)==='1';}catch{}
 if(!seen){
 const invitation=document.createElement('dialog');invitation.id='tour-invitation';invitation.setAttribute('aria-labelledby','tour-invitation-title');invitation.setAttribute('aria-describedby','tour-invitation-description');
 invitation.innerHTML='<button type="button" id="tour-invitation-close" aria-label="Close tutorial invitation">×</button><span class="tour-invitation-eyebrow">YOUR DASHBOARD GUIDE</span><h2 id="tour-invitation-title">New here, Vanessa?</h2><p id="tour-invitation-description">Take a quick tour of the dashboard and the things to check first.</p><div class="tour-invitation-actions"><button type="button" class="p-button" id="tour-welcome-start" autofocus>Show me around</button><button type="button" class="quiet" id="tour-later">Not now</button></div><small>You can replay it anytime from Dashboard tour.</small>';
 document.body.append(invitation);
 const dismissInvitation=()=>{try{localStorage.setItem(key,'1');}catch{}invitation.remove();if(!shell.open)trigger.focus({preventScroll:true});};
 invitation.addEventListener('close',dismissInvitation);
 invitation.querySelector('#tour-welcome-start').onclick=()=>{invitation.close();start();};
 invitation.querySelector('#tour-later').onclick=()=>invitation.close();
 invitation.querySelector('#tour-invitation-close').onclick=()=>invitation.close();
 invitation.showModal();
 }
}
if(dashboardAllowed)startDashboardTour();else document.addEventListener('dashboard-ready',startDashboardTour,{once:true});
