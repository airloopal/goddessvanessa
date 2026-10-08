'use strict';
window.ApplicationTracking=(()=>{
 let stage=null,flight=false,queued=false,timer=null,lastSent=0;
 async function send(){if(!stage||typeof educationPreview!=='undefined'&&educationPreview||typeof identity!=='undefined'&&identity.owner)return;if(flight){queued=true;return;}flight=true;lastSent=Date.now();const next=stage;try{await fetch('/api/education/application-funnel',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json','X-Education-Context':'application'},body:JSON.stringify({stage:next,visible:!document.hidden,...(typeof learnerName!=='undefined'&&typeof learnerEmail!=='undefined'&&learnerName.trim().length>=2&&learnerName.length<=100&&/^\S+@[^\s@]+\.[^\s@]+$/.test(learnerEmail.trim())?{contact:{name:learnerName.trim(),email:learnerEmail.trim()}}:{})})});}catch{}finally{flight=false;if(queued){queued=false;void send();}}}
 function record(next){if(next==='lessons'){stage=null;clearTimeout(timer);return;}if(!['paths','entry','intro','questions','review','payment'].includes(next))return;stage=next;clearTimeout(timer);timer=setTimeout(()=>void send(),250);}
 setInterval(()=>{if(stage&&!document.hidden)void send();},30000);document.addEventListener('visibilitychange',()=>{if(stage)void send();});addEventListener('pagehide',()=>{if(stage)void send();});
 return {record};
})();
