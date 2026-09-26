import {statusAPI,recordFailure} from '../server/platform/diagnostics.js';
import worker from '../dist/server/index.js';
import {productionDatabase} from '../server/platform/database.js';
import {storage} from '../server/platform/storage.js';
import {authContext,verifiedRequest,authAPI} from '../server/platform/auth.js';
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
  context=dependencies.auth||authContext(request,runtime);
  const response=url.pathname.startsWith('/api/auth/')?await authAPI(request,context,runtime):await worker.fetch(await verifiedRequest(request,context.client,env),runtime);
  return await finish(response);
 }catch(error){
  console.error('platform_request_failed',error.code||error.name||'error');
  const response=new Response(JSON.stringify({error:'The service is temporarily unavailable. Please retry shortly.'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  return await finish(response);
 }
}
export default {fetch(request){return handle(request);}};
