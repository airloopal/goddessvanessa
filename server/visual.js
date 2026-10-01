const EDITOR_OWNER_EMAIL="danielvernontp@gmail.com";
async function visualAPI(request,env,url,userId){
 const endpoint=url.pathname;const published=endpoint==='/api/visual/published';
 if(request.method==='GET'){
  const row=published?await db(env).prepare('SELECT content, revision, updated_at FROM visual_site WHERE id = 1').first():await db(env).prepare('SELECT content, revision, updated_at FROM visual_drafts WHERE user_id = ?').bind(userId).first();
  return json({config:normaliseLegacyEntry(row?JSON.parse(row.content):{version:2,edits:{}}),revision:row?.revision||0,updatedAt:row?.updated_at||null});
 }
 if(request.method!=='PUT')return json({error:'Method not allowed'},405);
 if(request.headers.get('origin')!==url.origin)return json({error:'Request origin rejected'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON required'},415);
 if(published&&request.headers.get('oai-authenticated-user-email')?.toLowerCase()!==EDITOR_OWNER_EMAIL)return json({error:'Only Goddess can publish changes.'},403);
 const raw=await request.text();if(raw.length>900000)return json({error:'This version is too large. Export it before reducing its size.'},413);
 let data;try{data=JSON.parse(raw);}catch{return json({error:'Invalid JSON'},400);}
 if(!data||!Number.isInteger(data.revision)||data.revision<0||!validVisual(data.config))return json({error:'Invalid editor version'},400);
 const content=JSON.stringify(data.config),updatedAt=new Date().toISOString();let result;
 if(published)result=data.revision===0?await db(env).prepare('INSERT INTO visual_site (id, content, revision, updated_at) VALUES (1, ?, 1, ?) ON CONFLICT(id) DO NOTHING').bind(content,updatedAt).run():await db(env).prepare('UPDATE visual_site SET content = ?, revision = revision + 1, updated_at = ? WHERE id = 1 AND revision = ?').bind(content,updatedAt,data.revision).run();
 else result=data.revision===0?await db(env).prepare('INSERT INTO visual_drafts (user_id, content, revision, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO NOTHING').bind(userId,content,updatedAt).run():await db(env).prepare('UPDATE visual_drafts SET content = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ?').bind(content,updatedAt,userId,data.revision).run();
 if(!result.meta?.changes)return json({error:'A newer version exists. Export your edits, then reload before saving or publishing.'},409);
 return json({saved:true,revision:data.revision+1,updatedAt});
}

function normaliseLegacyEntry(config){
 for(const [key,edit] of Object.entries(config.edits||{})){
  if(key==='landing|#hero-cta'&&Array.isArray(edit.text)){
   edit.text=edit.text.map(text=>/^(enter the kingdom|enter)$/i.test(text.trim())?'SIGN UP':text);
  }
 }
 return config;
}
