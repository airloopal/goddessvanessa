import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
let calls=[],ok=true,redirect='';
const window={};const context={window,parent:window,URLSearchParams,location:{search:'',replace:s=>redirect=s},fetch:async(path,options={})=>{calls.push({path,options});return {ok,json:async()=>ok?{student:{id:'private-student'}}:{error:'Invalid code'}};}};
vm.runInNewContext(fs.readFileSync('public/preview-access.js','utf8'),context);
assert.equal((await window.PreviewAccess.check()).id,'private-student');
await window.PreviewAccess.enter('a-private-code');assert.equal(JSON.parse(calls.at(-1).options.body).code,'a-private-code');
ok=false;await assert.rejects(window.PreviewAccess.enter('VANESSA-DEMO'),/Invalid code/);assert.equal(await window.PreviewAccess.check(),null);
await assert.rejects(window.PreviewAccess.logout(),/Could not log out/);assert.equal(redirect,'');
ok=true;await window.PreviewAccess.logout();assert.equal(calls.at(-1).options.method,'DELETE');assert.equal(redirect,'access.html?notice=logout');
console.log('Access UI checks passed: server validation, invalid code handling and confirmed server logout.');
// Normal Sub Login routes an expired paid member to billing without storing the code.
async function normalLogin({failure,billingOK=false,billingStatus=401}={}){
 let assigned='',billingCalls=0;const input={value:'AB-'.repeat(24),setAttribute(){}},status={},button={},form={},host={append(){},set innerHTML(v){}},nodes={'education-access':host,'access-code':input,'access-status':status,'access-form':form};
 const scope={document:{getElementById:id=>nodes[id],createElement:()=>({})},URLSearchParams,AbortSignal,location:{search:'',assign:v=>assigned=v},window:{addEventListener(){}},eduAPI:()=>new Promise(()=>{}),PreviewAccess:{enter:async()=>{if(failure)throw Object.assign(Error('Login denied'),{status:failure});},check:async()=>null},fetch:async(path,options)=>{assert.equal(path,'/api/member/session');billingCalls++;assert.equal(JSON.parse(options.body).code,'AB'.repeat(24));assert.equal(options.credentials,'same-origin');return {ok:billingOK,status:billingStatus};}};
 vm.runInNewContext(fs.readFileSync('public/education-access.js','utf8'),scope);
 await form.onsubmit({preventDefault(){},target:{querySelector:()=>button}});return {assigned,billingCalls,message:status.textContent,disabled:button.disabled};
}
assert.equal((await normalLogin()).assigned,'feed.html');
for(const failure of [401,402]){const r=await normalLogin({failure,billingOK:true});assert.equal(r.assigned,'/plans.html');assert.equal(r.billingCalls,1);assert.equal(r.disabled,false);}
assert.equal((await normalLogin({failure:401})).assigned,'');
for(const failure of [400,403,429,500]){const r=await normalLogin({failure,billingOK:true});assert.equal(r.assigned,'');assert.equal(r.billingCalls,0,'Never bypass cookie, suspension, rate or server failures');}
console.log('Normal login renewal routing passed: expired code opens billing only; active login unchanged; failed verification never redirects; no code in a URL or browser storage.');
