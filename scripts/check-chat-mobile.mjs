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
context.window={visualViewport:viewport,innerHeight:720,addEventListener(){}};context.document={activeElement:null};context.requestAnimationFrame=f=>f();
const host={style:{setProperty:(k,v)=>styles[k]=v},classList:{toggle(){}}},log={scrollHeight:1400,scrollTop:100,clientHeight:500};context.installChatViewport(host,log);assert.equal(log.scrollTop,100);
viewport.height=340;context.document.activeElement={id:'client-message'};listeners.resize();assert.equal(styles['--chat-viewport-height'],'340px');assert.equal(log.scrollTop,1400);
viewport.offsetTop=200;listeners.scroll();assert.equal(styles['--chat-viewport-top'],'200px');viewport.scale=2;viewport.height=200;listeners.resize();assert.equal(styles['--chat-viewport-height'],'340px');
console.log('Mobile chat checks passed: picker return, hidden completion, manual/background privacy, keyboard viewport and history retention.');
