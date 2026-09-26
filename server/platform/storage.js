import {createClient} from '@supabase/supabase-js';
export function storage(env){
 const secret=env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY;if(!secret)return null;
 const supabase=createClient(env.SUPABASE_URL,secret,{auth:{persistSession:false,autoRefreshToken:false}}),files=supabase.storage.from('academy-media'),staging=supabase.storage.from('academy-uploads');
 const checked=({data,error})=>{if(error)throw Error('Private storage operation failed');return data;};
 return {
  async put(key,bytes,{httpMetadata}={}){checked(await files.upload(key,bytes,{contentType:httpMetadata?.contentType||'application/octet-stream',upsert:false,cacheControl:'0'}));},
  async delete(keys){checked(await files.remove(Array.isArray(keys)?keys:[keys]));},
  async signedRead(key,{download}={}){return checked(await files.createSignedUrl(key,300,download?{download}:undefined)).signedUrl;},
  async signUpload(key){return checked(await staging.createSignedUploadUrl(key,{upsert:false})).signedUrl;},
  async staged(key){return checked(await staging.download(key));},
  async deleteStaged(key){checked(await staging.remove([key]));}
 };
}
