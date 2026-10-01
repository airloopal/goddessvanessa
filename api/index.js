import {verify,randomBytes} from 'node:crypto';
import {boundedText} from '../server/platform/request-body.js';
import {statusAPI,recordFailure} from '../server/platform/diagnostics.js';
import worker from '../dist/server/index.js';
import {productionDatabase} from '../server/platform/database.js';
import {storage} from '../server/platform/storage.js';
import {authContext,verifiedRequest,authAPI} from '../server/platform/auth.js';
const THRONE_KEY='-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAPXbUfxh7XL4SYUVcfhmYMIbxvtR9E9LDd8gPJ1PwSD8=\n-----END PUBLIC KEY-----';
const giftResponse=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store'}});
export async function throneWebhook(request,DB,options={}){
 if(request.method!=='POST')return giftResponse({error:'Method not allowed'},405);
 const timestamp=request.headers.get('x-signature-timestamp'),signature=request.headers.get('x-signature-ed25519');
 if(!/^\d{10,12}$/.test(timestamp||'')||Math.abs(Date.now()/1000-Number(timestamp))>300||!/^[a-f0-9]{128}$/i.test(signature||''))return giftResponse({error:'Invalid signature'},403);
 let raw;try{raw=await boundedText(request,16384);}catch{return giftResponse({error:'Request too large'},413);}
 if(!verify(null,Buffer.from(timestamp+'.'+raw),options.publicKey||THRONE_KEY,Buffer.from(signature,'hex')))return giftResponse({error:'Invalid signature'},403);
 let event;try{event=JSON.parse(raw);}catch{return giftResponse({error:'Invalid event'},400);}
 const d=event.data,types=['gift_purchased','contribution_purchased','gift_crowdfunded'];
 if(event.contract_version!=='1'||!types.includes(event.event_type)||!/^[a-f0-9-]{36}$/i.test(event.event_id||'')||!d||d.creator_id!=='BJk2DI5LvAPbA3keyUw2z0T6ooR2'||d.creator_username!=='vvannessa')return giftResponse({error:'Unexpected event'},400);
 const amount=event.event_type==='contribution_purchased'?d.amount:d.price;
 if(!Number.isSafeInteger(amount)||amount<0||! /^[A-Z]{3}$/.test(d.currency||'')||typeof d.item_name!=='string'||!d.item_name.trim()||d.item_name.length>300||typeof d.message!=='undefined'&&typeof d.message!=='string'||(d.message?.length||0)>4000)return giftResponse({error:'Invalid gift details'},400);
 const refs=[...new Set(d.message?.match(/\bGV-[A-F0-9]{24}\b/g)||[])];
 const ref=refs.length===1?refs[0]:null,key='throne-event:'+event.event_id,now=Date.now();
 const info={eventId:event.event_id,type:event.event_type,item:d.item_name,amount,currency:d.currency,receivedAt:now};
 const text='🎁 Throne confirmed '+(event.event_type==='contribution_purchased'?'your contribution to ':'your gift: ')+d.item_name+' · '+new Intl.NumberFormat('en-GB',{style:'currency',currency:d.currency}).format(amount/100)+'. Thank you!';
 const record=DB.prepare('INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(id) DO NOTHING').bind(key,JSON.stringify(info),new Date(now).toISOString());
 const message=DB.prepare("INSERT INTO chat_messages (id,student_id,sender,body,created_at) SELECT ?,s.id,'admin',?,? FROM prototype_settings r JOIN chat_students s ON s.id=r.content::jsonb->>'studentId' WHERE r.id LIKE 'throne-ref:%' AND r.content::jsonb->>'reference'=? AND (r.content::jsonb->>'expiresAt')::bigint>? AND s.status='active' ON CONFLICT(id) DO NOTHING").bind('throne-gift:'+event.event_id,text,now,ref,now);
 await DB.batch([record,message]);return giftResponse({received:true});
}
async function giftReference(request,runtime,context){
 if(request.method!=='POST')return giftResponse({error:'Method not allowed'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return giftResponse({error:'Origin rejected'},403);
 const sessionURL=new URL('/api/chat/session',request.url),sessionRequest=new Request(sessionURL,{headers:request.headers});
 const session=await worker.fetch(await verifiedRequest(sessionRequest,context.client,runtime),runtime);
 if(!session.ok)return giftResponse({error:'Sign in to your conversation first'},401);
 const {student}=await session.json(),now=Date.now(),id='throne-ref:'+student.id;
 const record=await runtime.DB.prepare('SELECT content FROM prototype_settings WHERE id=?').bind(id).first();
 if(record){const existing=JSON.parse(record.content);if(existing.expiresAt>now)return giftResponse({reference:existing.reference,expiresAt:existing.expiresAt});}
 const reference='GV-'+randomBytes(12).toString('hex').toUpperCase(),expiresAt=now+7*86400000;
 const row=await runtime.DB.prepare("INSERT INTO prototype_settings (id,content,revision,updated_at) VALUES (?,?,1,?) ON CONFLICT(id) DO UPDATE SET content=CASE WHEN (prototype_settings.content::jsonb->>'expiresAt')::bigint<=? THEN excluded.content ELSE prototype_settings.content END,revision=prototype_settings.revision+1,updated_at=excluded.updated_at RETURNING content").bind(id,JSON.stringify({studentId:student.id,reference,expiresAt}),new Date(now).toISOString(),now).first();
 const saved=JSON.parse(row.content);return giftResponse({reference:saved.reference,expiresAt:saved.expiresAt});
}

export async function handle(request,env=process.env,dependencies={}){
 const url=new URL(request.url);
 const route=url.searchParams.get('__path');if(route!==null){url.pathname='/api/'+route;url.searchParams.delete('__path');request=new Request(url,request);}
 let context,DB;const requestId=crypto.randomUUID();
 const finish=async response=>{const issue=response.headers.get('X-Platform-Issue');await recordFailure(DB,{path:url.pathname,status:response.status,requestId,issue});const out=new Response(response.body,{status:response.status,headers:response.headers});out.headers.set('X-Request-ID',requestId);out.headers.delete('X-Platform-Issue');return context?context.apply(out):out;};
 try{
  if(['/api/admin/status','/api/admin/changelog','/api/admin/overview'].includes(url.pathname)){context=dependencies.auth||authContext(request,{...env,...(dependencies.DB?{DB:dependencies.DB}:{})});const verified=await verifiedRequest(request,context.client,env);return context.apply(await statusAPI(verified,env,{database:()=>dependencies.DB||productionDatabase(env),storage:()=>dependencies.BUCKET||storage(env)}));}
  DB=dependencies.DB||productionDatabase(env);
  const runtime={...env,DB,BUCKET:dependencies.BUCKET||storage(env),DIRECT_UPLOADS:true};
  if(url.pathname==='/api/health'){
   await DB.prepare('SELECT 1 FROM prototype_settings LIMIT 1').all();
   return new Response(JSON.stringify({ok:true,database:true,storage:!!runtime.BUCKET,email:!!(env.RESEND_API_KEY&&env.EMAIL_FROM)}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  }
  if(url.pathname==='/api/throne/webhook')return await finish(await throneWebhook(request,DB));
  context=dependencies.auth||authContext(request,runtime);
  if(url.pathname==='/api/chat/gift-reference')return await finish(await giftReference(request,runtime,context));
  const response=url.pathname.startsWith('/api/auth/')?await authAPI(request,context,runtime):await worker.fetch(await verifiedRequest(request,context.client,env),runtime);
  return await finish(response);
 }catch(error){
  console.error('platform_request_failed',error.code||error.name||'error');
  const response=new Response(JSON.stringify({error:'The service is temporarily unavailable. Please retry shortly.'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  return await finish(response);
 }
}
export default {fetch(request){return handle(request);}};
