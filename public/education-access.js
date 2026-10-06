'use strict';
const accessHost=document.getElementById('education-access');
accessHost.innerHTML='<span class="overline">RETURN TO YOUR SPACE</span><h1>Sub Access</h1><p class="lead">Enter your access code to open your private space.</p><form id="access-form"><label class="signature-label" for="access-code">Access code<input id="access-code" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" maxlength="60" placeholder="Enter your access code" aria-describedby="access-help access-status" required></label><p id="access-help" class="muted">Use the private access code supplied by Goddess. Your code works until your contract ends or a replacement is issued. Private tabs work while this tab remains open; closing all private tabs ends the session. Keep cookies enabled for this site.</p><p id="access-status" role="status"></p><button class="p-button" type="submit">Open your space</button></form><p class="muted">Access codes are issued by Goddess Vanessa after she reviews your application. If you need a new code, contact her directly.</p>';
document.getElementById('access-form').onsubmit=async e=>{e.preventDefault();const input=document.getElementById('access-code'),status=document.getElementById('access-status'),button=e.target.querySelector('button');button.disabled=true;status.textContent='Checking your code…';try{await PreviewAccess.enter(input.value);location.assign('feed.html');}catch(error){status.textContent=error.message;input.setAttribute('aria-invalid','true');}finally{button.disabled=false;}};


if(new URLSearchParams(location.search).get('notice')==='logout')document.getElementById('access-status').textContent='You have logged out.';
eduAPI('published').then(p=>eduTheme(p.config)).catch(()=>{});

const resumeSubHome=()=>PreviewAccess.check().then(async student=>{if(!student||student.id==='editor-preview')return;const r=await fetch('/api/education/identity',{cache:'no-store',credentials:'same-origin',headers:{'X-Education-Context':'application'}});if(r.ok&&(await r.json()).applicationInProgress===false)location.replace('/feed.html');}).catch(()=>{});
resumeSubHome();window.addEventListener('pageshow',event=>{if(event.persisted)resumeSubHome();});

const accessNotice=new URLSearchParams(location.search).get('notice');
if(accessNotice==='application-saved')document.getElementById('access-status').textContent='Your application has been sent to Goddess Vanessa for review. Chat opens only after she issues your private access code.';
