'use strict';
const EDUCATION_DEFAULTS={version:1,brand:'Vanessa Academy',tagline:'Learn at your own pace.',introTitle:'A clear starting point.',introText:'Explore practical lessons in communication, personal boundaries and reflection. Choose a learning path, tell us what helps you learn, and work through each lesson in your own time.',theme:{pink:'#f6c5db',accent:'#9c2756',ink:'#21131c',background:'#fffafc'},features:{questionnaire:true,progress:true},paths:[{id:'foundations',title:'Foundations',description:'Start with the essentials and build your confidence.'},{id:'practice',title:'Further practice',description:'Reflect on what you know and practise applying it.'}],questions:[{id:'goal',title:'What would you like to learn?',options:['Clear communication','Setting personal boundaries','Reflective practice']},{id:'format',title:'How do you prefer to learn?',options:['Reading','Practical exercises','A mix of both']},{id:'pace',title:'What pace suits you?',options:['Short regular sessions','One lesson at a time','My own schedule']}],homeBlocks:[{id:'home-purpose',type:'text',title:'A place to learn',body:'Read clear explanations, try reflective exercises, and keep track of the lessons you complete.',url:''},{id:'home-method',type:'note',title:'Your learning, your pace',body:'You can pause, revisit a lesson, or change your learning path. Enrolment is free and does not create a service agreement.',url:''}],lessons:[{id:'communication',title:'Clear communication',summary:'Build a simple, repeatable way to express what you need.',blocks:[{id:'communication-read',type:'text',title:'Be specific and check understanding',body:'Describe the situation without guessing another person’s intentions. Explain what you need in concrete terms, then invite questions. A useful starting point is: “When this happens, I need this. Can we agree on a next step?”',url:''},{id:'communication-exercise',type:'checklist',title:'Try it yourself',body:'Choose an everyday situation.\nWrite one clear request.\nAsk the other person what they understood.',url:''}]},{id:'boundaries',title:'Personal boundaries',summary:'Recognise a limit and communicate it respectfully.',blocks:[{id:'boundaries-read',type:'text',title:'A boundary describes your choices',body:'A boundary explains what you are comfortable with and what you will do if that limit is reached. It is not a way to control another person. You can revisit a boundary as your needs change.',url:''},{id:'boundaries-reflect',type:'note',title:'Pause and reflect',body:'Write down one limit that matters to you. Practise stating it in one calm sentence, without apologising for having a need.',url:''}]},{id:'reflection',title:'Reflect and plan',summary:'Turn a lesson into one realistic next step.',blocks:[{id:'reflection-list',type:'checklist',title:'Your next step',body:'Name one thing you learned.\nChoose a small action you can take this week.\nDecide when you will review how it went.',url:''}]}]};
function validEducation(c){
 const str=(s,n)=>typeof s==='string'&&s.length<=n,txt=(s,n)=>str(s,n)&&s.trim().length>0,id=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,70}$/.test(s)&&!['__proto__','constructor','prototype'].includes(s),list=(a,min,max)=>Array.isArray(a)&&a.length>=min&&a.length<=max,unique=a=>new Set(a.map(x=>x?.id)).size===a.length;
 const block=b=>b&&id(b.id)&&['text','note','checklist','video'].includes(b.type)&&txt(b.title,160)&&str(b.body,10000)&&str(b.url,1500)&&(b.type!=='video'||/^(https:\/\/[^\s"<>]+|images\/[a-zA-Z0-9_.-]+\.mp4)$/.test(b.url));
 return !!(c&&(c.agreement===undefined||validEducationAgreement(c.agreement))&&c.version===1&&txt(c.brand,80)&&txt(c.tagline,160)&&txt(c.introTitle,160)&&str(c.introText,8000)&&c.theme&&['pink','accent','ink','background'].every(k=>/^#[0-9a-f]{6}$/i.test(c.theme[k]))&&c.features&&['questionnaire','progress'].every(k=>typeof c.features[k]==='boolean')&&list(c.paths,1,8)&&unique(c.paths)&&c.paths.every(p=>p&&id(p.id)&&txt(p.title,100)&&str(p.description,1000))&&list(c.questions,0,20)&&(!c.features.questionnaire||c.questions.length>0)&&unique(c.questions)&&c.questions.every(q=>q&&id(q.id)&&txt(q.title,200)&&list(q.options,2,15)&&new Set(q.options.map(o=>typeof o==='string'?o.trim().toLowerCase():o)).size===q.options.length&&q.options.every(o=>txt(o,200)))&&list(c.homeBlocks,0,20)&&unique(c.homeBlocks)&&c.homeBlocks.every(block)&&list(c.lessons,1,40)&&unique(c.lessons)&&c.lessons.every(l=>l&&id(l.id)&&txt(l.title,160)&&str(l.summary,1000)&&list(l.blocks,0,30)&&unique(l.blocks)&&l.blocks.every(block)));
}

const EDUCATION_AGREEMENT_DEFAULTS={entryPlans:[{id:'basic',name:'Basic',amount:8500},{id:'advanced',name:'Advanced',amount:12500}],contractPlans:[{id:'day',name:'1 time / 24h',amount:10000},{id:'month',name:'1 month',amount:25000},{id:'quarter',name:'3 months',amount:75000},{id:'infinite',name:'Infinite',amount:500000}],title:'Educational agreement',body:'EDUCATIONAL AGREEMENT — DRAFT FOR REVIEW\n\nThis draft concerns access to educational materials about communication, boundaries and reflective practice.\n\n1. Educational purpose\nUse the materials for your own learning. You may pause an exercise or revisit a lesson.\n\n2. Your details\nCheck the full name and email shown above before acknowledging this draft. Typing a matching name confirms your acknowledgement; it is not independent identity verification.\n\n3. Selected plan\nThe selected entry and contract rates appear in the review summary. Payment processing is not connected. No payment has been taken and no paid access is activated by this preview.\n\n4. Account access\nEmail delivery and access-code authentication must be connected before emailed login codes can be issued.\n\n5. Acceptable use\nRead the acceptable-use policy below. Respect other people’s privacy and do not use the platform for harassment, unlawful content.\n\n6. Before live enrolment\nThe course owner must replace this draft with the final educational agreement and publish it. Review the final document before making a purchase.\n\nEnd of draft agreement.',acceptableUse:'Use this platform for education and respectful communication. Do not harass or threaten others, share another person’s private information, post unlawful content. Do not share your access credentials.'};
function educationWithAgreement(c){return {...c,agreement:structuredClone(c.agreement||EDUCATION_AGREEMENT_DEFAULTS)};}
function validEducationAgreement(a){const text=(s,max)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;const plans=(list,ids)=>Array.isArray(list)&&list.length===ids.length&&new Set(list.map(p=>typeof p?.name==='string'?p.name.trim().toLowerCase():p?.name)).size===list.length&&list.every((p,i)=>p&&p.id===ids[i]&&text(p.name,100)&&Number.isSafeInteger(p.amount)&&p.amount>=0&&p.amount<=100000000);return !!(a&&plans(a.entryPlans,['basic','advanced'])&&plans(a.contractPlans,['day','month','quarter','infinite'])&&text(a.title,160)&&text(a.body,30000)&&text(a.acceptableUse,12000));}
EDUCATION_DEFAULTS.agreement=structuredClone(EDUCATION_AGREEMENT_DEFAULTS);

// Shared by the editor and API: rates are integer pence, never display text.
function educationSettingsErrors(c){
 const errors=[];
 for(const [key,label] of [['entryPlans','Entry plan'],['contractPlans','Contract plan']]){
  const plans=c?.agreement?.[key];if(!Array.isArray(plans)){errors.push('Agreement plans are missing.');continue;}
  const names=new Set();
  plans.forEach((p,i)=>{
   const name=typeof p?.name==='string'?p.name.trim():'';
   if(!name||name.length>100)errors.push(label+' '+(i+1)+': enter a name of 1–100 characters.');
   if(names.has(name.toLowerCase()))errors.push(label+' names must be different.');names.add(name.toLowerCase());
   if(!Number.isSafeInteger(p?.amount)||p.amount<0||p.amount>100000000)errors.push(label+' '+(i+1)+': enter £0–£1,000,000 with no more than two decimal places.');
  });
 }
 if(c?.features?.questionnaire&&!c?.questions?.length)errors.push('Add at least one question or turn the questionnaire off.');
 for(const [i,q] of (Array.isArray(c?.questions)?c.questions:[]).entries()){
  if(typeof q?.title!=='string'||!q.title.trim()||q.title.length>200)errors.push('Question '+(i+1)+': enter a title of 1–200 characters.');
  if(!Array.isArray(q?.options)||q.options.length<2||q.options.length>15)errors.push('Question '+(i+1)+': add 2–15 answer options.');
  else if(q.options.some(o=>typeof o!=='string'||!o.trim()||o.length>200)||new Set(q.options.map(o=>String(o).trim().toLowerCase())).size!==q.options.length)errors.push('Question '+(i+1)+': use different, non-empty options of up to 200 characters.');
 }
 return errors;
}
function educationPence(value){
 const text=String(value).trim();
 if(!/^\d+(?:\.\d{1,2})?$/.test(text))return null;
 const [whole,fraction='']=text.split('.'),amount=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 return Number.isSafeInteger(amount)&&amount<=100000000?amount:null;
}
function educationSettingsChanges(before,after){
 const changes=[],money=n=>'£'+(n/100).toFixed(2);
 for(const key of ['entryPlans','contractPlans'])for(const p of after.agreement[key]){
  const old=before.agreement[key].find(x=>x.id===p.id);
  if(old&&(old.name!==p.name||old.amount!==p.amount))changes.push(old.name+' ('+money(old.amount)+') → '+p.name+' ('+money(p.amount)+')');
 }
 if(before.features.questionnaire!==after.features.questionnaire)changes.push('Application questions '+(after.features.questionnaire?'enabled':'disabled')+'.');
 for(const q of after.questions){const old=before.questions.find(x=>x.id===q.id);if(!old)changes.push('Added question: '+q.title);else {if(old.title!==q.title)changes.push('Question: '+old.title+' → '+q.title);if(JSON.stringify(old.options)!==JSON.stringify(q.options))changes.push('Updated question options for '+q.title+': '+old.options.join(' / ')+' → '+q.options.join(' / '));}}
 for(const q of before.questions)if(!after.questions.some(x=>x.id===q.id))changes.push('Removed question: '+q.title);
 if(before.questions.map(q=>q.id).join()!==after.questions.map(q=>q.id).join())changes.push('Application question order updated.');
 if(before.agreement.title!==after.agreement.title||before.agreement.body!==after.agreement.body||before.agreement.acceptableUse!==after.agreement.acceptableUse)changes.push('Agreement text or acceptable-use policy updated.');
 const other=c=>{const {agreement,questions,features,...rest}=c;return {...rest,progress:features.progress};};if(JSON.stringify(other(before))!==JSON.stringify(other(after)))changes.push('Course content or appearance updated.');
 return changes;
}
