import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
let interval,stored=[],requests=[],fail=false,failStatus=503,serverStates=[],release;
const window={};
const context={window,parent:window,location:{search:''},URL,URLSearchParams,crypto,document:{body:{classList:{contains:()=>false}},hidden:false,addEventListener(){}},setInterval:fn=>interval=fn,Date,Map,Set,Number,eduEscape:s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),fetch:async(path,options)=>{
 requests.push({path,options});if(fail)return {ok:false,status:failStatus,json:async()=>({error:'Try again'})};let data={};
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

const adminLink=vm.runInContext('chatMessageText({from:"admin",text:"Gift https://throne.com/vvannessa"})',context);assert.match(adminLink,/target="_blank"/);assert.match(adminLink,/noopener noreferrer/);assert.doesNotMatch(vm.runInContext('chatMessageText({from:"client",text:"https://throne.com/vvannessa"})',context),/<a /);assert.doesNotMatch(vm.runInContext('chatMessageText({from:"admin",text:"https://throne.com.evil.example/x"})',context),/<a /);
const policy=fs.readFileSync('server/chat.js','utf8').split('// Private learning-support')[0];const guard={URL};vm.createContext(guard);vm.runInContext(policy,guard);for(const url of ['http://throne.com/x','https://throne.com.evil.example/x','https://user@throne.com/x','javascript:alert(1)','https://throne.com:444/x'])assert.equal(vm.runInContext('chatSafeLink('+JSON.stringify(url)+')',guard),false);assert.equal(vm.runInContext('chatSafeLink("https://throne.com/vvannessa")',guard),true);for(const text of ['https://evil.example/x','www.evil.example','evil.example/path'])assert.ok(vm.runInContext('chatLinkCandidates('+JSON.stringify(text)+').length',guard));console.log('Chat link checks passed: sender separation, HTTPS allowlist, lookalikes, credentials, ports and plain-text Sub rendering.');

fail=true;failStatus=400;await assert.rejects(chat.send("client","https://throne.com/vvannessa","blocked-link"));assert.equal(chat.all().some(m=>m.id==="blocked-link"),false,"Rejected link is removed rather than offering a futile retry");
