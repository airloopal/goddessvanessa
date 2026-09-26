import assert from 'node:assert/strict';
import {authContext,authAPI} from '../server/platform/auth.js';
const env={SUPABASE_URL:'https://hlmlqdkcwchmzxbcvrtp.supabase.co',SUPABASE_PUBLISHABLE_KEY:'test-publishable'},originalFetch=globalThis.fetch;
let payload;
globalThis.fetch=async(url,init)=>{assert.match(String(url),/\/auth\/v1\/otp/);payload=JSON.parse(init.body);return new Response('{}',{headers:{'Content-Type':'application/json'}});};
try{
 const request=new Request('https://academy.test/api/auth/email',{method:'POST',headers:{origin:'https://academy.test','Content-Type':'application/json'},body:JSON.stringify({email:'owner@example.test',returnTo:'/dashboard.html'})});
 const context=authContext(request,env),response=context.apply(await authAPI(request,context,env));assert.equal(response.status,200);assert.equal(payload.email,'owner@example.test');assert.equal(payload.code_challenge_method,'s256');assert.ok(payload.code_challenge);
 const cookies=response.headers.getSetCookie();assert.ok(cookies.some(c=>c.includes('code-verifier')));for(const cookie of cookies){assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/);}
 assert.match(response.headers.get('cache-control'),/no-store/);
 const denied=await authAPI(new Request('https://academy.test/api/auth/email',{method:'POST',headers:{origin:'https://other.test'},body:'{}'}),context,env);assert.equal(denied.status,403);
 const missing=await authAPI(new Request('https://academy.test/api/auth/callback'),context,env);assert.equal(missing.status,303);assert.match(missing.headers.get('location'),/signin.html\?error=link/);
}finally{globalThis.fetch=originalFetch;}
console.log('Supabase email sign-in checks passed: actual SDK PKCE challenge, secure verifier cookies, origin checks and invalid callback handling. No real email sent.');
