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

// Mobile focus fallback covers native keyboards that resize both viewports.
context.window.matchMedia=()=>({matches:true});viewport.scale=1;viewport.height=620;context.window.innerHeight=620;context.document.activeElement={id:'client-message'};let subRaised=false;host.classList.toggle=(k,v)=>subRaised=v;listeners.resize();assert.equal(subRaised,true,'Tall resized mobile keyboard hides Sub navigation');context.document.activeElement=null;listeners.resize();assert.equal(subRaised,false);
adminContext.window.matchMedia=()=>({matches:true});adminContext.innerHeight=620;adminViewport.height=620;adminDoc.activeElement={matches:()=>true};adminEvents.focusin();assert.equal(adminClasses['admin-keyboard-open'],true,'Tall resized mobile keyboard hides Admin navigation');assert.equal(adminStyles['--mobile-chat-height'],'620px');adminDoc.activeElement=null;adminEvents.focusout();assert.equal(adminClasses['admin-keyboard-open'],false);
adminContext.window.matchMedia=()=>({matches:false});adminContext.innerHeight=900;adminViewport.height=900;adminDoc.activeElement={matches:()=>true};adminEvents.focusin();assert.equal(adminClasses['admin-keyboard-open'],false,'Desktop typing keeps navigation');
const events={},capture={},inside={},outside={};let adminFocus=0,subFocus=0,expanded='true';
const menu={open:true,contains:t=>t===inside,querySelector:()=>({focus:()=>adminFocus++})},options={hidden:false},toggle={closest:()=>({contains:t=>t===inside}),setAttribute:(k,v)=>expanded=v,focus:()=>subFocus++};
const menuDoc={querySelectorAll:()=>menu.open?[menu]:[],getElementById:id=>id==='account-options'?options:toggle,addEventListener:(n,f,c)=>{events[n]=f;capture[n]=c;}};
const refinement=fs.readFileSync('public/chat-refinements.js','utf8');vm.runInNewContext(refinement.slice(refinement.indexOf('// Dismiss chat action menus')), {document:menuDoc});
events.pointerdown({target:inside});assert.equal(menu.open,true);assert.equal(options.hidden,false);assert.equal(capture.pointerdown,true);
events.pointerdown({target:outside});assert.equal(menu.open,false);assert.equal(options.hidden,true);assert.equal(expanded,'false');
menu.open=true;options.hidden=false;events.click({target:outside});assert.equal(menu.open,false);assert.equal(options.hidden,true);
menu.open=true;options.hidden=false;events.focusin({target:outside});assert.equal(menu.open,false);assert.equal(options.hidden,true);
menu.open=true;options.hidden=false;events.keydown({key:'Escape',target:inside});assert.equal(menu.open,false);assert.equal(options.hidden,true);assert.equal(adminFocus,1);assert.equal(subFocus,1);
const plansHTML=fs.readFileSync('public/plans.html','utf8');assert.match(plansHTML, /id="member-theme"[\s\S]*Sub Login<\/a><\/div><\/header>/);assert.equal((plansHTML.match(/Sub Login/g)||[]).length,1);assert.ok(!fs.readFileSync('public/member-plans.js','utf8').includes('>Sub Login</a>'));
console.log('15 October chat UI passed: mobile focus/resized keyboard dismissal, desktop navigation retention, both menus outside pointer/click/focus and Escape, and header-only Sub Login. No network or account action.');

// Composer compactness follows local form/panel focus, never the other party's typing.
const overflowSource=fs.readFileSync('public/chat-refinements.js','utf8'),overflowContext=vm.createContext({document:{activeElement:null}});vm.runInContext(overflowSource.slice(overflowSource.indexOf('function composerOverflowCompact'),overflowSource.indexOf('(()=>{',overflowSource.indexOf('function composerOverflowCompact'))),overflowContext);const inputFocus={},toolFocus={},elsewhere={};const fakeForm={contains:x=>x===inputFocus},fakePanel={contains:x=>x===toolFocus};for(const [target,want]of [[null,false],[inputFocus,true],[toolFocus,true],[elsewhere,false]]){overflowContext.document.activeElement=target;assert.equal(overflowContext.composerOverflowCompact(fakeForm,fakePanel),want);}console.log('Composer focus checks passed: own typing/tools compact; outside focus restores full attachment row.');

await import('./check-platform-motion.mjs');
