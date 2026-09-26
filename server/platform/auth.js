import {createServerClient} from '@supabase/ssr';
export const safeReturn=value=>typeof value==='string'&&/^\/(?!\/)/.test(value)&&!/[\\\r\n]/.test(value)?value:'/dashboard.html';
export function authContext(request,env){
 const changes=new Map(),cookies=new Map((request.headers.get('cookie')||'').split(';').flatMap(s=>{const i=s.indexOf('=');if(i<0)return [];try{return [[s.slice(0,i).trim(),decodeURIComponent(s.slice(i+1))]];}catch{return [];}}));
 const client=createServerClient(env.SUPABASE_URL,env.SUPABASE_PUBLISHABLE_KEY||env.NEXT_PUBLIC_SUPABASE_ANON_KEY||env.SUPABASE_ANON_KEY,{cookieOptions:{httpOnly:true,secure:true,sameSite:'lax',path:'/'},cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:values=>{for(const c of values){cookies.set(c.name,c.value);changes.set(c.name,c);}}}});
 const apply=response=>{const out=new Response(response.body,{status:response.status,headers:response.headers});for(const {name,value,options={}} of changes.values()){let c=name+'='+encodeURIComponent(value)+'; Path=/; HttpOnly; Secure; SameSite=Lax';if(options.maxAge!==undefined)c+='; Max-Age='+Math.floor(options.maxAge);out.headers.append('Set-Cookie',c);}if(changes.size)out.headers.set('Cache-Control','private, no-store');return out;};
 return {client,apply};
}
// Client-supplied identity and proxy headers are never trusted on the new host.
export async function verifiedRequest(request,client,env={}){
 const headers=new Headers(request.headers);headers.delete('oai-authenticated-user-id');headers.delete('oai-authenticated-user-email');headers.delete('cf-connecting-ip');
 const {data:{user},error}=await client.auth.getUser();
 if(!error&&user?.email_confirmed_at&&user.email?.toLowerCase()==='danielvernontp@gmail.com'){headers.set('oai-authenticated-user-id',user.id);headers.set('oai-authenticated-user-email',user.email||'');}
 // Vercel overwrites this header at its edge. Never trust it on another host.
 if(env.VERCEL==='1'){const ip=request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for');if(ip)headers.set('cf-connecting-ip',ip);}
 return new Request(request,{headers});
}
export async function authAPI(request,context,env){
 const url=new URL(request.url),path=url.pathname;
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
 if(path==='/api/auth/callback'&&request.method==='GET'){
  const code=url.searchParams.get('code');if(!code)return Response.redirect(url.origin+'/signin.html?error=link',303);
  const {error}=await context.client.auth.exchangeCodeForSession(code);
  return Response.redirect(url.origin+(error?'/signin.html?error=link':safeReturn(url.searchParams.get('return_to'))),303);
 }
 if(request.method!=='POST')return reply({error:'Method not allowed.'},405);
 if(request.headers.get('origin')!==url.origin)return reply({error:'Request origin rejected.'},403);
 if(path==='/api/auth/logout'){await context.client.auth.signOut({scope:'local'});return reply({ok:true});}
 if(path!=='/api/auth/email')return reply({error:'Not found.'},404);
 let body;try{const raw=await request.text();if(raw.length>3000)throw Error();body=JSON.parse(raw);}catch{return reply({error:'Invalid request.'},400);}
 if(typeof body.email!=='string'||body.email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(body.email))return reply({error:'Enter a valid email address.'},400);
 const email=body.email.trim().toLowerCase();
 if(email!=='danielvernontp@gmail.com')return reply({error:'This sign-in is for Goddess. Students use the access code issued by Goddess Vanessa on Sub Access.'},403);
 if(env.DB){const ip=env.VERCEL==='1'?(request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'unknown'):'unknown';const hash=async value=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))).toString('hex');for(const [key,max,period] of [['auth-ip:'+await hash(ip),10,3600000],['auth-email:'+await hash(email),1,60000]]){const now=Date.now(),r=await env.DB.prepare('INSERT INTO chat_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN chat_limits.expires<=? THEN 1 ELSE chat_limits.count+1 END,expires=CASE WHEN chat_limits.expires<=? THEN excluded.expires ELSE chat_limits.expires END RETURNING count').bind(key,now+period,now,now).first();if(r.count>max)return reply({error:'Please wait before requesting another sign-in link.'},429);}}
 const {error}=await context.client.auth.signInWithOtp({email,options:{emailRedirectTo:url.origin+'/api/auth/callback?return_to='+encodeURIComponent(safeReturn(body.returnTo))}});
 if(error){const limited=error.code==='over_email_send_rate_limit'||error.status===429;const response=reply({error:limited?'Sign-in email sending is temporarily limited. Try later or configure the Goddess sign-in email provider.':'The sign-in email could not be sent. Contact Goddess.'},limited?429:503);response.headers.set('X-Platform-Issue',limited?'auth_email_limit':'auth_email_failed');return response;}
 return reply({ok:true,message:'Check your email and open the sign-in link in this browser.'});
}
