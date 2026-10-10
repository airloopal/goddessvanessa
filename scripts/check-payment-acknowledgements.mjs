import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('public/square-payments.js','utf8');
for(const stage of ['entry','contract']){
 const checkbox={checked:false,focus(){this.focused=true;}};
 const recovery={disabled:false};
 const button={id:`square-${stage}-pay`,dataset:{},disabled:false,isConnected:true,parentElement:{querySelector:()=>recovery},after(){}};
 let fallback=0,charges=0,tokenizations=0,notices=0;
 const c=vm.createContext({URL,URLSearchParams,location:{search:''},crypto:{randomUUID:()=> 'fixture-attempt'},entryId:'basic',contractId:'month',configRevision:1,learnerEmail:'',document:{getElementById:id=>id.endsWith('acknowledge')?checkbox:id.endsWith('pay')?button:{}},window:{},squareNotice(){notices++;},squareButton(){},eduAPI:async path=>{if(path==='payments/fallback'){fallback++;throw Error('Fixture error');}if(path==='payments/prepare')return {hosted:true};},sessionStorage:{setItem(){}},pathId:'fixture',answers:{},learnerName:'',learnerPhone:'',screen:'review',squareLoadSDK:async()=>{},gbp:()=> '£85.00'});
 vm.runInContext(source+'\nglobalThis.api={squareRefundNoticeHTML,squareBindAcknowledgement,squareSetPaymentReady,squareHostedRecovery,squarePaymentAcknowledged,squareMountCard};',c);
 const a=c.api;
 assert.match(a.squareRefundNoticeHTML(stage),/type="checkbox"/);
 assert.match(a.squareRefundNoticeHTML(stage),stage==='entry'?/I understand that this payment is a voluntary gift so therefore non-refundable\./:/I understand this is a paid contractual agreement\. The Agreement and Acceptable Use Policy applies\./);
 a.squareBindAcknowledgement(stage,button);a.squareSetPaymentReady(stage,button,true);assert.equal(button.disabled,true);assert.equal(recovery.disabled,true);
 await a.squareHostedRecovery(stage,button,{});assert.equal(fallback,0);
 checkbox.checked=true;checkbox.onchange();assert.equal(button.disabled,false);assert.equal(recovery.disabled,false);
 a.squareSetPaymentReady(stage,button,false);checkbox.onchange();assert.equal(button.disabled,true,'Checking cannot re-enable an in-flight action');
 a.squareSetPaymentReady(stage,button,true);await a.squareHostedRecovery(stage,button,{});assert.equal(fallback,1);assert.equal(button.disabled,false,'Retry preserves acknowledgement');
 checkbox.checked=false;checkbox.onchange();assert.equal(button.disabled,true);
 a.squareSetPaymentReady(stage,button,true,true);assert.equal(button.disabled,false,'Existing charge can be confirmed without a second acknowledgement');assert.equal(recovery.disabled,true);
 await a.squareMountCard(stage,button.id,'message');assert.equal(button.disabled,true,'Hosted payment action cannot bypass consent');checkbox.checked=true;checkbox.onchange();assert.equal(button.disabled,false);
 c.entryId='advanced';c.contractId='quarter';c.document.getElementById=()=>null;assert.equal(a.squarePaymentAcknowledged(stage),false,'Changing a selected fee resets consent');
 assert.equal(charges,0);assert.equal(tokenizations,0);assert.ok(notices>0);
}
// Final signing still needs every existing review confirmation and the additional contract acknowledgement.
const c=vm.createContext({learnerName:'Fixture',emailValid:()=>true,entryReviewed:true,entryPlan:()=>true,contractPlan:()=>true,reviewReached:true,reviewSignature:'Fixture',ageConfirmed:true,aupAccepted:true,squareEnabled:()=>true,squarePaymentAcknowledged:()=>false});
const review=fs.readFileSync('public/education-review.js','utf8').match(/function reviewValid\(\)\{[^\n]+/)[0];vm.runInContext(review,c);assert.equal(c.reviewValid(),false);c.squarePaymentAcknowledged=()=>true;assert.equal(c.reviewValid(),true);c.aupAccepted=false;assert.equal(c.reviewValid(),false);
console.log('Payment acknowledgements passed: exact copy, fee scoping, ready/busy states, hosted action guard, retry confirmation and final signing gates. No charges made.');
// Execute the real native handler with a fake SDK/transport: no provider or bank calls.
for(const stage of ['entry','contract']){
 const checkbox={checked:false,focus(){}};let recovery=null;
 const message={replaceChildren(){},className:''};
 const button={id:`square-${stage}-pay`,dataset:{},disabled:false,isConnected:true,parentElement:{querySelector:()=>recovery},after(node){recovery=node;}};
 const calls=[];let tokens=0;
 const fixture=vm.createContext({URL,URLSearchParams,location:{search:''},crypto:{randomUUID:()=> 'fixture-attempt'},entryId:'basic',contractId:'month',configRevision:1,learnerEmail:'',pathId:'fixture',answers:{},learnerName:'',learnerPhone:'',screen:'review',sessionStorage:{setItem(){}},document:{getElementById:id=>id.endsWith('acknowledge')?checkbox:id.endsWith('pay')?button:message,createElement:()=>({dataset:{},remove(){recovery=null;}})},window:{Square:{payments:()=>({card:async()=>({attach:async()=>{},destroy:async()=>{}})})}},eduAPI:async()=>({applicationId:'fixture',locationId:'fixture',plan:{id:stage==='entry'?'basic':'month',amount:8500}}),squareNotice(){},squareButton(){},squareLoadSDK:async()=>{},gbp:()=> '£85.00'});
 vm.runInContext(source+`\nsquareTokenize=async()=>{tokens++;return {status:'OK',token:'fixture-source'};};squareFetchTimed=async(path,options)=>{calls.push(JSON.parse(options.body));return {json:async()=>({paid:false,error:'Fixture pending confirmation'})};};globalThis.mount=squareMountCard;`,Object.assign(fixture,{calls,get tokens(){return tokens;},set tokens(v){tokens=v;}}));
 await fixture.mount(stage,button.id,'message');assert.equal(button.disabled,true);
 await button.onclick();assert.equal(calls.length,0,'Unticked checkbox never submits native charge');
 checkbox.checked=true;checkbox.onchange();await button.onclick();assert.equal(calls.length,1);assert.equal(calls[0].attemptId,'fixture-attempt');
 checkbox.checked=false;checkbox.onchange();assert.equal(button.disabled,false,'Pending charge confirmation stays available');await button.onclick();assert.equal(calls.length,2);assert.equal(calls[1].attemptId,calls[0].attemptId);assert.equal(calls[1].sourceId,calls[0].sourceId);
}
console.log('Native handler passed: unchecked consent blocks charge; confirmation retries retain the same payment attempt. All transports mocked.');
