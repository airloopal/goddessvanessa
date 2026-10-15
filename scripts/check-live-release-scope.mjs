import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import worker from '../dist/server/index.js';
const built=fs.readFileSync('dist/server/index.js','utf8');
for(const name of ['memberCheckoutEnabled','membershipAPI','squareApplyRenewal'])assert.ok(built.includes(name),'Approved renewal runtime: '+name);
for(const file of ['plans.html','member-plans.js','member-plans.css'])assert.ok(fs.existsSync('dist/public/'+file),'Approved renewal asset: '+file);
for(const file of ['feed.html','feed.js','feed-donations.js','sub-theme.css','liquid-glass.css','sub-navigation.js','square-ui.js','square-ui.css','sub-profile.js','sub-profile.css','application-funnel.js','application-funnel.css','application-tracking.js'])assert.ok(fs.existsSync('dist/public/'+file),'Approved asset included: '+file);
for(const path of ['/api/member/plans','/api/member/session','/api/member/prepare','/api/member/charge','/api/member/card/remove']){const r=await worker.fetch(new Request('https://academy.test'+path),{});assert.ok([401,405].includes(r.status),'Renewal endpoint rejects anonymous input: '+path);}
const menu=fs.readFileSync('public/student-account.js','utf8');assert.match(menu,/location.assign\('\/plans.html'\)/);assert.match(menu,/href="\/account.html"/);assert.ok(!menu.includes('Delete chat account?'));
assert.equal((await worker.fetch(new Request('https://academy.test/api/chat/email-test'),{})).status,403,'Controlled send testing remains Sandbox-only');
assert.ok(!fs.readFileSync('public/admin-email.js','utf8').includes('email-test'));
assert.ok(!fs.readFileSync('public/admin-support.js','utf8').includes("chatAPI('activity')"),'Email activity hooks stay excluded');
const preserved=JSON.parse(fs.readFileSync('scripts/live-preserved-files.json','utf8'));for(const [path,sha]of Object.entries(preserved)){const b=fs.readFileSync(path);assert.equal(crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex'),sha,'Production behavior preserved: '+path);}
console.log('Live release scope passed: approved feed/card/theme assets included, approved email reminders included, approved general renewals included; controlled email-test send hooks excluded, existing mail/account/auth/database behavior retained.');

assert.ok(built.includes('notificationAPI'),'Authorized transactional reminder runtime included');
assert.equal((await worker.fetch(new Request('https://academy.test/api/cron/notifications'),{})).status,401,'Reminder scheduler stays authenticated');
