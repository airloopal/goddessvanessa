// Owner-only broadcasts. One private asset is stored once and access is earned
// exclusively by a delivered message in the requesting conversation.
async function broadcastAssetShared(env,id){return !!await db(env).prepare("SELECT m.id FROM chat_messages m LEFT JOIN prototype_settings a ON a.id='chat-album:'||m.id WHERE m.attachment_id=? OR a.content::jsonb->'attachmentIds' @> ?::jsonb LIMIT 1").bind(id,JSON.stringify([id])).first();}
async function chatBroadcast(request,env,url,{owner,method,body,now,path}){
 if(!owner)return json({error:'Goddess access required.'},403);
 if(path==='broadcast-discard'){
  if(method!=='POST'||!streamUUID(body.id)||Object.keys(body).some(k=>k!=='id'))return json({error:'Choose a broadcast draft.'},400);
  const file=await db(env).prepare("SELECT * FROM media_files WHERE id=? AND user_id='goddess-broadcast' AND scope='feed' AND role='admin'").bind(body.id).first();if(!file)return json({discarded:true});
  if(file.storage_key.startsWith('cloudflare-stream/'))return json({error:'Use the video draft discard control.'},400);
  const key='broadcast-discard:'+body.id;
  const result=await db(env).batch([streamLock(env,body.id),db(env).prepare("INSERT INTO prototype_settings(id,content,revision,updated_at) SELECT ?,'{}',1,? WHERE NOT EXISTS(SELECT 1 FROM chat_messages m LEFT JOIN prototype_settings a ON a.id='chat-album:'||m.id WHERE m.attachment_id=? OR a.content::jsonb->'attachmentIds' @> ?::jsonb) ON CONFLICT(id) DO NOTHING RETURNING id").bind(key,new Date(now).toISOString(),body.id,JSON.stringify([body.id]))]);
  if(!result[1].meta.changes&&!await db(env).prepare('SELECT id FROM prototype_settings WHERE id=?').bind(key).first())return json({error:'This attachment was already sent.'},409);
  await env.BUCKET.delete(file.storage_key);await db(env).prepare("DELETE FROM media_files WHERE id=? AND user_id='goddess-broadcast'").bind(body.id).run();return json({discarded:true});
 }
 if(!['GET','POST'].includes(method))return json({error:'Method not allowed.'},405);
 const available=async()=>{const rows=await db(env).prepare("SELECT id,user_id,name FROM chat_students WHERE status='active' ORDER BY name LIMIT 1000").all(),out=[];for(const t of rows.results){const lifeRow=await db(env).prepare('SELECT content FROM prototype_settings WHERE id=?').bind('account-life:'+t.id).first(),life=lifeRow?JSON.parse(lifeRow.content):{},deadline=await squareAccessDeadline(env,t.user_id);if(!(life.until>Date.now())&&!['pending','approved','deleting'].includes(life.deletion)&&deadline>Date.now()&&await chatConversationEnabled(env,t.id))out.push({...t,deadline:Number.isFinite(deadline)?deadline:253402300799000});}return out;};
 if(method==='GET')return json({students:(await available()).map(({id,name})=>({id,name}))});
 const ids=body.attachmentIds||[];
 if(Object.keys(body).some(k=>!['id','text','studentIds','attachmentIds'].includes(k))||!streamUUID(body.id)||typeof body.text!=='string'||body.text.length>1000||(!body.text.trim()&&!ids.length)||chatLinkCandidates(body.text).some(x=>!chatSafeLink(x)))return json({error:'Add a message or media. Use up to 1,000 characters and approved links.'},400);
 if(!Array.isArray(ids)||ids.length>6||ids.some(x=>!streamUUID(x))||new Set(ids).size!==ids.length)return json({error:'Choose up to 6 photos or videos.'},400);
 if(body.studentIds!==undefined&&(!Array.isArray(body.studentIds)||!body.studentIds.length||body.studentIds.length>1000||body.studentIds.some(x=>!streamUUID(x))||new Set(body.studentIds).size!==body.studentIds.length))return json({error:'Choose valid recipients.'},400);
 const manifest='chat-broadcast:'+body.id,previous=await db(env).prepare('SELECT content FROM prototype_settings WHERE id=?').bind(manifest).first();
 const fingerprint=JSON.stringify({text:body.text.trim(),studentIds:body.studentIds?[...body.studentIds].sort():null,attachmentIds:ids});
 if(previous){const old=JSON.parse(previous.content);return old.fingerprint===fingerprint?json({ok:true,recipients:old.count}):json({error:'This broadcast was already sent with different content. Start a new broadcast.'},409);}
 if(!await chatLimit(env,'broadcast:admin',10,3600000))return json({error:'Broadcast limit reached. Try later.'},429);
 const targets=(await available()).filter(t=>!body.studentIds||body.studentIds.includes(t.id));
 if(!targets.length||body.studentIds&&targets.length!==body.studentIds.length)return json({error:'Some recipients are unavailable. Reopen Broadcast to update the list.'},409);
 const files=ids.length?(await db(env).prepare("SELECT * FROM media_files WHERE id IN ("+ids.map(()=>'?').join(',')+") AND user_id='goddess-broadcast' AND scope='feed' AND role='admin'").bind(...ids).all()).results:[];
 if(files.length!==ids.length||files.some(f=>! /^(image|video)\//.test(f.mime)||f.mime.startsWith('video/')&&!f.storage_key.startsWith('cloudflare-stream/')))return json({error:'Choose your prepared broadcast photos and videos.'},403);
 for(const f of files.filter(f=>f.storage_key.startsWith('cloudflare-stream/'))){const job=await streamRead(env,f.id);if(!job||job.scope!=='broadcast'||job.environment!==streamTag(env)||job.state!=='ready'||job.accountId!==env.CLOUDFLARE_STREAM_ACCOUNT_ID)return json({error:'Wait for video processing to finish.'},409);}
 const deliveries=await Promise.all(targets.map(async t=>{const h=await chatHash('broadcast:'+body.id+':'+t.id);return {id:h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20,32),studentId:t.id,deadline:t.deadline};}));
 const list=JSON.stringify(deliveries),stamp=new Date(now).toISOString();
 const guard="(SELECT count(*) FROM jsonb_to_recordset(?::jsonb) AS d(\"studentId\" text,deadline bigint) JOIN chat_students s ON s.id=d.\"studentId\" WHERE s.status='active' AND d.deadline>extract(epoch from CURRENT_TIMESTAMP)*1000 AND NOT EXISTS(SELECT 1 FROM prototype_settings c WHERE c.id='chat-control:'||s.id AND c.content::jsonb->>'enabled'='false') AND NOT EXISTS(SELECT 1 FROM prototype_settings l WHERE l.id='account-life:'||s.id AND (COALESCE((l.content::jsonb->>'until')::bigint,0)>extract(epoch from CURRENT_TIMESTAMP)*1000 OR l.content::jsonb->>'deletion' IN ('pending','approved','deleting'))))=? AND (SELECT count(*) FROM media_files f WHERE f.id IN (SELECT jsonb_array_elements_text(?::jsonb)) AND f.user_id='goddess-broadcast' AND f.scope='feed' AND NOT EXISTS(SELECT 1 FROM prototype_settings x WHERE x.id='broadcast-discard:'||f.id OR x.id='stream-upload:'||f.id AND x.content::jsonb->>'state'<>'ready'))=?";
 await db(env).batch([
  db(env).prepare('SELECT pg_advisory_xact_lock(hashtextextended(?::text,0))').bind(manifest),
  ...[...ids].sort().map(id=>streamLock(env,id)),
  db(env).prepare('SELECT id FROM chat_students WHERE id IN (SELECT jsonb_array_elements_text(?::jsonb)) ORDER BY id FOR UPDATE').bind(JSON.stringify(targets.map(t=>t.id))),
  db(env).prepare("SELECT id FROM prototype_settings WHERE id IN (SELECT unnest(ARRAY['chat-control:'||x,'account-life:'||x]) FROM jsonb_array_elements_text(?::jsonb) AS x) ORDER BY id FOR UPDATE").bind(JSON.stringify(targets.map(t=>t.id))),
  db(env).prepare('INSERT INTO prototype_settings(id,content,revision,updated_at) SELECT ?,?,1,? WHERE '+guard+' ON CONFLICT(id) DO NOTHING').bind(manifest,JSON.stringify({fingerprint,count:targets.length,list}),stamp,list,targets.length,JSON.stringify(ids),ids.length),
  db(env).prepare("INSERT INTO chat_messages(id,student_id,sender,body,attachment_id,created_at) SELECT d.id,d.\"studentId\",'admin',?,?,? FROM jsonb_to_recordset(?::jsonb) AS d(id text,\"studentId\" text) WHERE EXISTS(SELECT 1 FROM prototype_settings WHERE id=? AND content::jsonb->>'fingerprint'=? AND content::jsonb->>'list'=?) ON CONFLICT(id) DO NOTHING").bind(body.text.trim(),ids[0]||null,now,list,manifest,fingerprint,list),
  ...(ids.length?[db(env).prepare("INSERT INTO prototype_settings(id,content,revision,updated_at) SELECT 'chat-album:'||d.id,jsonb_build_object('studentId',d.\"studentId\",'role','admin','attachmentIds',?::jsonb,'caption',?::text)::text,1,? FROM jsonb_to_recordset(?::jsonb) AS d(id text,\"studentId\" text) JOIN chat_messages m ON m.id=d.id WHERE EXISTS(SELECT 1 FROM prototype_settings WHERE id=? AND content::jsonb->>'fingerprint'=? AND content::jsonb->>'list'=?) ON CONFLICT(id) DO NOTHING").bind(JSON.stringify(ids),body.text.trim(),stamp,list,manifest,fingerprint,list)]:[])
 ]);
 const saved=await db(env).prepare('SELECT content FROM prototype_settings WHERE id=?').bind(manifest).first();return saved&&JSON.parse(saved.content).fingerprint===fingerprint?json({ok:true,recipients:JSON.parse(saved.content).count}):json({error:'Recipients or drafts changed. Nothing was sent. Refresh before retrying.'},409);
}
