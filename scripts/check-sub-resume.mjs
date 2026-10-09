import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync('public/sub-session-route.js','utf8');
async function run(status,data,fail=false,framed=false,application=false,appStatus=200){const redirects=[],events={};let observed;const c=vm.createContext({fetch:async(path,options)=>{if(path==='/api/education/identity')return {ok:appStatus===200,json:async()=>({applicationInProgress:application})};observed={path,options};if(fail)throw Error('offline');return {ok:status===200,json:async()=>data};},location:{replace:path=>redirects.push(path)},window:{...(framed?{parent:{}}:{}),addEventListener:(name,fn)=>events[name]=fn}});vm.runInContext(source,c);await new Promise(resolve=>setTimeout(resolve,0));return {redirects,events,observed};}
for(const status of [401,403,503])assert.deepEqual((await run(status,{student:{id:'fixture'}})).redirects,[]);
assert.deepEqual((await run(200,{})).redirects,[]);assert.deepEqual((await run(200,{student:{id:'fixture'}},true)).redirects,[]);
assert.deepEqual((await run(200,{student:{id:'fixture'}},false,true)).redirects,[],'editor frames do not resume away from their preview');
const valid=await run(200,{student:{id:'fixture'}});assert.deepEqual(valid.redirects,['/feed.html']);assert.equal(valid.observed.path,'/api/chat/session');assert.equal(valid.observed.options.headers['X-Chat-Role'],'student');assert.equal(valid.observed.options.cache,'no-store');valid.events.pageshow({persisted:true});await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(valid.redirects,['/feed.html','/feed.html']);
assert.match(fs.readFileSync('public/education-access.js','utf8'),/applicationInProgress===false/);
assert.match(fs.readFileSync('public/index.html','utf8'),/src="sub-session-route.js"/);
console.log('Sub resume checks passed: server-validated Home entry, failed/expired/offline checks stay on entry, student-role scope, no-store and cached-page recheck.');

assert.deepEqual((await run(200,{student:{id:'fixture'}},false,false,true)).redirects,[]);assert.deepEqual((await run(200,{student:{id:'fixture'}},false,false,false,503)).redirects,[]);assert.match(fs.readFileSync('public/square-payments.js','utf8'),/headers:educationRequestHeaders/);
const headerSource=fs.readFileSync('public/education-shared.js','utf8').split('\n').find(line=>line.startsWith('function educationRequestHeaders'));
const timedSource=fs.readFileSync('public/square-payments.js','utf8').split('\n').find(line=>line.startsWith('async function squareFetchTimed'));
let sent;const paymentContext=vm.createContext({URLSearchParams,location:{search:''},document:{getElementById:()=>({})},fetch:async(path,options)=>{sent={path,options};return {};}});
vm.runInContext(headerSource+'\n'+timedSource+'\nglobalThis.send=squareFetchTimed;',paymentContext);
await paymentContext.send('/api/education/payments/charge',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'},10);
assert.equal(sent.options.headers['X-Education-Context'],'application');assert.equal(sent.options.headers['Content-Type'],'application/json');
for(const inProgress of [true,false]){const redirects=[];const context=vm.createContext({URLSearchParams,PreviewAccess:{check:async()=>({id:'fixture'})},fetch:async()=>({ok:true,json:async()=>({applicationInProgress:inProgress})}),location:{replace:path=>redirects.push(path)}});vm.runInContext(fs.readFileSync('public/education-access.js','utf8').split('\n').find(line=>line.startsWith('const resumeSubHome='))+'\nglobalThis.resume=resumeSubHome;',context);await context.resume();assert.deepEqual(redirects,inProgress?[]:['/feed.html']);}
console.log('Shared-device Access and direct native-payment request wrappers passed.');
