import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import {database} from '../server/platform/database.js';
import worker from '../dist/server/index.js';
const context=vm.createContext({structuredClone});vm.runInContext(fs.readFileSync('public/education-config.js','utf8'),context);
for(const [input,want] of [['85',8500],['125.99',12599],['0',0],['5000.00',500000],['1.005',null],['-1',null],['1e3',null],['',null],['1000000.01',null]])assert.equal(vm.runInContext(`educationPence(${JSON.stringify(input)})`,context),want);
const sql=new PGlite();await sql.exec('CREATE ROLE anon; CREATE ROLE authenticated;');await sql.exec(fs.readFileSync('supabase/schema.sql','utf8'));const env={DB:database(sql)};
async function call(path,method='GET',body,role){const r=await worker.fetch(new Request('https://academy.test/api/education/'+path,{method,headers:{origin:'https://academy.test',...(body?{'content-type':'application/json'}:{}),...(role?{'oai-authenticated-user-id':role,'oai-authenticated-user-email':role==='owner'?'danielvernontp@gmail.com':'student@example.test'}:{})},body:body?JSON.stringify(body):undefined}),env);return {status:r.status,data:await r.json()};}
const original=(await call('published')).data.config;
const enrol={name:'Test Student',pathId:original.paths[0].id,answers:Object.fromEntries(original.questions.map(q=>[q.id,q.options[0]])),accepted:true,review:{revision:0,entryId:'basic',contractId:'day',email:'student@example.test',signature:'Test Student',ageConfirmed:true,aupAccepted:true,read:true,entryReviewed:true}};
assert.equal((await call('enrolment','PUT',enrol,'student')).status,200);
const saved=(await call('enrolment','GET',undefined,'student')).data.enrolment.snapshot;
const next=structuredClone(original);next.agreement.entryPlans[0].name='Course entry';next.agreement.entryPlans[0].amount=9901;next.agreement.contractPlans[0].name='Study day';next.agreement.contractPlans[0].amount=12345;next.questions.splice(1,1);next.questions[0].options=['New first option','New second option'];next.questions.push({id:'new_question',title:'Which material helps you?',options:['Written guide','Video guide']});
for(const invalid of [null,{...next,questions:[null]}, {...next,agreement:null}])assert.equal((await call('draft','PUT',{revision:0,config:invalid},'owner')).status,400);
for(const mutate of [c=>c.agreement.entryPlans[0].amount=100.5,c=>c.agreement.contractPlans[0].id='renamed-id',c=>c.agreement.contractPlans[1].name=' study day ',c=>c.questions[0].options=['Same',' same ']]){const invalid=structuredClone(next);mutate(invalid);assert.equal((await call('draft','PUT',{revision:0,config:invalid},'owner')).status,400);}
assert.equal((await call('draft','PUT',{revision:0,config:next},'student')).status,403);
assert.equal((await call('draft','PUT',{revision:0,config:next},'owner')).status,200);
assert.deepEqual((await call('published')).data.config,original);
assert.equal((await call('published','PUT',{revision:0,config:next},'owner')).status,200);
assert.equal((await call('published','PUT',{revision:0,config:original},'owner')).status,409);
assert.deepEqual((await call('enrolment','GET',undefined,'student')).data.enrolment.snapshot,saved);
const stale=await call('enrolment','PUT',enrol,'student');assert.equal(stale.status,409);assert.equal(stale.data.code,'settings_changed');
const current=structuredClone(enrol);current.review.revision=1;current.review.amount=1;current.answers=Object.fromEntries(next.questions.map(q=>[q.id,q.options[0]]));
const updated=await call('enrolment','PUT',current,'student');assert.equal(updated.status,200);assert.equal(updated.data.enrolment.snapshot.agreement.entry.amount,9901);assert.equal(updated.data.enrolment.snapshot.agreement.contract.amount,12345);assert.equal(updated.data.enrolment.snapshot.agreement.contract.name,'Study day');
const audit=await env.DB.prepare("SELECT content FROM prototype_settings WHERE id LIKE 'education-review-%'").all();assert.equal(audit.results.length,2);assert(audit.results.some(r=>JSON.parse(r.content).contract.amount===10000));
context.before=original;context.after=next;const changes=vm.runInContext('educationSettingsChanges(before,after)',context);assert(changes.some(x=>x.includes('£99.01')));assert(changes.some(x=>x.includes('Removed question')));assert(changes.some(x=>x.includes('Added question')));
// Exercise the actual student refresh handler, keeping only still-valid answers.
const elements=new Map();let button;
const appContext=vm.createContext({structuredClone,URLSearchParams,location:{search:'?preview=1'},parent:{postMessage(){}},window:{addEventListener(){},scrollTo(){}},document:{getElementById(id){if(!elements.has(id))elements.set(id,{textContent:'',append(b){button=b;}});return elements.get(id);},createElement(){return {};}}});
vm.runInContext(fs.readFileSync('public/education-config.js','utf8'),appContext);
vm.runInContext('const educationPreview=true;const eduAPI=async()=>({config:nextConfig,revision:1});',appContext);
vm.runInContext(fs.readFileSync('public/education-app.js','utf8'),appContext);
vm.runInContext(fs.readFileSync('public/education-review.js','utf8'),appContext);
appContext.nextConfig=next;appContext.oldConfig=original;
vm.runInContext("course=oldConfig;pathId='foundations';entryId='basic';contractId='day';learnerName='Kept Name';learnerEmail='keep@example.test';answers={goal:'Clear communication',pace:'Short regular sessions'};entryReviewed=true;reviewReached=true;ageConfirmed=true;aupAccepted=true;reviewSignature='Kept Name';updateReviewControls=()=>{};move=to=>screen=to;offerSettingsRefresh();",appContext);
await button.onclick();
assert.equal(vm.runInContext('learnerName',appContext),'Kept Name');assert.equal(vm.runInContext('learnerEmail',appContext),'keep@example.test');assert.equal(vm.runInContext('answers.pace',appContext),'Short regular sessions');assert.equal(vm.runInContext('answers.goal',appContext),undefined);assert.equal(vm.runInContext('configRevision',appContext),1);assert.equal(vm.runInContext('entryReviewed||reviewReached||ageConfirmed||aupAccepted',appContext),false);assert.equal(vm.runInContext('reviewSignature',appContext),'');assert.equal(vm.runInContext('screen',appContext),'intro');
// Multiple selections survive validation and saved agreement snapshots.
const multi=structuredClone(current);multi.answers=Object.fromEntries(next.questions.map(q=>[q.id,q.options.slice(0,2)]));
const multiSaved=await call('enrolment','PUT',multi,'student');assert.equal(multiSaved.status,200);
assert.deepEqual(multiSaved.data.enrolment.answers,multi.answers);
assert.deepEqual(multiSaved.data.enrolment.snapshot.questions.map(q=>q.answer),Object.values(multi.answers));
for(const bad of [[],['not a current choice'],[next.questions[0].options[0],next.questions[0].options[0]],{},[null]]){const invalid=structuredClone(multi);invalid.answers[next.questions[0].id]=bad;assert.equal((await call('enrolment','PUT',invalid,'student')).status,400);}
// The actual question renderer permits multiple checks, unchecks, and restores selections after Back.
const uiElements=new Map();let uiInputs=[];
const uiHost={innerHTML:'',querySelectorAll(selector){if(selector==='[data-path-id]')return [];if(selector==='.questions input')return uiInputs;return [];}};
const uiDocument={getElementById(id){if(id==='education-app')return uiHost;if(!uiElements.has(id))uiElements.set(id,{addEventListener(){},textContent:''});return uiElements.get(id);}};
const ui=vm.createContext({structuredClone,URLSearchParams,document:uiDocument,location:{search:'?preview=1'},parent:{postMessage(){}},window:{addEventListener(){}}});
vm.runInContext(fs.readFileSync('public/education-config.js','utf8'),ui);
vm.runInContext("const educationPreview=true;const eduTheme=()=>{};const eduEscape=s=>String(s);const squareEnabled=()=>false;const bindReview=()=>{};const bindContactFields=()=>{};const contactFields=()=>'';const bindEntryLightbox=()=>{};const squareDecorate=()=>{};let entryReviewed=false;",ui);
vm.runInContext(fs.readFileSync('public/education-app.js','utf8'),ui);ui.currentConfig=original;
vm.runInContext("course=currentConfig;screen='paths';renderLearning();",ui);assert.ok(!uiHost.innerHTML.includes('data-contact=')&&!uiHost.innerHTML.includes('learner-name'),'first step contains only selectors');
const question=original.questions[0];uiInputs=question.options.map((_,index)=>({name:question.id,value:String(index),checked:false}));
vm.runInContext("course=currentConfig;screen='questions';renderLearning();",ui);
assert(uiHost.innerHTML.includes('type="checkbox"'));assert(uiHost.innerHTML.includes('Select all that apply'));
uiInputs[0].checked=true;uiInputs[0].onchange();uiInputs[1].checked=true;uiInputs[1].onchange();
assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(answers)',ui))[question.id],question.options.slice(0,2));
vm.runInContext('renderLearning();',ui);assert.equal((uiHost.innerHTML.match(/checked/g)||[]).length,2);
uiInputs[0].checked=false;uiInputs[0].onchange();assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(answers)',ui))[question.id],[question.options[1]]);
await sql.close();console.log('Settings checks passed: exact pence, invalid settings rejected, draft isolation, publish conflicts, renamed plans and changed options, historical snapshots, server-derived rates, and student refresh retaining valid details while requiring new consent.');
