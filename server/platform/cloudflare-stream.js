import {boundedText} from './request-body.js';
const uidPattern=/^[a-f0-9]{32}$/;
export const streamUploadURL=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&['upload.videodelivery.net','upload.cloudflarestream.com'].includes(u.hostname)?u.href:null;}catch{return null;}};
export function cloudflareStream(env,transport=fetch){
 const account=env.CLOUDFLARE_STREAM_ACCOUNT_ID,key=env.CLOUDFLARE_STREAM_API_TOKEN;if(!uidPattern.test(account||'')||typeof key!=='string'||key.length<20||/[\r\n]/.test(key))return null;
 const request=async(path,{method='GET',headers={},body}={})=>{const r=await transport('https://api.cloudflare.com/client/v4/accounts/'+account+'/stream'+path,{method,redirect:'error',headers:{Authorization:'Bearer '+key,...headers},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});if(!r.ok){const error=Error('Video service request failed ('+r.status+').');error.status=r.status;throw error;}return r;};
 const data=async(path,options)=>{const r=await request(path,options),d=JSON.parse(await boundedText(r,65536));if(d.success!==true||!d.result)throw Error('Video service response unavailable.');return d.result;};
 return {
  async create({size,creator,origins}){const meta=['name '+Buffer.from('Private chat video').toString('base64'),'requiresignedurls','maxdurationseconds '+Buffer.from('1500').toString('base64'),'allowedorigins '+Buffer.from(origins.join(',')).toString('base64')].join(',');const r=await request('?direct_user=true',{method:'POST',headers:{'Tus-Resumable':'1.0.0','Upload-Length':String(size),'Upload-Creator':creator,'Upload-Metadata':meta}}),uid=r.headers.get('Stream-Media-ID'),uploadURL=streamUploadURL(r.headers.get('Location'));if(!uidPattern.test(uid||'')||!uploadURL)throw Error('Video upload response unavailable.');return {uid,uploadURL};},
  async status(uid){if(!uidPattern.test(uid))throw Error('Invalid video');return data('/'+uid);},
  async token(uid,expires){if(!uidPattern.test(uid))throw Error('Invalid video');const d=await data('/'+uid+'/token',{method:'POST',headers:{'Content-Type':'application/json'},body:{exp:expires}});if(typeof d.token!=='string'||d.token.length>16000||!/^[-\w]+\.[-\w]+\.[-\w]+$/.test(d.token))throw Error('Video playback unavailable.');return d.token;},
  async remove(uid){if(!uidPattern.test(uid))throw Error('Invalid video');try{await request('/'+uid,{method:'DELETE'});}catch(error){if(error.status!==404)throw error;}}
 };
}
