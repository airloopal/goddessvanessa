const homepageNotice=document.getElementById('homepage-notice');
const noticeEditing=new URLSearchParams(location.search).has('visual')&&parent!==window;
function dismissHomepageNotice(){homepageNotice.close();if(!noticeEditing){try{sessionStorage.setItem('house-homepage-notice','seen');}catch{}}}
document.getElementById('homepage-notice-close').onclick=dismissHomepageNotice;
document.getElementById('homepage-notice-continue').onclick=dismissHomepageNotice;
document.getElementById('homepage-notice-open').onclick=()=>{if(!homepageNotice.open)homepageNotice.showModal();};
homepageNotice.addEventListener('cancel',e=>{e.preventDefault();dismissHomepageNotice();});
if(!noticeEditing){let seen=false;try{seen=sessionStorage.getItem('house-homepage-notice')==='seen';}catch{}if(!seen)homepageNotice.showModal();}

const expectations=document.getElementById('expectations');document.getElementById('expectations-close').onclick=()=>expectations.close();expectations.addEventListener('click',e=>{if(e.target===expectations){const r=expectations.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)expectations.close();}});if(new URLSearchParams(location.search).has('visual')&&parent!==window){document.querySelectorAll('a[href="application.html"]').forEach(a=>{a.href='application.html?preview=1&studio=1&visual=1';a.addEventListener('click',e=>{e.preventDefault();parent.postMessage({type:'visual:navigate',page:'application:0'},location.origin);});});window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent)return;if(e.data?.type==='landing:show'){if(!e.data.notice&&homepageNotice.open)homepageNotice.close();if(!e.data.open&&expectations.open)expectations.close();if(e.data.open&&!expectations.open)expectations.showModal();if(e.data.notice&&!homepageNotice.open)homepageNotice.showModal();}});}

const scenes=[...document.querySelectorAll('.video-scene')],sceneButtons=[...document.querySelectorAll('.scene-button')],motionButton=document.getElementById('hero-motion');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const portraitViewport=matchMedia('(max-aspect-ratio: 4/5)');
function selectVideoFiles(){
 scenes.forEach(scene=>{
  const video=scene.querySelector('video');
  const file=portraitViewport.matches?video.dataset.mobile:video.dataset.desktop;
  // Preserve an independently chosen video from the visual editor.
  const current=video.getAttribute('src');
  if(!file||(current&&current!==video.dataset.mobile&&current!==video.dataset.desktop))return;
  video.poster=file.replace(/\.mp4$/,'.jpg');
  if(current!==file){video.src=file;video.load();}
 });
}
selectVideoFiles();
portraitViewport.addEventListener('change',()=>{selectVideoFiles();syncPlayback();});

let activeScene=0,manualPause=reduced.matches;
const titleGlow='#f071b4';
function syncPlayback(){
 scenes.forEach((scene,i)=>{const v=scene.querySelector('video');v.muted=true;if(i===activeScene&&!manualPause&&!document.hidden)v.play().catch(()=>{});else v.pause();});
 const v=scenes[activeScene].querySelector('video');motionButton.textContent=v.paused?'Play video':'Pause video';motionButton.setAttribute('aria-label',v.paused?'Play background video':'Pause background video');
}
function setScene(index){activeScene=index;document.body.style.setProperty('--scene-glow',titleGlow);sceneButtons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));syncPlayback();}
sceneButtons.forEach((b,i)=>b.addEventListener('click',()=>scenes[i].scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'start'})));
const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting&&entry.intersectionRatio>=.55)setScene(Number(entry.target.dataset.scene));},{threshold:[.55,.75]});
scenes.forEach(scene=>{observer.observe(scene);const v=scene.querySelector('video');for(const event of ['play','pause'])v.addEventListener(event,()=>{if(scene===scenes[activeScene]){motionButton.textContent=v.paused?'Play video':'Pause video';motionButton.setAttribute('aria-label',v.paused?'Play background video':'Pause background video');}});});
motionButton.onclick=()=>{manualPause=!scenes[activeScene].querySelector('video').paused;syncPlayback();};
reduced.addEventListener('change',e=>{manualPause=e.matches;syncPlayback();});document.addEventListener('visibilitychange',syncPlayback);setScene(0);
