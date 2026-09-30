'use strict';
function setupStudentAccount(){
 const link=document.querySelector('.chat-header a[href="access.html"]');if(!link)return;
 const menu=document.createElement('div');menu.className='account-dropdown';menu.innerHTML='<button id="account-toggle" class="quiet" type="button" aria-expanded="false" aria-controls="account-options">Account</button><div id="account-options" class="account-options" hidden><span class="account-menu-heading">Student account</span><button type="button" data-account-action="manage">Manage</button><button type="button" data-account-action="clear">Clear chat from this view</button><button type="button" data-account-action="logout">Log Out</button></div>';link.replaceWith(menu);
 const modal=document.createElement('dialog');modal.id='student-account-dialog';modal.setAttribute('aria-labelledby','student-account-title');document.body.append(modal);
 const toggle=document.getElementById('account-toggle'),options=document.getElementById('account-options');toggle.onclick=()=>{options.hidden=!options.hidden;toggle.setAttribute('aria-expanded',!options.hidden);};document.addEventListener('click',e=>{if(!menu.contains(e.target)){options.hidden=true;toggle.setAttribute('aria-expanded','false');}});document.addEventListener('keydown',e=>{if(e.key==='Escape'){options.hidden=true;toggle.setAttribute('aria-expanded','false');}});
 function show(title,body){options.hidden=true;toggle.setAttribute('aria-expanded','false');modal.innerHTML='<button type="button" class="quiet" id="close-account-dialog" aria-label="Close account settings">×</button><span class="overline">STUDENT ACCOUNT</span><h2 id="student-account-title">'+title+'</h2>'+body;document.getElementById('close-account-dialog').onclick=()=>modal.close();if(!modal.open)modal.showModal();}
 function action(name){if(name==='manage'){show('Manage your account','<div class="manage-options"><button class="quiet" data-manage="code">Request new access code</button><button class="quiet" data-manage="deactivate">Deactivate Account</button><button class="quiet danger-action" data-manage="delete">Delete Account</button></div><p class="muted">These controls apply to your chat account. Your signed application and learning records are retained separately.</p><a class="quiet" href="application.html">Review your student details</a>');modal.querySelectorAll('[data-manage]').forEach(b=>b.onclick=()=>action(b.dataset.manage));return;}
 if(name==='code'){showCodeRequest();return;}
 if(name==='clear'){show('Clear this chat view?','<p>This hides the messages currently shown in this tab. It does not delete messages from other devices or erase saved educational records.</p><button class="p-button" id="clear-preview-view">Clear from this view</button>');document.getElementById('clear-preview-view').onclick=()=>{window.clientClearBefore=Date.now();refreshClientChat();modal.close();};return;}
 if(name==='logout'){show('Log out?','<p>End this chat session and return to the access-code page.</p><button class="p-button" id="confirm-chat-logout" type="button">Log Out</button>');document.getElementById('confirm-chat-logout').onclick=()=>PreviewAccess.logout().catch(e=>show('Could not log out','<p>'+eduEscape(e.message)+'</p>'));return;}
 const deletion=name==='delete';show(deletion?'Delete chat account?':'Deactivate chat account?','<p>'+(deletion?'This permanently deletes your chat account and its message history. Your signed application and learning records are retained separately.':'This ends your session and suspends chat access. Goddess can reactivate it.')+'</p><button class="p-button" id="confirm-account-change">'+(deletion?'Delete chat account':'Deactivate chat account')+'</button><p id="account-error" role="status"></p>');document.getElementById('confirm-account-change').onclick=async e=>{e.target.disabled=true;try{await chatAPI('account',deletion?'DELETE':'PATCH',deletion?{confirm:true}:{action:'deactivate'});location.replace('access.html');}catch(error){document.getElementById('account-error').textContent=error.message;e.target.disabled=false;}};
 }

 const requestNotice=document.createElement('button');requestNotice.type='button';requestNotice.className='quiet';requestNotice.hidden=true;requestNotice.style.cssText='display:block;margin:12px auto;max-width:calc(100% - 32px)';requestNotice.onclick=()=>showCodeRequest();menu.closest('.chat-header').after(requestNotice);
 function notice(r){if(r?.status==='used')r=null;requestNotice.hidden=!r;requestNotice.style.display=r?'block':'none';requestNotice.textContent=r?.status==='pending'?'Access-code request awaiting review':r?.status==='approved'?'Replacement code approved · Collect code':r?.status==='issued'?'Your replacement access code · View':r?.status==='declined'?'Access-code request declined · View details':'';}
 async function refreshCodeRequest(){try{const d=await chatAPI('request-code');notice(d.request);}catch{}}
 async function showCodeRequest(){
  show('Request new access code','<p role="status">Checking your request…</p>');
  try{const d=await chatAPI('request-code'),r=d.request;notice(r);const expired=r?.reviewedAt&&Date.now()-r.reviewedAt>=86400000;
   let copy='Request a replacement for your next sign-in. Vanessa will approve or decline it from her dashboard. Your current chat stays open.',button='Send request',collect=false;
   if(r?.status==='pending'){copy='Your request has been sent and is awaiting review. Your current chat stays open.';button='Check status';}
   else if(['approved','issued'].includes(r?.status)&&!expired){copy='Your replacement has been approved. Collect and copy your single-use code before logging out. Using it will replace your current session.';button='View my code';collect=true;}
   else if(r?.status==='declined'){copy='Vanessa declined your request. Your current chat stays open. You can discuss this in your conversation.';button='Request again';}
   else if(expired)copy='Your previous approval has expired. You can request another code.';
   show('Request new access code','<p>'+copy+'</p><p id="code-request-feedback" role="status"></p><button class="p-button" id="submit-code-request">'+button+'</button>');
   document.getElementById('submit-code-request').onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{
    if(r?.status==='pending'){await showCodeRequest();return;}
    if(!collect){await chatAPI('request-code','POST',{});await showCodeRequest();return;}
    const result=await chatAPI('request-code','POST',{action:'collect'});
    show('Your replacement code','<label class="signature-label">Single-use access code<input id="replacement-access-code" readonly spellcheck="false"></label><p>Expires '+eduEscape(new Date(result.expiresAt).toLocaleString())+'. Keep it private. Your chat stays open until you use this code or log out.</p><button class="p-button" id="copy-replacement-code">Copy code</button><p role="status" id="code-copy-status"></p>');
    document.getElementById('replacement-access-code').value=result.code;
    document.getElementById('copy-replacement-code').onclick=async()=>{try{await navigator.clipboard.writeText(result.code);document.getElementById('code-copy-status').textContent='Copied. Keep your code somewhere private.';}catch{document.getElementById('replacement-access-code').select();document.getElementById('code-copy-status').textContent='Select and copy the code above.';}};
    await refreshCodeRequest();
   }catch(error){document.getElementById('code-request-feedback').textContent=error.message;b.disabled=false;}};
  }catch(error){show('Request new access code','<p role="status">'+eduEscape(error.message)+'</p>');}
 }
 refreshCodeRequest();setInterval(()=>{if(!document.hidden)refreshCodeRequest();},15000);
 menu.querySelectorAll('[data-account-action]').forEach(b=>b.onclick=()=>action(b.dataset.accountAction));
}
if(window.ChatStudent)setupStudentAccount();else document.addEventListener('student-chat-ready',setupStudentAccount,{once:true});
