'use strict';
(()=>{
 const content=[
  {
    "question": "1. What is House of Vanessa?",
    "answer": "An exclusive private platform for dominance, discipline and devotion."
  },
  {
    "question": "2. Why was it created?",
    "answer": "To protect Goddess Vanessa’s privacy and yours, separating public and private life."
  },
  {
    "question": "3. How do I enter?",
    "answer": "Complete registration, pay your entry tribute and choose a separately paid contract."
  },
  {
    "question": "4. What happens after entry?",
    "answer": "Access private communication, exclusive content, tasks and agreed experiences."
  },
  {
    "question": "5. What can I expect?",
    "answer": "Structured training, education, discipline, guidance and psychological control, tailored to your level of submission."
  },
  {
    "question": "6. What contracts are available?",
    "answer": "Four options with different durations, privileges and commitments."
  },
  {
    "question": "7. Can I speak to Goddess Vanessa?",
    "answer": "Yes, exclusively through the platform. Attention is selective, never guaranteed on demand."
  },
  {
    "question": "8. Is everything confidential?",
    "answer": "Discretion is mandatory. Personal information is handled under the privacy policy."
  },
  {
    "question": "9. Are payments refundable?",
    "answer": "All sign-up fees, entry tributes and contract fees are strictly non-refundable, except where required by law. By proceeding, you acknowledge and accept these terms."
  }
];
 const host=document.createElement('aside');host.className='application-faq';
 const button=document.createElement('button');button.type='button';button.className='quiet application-faq-button';button.setAttribute('aria-label','Application FAQ');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','application-faq-panel');button.textContent='?';
 const panel=document.createElement('section');panel.className='application-faq-panel';panel.id='application-faq-panel';panel.hidden=true;panel.setAttribute('aria-labelledby','application-faq-title');
 const header=document.createElement('header'),title=document.createElement('h2'),closeButton=document.createElement('button'),intro=document.createElement('p');
 title.id='application-faq-title';title.textContent='HOUSE OF VANESSA';closeButton.type='button';closeButton.className='quiet application-faq-close';closeButton.setAttribute('aria-label','Close FAQ');closeButton.textContent='×';header.append(title,closeButton);intro.className='application-faq-intro';intro.textContent='Read. Understand. Acknowledge.';panel.append(header,intro);
 for(const item of content){const question=document.createElement('h3'),answer=document.createElement('p');question.textContent=item.question;answer.textContent=item.answer;panel.append(question,answer);}
 host.append(button,panel);document.body.append(host);
 const close=()=>{panel.hidden=true;button.setAttribute('aria-expanded','false');};
 const show=()=>{if(host.hidden)return;panel.hidden=false;button.setAttribute('aria-expanded','true');};
 button.onclick=e=>{if(e.pointerType==='mouse')show();else panel.hidden?show():close();};closeButton.onclick=()=>{close();button.focus({preventScroll:true});close();};
 host.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')show();});
 host.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&!host.contains(document.activeElement))close();});
 // A touch focus must not open before click and immediately toggle closed.
 button.addEventListener('focus',()=>{if(button.matches(':focus-visible'))show();});
 host.addEventListener('focusout',e=>{if(!host.contains(e.relatedTarget))close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){const restore=panel.contains(document.activeElement);close();if(restore){button.focus({preventScroll:true});close();}}});
 document.addEventListener('click',e=>{if(!host.contains(e.target))close();});
 function sync(){const target=document.querySelector('#entry-lightbox[open]')||document.body;if(host.parentElement!==target)target.append(host);host.hidden=typeof squareState!=='undefined'&&squareState.contract?.status==='paid';if(host.hidden)close();}
 new MutationObserver(sync).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});sync();
})();
