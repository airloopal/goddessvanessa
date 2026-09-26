import pg from 'pg';
// Millisecond timestamps and message sequences must stay exact in JavaScript.
pg.types.setTypeParser(20, value => {const n=Number(value);if(!Number.isSafeInteger(n))throw Error('Database integer exceeds safe range');return n;});
const tables=['visual_drafts','visual_site','prototype_settings','education_enrolments','chat_students','chat_sessions','chat_messages','chat_state','chat_limits','media_files','media_uploads'];
export function sqlText(query){
 // SQL is supplied exclusively by our server modules; browser input is always bound.
 query=query.replace(new RegExp('\\b(FROM|JOIN|INTO|UPDATE)\\s+('+tables.join('|')+')\\b','gi'),(_,verb,table)=>verb+' academy.'+table);
 let i=0;return query.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?/g,part=>part==='?'?'$'+(++i):part);
}
export function database(pool){
 const prepare=(query)=>{let args=[];const stmt={query:sqlText(query),get args(){return args;},bind(...values){args=values;return stmt;},async first(){return (await pool.query(stmt.query,args)).rows[0]||null;},async all(){return {results:(await pool.query(stmt.query,args)).rows};},async run(){const r=await pool.query(stmt.query,args);return {results:r.rows,meta:{changes:r.rowCount??r.affectedRows??0}};}};return stmt;};
 return {prepare,async batch(statements){return pool.transaction(async client=>{const out=[];for(const s of statements){const r=await client.query(s.query,s.args);out.push({results:r.rows,meta:{changes:r.rowCount??r.affectedRows??0}});}return out;});}};
}
let shared;
export function productionDatabase(env){
 if(!shared){
  const connectionString=env.DATABASE_URL||env.POSTGRES_URL;if(!connectionString)throw Error('DATABASE_URL is not configured');
  const u=new URL(connectionString);for(const k of ['sslmode','sslcert','sslkey','sslrootcert'])u.searchParams.delete(k);
  const pool=new pg.Pool({connectionString:u.href,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:10000,allowExitOnIdle:true,ssl:{rejectUnauthorized:true,...(env.DATABASE_CA_CERT?{ca:env.DATABASE_CA_CERT.replaceAll('\\n','\n')}:{})}});
  pool.on('error',()=>console.error('database_pool_error'));
  shared=database({query:(q,a)=>pool.query(q,a),async transaction(fn){const c=await pool.connect();try{await c.query('BEGIN');const out=await fn(c);await c.query('COMMIT');return out;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}});
 }
 return shared;
}
