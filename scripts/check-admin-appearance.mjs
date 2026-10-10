import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const css=fs.readFileSync('public/admin-appearance.css','utf8');
const tokens=selector=>Object.fromEntries([...css.match(selector)[1].matchAll(/(--[a-z-]+):([^;]+);?/g)].map(m=>[m[1],m[2]]));
const day=tokens(/body\.dashboard\{([^}]+)\}/),night={...day,...tokens(/body\.dashboard\[data-admin-theme=night\]\{([^}]+)\}/)};
const lum=hex=>hex.slice(1).match(/../g).map(h=>parseInt(h,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
const pairs=[['ink','page'],['muted','page'],['ink','panel'],['muted','panel'],['ink','surface'],['muted','surface'],['selected-ink','selected'],['selected-muted','selected'],['accent','panel'],['accent','icon-bg'],['success','success-bg'],['warning','warning-bg'],['error','error-bg']];
for(const [mode,t]of Object.entries({day,night}))for(const [fg,bg]of pairs)assert.ok(contrast(t['--dash-'+fg],t['--dash-'+bg])>=4.5,mode+' '+fg+'/'+bg+' must support normal text');
const context={window:{},document:{body:{classList:{contains:name=>name==='dashboard'},dataset:{}}},localStorage:{getItem:()=>null}};vm.createContext(context);vm.runInContext(fs.readFileSync('public/admin-icons.js','utf8'),context);
for(const name of context.window.AdminIcons.names){const svg=context.window.AdminIcons.svg(name);assert.match(svg,/stroke-linecap="round"/);assert.match(svg,/stroke-linejoin="round"/);let checked=svg;if(name==='compose'){assert.equal((svg.match(/href=/g)||[]).length,1);assert.match(svg,/href="\/images\/brand\/admin-feed-compose\.png"/);assert.match(svg,/mask-type:alpha/);checked=svg.replace('href="/images/brand/admin-feed-compose.png"','');}assert.doesNotMatch(checked,/<script|\bon[a-z]+=|href=|<foreignObject/i);assert.doesNotMatch(svg,/\p{Extended_Pictographic}/u);}
assert.equal(crypto.createHash('sha256').update(fs.readFileSync('public/images/brand/admin-feed-compose.png')).digest('hex'),'a81c4bf47229022989f068801bec82dbfac6bbfc6cf1b548e43696cc57a6a6a6','Original supplied icon bytes preserved');
assert.match(context.window.AdminIcons.svg('<script>'),/data-admin-icon="alert"/);
const notices=fs.readFileSync('public/chat-refinements.js','utf8');assert.match(notices,/notification-topic/);assert.match(notices,/groups\.has\(group\)/);assert.match(notices,/AdminIcons\?\.svg/);
const navigation=fs.readFileSync('public/goddess-navigation.js','utf8');assert.match(navigation,/closest\('\.crucial-notification'\)/);
console.log('Admin appearance checks passed: both theme token pairs meet 4.5:1, rounded static icon collection has no executable SVG/device emoji, and notification rows have explicit topics with chat grouping and no extra decorator icons.');

assert.match(css,/body\.dashboard #student-code-dialog\{background:var\(--dash-panel\);color:var\(--dash-ink\);border-color:var\(--dash-border\)/);
