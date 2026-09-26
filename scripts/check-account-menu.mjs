import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class Element{
 constructor(parent=null){this.parent=parent;this.listeners={};this.attrs={};this.hidden=false;}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
 dispatch(type,extra={}){const e={target:this,key:null,preventDefault(){this.prevented=true;},...extra};for(const fn of this.listeners[type]||[])fn(e);return e;}
 contains(el){return el===this||!!el?.parent&&this.contains(el.parent);}
 setAttribute(k,v){this.attrs[k]=v;}
 focus(){document.activeElement=this;document.dispatch('focusin',{target:this});}
 closest(){return this.action?this:null;}
 click(){this.dispatch('click');}
}
const document=new Element(),account=new Element(),button=new Element(account),panel=new Element(account),settings=new Element(panel),link=new Element(panel),availability=new Element(panel),outside=new Element(),heading=new Element(),sidebar=new Element();panel.hidden=true;settings.action=link.action=true;let settingsOpened=0;sidebar.addEventListener('click',()=>settingsOpened++);
document.activeElement=button;document.querySelector=s=>s==='.goddess-account'?account:s.includes('[data-tab=')?sidebar:s==='#dashboard-main h1'?heading:null;
document.getElementById=id=>({'goddess-account-toggle':button,'goddess-account-panel':panel,'account-settings':settings}[id]);panel.querySelector=()=>settings;
const timers=[];vm.runInNewContext(fs.readFileSync('public/goddess-account.js','utf8'),{document,queueMicrotask,setTimeout:fn=>timers.push(fn)});
button.click();assert.equal(panel.hidden,false);
// A browser may temporarily report body/no focused control while moving focus.
document.activeElement=outside;account.dispatch('focusout');await Promise.resolve();assert.equal(panel.hidden,false,'Menu must remain open during the blur-to-focus gap');
link.focus();assert.equal(panel.hidden,false);const navigation=panel.dispatch('click',{target:link});assert.ok(!navigation.prevented);assert.equal(panel.hidden,false,'Link must remain available until native activation completes');timers.splice(0).forEach(fn=>fn());assert.equal(panel.hidden,true);
button.click();availability.focus();panel.dispatch('click',{target:availability});assert.equal(panel.hidden,false,'Availability switch must stay usable');
outside.focus();assert.equal(panel.hidden,true);button.click();document.dispatch('click',{target:outside});assert.equal(panel.hidden,true);
button.dispatch('keydown',{key:'ArrowDown'});assert.equal(document.activeElement,settings);assert.equal(panel.hidden,false);
settings.click();assert.equal(settingsOpened,1);assert.equal(document.activeElement,heading);assert.equal(panel.hidden,true);
button.click();document.dispatch('keydown',{key:'Escape'});assert.equal(panel.hidden,true);assert.equal(document.activeElement,button);assert.equal(button.attrs['aria-expanded'],'false');
console.log('Account menu regression passed: focus transition, link activation order, availability, Settings routing, outside click/focus, Arrow Down and Escape.');
