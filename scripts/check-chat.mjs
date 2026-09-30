import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
let interval,stored=[],requests=[],fail=false,serverStates=[],release;
const window={};
const context={window,parent:window,location:{search:''},URLSearchParams,crypto,document:{body:{classList:{contains:()=>false}},hidden:false,addEventListener(){}},setInterval:fn=>interval=fn,Date,Map,Set,Number,eduEscape:s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),fetch:async(path,options)=>{
 requests.push({path,options});if(fail)return {ok:false,status:503,json:async()=>({error:'Try again'})};let data={};
 if(path.includes('/messages')&&options.method==='GET')data={messages:stored,states:serverStates,online:true,hasMore:false};
 if(path.endsWith('/messages')&&options.method==='POST'){if(release)await new Promise(resolve=>release=resolve);const b=JSON.parse(options.body),m={id:b.id,text:b.text,seq:stored.length+1,from:'client',at:Date.now()};stored.push(m);data={message:m};}
 return {ok:true,json:async()=>data};}};
vm.createContext(context);vm.runInContext(fs.readFileSync('public/restored-chat.js','utf8'),context);context.PreviewChat=window.PreviewChat;
const chat=window.PreviewChat;
await chat.select('student-a');assert.equal(chat.online(),true);
release=true;const pending=chat.send('client','<hello>','123');assert.equal(chat.all()[0].pending,true);assert.match(vm.runInContext("previewThread('client')",context),/Sending/);release();release=null;await pending;
assert.equal(chat.all().length,1);assert.equal(chat.all()[0].seq,1);assert.equal(requests.find(r=>r.options.method==='POST').options.headers['X-Chat-Role'],'student');
assert.match(vm.runInContext("previewThread('client')",context),/&lt;hello>/);
serverStates=[{role:'admin',read_seq:1,typing_until:Date.now()+5000}];await chat.refresh();assert.equal(chat.readByOther(1),true);assert.equal(chat.typing('admin'),true);assert.match(vm.runInContext("previewThread('client')",context),/aria-label="Read"/);
fail=true;await assert.rejects(chat.send('client','not sent','456'),/Try again/);assert.equal(chat.all().length,2);assert.equal(chat.all()[1].failed,true);assert.match(vm.runInContext("previewThread('client')",context),/Not sent · Retry/);
fail=false;await chat.retry('456');assert.equal(chat.all().length,2);assert.equal(stored.filter(m=>m.id==='456').length,1);assert.equal(chat.all()[1].failed,undefined);
await chat.refresh();assert.equal(chat.all().length,2,'polling does not duplicate optimistic messages');
const before=requests.length;window.ChatDiscreet=true;await chat.read();await chat.refresh();assert.equal(requests.length,before,'privacy cover suppresses background reads and refreshes');window.ChatDiscreet=false;
await chat.read();await chat.read();assert.equal(requests.filter(r=>r.path.endsWith('/state')&&JSON.parse(r.options.body||'{}').readSeq===2).length,1,'read receipts are not sent repeatedly');
stored=[];await chat.select('student-b');assert.equal(chat.all().length,0);
console.log('Chat checks passed: immediate pending bubbles, sent/read states, typing, escaped text, retry with original ID, deduplicated polling, private cover, read throttling and conversation isolation.');
