import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync('public/sub-session-route.js','utf8');
async function run(status,data,fail=false){const redirects=[],events={};let observed;const c=vm.createContext({fetch:async(path,options)=>{observed={path,options};if(fail)throw Error('offline');return {ok:status===200,json:async()=>data};},location:{replace:path=>redirects.push(path)},window:{addEventListener:(name,fn)=>events[name]=fn}});vm.runInContext(source,c);await new Promise(resolve=>setTimeout(resolve,0));return {redirects,events,observed};}
for(const status of [401,403,503])assert.deepEqual((await run(status,{student:{id:'fixture'}})).redirects,[]);
assert.deepEqual((await run(200,{})).redirects,[]);assert.deepEqual((await run(200,{student:{id:'fixture'}},true)).redirects,[]);
const valid=await run(200,{student:{id:'fixture'}});assert.deepEqual(valid.redirects,['/feed.html']);assert.equal(valid.observed.path,'/api/chat/session');assert.equal(valid.observed.options.headers['X-Chat-Role'],'student');assert.equal(valid.observed.options.cache,'no-store');valid.events.pageshow({persisted:true});await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(valid.redirects,['/feed.html','/feed.html']);
assert.match(fs.readFileSync('public/education-access.js','utf8'),/if\(student\)location.replace\('\/feed.html'\)/);
assert.match(fs.readFileSync('public/index.html','utf8'),/src="sub-session-route.js"/);
console.log('Sub resume checks passed: server-validated Home entry, failed/expired/offline checks stay on entry, student-role scope, no-store and cached-page recheck.');
