'use strict';
// Only resume a server-validated, unexpired Sub session. Authentication errors stay on the landing page.
(()=>{if(window.parent&&window.parent!==window)return;async function resume(){try{const r=await fetch('/api/chat/session',{cache:'no-store',credentials:'same-origin',headers:{'X-Chat-Role':'student'}});if(!r.ok)return;const d=await r.json();if(d.student?.id)location.replace('/feed.html');}catch{}}resume();window.addEventListener('pageshow',e=>{if(e.persisted)resume();});})();
