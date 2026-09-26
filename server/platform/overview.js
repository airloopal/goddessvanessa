export async function overview(DB){
 const counts=await DB.prepare(`SELECT
 (SELECT COUNT(*) FROM education_enrolments) AS applications,
 (SELECT COUNT(*) FROM chat_students WHERE status='active') AS active_students,
 (SELECT COUNT(*) FROM prototype_settings WHERE id LIKE 'education-verification:%' AND content::jsonb->>'status'='pending') AS pending_verifications,
 (SELECT COUNT(*) FROM chat_messages m WHERE m.sender='client' AND m.seq>COALESCE((SELECT read_seq FROM chat_state s WHERE s.student_id=m.student_id AND s.role='admin'),0)) AS unread_messages`).first();
 const recent=await DB.prepare('SELECT reference,name,created_at FROM education_enrolments ORDER BY created_at DESC LIMIT 5').all();
 const days=Array.from({length:7},(_,i)=>new Date(Date.now()-(6-i)*86400000).toISOString().slice(0,10));
 const rows=await DB.prepare('SELECT LEFT(created_at,10) AS day,COUNT(*) AS count FROM education_enrolments WHERE created_at>=? GROUP BY LEFT(created_at,10)').bind(days[0]+'T00:00:00.000Z').all();
 return {counts,recent:recent.results,days:days.map(day=>({day,count:Number(rows.results.find(r=>r.day===day)?.count||0)})),checkedAt:new Date().toISOString(),timezone:'UTC'};
}
