const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const db=env=>{if(!env.DB)throw Error('Progress database is unavailable');return env.DB;};
export default {async fetch(request,env){
 const url=new URL(request.url),pathname=url.pathname;
 if(pathname.startsWith('/api/feed/')){try{return await feedAPI(request,env,url);}catch{return json({error:'The feed is temporarily unavailable. Please retry.'},503);}}
 if(pathname==='/api/chat/ui-activity')return dashboardActivity(request,env,url);
 if(pathname.startsWith('/api/visual/')){
  if(!['/api/visual/published','/api/visual/draft'].includes(pathname))return json({error:'Not found'},404);
  const authenticatedUser=request.headers.get('oai-authenticated-user-id'),userId=authenticatedUser?'owner':null;
  if(!(request.method==='GET'&&pathname==='/api/visual/published')&&(!userId||request.headers.get('oai-authenticated-user-email')?.toLowerCase()!==EDITOR_OWNER_EMAIL))return json({error:'Sign in as Goddess to edit. Use /signin.html?return_to=%2Fstudio.html'},403);
  try{return await visualAPI(request,env,url,userId);}catch{return json({error:'Editor storage unavailable. Keep your edits open and retry.'},503);}
 }
 if(['/api/media/prepare','/api/media/complete'].includes(pathname)){try{return await directMediaAPI(request,env,url);}catch{return json({error:'File upload is temporarily unavailable. Please retry.'},503);}}
 if(pathname==='/api/media/upload'&&env.DIRECT_UPLOADS)return json({error:'Use the direct upload flow.'},410);
 if(pathname.startsWith('/api/media/')){try{return await mediaAPI(request,env,url);}catch(error){console.error('media_api_failed',error.message);return json({error:'File storage is temporarily unavailable. Please retry.'},503);}}
 if(pathname.startsWith('/api/chat/')){try{return await chatAPI(request,env,url);}catch(error){console.error('chat_api_failed',error.message);return json({error:'Chat is temporarily unavailable. Please retry.'},503);}}
 if(pathname.startsWith('/api/education/')){try{return await educationAPI(request,env,url);}catch(error){console.error('education_api_failed',error.name);await recordEducationFailure(env,pathname,error);return json({error:'The learning service is unavailable. Keep your work open and retry.'},503);}}
 if(pathname.startsWith('/api/'))return json({error:'This earlier prototype endpoint has been retired. Use the educational platform.'},410);
 const redirects={'/journey.html':'/application.html','/agreement.html':'/application.html','/copy-studio.html':'/studio.html','/walkthrough.html':'/application.html','/studio':'/studio.html'};
 if(redirects[pathname])return Response.redirect(url.origin+redirects[pathname],302);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const key=pathname==='/'?'/index.html':pathname==='/studio'?'/studio.html':pathname;const asset=ASSETS[key];
 if(!asset)return new Response('Page not found',{status:404,headers:{'Content-Type':'text/plain'}});
 const bytes=Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0));
 if(asset.type==='video/mp4'){
  const headers={'Content-Type':'video/mp4','Accept-Ranges':'bytes','Cache-Control':'no-cache','Content-Length':String(bytes.length)};
  const range=request.headers.get('range');
  if(range&&request.method==='GET'){
   const m=/^bytes=(\d*)-(\d*)$/.exec(range);let start=0,end=bytes.length-1;
   if(m&&(m[1]||m[2])){if(!m[1])start=Math.max(0,bytes.length-Number(m[2]));else{start=Number(m[1]);if(m[2])end=Math.min(end,Number(m[2]));}}
   else return new Response(null,{status:416,headers:{...headers,'Content-Range':'bytes */'+bytes.length,'Content-Length':'0'}});
   if(start>end||start>=bytes.length)return new Response(null,{status:416,headers:{...headers,'Content-Range':'bytes */'+bytes.length,'Content-Length':'0'}});
   return new Response(bytes.slice(start,end+1),{status:206,headers:{...headers,'Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':String(end-start+1)}});
  }
  return new Response(request.method==='HEAD'?null:bytes,{headers});
 }

 return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':(['/application.html','/feed.html'].includes(key)?"default-src 'self'; script-src 'self' 'sha256-vE3zJSE4rIbdigbE9q7hjjE23p9+O6190jJjXGZKgTU=' https://sandbox.web.squarecdn.com https://web.squarecdn.com; style-src 'self' 'unsafe-inline' https://sandbox.web.squarecdn.com https://web.squarecdn.com; font-src 'self' https://square-fonts-production-f.squarecdn.com https://d1g145x70srn7h.cloudfront.net; img-src 'self' data: https:; media-src 'self' https: blob:; frame-src 'self' https:; connect-src 'self' https://sandbox.web.squarecdn.com https://web.squarecdn.com https://pci-connect.squareupsandbox.com https://pci-connect.squareup.com https://o160250.ingest.sentry.io https://hlmlqdkcwchmzxbcvrtp.supabase.co; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self' https:; upgrade-insecure-requests":"default-src 'self'; script-src 'self' https://sandbox.web.squarecdn.com https://web.squarecdn.com; style-src 'self' 'unsafe-inline' https://sandbox.web.squarecdn.com https://web.squarecdn.com; font-src 'self' https://square-fonts-production-f.squarecdn.com https://d1g145x70srn7h.cloudfront.net; img-src 'self' data: https:; media-src 'self' https: blob:; frame-src 'self' https://sandbox.web.squarecdn.com https://web.squarecdn.com; connect-src 'self' https://sandbox.web.squarecdn.com https://web.squarecdn.com https://pci-connect.squareupsandbox.com https://pci-connect.squareup.com https://o160250.ingest.sentry.io https://hlmlqdkcwchmzxbcvrtp.supabase.co; object-src 'none'; base-uri 'self'; frame-ancestors 'self'")}});
}};
