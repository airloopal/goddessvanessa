// Read-only owner ledger. A bank approval is never a completed payment.
function squareAdminPayment(r){
 const payment=squarePublic(r);
 if(!payment)return {state:'not_started',status:null};
 const confirmed=r.status==='paid'&&r.providerStatus==='COMPLETED'&&!!r.paymentId&&!!r.paidAt;
 const state=r.status==='granted'?'granted':r.status==='refund_review'?'review':confirmed?'confirmed':r.status==='paid'?'unverified':'pending';
 let receipt=null;try{const u=new URL(r.receiptUrl);if(state==='confirmed'&&u.protocol==='https:'&&u.hostname==='squareup.com'&&!u.username&&!u.password&&!u.port&&/^\/receipt\/preview\/[A-Za-z0-9_-]+$/.test(u.pathname)&&!u.search&&!u.hash)receipt=u.href;}catch{}
 return {...payment,state,receiptUrl:receipt,paymentReference:confirmed?r.paymentId:null};
}
async function adminPaymentsAPI(request,env,owner){
 if(!owner)return json({error:'Goddess access required.'},403);
 if(request.method!=='GET')return json({error:'This payment view is read-only.'},405);
 const mode=squareMode(env);
 const rows=await db(env).prepare(`WITH people AS (
 SELECT content::jsonb->>'user' AS person,MAX(updated_at) AS updated_at FROM prototype_settings
 WHERE id LIKE ? AND content::jsonb->>'stage' IN ('entry','contract') GROUP BY 1 ORDER BY 2 DESC,1 LIMIT 100
 ) SELECT p.person,p.updated_at,c.content::jsonb->>'name' AS contact_name,c.content::jsonb->>'email' AS email,
 n.name,n.reference,(e.content::jsonb-'request'-'cardAttempt')::text AS entry,
 (k.content::jsonb-'request'-'cardAttempt')::text AS contract,jsonb_build_object('status',g.content::jsonb->>'status','approvedBy',g.content::jsonb->>'approvedBy','entryId',g.content::jsonb->>'entryId')::text AS grant
 FROM people p LEFT JOIN prototype_settings c ON c.id='sub-contact:'||p.person
 LEFT JOIN education_enrolments n ON n.user_id=p.person
 LEFT JOIN prototype_settings e ON e.content::jsonb->>'user'=p.person AND e.id LIKE ? AND e.content::jsonb->>'stage'='entry'
 LEFT JOIN prototype_settings k ON k.content::jsonb->>'user'=p.person AND k.id LIKE ? AND k.content::jsonb->>'stage'='contract'
 LEFT JOIN prototype_settings g ON g.id='entry-grant:'||p.person ORDER BY p.updated_at DESC,p.person`).bind('sq-'+mode+'-%','sq-'+mode+'-e-%','sq-'+mode+'-c-%').all();
 const applicants=[];
 for(const row of rows.results){
  let entry=row.entry?JSON.parse(row.entry):null;const contract=row.contract?JSON.parse(row.contract):null,grant=row.grant?JSON.parse(row.grant):null;
  // Show a deliberate waiver separately; never relabel its financial record paid.
  if(grant?.status==='granted'&&grant.approvedBy==='goddess'&&(!entry||entry.status==='pending')&&(!entry||entry.plan.id===grant.entryId))entry={...entry,stage:'entry',status:'granted',plan:{...entry?.plan,amount:0}};
  const suffix=(await chatHash(row.person)).slice(0,24);
  applicants.push({id:suffix,name:row.contact_name||row.name||'Applicant · '+suffix.slice(-8),email:row.email||'',reference:row.reference||null,updatedAt:row.updated_at,entry:squareAdminPayment(entry),contract:squareAdminPayment(contract)});
 }
 const response=json({applicants,limit:100,checkedAt:new Date().toISOString(),mode});response.headers.set('Cache-Control','private, no-store');return response;
}
