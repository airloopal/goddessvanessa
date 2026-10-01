import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {database} from '../server/platform/database.js';
import worker from '../dist/server/index.js';
const sql=new PGlite();await sql.exec('CREATE ROLE anon; CREATE ROLE authenticated;');await sql.exec(fs.readFileSync('supabase/schema.sql','utf8'));
const orders=new Map(),payments=new Map(),links=new Map();let creations=0;
const env={DB:database(sql),SQUARE_ENVIRONMENT:'sandbox',SQUARE_ACCESS_TOKEN:'test-only',SQUARE_LOCATION_ID:'location',SQUARE_WEBHOOK_SIGNATURE_KEY:'test-signature',SQUARE_WEBHOOK_URL:'https://academy.test/api/education/payments/webhook',SQUARE_SITE_URL:'https://academy.test'};
env.SQUARE_FETCH=async(url,options)=>{
 const path=new URL(url).pathname;
 if(path.endsWith('/online-checkout/payment-links')){const body=JSON.parse(options.body);assert.ok(body.order.reference_id.length<=40);assert.equal(body.order.line_items[0].base_price_money.currency,'GBP');
  if(!links.has(body.idempotency_key)){const id='order-'+(++creations),link={id:'link-'+creations,order_id:id,url:'https://sandbox.square.link/u/'+creations};orders.set(id,{...body.order,id,tenders:[]});links.set(body.idempotency_key,link);}
  return Response.json({payment_link:links.get(body.idempotency_key)});
 }
 if(path.startsWith('/v2/orders/'))return Response.json({order:orders.get(decodeURIComponent(path.split('/').at(-1)))});
 if(path.startsWith('/v2/payments/'))return Response.json({payment:payments.get(decodeURIComponent(path.split('/').at(-1)))});
 throw Error('Unexpected Square request '+url);
};
async function call(path,{method='GET',data,user='applicant',origin='https://academy.test',extraEnv={},cookie}={}){
 const headers={...(cookie?{cookie}:{}),origin,'oai-authenticated-user-id':user,'oai-authenticated-user-email':user==='owner'?'danielvernontp@gmail.com':'student@example.test',...(data?{'Content-Type':'application/json'}:{})};
 const r=await worker.fetch(new Request('https://academy.test'+(path.startsWith('/')?path:'/api/education/'+path),{method,headers,...(data?{body:JSON.stringify(data)}:{})}),{...env,...extraEnv});return {status:r.status,data:await r.json(),r};
}
async function webhook(id,{bad=false,type='payment.updated'}={}){const body=JSON.stringify({type,data:{object:type.startsWith('refund.')?{refund:{payment_id:id}}:{payment:{id}}}});const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.SQUARE_WEBHOOK_SIGNATURE_KEY),{name:'HMAC',hash:'SHA-256'},false,['sign']);const signature=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(env.SQUARE_WEBHOOK_URL+body))).toString('base64');const r=await worker.fetch(new Request(env.SQUARE_WEBHOOK_URL,{method:'POST',body,headers:{'x-square-hmacsha256-signature':bad?'bad':signature}}),env);return r.status;}
function complete(orderId,amount){const id='payment-'+orderId,order=orders.get(orderId);const now=new Date().toISOString();payments.set(id,{id,order_id:orderId,location_id:'location',status:'COMPLETED',amount_money:{amount,currency:'GBP'},total_money:{amount,currency:'GBP'},updated_at:now,receipt_url:'https://squareup.com/receipt/example'});order.tenders=[{payment_id:id}];return id;}
const post=(stage,planId,extras={})=>call('payments/checkout',{method:'POST',data:{stage,planId,revision:0,amount:1},...extras});
assert.equal((await post('entry','basic',{origin:'https://evil.test'})).status,403);
assert.equal((await post('contract','month')).status,409);
assert.equal((await post('entry','basic',{extraEnv:{SQUARE_ENVIRONMENT:'production'}})).status,503);
const first=await post('entry','basic');assert.equal(first.status,200);assert.match(first.data.url,/sandbox.square.link/);
assert.equal((await post('entry','basic')).data.url,first.data.url);assert.equal(creations,1);
assert.equal((await post('entry','advanced')).status,409);
assert.equal(orders.get('order-1').line_items[0].base_price_money.amount,8500);
assert.equal((await call('payments')).data.entry.status,'pending');
assert.equal((await call('payments',{user:'other'})).data.entry,null);
assert.equal((await call('payments',{extraEnv:{SQUARE_ENVIRONMENT:'production'}})).data.entry,null);
const id=complete('order-1',1);assert.equal(await webhook(id),200);assert.equal((await call('payments')).data.entry.status,'pending');
complete('order-1',8500);assert.equal(await webhook(id,{bad:true}),403);assert.equal((await call('payments')).data.entry.status,'pending');
assert.equal(await webhook(id),200);assert.equal(await webhook(id),200);assert.equal((await call('payments')).data.entry.status,'paid');
assert.equal((await post('entry','basic')).data.paid,true);assert.equal(creations,1);
const config=(await call('published')).data.config;
const payload={name:'Test Student',pathId:config.paths[0].id,answers:Object.fromEntries(config.questions.map(q=>[q.id,q.options[0]])),accepted:true,review:{revision:0,entryId:'basic',contractId:'month',email:'student@example.test',signature:'Test Student',ageConfirmed:true,aupAccepted:true,read:true,entryReviewed:true}};
assert.equal((await call('enrolment',{method:'PUT',data:payload,user:'other'})).status,402);
const enrol=await call('enrolment',{method:'PUT',data:payload});assert.equal(enrol.status,200,JSON.stringify(enrol.data));
const contract=await post('contract','month');assert.equal(contract.status,200,JSON.stringify(contract.data));assert.equal(creations,2);
assert.equal((await call('enrolment',{method:'PUT',data:payload})).status,409);
const denied=await call('/api/chat/students',{method:'POST',user:'owner',data:{reference:enrol.data.enrolment.reference}});assert.equal(denied.status,402);
const contractId=complete('order-2',25000);
// The browser return only asks the server to reconcile; Square remains authoritative.
assert.equal((await call('payments/refresh',{method:'POST',data:{}})).data.contract.status,'paid');
const paid=(await call('payments')).data.contract;assert.ok(paid.expiresAt);const paidAt=paid.paidAt;await webhook(contractId);assert.equal((await call('payments')).data.contract.paidAt,paidAt);
const admin=(await call('enrolments',{user:'owner'})).data.enrolments;assert.equal(admin[0].payments.contract.status,'paid');assert.ok(!('user_id' in admin[0]));
const issued=await call('/api/chat/students',{method:'POST',user:'owner',data:{reference:enrol.data.enrolment.reference}});assert.equal(issued.status,200);assert.ok(issued.data.code);
const contractKey=orders.get('order-2').reference_id;const row=await env.DB.prepare('SELECT content FROM prototype_settings WHERE id=?').bind(contractKey).first();const stored=JSON.parse(row.content);await env.DB.prepare('UPDATE prototype_settings SET content=? WHERE id=?').bind(JSON.stringify({...stored,expiresAt:'2020-01-01T00:00:00Z'}),contractKey).run();assert.equal((await call('/api/chat/students',{method:'POST',user:'owner',data:{reference:enrol.data.enrolment.reference}})).status,402);await env.DB.prepare('UPDATE prototype_settings SET content=? WHERE id=?').bind(row.content,contractKey).run();
// Codes and sessions must end with a near-expiry paid contract.
const nearEnd=Date.now()+3600000;
await env.DB.prepare('UPDATE prototype_settings SET content=? WHERE id=?').bind(JSON.stringify({...stored,expiresAt:new Date(nearEnd).toISOString()}),contractKey).run();
const shortCode=await call('/api/chat/students',{method:'POST',user:'owner',data:{reference:enrol.data.enrolment.reference}});
assert.equal(shortCode.data.expiresAt,nearEnd);
const shortLogin=await call('/api/chat/session',{method:'POST',user:'',data:{code:shortCode.data.code}});assert.equal(shortLogin.status,200);
const cookie=shortLogin.r.headers.get('set-cookie').split(';')[0];
const session=await env.DB.prepare('SELECT expires_at FROM chat_sessions WHERE student_id=?').bind(shortCode.data.studentId).first();assert.equal(Number(session.expires_at),nearEnd);
await env.DB.prepare('UPDATE prototype_settings SET content=? WHERE id=?').bind(JSON.stringify({...stored,expiresAt:new Date(Date.now()-1).toISOString()}),contractKey).run();
assert.equal((await call('/api/chat/session',{user:'',cookie})).status,401);
await env.DB.prepare('UPDATE prototype_settings SET content=? WHERE id=?').bind(row.content,contractKey).run();
payments.get(contractId).refunded_money={amount:25000,currency:'GBP'};await webhook(contractId,{type:'refund.updated'});assert.equal((await call('payments')).data.contract.status,'refund_review');
assert.equal((await call('progress',{method:'PUT',data:{lessonId:config.lessons[0].id,completed:true}})).status,402);
// Verify calendar months clamp at month-end, never overflow into the following month.
const source=fs.readFileSync('server/square.js','utf8');const expiry=new Function(source+';return squareExpiry;')();
assert.equal(expiry('month','2027-01-31T12:00:00Z'),'2027-02-28T12:00:00.000Z');assert.equal(expiry('quarter','2026-11-30T12:00:00Z'),'2027-02-28T12:00:00.000Z');assert.equal(expiry('day','2026-09-30T12:00:00Z'),'2026-10-01T12:00:00.000Z');assert.equal(expiry('infinite',paidAt),null);
// Simultaneous first attempts reserve one record and reuse one Square idempotency key.
const simultaneous=await Promise.all([post('entry','advanced',{user:'concurrent'}),post('entry','advanced',{user:'concurrent'})]);assert.equal(simultaneous[0].status,200);assert.equal(simultaneous[0].data.url,simultaneous[1].data.url);assert.equal(creations,3);
// Embedded checkout: server amounts, idempotent retries, decline recovery and legacy safety.
const hostedFetch=env.SQUARE_FETCH,cardResults=new Map(),orderResults=new Map();let charges=0,dropResponse=false;
env.SQUARE_APPLICATION_ID='sandbox-app';
env.SQUARE_FETCH=async(url,options)=>{
 const path=new URL(url).pathname,body=options.body?JSON.parse(options.body):null;
 if(path==='/v2/orders'){
  if(!orderResults.has(body.idempotency_key)){const order={...body.order,id:'embedded-order-'+orderResults.size,tenders:[]};orderResults.set(body.idempotency_key,order);orders.set(order.id,order);}
  return Response.json({order:orderResults.get(body.idempotency_key)});
 }
 if(path==='/v2/payments'){
  if(body.source_id==='cnon:declined')return Response.json({errors:[{code:'CARD_DECLINED'}]},{status:400});
  if(!cardResults.has(body.idempotency_key)){
   charges++;const payment={id:'embedded-payment-'+charges,order_id:body.order_id,location_id:'location',amount_money:body.amount_money,total_money:body.amount_money,status:'COMPLETED',updated_at:new Date().toISOString()};
   payments.set(payment.id,payment);cardResults.set(body.idempotency_key,payment);orders.get(body.order_id).tenders=[{payment_id:payment.id}];
  }
  if(dropResponse){dropResponse=false;throw Error('Simulated lost network response');}
  return Response.json({payment:cardResults.get(body.idempotency_key)});
 }
 return hostedFetch(url,options);
};
const embedded=(route,user,data={})=>call('payments/'+route,{method:'POST',user,data:{stage:'entry',planId:'basic',revision:0,...data}});
assert.equal((await embedded('prepare','card-user',{extra:'ignored'})).status,200);
assert.equal((await embedded('charge','card-user',{attemptId:crypto.randomUUID(),sourceId:'CASH'})).status,400);
const cardBody={attemptId:crypto.randomUUID(),sourceId:'cnon:valid',amount:1};
const charged=await embedded('charge','card-user',cardBody);assert.equal(charged.data.paid,true,JSON.stringify(charged));assert.equal(charged.data.payment.plan.amount,8500);
assert.equal((await embedded('charge','card-user',cardBody)).data.paid,true);assert.equal(charges,1);
const savedRow=await env.DB.prepare('SELECT content FROM prototype_settings WHERE id=?').bind(orders.get('embedded-order-0').reference_id).first();assert.ok(!savedRow.content.includes('cnon:valid'));
const declineBody={attemptId:crypto.randomUUID(),sourceId:'cnon:declined'};
assert.equal((await embedded('charge','decline-user',declineBody)).data.retryCard,true);
assert.equal((await embedded('charge','decline-user',declineBody)).status,402);
assert.equal((await embedded('charge','decline-user',{attemptId:crypto.randomUUID(),sourceId:'cnon:valid'})).data.paid,true);
dropResponse=true;const uncertain={attemptId:crypto.randomUUID(),sourceId:'cnon:valid'};
assert.equal((await embedded('charge','timeout-user',uncertain)).data.retrySame,true);
assert.equal((await embedded('charge','timeout-user',uncertain)).data.paid,true);assert.equal(charges,3);
assert.equal((await embedded('prepare','concurrent',{planId:'advanced'})).status,409);
assert.equal((await embedded('prepare','no-entry',{stage:'contract',planId:'month'})).status,409);
assert.equal((await embedded('prepare','card-user',{planId:'advanced'})).status,409);
const countBefore=charges;const race=await Promise.all([embedded('charge','card-race',{attemptId:crypto.randomUUID(),sourceId:'cnon:valid'}),embedded('charge','card-race',{attemptId:crypto.randomUUID(),sourceId:'cnon:valid'})]);
assert.ok(race.some(x=>x.data.paid));assert.equal(charges,countBefore+1);
console.log('Embedded checks passed: charged once, server prices, token removal, decline recovery, unknown-response recovery, legacy protection, contract gating and concurrent attempts.');
await sql.close();console.log('Square checks passed: server prices, duplicate checkout, stage gates, isolated users/environments, webhook signatures, amount checks, reconciliation, refunds, admin visibility and calendar expiry.');
