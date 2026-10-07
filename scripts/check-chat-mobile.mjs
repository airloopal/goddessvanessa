import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('public/client-chat.js','utf8');
const context=vm.createContext({setTimeout,clearTimeout});
vm.runInContext(source.slice(source.indexOf('// Native keyboards')),context);
function state(){let hidden=false,covered=false,reason=null;const c=context.createChatPickerPrivacy({hidden:()=>hidden,covered:()=>covered,reason:()=>reason,conceal:r=>{if(!covered||r==='manual')reason=r;covered=true;},resume:()=>{covered=false;reason=null;}});return {c,get covered(){return covered;},hide(){hidden=true;c.visibility();},show(){hidden=false;c.visibility();},manual(){covered=true;reason='manual';}};}
let s=state();s.c.begin();s.hide();assert.equal(s.covered,true);s.show();assert.equal(s.covered,true);s.c.finish();assert.equal(s.covered,false);
s=state();s.c.begin();s.hide();s.c.finish();assert.equal(s.covered,true);s.show();assert.equal(s.covered,false);
s=state();s.hide();s.show();s.c.finish();assert.equal(s.covered,true);
s=state();s.manual();s.c.begin();s.hide();s.show();s.c.finish();assert.equal(s.covered,true);
s=state();s.c.begin();s.hide();s.manual();s.c.finish();s.show();assert.equal(s.covered,true);
const listeners={},styles={};const viewport={height:720,offsetTop:0,scale:1,addEventListener:(n,f)=>listeners[n]=f};
context.window={visualViewport:viewport,innerHeight:720,addEventListener(){}};context.document={activeElement:null,addEventListener(){}};context.requestAnimationFrame=f=>f();
const host={style:{setProperty:(k,v)=>styles[k]=v},classList:{toggle(){}}},log={scrollHeight:1400,scrollTop:100,clientHeight:500};context.installChatViewport(host,log);assert.equal(log.scrollTop,100);
viewport.height=340;context.document.activeElement={id:'client-message'};listeners.resize();assert.equal(styles['--chat-viewport-height'],'340px');assert.equal(log.scrollTop,1400);
viewport.offsetTop=200;listeners.scroll();assert.equal(styles['--chat-viewport-top'],'200px');viewport.scale=2;viewport.height=200;listeners.resize();assert.equal(styles['--chat-viewport-height'],'340px');
console.log('Mobile chat checks passed: picker return, hidden completion, manual/background privacy, keyboard viewport and history retention.');

// Admin keyboard handling also supports browsers which resize innerHeight itself.
const adminSource=fs.readFileSync('public/goddess-navigation.js','utf8'),adminStyles={},adminClasses={},adminEvents={};
const adminViewport={height:844,offsetTop:0,scale:1,addEventListener:(n,f)=>adminEvents[n]=f};
const adminLog={scrollTop:10,scrollHeight:2000};
const adminDoc={activeElement:null,body:{classList:{toggle:(k,v)=>adminClasses[k]=v},style:{setProperty:(k,v)=>adminStyles[k]=v}},querySelector:()=>({getBoundingClientRect:()=>({height:80})}),getElementById:id=>id==='dashboard-nav'?{getBoundingClientRect:()=>({height:84})}:adminLog,addEventListener:(n,f)=>adminEvents[n]=f};
const adminContext=vm.createContext({window:{visualViewport:adminViewport},innerHeight:844,document:adminDoc,addEventListener(){},requestAnimationFrame:f=>f()});
vm.runInContext(adminSource.slice(adminSource.indexOf(' const viewport=window.visualViewport;'),adminSource.lastIndexOf('})();')),adminContext);
assert.equal(adminStyles['--mobile-chat-height'],'680px');assert.equal(adminLog.scrollTop,10);
adminDoc.activeElement={matches:()=>true};adminViewport.height=390;adminEvents.resize();assert.equal(adminClasses['admin-keyboard-open'],true);assert.equal(adminStyles['--mobile-chat-height'],'390px');assert.equal(adminStyles['--mobile-chat-top'],'0px');assert.equal(adminLog.scrollTop,2000);
adminViewport.offsetTop=50;adminEvents.scroll();assert.equal(adminStyles['--mobile-chat-top'],'50px');
adminContext.innerHeight=390;adminEvents.resize();assert.equal(adminClasses['admin-keyboard-open'],true);
adminDoc.activeElement=null;adminViewport.height=844;adminViewport.offsetTop=0;adminContext.innerHeight=844;adminEvents.focusout();assert.equal(adminClasses['admin-keyboard-open'],false);assert.equal(adminStyles['--mobile-chat-height'],'680px');
// A floating island also reserves its safe-area/bottom gap.
adminDoc.getElementById=id=>id==='dashboard-nav'?{getBoundingClientRect:()=>({height:74,top:744})}:adminLog;adminEvents.resize();assert.equal(adminStyles['--mobile-chat-height'],'664px','Composer stops above the island, including its bottom gap');
console.log('Admin viewport checks passed: keyboard offset, resized layout viewport, history retention and keyboard dismissal.');
