import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx={window:{},URL,location:{origin:'https://academy.test'}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('public/verification-experience.js','utf8'),ctx);const ui=ctx.window.VerificationExperience;
assert.equal(ui.fileError({name:'reply.MOV',type:'video/quicktime',size:50*1024*1024}),'');
assert.match(ui.fileError({name:'reply.mp4',type:'video/mp4',size:50*1024*1024+1}),/50 MB/);
assert.match(ui.fileError({name:'reply.mp4',type:'image/jpeg',size:100}),/original/);
assert.match(ui.fileError({name:'reply.jpg',type:'video/mp4',size:100}),/original/);
assert.match(ui.fileError(null),/Choose/);
assert.equal(ui.videoURL('/api/media/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),'https://academy.test/api/media/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
assert.equal(ui.videoURL('https://video.example.test/intro.mp4'),'https://video.example.test/intro.mp4');
for(const value of ['javascript:alert(1)','data:video/mp4;base64,AAAA','http://video.example.test/intro.mp4','https://user:pass@video.example.test/intro.mp4','https://video.example.test/intro.jpg','//video.example.test/intro.mov'])assert.throws(()=>ui.videoURL(value));
assert.equal(ui.escape('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
assert.ok(!ui.steps(['<script>','Await','Watch'],0).includes('<script>'));
// Late request replies must never reopen verification or restart its polling after leaving checkout.
let resolve,intervals=0,renders=0;const node={focus(){},onclick:null};const dialog={open:true,innerHTML:'',classList:{add(){},remove(){}}};const c={window:{},VerificationExperience:ui,document:{hidden:false,getElementById:()=>node},setInterval:()=>++intervals,clearInterval(){},educationPreview:false,identity:{application:true},eduAPI:()=>new Promise(r=>resolve=r)};vm.createContext(c);vm.runInContext(fs.readFileSync('public/entry-lightbox.js','utf8'),c);c.dialog=dialog;vm.runInContext('entryDialog=dialog;renderVerificationPanel=()=>{onRender()};',c);c.onRender=()=>renders++;
const opening=vm.runInContext('showEntryVerification()',c);dialog.open=false;resolve({request:{revision:1,status:'pending'}});await opening;assert.equal(intervals,0);assert.equal(renders,0);
dialog.open=true;vm.runInContext("entryDialogView='verification';verificationRecord={revision:1}",c);const refreshing=vm.runInContext('refreshEntryVerification()',c);vm.runInContext("entryDialogView='payment'",c);resolve({request:{revision:2,status:'ready'}});await refreshing;assert.equal(renders,0);
for(const file of ['public/application.html','public/dashboard.html']){const html=fs.readFileSync(file,'utf8');assert.ok(html.includes('verification-experience.js'));assert.ok(html.includes('verification-experience.css'));}
console.log('Verification experience passed: unchanged 50 MB/types/link validation, escaped content, no polling/render after leaving verification, and both page integrations.');
