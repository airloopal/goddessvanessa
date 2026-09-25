const emailReady=env=>!!env.RESEND_API_KEY&&typeof env.EMAIL_FROM==='string'&&env.EMAIL_FROM.length<300&&!/[\r\n]/.test(env.EMAIL_FROM)&&/[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/.test(env.EMAIL_FROM);
async function sendAccessEmail(env,{email,name,code,origin}){
 if(!emailReady(env))return {emailSent:false,emailStatus:'not_configured'};
 try{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'student-access-'+await chatHash(code)},body:JSON.stringify({from:env.EMAIL_FROM,to:[email],subject:'Your private learning access code',text:'Hello '+name+',\n\nYour access code is:\n\n'+code+'\n\nOpen '+origin+'/access.html and paste this code. It can be used once and expires in 24 hours.\n\nKeep this code private. If you did not request access, you can ignore this email.\n\nVanessa Academy'}),signal:AbortSignal.timeout(10000)});if(!response.ok){console.error('access_email_failed',response.status);return {emailSent:false,emailStatus:'failed'};}const result=await response.json();if(!result.id)return {emailSent:false,emailStatus:'failed'};return {emailSent:true,emailStatus:'accepted'};}catch{console.error('access_email_unavailable');return {emailSent:false,emailStatus:'failed'};}
}
async function requestAccessEmail(request,env,url,body){
 if(!emailReady(env))return json({error:'Automatic email delivery is not enabled yet. Ask your administrator for an access code.'},503);
 if(typeof body.email!=='string'||body.email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()))return json({error:'Enter your email address.'},400);
 const ip=request.headers.get('cf-connecting-ip')||'unknown';if(!await chatLimit(env,'code-email-ip:'+await chatHash(ip),5,3600000))return json({error:'Too many requests. Please try again in an hour.'},429);
 const email=body.email.trim().toLowerCase(),reply={message:'If an active student account matches this address, a code will arrive shortly. Check your spam folder or contact your administrator.'};
 if(!await chatLimit(env,'code-email:'+await chatHash(email),1,60000))return json(reply);
 const records=await db(env).prepare("SELECT id,name,email FROM chat_students WHERE lower(email)=? AND status='active' LIMIT 2").bind(email).all();if(records.results.length!==1)return json(reply);
 const student=records.results[0],code=chatToken();await db(env).prepare("UPDATE chat_students SET code_hash=?,code_expires=? WHERE id=? AND status='active'").bind(await chatHash(code),Date.now()+86400000,student.id).run();
 // Existing sessions stay valid until the emailed code is redeemed.
 await sendAccessEmail(env,{...student,code,origin:url.origin});return json(reply);
}
async function provisionStudent(env,{user,name,email,origin}){
 const previous=await db(env).prepare('SELECT id FROM chat_students WHERE user_id=?').bind(user).first();if(previous)return {created:false};
 const code=chatToken(),id=crypto.randomUUID(),now=Date.now();const inserted=await db(env).prepare("INSERT INTO chat_students (id,user_id,name,email,status,code_hash,code_expires,created_at) VALUES (?,?,?,?,'active',?,?,?) ON CONFLICT(user_id) DO NOTHING").bind(id,user,name,email,await chatHash(code),now+86400000,now).run();
 if(!inserted.meta?.changes)return {created:false};return {created:true,...await sendAccessEmail(env,{name,email,code,origin})};
}
