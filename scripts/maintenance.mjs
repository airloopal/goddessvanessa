// Run with server environment variables (e.g. node --env-file=.env scripts/maintenance.mjs).
import {productionDatabase} from '../server/platform/database.js';
import {storage} from '../server/platform/storage.js';
const DB=productionDatabase(process.env),bucket=storage(process.env);if(!bucket)throw Error('Storage is not configured');
const rows=await DB.prepare('SELECT id,storage_key FROM media_uploads WHERE expires_at<? ORDER BY expires_at LIMIT 200').bind(Date.now()-3600000).all();
for(const row of rows.results){await bucket.deleteStaged(row.storage_key);await DB.prepare('DELETE FROM media_uploads WHERE id=?').bind(row.id).run();}
await DB.prepare('DELETE FROM chat_limits WHERE expires<?').bind(Date.now()).run();
await DB.prepare('DELETE FROM chat_sessions WHERE expires_at<?').bind(Date.now()).run();
console.log('Expired uploads and sessions cleaned.');
