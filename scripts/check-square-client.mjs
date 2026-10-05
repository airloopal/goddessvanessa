import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const listeners=new Map();const context=vm.createContext({setTimeout,clearTimeout,window:{addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type);}}});
vm.runInContext(fs.readFileSync('public/square-payments.js','utf8')+';globalThis.testAPI={squareTokenize,squareAwait,squareDisplayPlan,setState:(s,p)=>{squareState=s;squarePromoCode=p;}}',context);const api=context.testAPI;
const token=await api.squareTokenize({tokenize:async()=>({status:'OK',token:'test-only'})},{},50);assert.equal(token.status,'OK');assert.equal(listeners.size,0);
let release;const stuck=api.squareTokenize({tokenize:()=>new Promise(r=>{release=r;})},{},5);await assert.rejects(stuck,/No payment was submitted/);assert.equal(listeners.size,0);release({status:'OK',token:'late-token'});
const blocked=api.squareTokenize({tokenize:()=>new Promise(()=>{})},{},50);listeners.get('securitypolicyviolation')({effectiveDirective:'form-action'});await assert.rejects(blocked,/could not open securely/);assert.equal(listeners.size,0);
const plan={id:'basic',amount:8500};api.setState({entry:{plan,canChangePromo:true}},'SUB50');assert.equal(api.squareDisplayPlan(plan,'entry').amount,4250);
api.setState({entry:{plan,canChangePromo:false}},'SUB50');assert.equal(api.squareDisplayPlan(plan,'entry').amount,8500);
const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));const base=config.headers[0].headers.find(h=>h.key==='Content-Security-Policy').value;const payment=config.headers.filter(r=>r.source==='/application.html').flatMap(r=>r.headers).find(h=>h.key==='Content-Security-Policy').value;
assert(base.includes("form-action 'self';"));assert(!base.includes("frame-src 'self' https:;"));assert(payment.includes("form-action 'self' https:;"));assert(payment.includes("frame-src 'self' https:;"));assert(!payment.includes("script-src 'self' https:;"));assert(!payment.includes("'unsafe-eval'"));assert(payment.includes("object-src 'none'"));
console.log('Payment client checks passed: stalled verification, blocked bank form, late tokens ignored, listener cleanup, promo display and checkout-only bank authentication CSP.');

// Verification time is paused while the buyer uses a bank app, with a hard total bound.
let visibility,hidden=false;
context.document={get hidden(){return hidden;},addEventListener:(type,fn)=>{visibility=fn;},removeEventListener:()=>{visibility=null;}};
let completed;
const returning=api.squareTokenize({tokenize:()=>new Promise(r=>completed=r)},{},30);
hidden=true;visibility();await new Promise(r=>setTimeout(r,45));hidden=false;visibility();completed({status:'OK',token:'bank-return'});assert.equal((await returning).token,'bank-return');assert.equal(visibility,null);
context.document.hidden;
vm.runInContext('globalThis.surfaceAPI={squareAuthenticationSurface,setDialog:(d)=>{globalThis.entryDialog=d;}}',context);
let modal=true,open=true,closes=0,shows=0,modals=0;
const dialog={get open(){return open;},dataset:{},matches:()=>modal,close(){closes++;open=false;},show(){shows++;open=true;modal=false;},showModal(){modals++;open=true;modal=true;}};
context.surfaceAPI.setDialog(dialog);
assert.equal(await context.surfaceAPI.squareAuthenticationSurface(async()=>{assert.equal(modal,false);return 'verified';}),'verified');assert.equal(modal,true);assert.equal(closes,2);assert.equal(shows,1);assert.equal(modals,1);assert.equal(dialog.dataset.squareSkipClose,'2');
await assert.rejects(context.surfaceAPI.squareAuthenticationSurface(async()=>{throw Error('Challenge failed');}),/Challenge failed/);assert.equal(modal,true);
console.log('Bank return checks passed: hidden-bank-app time excluded, listener cleanup and authentication window modal handoff restored on success/failure.');

// Reload and native return recover server contact without optional sessionStorage.
async function nativeInit({returned=true,paid=true,refreshError=false}={}){
 const state={mode:'production',ready:true,contact:{pathId:'path',email:'fixture@example.test'},entry:{status:'pending',plan:{id:'advanced',amount:6250,promoCode:'SUB50'}},contract:null};let refreshes=0;
 const c=vm.createContext({setTimeout,clearTimeout,URLSearchParams,educationPreview:false,enrolment:null,pathId:'',entryId:'',contractId:'',answers:{},learnerName:'',learnerEmail:'',learnerPhone:'',entryReviewed:false,screen:returned?'intro':'paths',course:{features:{questionnaire:true}},sessionStorage:{getItem(){throw Error('Storage blocked');},setItem(){throw Error('Storage blocked');}},location:{search:returned?'?payment=entry':'',pathname:'/application.html'},history:{replaceState(){}},eduAPI:async path=>{if(path==='payments')return state;refreshes++;if(refreshError)throw Error('Offline');return {mode:'production',ready:true,entry:{...state.entry,status:paid?'paid':'pending'},contract:null};}});
 vm.runInContext(fs.readFileSync('public/square-payments.js','utf8')+';globalThis.init=squareInit;',c);await c.init();return {c,refreshes};
}
let resume=await nativeInit();assert.equal(resume.c.screen,'questions');assert.equal(resume.c.pathId,'path');assert.equal(resume.c.learnerEmail,'fixture@example.test');assert.equal(resume.c.entryReviewed,true);
resume=await nativeInit({returned:false});assert.equal(resume.refreshes,1);assert.equal(resume.c.screen,'questions');
resume=await nativeInit({paid:false});assert.equal(resume.c.entryReviewed,false);assert.equal(resume.c.screen,'intro');
resume=await nativeInit({refreshError:true});assert.equal(resume.c.entryReviewed,false);assert.equal(resume.c.pathId,'path');
console.log('Native browser recovery checks passed: missing marker, blocked draft storage, contact retained and no unverified paid state.');
