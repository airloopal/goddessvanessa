import {randomBytes,randomUUID,createHash,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {staffEnvironment} from './staff-environment.js';
import {staffChatMedia} from './staff-chat-media.js';
import {promisify} from 'node:util';
import {boundedText} from './request-body.js';
import {mediaType,streamPrivateStatus,streamPlaybackHost} from '../../dist/server/index.js';

// Staff never acquire Goddess headers or access the owner APIs.
const scrypt=promisify(scryptCallback),cookieName='__Host-vanessa_staff',ttl=8*3600000;
const hash=value=>createHash('sha256').update(value).digest('hex');
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const key=(type,id)=>'staff-'+type+':'+id;
const stamp=()=>new Date().toISOString();
const safeAccount=(row)=>{const c=JSON.parse(row.content);return {id:c.id,name:c.name,email:c.email,role:c.role,status:c.status,revision:row.revision,createdAt:c.createdAt};};
const read=async(DB,id)=>{const r=await DB.prepare('SELECT content,revision,updated_at FROM prototype_settings WHERE id=?').bind(id).first();return r?{...JSON.parse(r.content),revision:r.revision,updatedAt:r.updated_at}:null;};
const insert=(DB,id,value)=>DB.prepare('INSERT INTO prototype_settings(id,content,revision,updated_at) VALUES(?,?,1,?) ON CONFLICT(id) DO NOTHING RETURNING id').bind(id,JSON.stringify(value),stamp());
const update=(DB,id,value,revision)=>DB.prepare('UPDATE prototype_settings SET content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? RETURNING id').bind(JSON.stringify(value),stamp(),id,revision);
async function passwordRecord(password){const salt=randomBytes(24).toString('hex');return {salt,hash:(await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024})).toString('hex')};}
async function matches(password,record){const good=/^[a-f0-9]{128}$/.test(record?.hash||'')&&/^[a-f0-9]{48}$/.test(record?.salt||'');const value=await scrypt(password,good?record.salt:'0'.repeat(48),64,{N:32768,r:8,p:1,maxmem:64*1024*1024});return good&&timingSafeEqual(value,Buffer.from(record.hash,'hex'));}
function cookie(value,age){return cookieName+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+age;}
function token(request){return (request.headers.get('cookie')||'').match(/(?:^|;\s*)__Host-vanessa_staff=([a-f0-9]{64})(?:;|$)/)?.[1];}
async function limit(DB,name,max,period=900000){const now=Date.now();const row=await DB.prepare('INSERT INTO chat_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN chat_limits.expires<=? THEN 1 ELSE chat_limits.count+1 END,expires=CASE WHEN chat_limits.expires<=? THEN excluded.expires ELSE chat_limits.expires END RETURNING count').bind('staff:'+name,now+period,now,now).first();if(row.count>max)throw fail('Too many requests. Please wait before trying again.',429);}
async function actor(request,DB,context,environment){const {data:{user}}=await context.client.auth.getUser();if(user?.email_confirmed_at&&user.email?.toLowerCase()==='danielvernontp@gmail.com')return {id:'goddess',name:'Goddess Vanessa',role:'goddess',owner:true};const raw=token(request);if(!raw)return null;const session=await read(DB,key('session',hash(raw)));if(!session||session.expires<=Date.now()||(environment==='live'?session.environment!=='live':session.environment&&session.environment!==environment))return null;const account=await read(DB,key('account',session.staffId));if(!account||!uuid(account.id)||!['chatter','social'].includes(account.role)||account.status!=='active'||account.revision!==session.accountRevision)return null;return {id:account.id,name:account.name,role:account.role,owner:false,revision:account.revision,forceChange:account.forceChange===true,expires:session.expires,sessionKey:key('session',hash(raw))};}
function requireRole(a,...roles){if(!roles.includes(a.role))throw fail('This action is not available to your role.',403);}
async function assigned(DB,a,id){if(!uuid(id))throw fail('Choose a conversation.');const row=await DB.prepare('SELECT id,name,status FROM chat_students WHERE id=?').bind(id).first();if(!row)throw fail('Conversation unavailable.',404);const assignment=await read(DB,key('assignment',id));if(!a.owner&&assignment?.staffId!==a.id)throw fail('Conversation unavailable.',404);return {student:row,assignment};}
function cleanRecord(value){const result={...value};delete result.revision;delete result.updatedAt;return result;}
function permitted(DB,a){return a.owner?'TRUE':"EXISTS(SELECT 1 FROM prototype_settings WHERE id='staff-account:"+a.id+"' AND revision="+a.revision+" AND content::jsonb->>'status'='active') AND EXISTS(SELECT 1 FROM prototype_settings WHERE id='"+a.sessionKey+"' AND (content::jsonb->>'expires')::bigint>(extract(epoch from clock_timestamp())*1000)::bigint)";}
// IDs and revision in this server-only predicate are generated/stored by the server, never request fields.
async function save(DB,a,id,value,revision,scope={}){
 const assignmentGuard=!a.owner&&scope.studentId?" AND EXISTS(SELECT 1 FROM prototype_settings WHERE id=? AND content::jsonb->>'staffId'=? AND revision=?)":'';
 const guardArgs=assignmentGuard?[key('assignment',scope.studentId),a.id,scope.assignmentRevision]:[];
 const changed=revision===0?'INSERT INTO prototype_settings(id,content,revision,updated_at) SELECT ?,?,1,? WHERE '+permitted(DB,a)+assignmentGuard+' ON CONFLICT(id) DO NOTHING RETURNING id':'UPDATE prototype_settings SET content=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND '+permitted(DB,a)+assignmentGuard+' RETURNING id';
 const args=revision===0?[id,JSON.stringify(value),stamp(),...guardArgs]:[JSON.stringify(value),stamp(),id,revision,...guardArgs];
 const statement=DB.prepare('WITH changed AS ('+changed+') INSERT INTO prototype_settings(id,content,revision,updated_at) SELECT ?,?,1,? FROM changed RETURNING id').bind(...args,key('audit',randomUUID()),JSON.stringify({actorId:a.id,actorName:a.name,action:'saved',subject:id,at:Date.now()}),stamp());
 const locks=a.owner?[]:[DB.prepare('SELECT id FROM prototype_settings WHERE id=? FOR UPDATE').bind(key('account',a.id)),DB.prepare('SELECT id FROM prototype_settings WHERE id=? FOR UPDATE').bind(a.sessionKey)];if(assignmentGuard)locks.push(DB.prepare('SELECT id FROM prototype_settings WHERE id=? FOR UPDATE').bind(key('assignment',scope.studentId)));
 const result=await DB.batch([...locks,statement]);if(!result.at(-1).meta.changes)throw fail('This item changed or your access ended. Refresh before saving again.',409);
}

export async function staffAPI(request,env,context){
 const environment=staffEnvironment(env);if(!environment)return json({error:'Not found.'},404);
 const DB=env.DB,url=new URL(request.url),path=url.pathname.slice('/api/staff/'.length),method=request.method;
 try{
  let body={};if(!['GET','HEAD'].includes(method)){if(request.headers.get('origin')!==url.origin)throw fail('Request origin rejected.',403);if(!request.headers.get('content-type')?.startsWith('application/json'))throw fail('JSON required.',415);try{body=JSON.parse(await boundedText(request,24000));}catch(e){throw fail(e.status===413?'Request too large.':'Invalid request.',e.status===413?413:400);}if(!body||typeof body!=='object'||Array.isArray(body))throw fail('Invalid request.');}
  if(path==='login'&&method==='POST'){
   const ip=env.VERCEL==='1'?(request.headers.get('x-vercel-forwarded-for')||request.headers.get('x-forwarded-for')||'unknown'):'local';await limit(DB,'login-ip:'+hash(ip),5);await limit(DB,'login-global',30);
   if(typeof body.email!=='string'||body.email.length>254||typeof body.password!=='string'||body.password.length>64)throw fail('Email or password is incorrect.',401);
   const row=await DB.prepare("SELECT content,revision FROM prototype_settings WHERE id LIKE 'staff-account:%' AND content::jsonb->>'email'=? LIMIT 1").bind(body.email.trim().toLowerCase()).first();const account=row?JSON.parse(row.content):null;
   if(!await matches(body.password,account)||account.status!=='active')throw fail('Email or password is incorrect.',401);
   const raw=randomBytes(32).toString('hex');await insert(DB,key('session',hash(raw)),{staffId:account.id,accountRevision:row.revision,expires:Date.now()+ttl,environment}).run();
   await DB.prepare("DELETE FROM prototype_settings WHERE id LIKE 'staff-session:%' AND updated_at<?").bind(new Date(Date.now()-ttl).toISOString()).run();
   const r=json({ok:true});r.headers.set('Set-Cookie',cookie(raw,ttl/1000));return r;
  }
  if(path==='logout'&&method==='POST'){const raw=token(request);if(raw)await DB.prepare('DELETE FROM prototype_settings WHERE id=?').bind(key('session',hash(raw))).run();const r=json({ok:true});r.headers.set('Set-Cookie',cookie('',0));return r;}
  const a=await actor(request,DB,context,environment);if(!a)throw fail('Sign in to your staff account.',401);
  if(path==='session'&&method==='GET')return json({user:{id:a.id,name:a.name,role:a.role,forceChange:!!a.forceChange}});
  if(path==='password'&&method==='POST'){
   if(a.owner)throw fail('Use Goddess account settings.',403);await limit(DB,'password:'+a.id,5);
   if(typeof body.currentPassword!=='string'||body.currentPassword.length>64||!text(body.password,64)||body.password.length<12||body.password===body.currentPassword)throw fail('Choose a different password of 12–64 characters.');const old=await read(DB,key('account',a.id));if(!await matches(body.currentPassword,old))throw fail('Current password is incorrect.',401);
   await save(DB,a,key('account',a.id),{...cleanRecord(old),...await passwordRecord(body.password),forceChange:false},a.revision);const r=json({ok:true,message:'Password changed. Sign in again.'});r.headers.set('Set-Cookie',cookie('',0));return r;
  }
  if(a.forceChange)throw fail('Change your temporary password before continuing.',403);
  if(!['GET','HEAD'].includes(method))await limit(DB,'write:'+a.id,90,60000);
  if(path.startsWith('chat-media/'))return await staffChatMedia(request,env,a,body,{assigned,permitted,limit});
  if(path==='team'){
   requireRole(a,'goddess');
   if(method==='GET'){const rows=await DB.prepare("SELECT content,revision FROM prototype_settings WHERE id LIKE 'staff-account:%' ORDER BY updated_at DESC LIMIT 100").all();return json({team:rows.results.map(safeAccount)});}
   if(method==='POST'){
    if(!text(body.name,80)||typeof body.email!=='string'||body.email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)||!['chatter','social'].includes(body.role))throw fail('Enter a name, valid email and staff role.');const email=body.email.trim().toLowerCase();const id=randomUUID(),password=randomBytes(18).toString('base64url'),account={id,name:body.name.trim(),email,role:body.role,status:'active',forceChange:true,createdAt:Date.now(),...await passwordRecord(password)};
    const result=await DB.batch([DB.prepare('SELECT pg_advisory_xact_lock(hashtextextended(?::text,0))').bind('staff-team-accounts'),DB.prepare("WITH created AS (INSERT INTO prototype_settings(id,content,revision,updated_at) SELECT ?,?,1,? WHERE NOT EXISTS(SELECT 1 FROM prototype_settings WHERE id LIKE 'staff-account:%' AND content::jsonb->>'email'=?) AND (SELECT COUNT(*) FROM prototype_settings WHERE id LIKE 'staff-account:%')<20 RETURNING id) INSERT INTO prototype_settings(id,content,revision,updated_at) SELECT ?,?,1,? FROM created RETURNING id").bind(key('account',id),JSON.stringify(account),stamp(),email,key('audit',randomUUID()),JSON.stringify({actorId:a.id,actorName:a.name,action:'account-created',subject:id,at:Date.now()}),stamp())]);if(!result[1].meta.changes)throw fail('That email already has an account, or the 20-account limit has been reached.',409);return json({id,temporaryPassword:password},201);
   }
   if(method==='PATCH'){
    if(!uuid(body.id)||!['disable','enable','reset'].includes(body.action)||!Number.isSafeInteger(body.revision))throw fail('Choose an account action.');const old=await read(DB,key('account',body.id));if(!old)throw fail('Account unavailable.',404);const password=body.action==='reset'?randomBytes(18).toString('base64url'):null;const next={...cleanRecord(old),...(password?{...await passwordRecord(password),forceChange:true}:{status:body.action==='disable'?'disabled':'active'})};await save(DB,a,key('account',body.id),next,body.revision);return json({ok:true,...(password?{temporaryPassword:password}:{})});
   }
  }
  if(path==='assignments'){
   requireRole(a,'goddess');
   if(method==='GET'){const rows=await DB.prepare("SELECT s.id,s.name,s.status,p.content,p.revision FROM chat_students s LEFT JOIN prototype_settings p ON p.id='staff-assignment:'||s.id ORDER BY s.name LIMIT 1000").all();return json({assignments:rows.results.map(r=>({studentId:r.id,name:r.name,status:r.status,staffId:r.content?JSON.parse(r.content).staffId:null,revision:r.revision||0}))});}
   if(method==='PUT'){
    if(!uuid(body.studentId)||body.staffId!==null&&!uuid(body.staffId)||!Number.isSafeInteger(body.revision)||body.revision<0)throw fail('Choose an assignment.');if(!await DB.prepare('SELECT id FROM chat_students WHERE id=?').bind(body.studentId).first())throw fail('Conversation unavailable.',404);
    if(body.staffId){const staff=await read(DB,key('account',body.staffId));if(!staff||staff.role!=='chatter'||staff.status!=='active')throw fail('Choose an active chatter.');}
    await save(DB,a,key('assignment',body.studentId),{studentId:body.studentId,staffId:body.staffId,assignedAt:Date.now()},body.revision);return json({ok:true});
   }
  }
  if(path==='chats'&&method==='GET'){
   requireRole(a,'goddess','chatter');const rows=await DB.prepare("SELECT s.id,s.name,s.status,p.content,p.revision,(SELECT MAX(seq) FROM chat_messages WHERE student_id=s.id) AS last_seq,(SELECT MAX(created_at) FROM chat_messages WHERE student_id=s.id) AS last_at FROM chat_students s LEFT JOIN prototype_settings p ON p.id='staff-assignment:'||s.id WHERE (?::boolean OR p.content::jsonb->>'staffId'=?) ORDER BY last_seq DESC NULLS LAST,s.name LIMIT 1000").bind(a.owner,a.id).all();return json({chats:rows.results.map(({content,...r})=>({...r,staffId:content?JSON.parse(content).staffId:null}))});
  }
  if(['thread','message','notes','state'].includes(path)){
   requireRole(a,'goddess','chatter');const id=method==='GET'?url.searchParams.get('student'):body.studentId;const {student,assignment}=await assigned(DB,a,id);
   if(path==='thread'&&method==='GET'){
    const before=url.searchParams.get('before')===null?Number.MAX_SAFE_INTEGER:Number(url.searchParams.get('before'));if(!Number.isSafeInteger(before)||before<1)throw fail('Invalid message cursor.');const rows=await DB.prepare("SELECT m.seq,m.id,m.sender,m.body,m.attachment_id,m.created_at,n.content AS author FROM chat_messages m LEFT JOIN prototype_settings n ON n.id='staff-message:'||m.id WHERE m.student_id=? AND m.seq<? ORDER BY m.seq DESC LIMIT 100").bind(id,before).all();const messages=[];
    const albumKeys=rows.results.map(r=>'chat-album:'+r.id),albumRows=albumKeys.length?await DB.prepare('SELECT id,content FROM prototype_settings WHERE id IN ('+albumKeys.map(()=>'?').join(',')+')').bind(...albumKeys).all():{results:[]};const albums=new Map(albumRows.results.map(r=>[r.id.slice(11),JSON.parse(r.content)]));
    const attachmentIds=row=>{const album=albums.get(row.id);return album?.role===row.sender&&Array.isArray(album.attachmentIds)?album.attachmentIds.slice(0,6).filter(uuid):row.attachment_id?[row.attachment_id]:[];};const allIds=[...new Set(rows.results.flatMap(attachmentIds))];
    const files=allIds.length?await DB.prepare("SELECT id,mime,role,storage_key FROM media_files WHERE student_id=? AND scope='chat' AND id IN ("+allIds.map(()=>'?').join(',')+")").bind(id,...allIds).all():{results:[]};const fileMap=new Map(files.results.map(f=>[f.id,f]));
    for(const row of rows.results){const attachments=attachmentIds(row).map(fid=>fileMap.get(fid)).filter(f=>f&&f.role===row.sender).map(f=>({id:f.id,mime:f.mime,stream:f.storage_key.startsWith('cloudflare-stream/'),url:'/api/staff/media/'+f.id}));messages.push({seq:row.seq,id:row.id,from:row.sender,text:row.attachment_id?(albums.has(row.id)?row.body:''):row.body,at:row.created_at,staffName:row.author?JSON.parse(row.author).name:null,files:attachments});}
    return json({student,assignmentRevision:assignment?.revision||0,messages:messages.reverse(),hasMore:rows.results.length===100});
   }
   if(path==='message'&&method==='POST'){
    if(!text(body.text,1000)||!uuid(body.id)||!Number.isSafeInteger(body.assignmentRevision))throw fail('Write a message of up to 1,000 characters.');
    // Staff cannot introduce clickable destinations, payment claims or a forged sender role.
    if(/https?:\/\/|www\.|\b[a-z0-9-]+\.[a-z]{2,}(?:\/|\b)/i.test(body.text))throw fail('Staff replies use plain text. Ask Goddess to share links.');
    await limit(DB,'send:'+a.id,60,60000);
    const condition=a.owner?'TRUE':"p.content::jsonb->>'staffId'=? AND p.revision=?";const args=a.owner?[]:[a.id,body.assignmentRevision];
    const accountLock=a.owner?[]:[DB.prepare('SELECT id FROM prototype_settings WHERE id=? FOR UPDATE').bind(key('account',a.id)),DB.prepare('SELECT id FROM prototype_settings WHERE id=? FOR UPDATE').bind(a.sessionKey)];
    const result=await DB.batch([...accountLock,DB.prepare('SELECT id FROM prototype_settings WHERE id=? FOR UPDATE').bind(key('assignment',id)),DB.prepare("WITH sent AS (INSERT INTO chat_messages(id,student_id,sender,body,created_at) SELECT ?,s.id,'admin',?,? FROM chat_students s LEFT JOIN prototype_settings p ON p.id='staff-assignment:'||s.id WHERE s.id=? AND s.status='active' AND "+condition+" AND "+permitted(DB,a)+" AND NOT EXISTS(SELECT 1 FROM prototype_settings c WHERE c.id='chat-control:'||s.id AND c.content::jsonb->>'enabled'='false') ON CONFLICT(id) DO NOTHING RETURNING id) INSERT INTO prototype_settings(id,content,revision,updated_at) SELECT ?,?,1,? FROM sent RETURNING id").bind(body.id,body.text.trim(),Date.now(),id,...args,key('message',body.id),JSON.stringify({staffId:a.id,name:a.name,studentId:id}),stamp())]);
    if(!result.at(-1).meta.changes){const previous=await read(DB,key('message',body.id));const sent=await DB.prepare('SELECT body FROM chat_messages WHERE id=? AND student_id=?').bind(body.id,id).first();if(previous?.staffId!==a.id||previous?.studentId!==id||sent?.body!==body.text.trim())throw fail('Conversation changed, is paused, or this message identifier was already used. Refresh before sending.',409);}
    return json({ok:true});
   }
   if(path==='state'&&method==='PUT'){
    if(!Number.isSafeInteger(body.readSeq)||body.readSeq<0)throw fail('Invalid read position.');
    const latest=await DB.prepare('SELECT COALESCE(MAX(seq),0) AS seq FROM chat_messages WHERE student_id=?').bind(id).first();const readSeq=Math.min(body.readSeq,latest.seq),guard=a.owner?'TRUE':"EXISTS(SELECT 1 FROM prototype_settings WHERE id=? AND content::jsonb->>'staffId'=?)",args=a.owner?[]:[key('assignment',id),a.id];
    await DB.batch([...(a.owner?[]:[DB.prepare('SELECT id FROM prototype_settings WHERE id=? FOR UPDATE').bind(key('account',a.id)),DB.prepare('SELECT id FROM prototype_settings WHERE id=? FOR UPDATE').bind(a.sessionKey)]),DB.prepare('SELECT id FROM prototype_settings WHERE id=? FOR UPDATE').bind(key('assignment',id)),DB.prepare("INSERT INTO chat_state(student_id,role,typing_until,read_seq) SELECT ?,'admin',0,? WHERE "+guard+' AND '+permitted(DB,a)+" ON CONFLICT(student_id,role) DO UPDATE SET read_seq=GREATEST(chat_state.read_seq,excluded.read_seq)").bind(id,readSeq,...args)]);return json({ok:true});
   }
   if(path==='notes'){
    const k=key('notes',id);if(method==='GET')return json({note:await read(DB,k)||{text:'',revision:0}});
    if(method==='PUT'){if(typeof body.text!=='string'||body.text.length>4000||!Number.isSafeInteger(body.revision)||body.revision<0)throw fail('Use up to 4,000 characters.');await save(DB,a,k,{text:body.text,studentId:id,by:a.name},body.revision,{studentId:id,assignmentRevision:assignment?.revision});return json({ok:true});}
   }
  }
  if(path==='tickets'){
   if(method==='GET'){const rows=await DB.prepare("SELECT content,revision,updated_at FROM prototype_settings WHERE id LIKE 'staff-ticket:%' AND (?::boolean OR content::jsonb->>'createdBy'=?) ORDER BY updated_at DESC LIMIT 100").bind(a.owner,a.id).all();return json({tickets:rows.results.map(r=>({...JSON.parse(r.content),revision:r.revision,updatedAt:r.updated_at}))});}
   if(method==='POST'){if(!uuid(body.id)||!['support','bug'].includes(body.kind)||!text(body.title,140)||!text(body.text,4000)||body.studentId!==undefined&&body.studentId!==null&&!uuid(body.studentId))throw fail('Enter a title and description.');if(body.studentId)await assigned(DB,a,body.studentId);await limit(DB,'ticket:'+a.id,20,3600000);await save(DB,a,key('ticket',body.id),{id:body.id,kind:body.kind,title:body.title.trim(),createdBy:a.id,createdByName:a.name,status:'open',studentId:body.studentId||null,messages:[{by:a.id,name:a.name,text:body.text.trim(),at:Date.now()}]},0);return json({ok:true},201);}
   if(method==='PATCH'){if(!uuid(body.id)||!Number.isSafeInteger(body.revision))throw fail('Choose a support thread.');const old=await read(DB,key('ticket',body.id));if(!old||!a.owner&&old.createdBy!==a.id)throw fail('Support thread unavailable.',404);if(body.status!==undefined&&!a.owner)throw fail('Only Goddess can change the status.',403);if(body.status!==undefined&&!['open','in_progress','resolved'].includes(body.status)||body.text!==undefined&&!text(body.text,4000))throw fail('Use a valid status or reply.');if(old.messages.length>=100)throw fail('This thread is full. Open a new support request.');await save(DB,a,key('ticket',body.id),{...cleanRecord(old),status:body.status||old.status,messages:[...old.messages,...(body.text?[{by:a.id,name:a.name,text:body.text.trim(),at:Date.now()}]:[])]},body.revision);return json({ok:true});}
  }
  if(path==='drafts'){
   requireRole(a,'goddess','social');
   if(method==='GET'){const rows=await DB.prepare("SELECT content,revision,updated_at FROM prototype_settings WHERE id LIKE 'staff-draft:%' AND (?::boolean OR content::jsonb->>'createdBy'=?) ORDER BY updated_at DESC LIMIT 100").bind(a.owner,a.id).all();return json({drafts:rows.results.map(r=>({...JSON.parse(r.content),revision:r.revision,updatedAt:r.updated_at}))});}
   if(method==='PUT'){
    if(!uuid(body.id)||!Number.isSafeInteger(body.revision)||body.revision<0||!text(body.title,140)||typeof body.instagram!=='string'||body.instagram.length>2200||typeof body.tiktok!=='string'||body.tiktok.length>2200||!['draft','review'].includes(body.status)||!Array.isArray(body.assets)||body.assets.length>6||new Set(body.assets).size!==body.assets.length||body.assets.some(x=>!uuid(x))||body.scheduledFor&&(typeof body.scheduledFor!=='string'||!Number.isFinite(Date.parse(body.scheduledFor))||body.scheduledFor.length>40))throw fail('Use a title, captions up to 2,200 characters and up to six media assets.');const old=await read(DB,key('draft',body.id));if(old&&!a.owner&&old.createdBy!==a.id)throw fail('Draft unavailable.',404);if(old?.status==='approved'&&!a.owner)throw fail('Approved drafts are locked. Ask Goddess to request changes.',409);
    for(const id of body.assets){const asset=await read(DB,key('asset',id));if(!asset||asset.storageKey!=='staff-social/'+environment+'/'+id||asset.state!=='ready'||!a.owner&&asset.createdBy!==a.id)throw fail('Choose media from your public-content library.');}
    await save(DB,a,key('draft',body.id),{id:body.id,title:body.title.trim(),instagram:body.instagram,tiktok:body.tiktok,assets:body.assets,scheduledFor:body.scheduledFor||null,status:body.status,createdBy:old?.createdBy||a.id,createdByName:old?.createdByName||a.name,reviewNote:'',submittedAt:body.status==='review'?Date.now():null},body.revision);return json({ok:true});
   }
   if(method==='PATCH'){
    requireRole(a,'goddess');if(!uuid(body.id)||!['approved','changes_requested'].includes(body.status)||!Number.isSafeInteger(body.revision)||typeof body.note!=='string'||body.note.length>2000)throw fail('Choose Approve or Request changes.');const old=await read(DB,key('draft',body.id));if(!old)throw fail('Draft unavailable.',404);if(body.status==='approved'&&old.status!=='review')throw fail('Only submitted drafts can be approved.',409);await save(DB,a,key('draft',body.id),{...cleanRecord(old),status:body.status,reviewNote:body.note,reviewedAt:Date.now(),reviewedBy:a.id},body.revision);return json({ok:true});
   }
  }
  if(path==='assets'&&method==='GET'){requireRole(a,'goddess','social');const rows=await DB.prepare("SELECT content FROM prototype_settings WHERE id LIKE 'staff-asset:%' AND content::jsonb->>'state'='ready' AND (?::boolean OR content::jsonb->>'createdBy'=?) ORDER BY updated_at DESC LIMIT 100").bind(a.owner,a.id).all();return json({assets:rows.results.map(r=>{const x=JSON.parse(r.content);return {id:x.id,mime:x.mime,size:x.size,url:'/api/staff/asset/'+x.id};})});}
  if(path==='asset-prepare'&&method==='POST'){
   requireRole(a,'goddess','social');if(!env.BUCKET?.signUpload)throw fail('Private media storage is unavailable.',503);if(!uuid(body.id)||!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(body.type)||!Number.isSafeInteger(body.size)||body.size<1||body.size>50*1024*1024)throw fail('Choose a JPG, PNG, WebP, MP4 or WebM file up to 50 MB.');await limit(DB,'asset:'+a.id,30,3600000);
   const existing=await read(DB,key('asset',body.id));if(existing){if(existing.storageKey!=='staff-social/'+environment+'/'+body.id||existing.createdBy!==a.id||existing.size!==body.size||existing.claimedType!==body.type)throw fail('Upload identifier conflict.',409);if(existing.state==='ready')return json({completeOnly:true});if(existing.expires<Date.now())throw fail('Upload expired. Choose the file again.',410);return json({uploadUrl:await env.BUCKET.signUpload(existing.storageKey)});}
   const storageKey='staff-social/'+environment+'/'+body.id,asset={environment,id:body.id,createdBy:a.id,claimedType:body.type,size:body.size,storageKey,state:'uploading',expires:Date.now()+3600000};
   const result=await DB.batch([DB.prepare('SELECT pg_advisory_xact_lock(hashtextextended(?::text,0))').bind('staff-social-quota'),DB.prepare("INSERT INTO prototype_settings(id,content,revision,updated_at) SELECT ?,?,1,? WHERE (SELECT COALESCE(SUM((content::jsonb->>'size')::bigint),0) FROM prototype_settings WHERE id LIKE 'staff-asset:%')+?::bigint<=2147483648 ON CONFLICT(id) DO NOTHING RETURNING id").bind(key('asset',body.id),JSON.stringify(asset),stamp(),body.size)]);if(!result[1].meta.changes)throw fail('The studio media allowance is full, or this upload already exists.',409);return json({uploadUrl:await env.BUCKET.signUpload(storageKey)});
  }
  if(path==='asset-complete'&&method==='POST'){
   requireRole(a,'goddess','social');if(!uuid(body.id))throw fail('Choose an upload.');const asset=await read(DB,key('asset',body.id));if(!asset||asset.storageKey!=='staff-social/'+environment+'/'+body.id||!a.owner&&asset.createdBy!==a.id)throw fail('Upload unavailable.',404);if(asset.state==='ready')return json({ok:true});if(asset.expires<Date.now())throw fail('Upload expired.',410);const blob=await env.BUCKET.staged(asset.storageKey);if(blob.size!==asset.size)throw fail('Uploaded size does not match.');const bytes=new Uint8Array(await blob.arrayBuffer()),mime=mediaType(bytes,asset.claimedType);if(mime!==asset.claimedType||!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(mime))throw fail('This file format is not supported.',415);
   await env.BUCKET.put(asset.storageKey,bytes,{httpMetadata:{contentType:mime}});try{await save(DB,a,key('asset',body.id),{...cleanRecord(asset),state:'ready',mime},asset.revision);}catch(e){const current=await read(DB,key('asset',body.id));if(current?.state!=='ready')await env.BUCKET.delete(asset.storageKey);throw e;}await env.BUCKET.deleteStaged(asset.storageKey);return json({ok:true});
  }
  if(path.startsWith('asset/')&&['GET','HEAD'].includes(method)){
   requireRole(a,'goddess','social');const id=path.slice(6);if(!uuid(id))throw fail('Media unavailable.',404);const asset=await read(DB,key('asset',id));if(!asset||asset.storageKey!=='staff-social/'+environment+'/'+id||asset.state!=='ready'||!a.owner&&asset.createdBy!==a.id)throw fail('Media unavailable.',404);return new Response(null,{status:302,headers:{Location:await env.BUCKET.signedRead(asset.storageKey),'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
  }
  if(path.startsWith('media/')&&['GET','HEAD'].includes(method)){
   requireRole(a,'goddess','chatter');const id=path.slice(6);if(!uuid(id))throw fail('Media unavailable.',404);const file=await DB.prepare("SELECT * FROM media_files WHERE id=? AND scope='chat'").bind(id).first();if(!file)throw fail('Media unavailable.',404);await assigned(DB,a,file.student_id);
   const shared=await DB.prepare("SELECT id FROM chat_messages WHERE student_id=? AND sender=? AND (attachment_id=? OR EXISTS(SELECT 1 FROM prototype_settings p WHERE p.id='chat-album:'||chat_messages.id AND p.content::jsonb->'attachmentIds' @> ?::jsonb)) LIMIT 1").bind(file.student_id,file.role,id,JSON.stringify([id])).first();if(!shared)throw fail('Media unavailable.',404);
   if(file.storage_key.startsWith('cloudflare-stream/')){const job=await read(DB,'stream-upload:'+id);if(!job||job.environment!==environment||job.state!=='ready'||job.accountId!==env.CLOUDFLARE_STREAM_ACCOUNT_ID)throw fail('Video unavailable.',404);const d=await streamPrivateStatus(env,job),host=streamPlaybackHost(d,job.uid);if(!host||d.readyToStream!==true||d.status?.state!=='ready')throw fail('Video is processing.',409);const expires=Math.min(Date.now()+300000,a.expires||Infinity),t=await env.VIDEO_STREAM.token(job.uid,Math.floor(expires/1000));return json({hls:'https://'+host+'/'+t+'/manifest/video.m3u8',expiresAt:expires});}
   if(!env.BUCKET?.signedRead)throw fail('Private media storage is unavailable.',503);return new Response(null,{status:302,headers:{Location:await env.BUCKET.signedRead(file.storage_key),'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
  }
  if(path==='audit'&&method==='GET'){requireRole(a,'goddess');const rows=await DB.prepare("SELECT content FROM prototype_settings WHERE id LIKE 'staff-audit:%' ORDER BY updated_at DESC LIMIT 100").all();return json({events:rows.results.map(r=>JSON.parse(r.content))});}
  return json({error:'Not found.'},404);
 }catch(error){if(error.status)return json({error:error.message},error.status);throw error;}
}
