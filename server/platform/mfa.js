import {randomBytes,createHmac,createHash,createCipheriv,createDecipheriv,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback),alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes){let bits=0,value=0,out='';for(const b of bytes){value=(value<<8)|b;bits+=8;while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5;}}if(bits)out+=alphabet[(value<<(5-bits))&31];return out;}
function unbase32(text){let bits=0,value=0,out=[];for(const c of text){const n=alphabet.indexOf(c);if(n<0)throw Error('Invalid authenticator key');value=(value<<5)|n;bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8;}}return Buffer.from(out);}
export function totp(secret,step,digits=6){const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));const h=createHmac('sha1',unbase32(secret)).update(counter).digest(),offset=h[h.length-1]&15;return String((h.readUInt32BE(offset)&0x7fffffff)%10**digits).padStart(digits,'0');}
export function totpStep(secret,code,last=-1,now=Date.now()){if(typeof code!=='string'||!/^\d{6}$/.test(code))return null;const step=Math.floor(now/30000);for(const candidate of [step,step-1,step+1]){if(candidate>last&&timingSafeEqual(Buffer.from(totp(secret,candidate)),Buffer.from(code)))return candidate;}return null;}
const key=async(code,salt)=>scrypt(code,salt,32,{N:32768,r:8,p:1,maxmem:64*1024*1024});
// The stored access-code verifier cannot decrypt this envelope: the raw code and
// an independent scrypt salt are required. Neither raw code nor raw key is stored.
export async function sealSecret(secret,code){const salt=randomBytes(24).toString('hex'),iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',await key(code,salt),iv);cipher.setAAD(Buffer.from('vanessa-mfa-v1'));const ciphertext=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);return {salt,iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),ciphertext:ciphertext.toString('hex')};}
export async function openSecret(envelope,code){const decipher=createDecipheriv('aes-256-gcm',await key(code,envelope.salt),Buffer.from(envelope.iv,'hex'));decipher.setAAD(Buffer.from('vanessa-mfa-v1'));decipher.setAuthTag(Buffer.from(envelope.tag,'hex'));return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,'hex')),decipher.final()]).toString('utf8');}
export const recoveryHash=value=>createHash('sha256').update(String(value).replaceAll('-','').toLowerCase()).digest('hex');
export const newRecoveryCodes=()=>Array.from({length:8},()=>randomBytes(16).toString('hex').match(/.{4}/g).join('-'));
export async function mfaProof(record,code,factor){if(!record.mfa)return {record,verified:false};if(typeof factor!=='string')return null;
 if(/^\d{6}$/.test(factor)){const secret=await openSecret(record.mfa.envelope,code),step=totpStep(secret,factor,record.mfa.lastStep);return step===null?null:{record:{...record,mfa:{...record.mfa,lastStep:step}},verified:true};}
 if(!/^[a-f0-9]{32}$/i.test(factor.replaceAll('-','')))return null;const hash=recoveryHash(factor),codes=record.mfa.recoveryHashes||[];if(!codes.includes(hash))return null;return {record:{...record,mfa:{...record.mfa,recoveryHashes:codes.filter(h=>h!==hash)}},verified:true};
}
