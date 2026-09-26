import worker from '../dist/server/index.js';
import {productionDatabase} from '../server/platform/database.js';
import {storage} from '../server/platform/storage.js';
import {authContext,verifiedRequest,authAPI} from '../server/platform/auth.js';
export async function handle(request,env=process.env,dependencies={}){
 const url=new URL(request.url);
 const route=url.searchParams.get('__path');if(route!==null){url.pathname='/api/'+route;url.searchParams.delete('__path');request=new Request(url,request);}
 let context;
 try{
  const DB=dependencies.DB||productionDatabase(env);
  const runtime={...env,DB,BUCKET:dependencies.BUCKET||storage(env),DIRECT_UPLOADS:true};
  if(url.pathname==='/api/health'){
   await DB.prepare('SELECT 1 FROM prototype_settings LIMIT 1').all();
   return new Response(JSON.stringify({ok:true,database:true,storage:!!runtime.BUCKET,email:!!(env.RESEND_API_KEY&&env.EMAIL_FROM)}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  }
  context=dependencies.auth||authContext(request,env);
  const response=url.pathname.startsWith('/api/auth/')?await authAPI(request,context,runtime):await worker.fetch(await verifiedRequest(request,context.client,env),runtime);
  return context.apply(response);
 }catch(error){
  console.error('platform_request_failed',error.code||error.name||'error');
  const response=new Response(JSON.stringify({error:'The service is temporarily unavailable. Please retry shortly.'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  return context?context.apply(response):response;
 }
}
export default {fetch(request){return handle(request);}};
