import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('public/admin-chat-notifications.js','utf8');
async function run(previews){const alerts=[],responses=[{events:[{id:'old'}],cursor:10},{events:[{id:'m',student_id:'a',name:'Private Name',text:'Private body',kind:'message'},{id:'i',student_id:'a',name:'Private Name',attachment_id:'image-id',file_name:'Photo.png',kind:'image'},{id:'v',student_id:'a',name:'Private Name',file_name:'Video.mp4',kind:'video'},{id:'throne-gift:1',student_id:'a',name:'Private Name',text:'🎁 Throne confirmed your gift',kind:'gift'}],cursor:14},{events:[],cursor:14}];const paths=[];
 const worker={showNotification:async(title,options)=>alerts.push({title,...options})};
 const context={window:{isSecureContext:true,Notification:{permission:'granted'}},Notification:{permission:'granted'},navigator:{serviceWorker:{register:async()=>worker,ready:Promise.resolve(worker),addEventListener(){}}},localStorage:{getItem:key=>key==='admin-chat-notifications'?'on':previews?'on':'off',setItem(){}},dashboardAllowed:true,tab:'overview',document:{addEventListener(){}},setInterval(){},chatAPI:async path=>{paths.push(path);return responses.shift();},URLSearchParams,location:{search:''}};
 vm.createContext(context);vm.runInContext(source,context);const api=context.window.AdminChatNotifications;
 await api.poll();assert.equal(alerts.length,0,'initial poll suppresses old activity');await api.poll();assert.equal(alerts.length,4);await api.poll();assert.equal(alerts.length,4,'no duplicate alerts');assert.equal(paths[1],'notifications?after=10');
 if(previews){assert.equal(alerts[0].body,'Private body');assert.equal(alerts[1].image,'/api/media/image-id');assert.match(alerts[2].body,/Video.mp4/);assert.match(alerts[3].body,/Throne/);}else{assert.ok(!JSON.stringify(alerts).includes('Private'));assert.ok(alerts.every(a=>!a.image));}
}
await run(false);await run(true);
const handlers={};let focused=0,opened=null;
const dashboard={url:'https://academy.test/dashboard.html',focus:async()=>focused++,postMessage:data=>opened=data};const sw={self:{location:{origin:'https://academy.test'},addEventListener:(name,fn)=>handlers[name]=fn,clients:{claim:async()=>{},matchAll:async()=>[dashboard],openWindow:async()=>{throw Error('Existing dashboard should be reused');}},skipWaiting(){}},URL};
vm.createContext(sw);vm.runInContext(fs.readFileSync('public/chat-notifications-sw.js','utf8'),sw);let pending;handlers.notificationclick({notification:{data:{studentId:'a'},close(){}},waitUntil:p=>pending=p});await pending;assert.equal(focused,1);assert.equal(opened.studentId,'a');assert.equal(handlers.fetch,undefined,'private requests are never cached');
console.log('Browser alert checks passed: opt-in previews, private default, initial backlog suppression, media/gift events, cursor deduplication, click-to-chat and no private caching.');
