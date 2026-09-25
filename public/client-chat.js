'use strict';
(async()=>{
const student=await PreviewAccess.check().catch(()=>null);if(!student){location.replace('access.html');return;}
window.ChatStudent=student;
window.addEventListener('pageshow',async event=>{if(event.persisted&&!await PreviewAccess.check())location.replace('access.html');});
const clientHost=document.getElementById('client-chat');
clientHost.innerHTML='<div class="chat-shell pink"><aside class="chat-sidebar"><div class="avatar">V</div><h2>Goddess Vanessa</h2><p class="presence-status">Checking availability…</p><div class="soft-note">Your learning support</div><label>Chat appearance<select id="chat-tone"><option value="pink">Rose</option><option value="dark">Midnight</option><option value="light">Pearl</option></select></label><a class="quiet" href="application.html">Your learning space</a></aside><section class="chat-main"><header class="chat-header"><div class="chat-portrait">V</div><div><strong>Goddess Vanessa</strong><small class="presence-status">Checking availability…</small></div><div class="chat-header-actions"><button id="mobile-theme" class="quiet">Theme</button><button id="work-mode" class="quiet">Work mode</button><a class="quiet" href="access.html">Account</a></div></header><div class="chat-warning">Private conversation · Messages are saved to your account.</div><div class="chat-session-note">Your space <span>'+eduEscape(student.name)+'</span></div><div id="messages" class="messages" role="log" aria-live="polite"></div><form id="client-composer" class="chat-composer"><label for="client-message" class="sr-only">Message</label><input id="client-message" maxlength="1000" required placeholder="Write a message…" autocomplete="off"><button class="p-button" aria-label="Send message"><svg class="p-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 12h16m-6-6 6 6-6 6"/></svg></button></form></section></div><dialog id="work-cover"><h2>Work mode</h2><p>Your conversation is hidden.</p><button class="p-button" id="resume-chat">Return to conversation</button></dialog>';
window.refreshClientChat=function refreshClientChat(){const log=document.getElementById('messages');renderChatLog(log,'client');PreviewChat.read();document.querySelectorAll('.presence-status').forEach(x=>x.textContent=PreviewChat.online()?'Online':'Offline');};
if(CHAT_EDITOR)document.querySelector('.chat-warning').textContent='Visual-editor preview · No messages are sent.';
await PreviewChat.select(student.id);PreviewChat.subscribe(refreshClientChat);refreshClientChat();bindPreviewComposer(document.getElementById('client-composer'),'client',refreshClientChat);
document.getElementById('chat-tone').onchange=e=>document.querySelector('.chat-shell').className='chat-shell '+e.target.value;
document.getElementById('mobile-theme').onclick=()=>{const select=document.getElementById('chat-tone');select.selectedIndex=(select.selectedIndex+1)%3;select.dispatchEvent(new Event('change'));};
document.getElementById('work-mode').onclick=()=>document.getElementById('work-cover').showModal();document.getElementById('resume-chat').onclick=()=>document.getElementById('work-cover').close();

document.dispatchEvent(new Event('student-chat-ready'));
window.ChatLoading?.start();

})();
