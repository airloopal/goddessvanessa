'use strict';
async function uploadPrivateFile(file,params,id){
 if(typeof CHAT_EDITOR!=='undefined'&&CHAT_EDITOR)throw Error('Uploads are unavailable in the visual-editor preview.');
 if(!file||file.size>25*1024*1024)throw Error('Choose a file no larger than 25 MB.');
 const headers={'Content-Type':'application/json','X-Chat-Role':document.body.classList.contains('dashboard')?'admin':'student'};
 const api=async(path,data)=>{const r=await fetch('/api/media/'+path,{method:'POST',headers,body:JSON.stringify(data)});const result=await r.json();if(!r.ok)throw Error(result.error||'Upload failed. Please retry.');return result;};
 const ready=await api('prepare',{...params,id,name:file.name,size:file.size,type:file.type||'application/octet-stream'});
 if(ready.file)return ready;
 if(ready.uploadUrl){const r=await fetch(ready.uploadUrl,{method:'PUT',headers:{'Content-Type':file.type||'application/octet-stream','x-upsert':'false'},body:file});if(!r.ok)throw Error('The file could not be uploaded. Choose the file again and retry.');}
 return api('complete',{id});
}
function mediaMessage(file){if(!file||!/^\/api\/media\/[a-f0-9-]{36}$/.test(file.url))return '';const url=eduEscape(file.url),name=eduEscape(file.name);let content='';if(file.mime.startsWith('image/'))content='<a href="'+url+'?download=1" target="_blank" rel="noopener"><img loading="lazy" src="'+url+'" alt="'+name+'"></a>';else if(file.mime.startsWith('video/'))content='<video controls playsinline preload="none" src="'+url+'" aria-label="'+name+'"></video>';else if(file.mime.startsWith('audio/'))content='<audio controls preload="none" src="'+url+'" aria-label="'+name+'"></audio>';return '<div class="message-attachment">'+content+'<a href="'+url+'?download=1" target="_blank" rel="noopener">'+name+' · '+(file.size/1048576).toFixed(1)+' MB</a></div>';}
function bindChatMedia(form){if(form.id==='floating-form'||form.dataset.mediaBound)return;form.dataset.mediaBound='true';const panel=document.createElement('div');panel.className='chat-attachment-controls';panel.innerHTML='<input type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm,application/pdf" hidden><button class="quiet" type="button" data-pick>＋ Attach</button><button class="quiet" type="button" data-record>Voice note</button><span class="attachment-selection" hidden></span><button class="p-button" type="button" data-send-file hidden>Send file</button><button class="quiet" type="button" data-clear-file hidden>Cancel</button><span class="attachment-status" role="status"></span>';form.before(panel);const input=panel.querySelector('input'),pick=panel.querySelector('[data-pick]'),record=panel.querySelector('[data-record]'),send=panel.querySelector('[data-send-file]'),clear=panel.querySelector('[data-clear-file]'),label=panel.querySelector('.attachment-selection'),status=panel.querySelector('[role=status]');let file=null,id=null,recorder=null,stream=null,timer=null,discard=false;
 function select(value){file=value;id=crypto.randomUUID();label.textContent=value?.name||'';label.hidden=!value;send.hidden=!value;clear.hidden=!value;status.textContent=value?'Ready to send · '+(value.size/1048576).toFixed(1)+' MB':'';}
 if(form.id==='client-composer'){
 pick.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m8 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9M8 12l-2 2a1 1 0 0 0 2 2l8-8"/></svg>';pick.setAttribute('aria-label','Attach file');pick.title='Attach file';
 record.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 10v2a6 6 0 0 0 12 0v-2M12 18v3m-4 0h8"/></svg>';record.setAttribute('aria-label','Record voice note');record.title='Record voice note';
 }
 pick.onclick=()=>input.click();input.onchange=()=>{const chosen=input.files[0];if(chosen?.size>25*1024*1024){status.textContent='Choose a file no larger than 25 MB.';input.value='';return;}select(chosen);};clear.onclick=()=>{select(null);input.value='';};
 send.onclick=async()=>{if(!file)return;const target=PreviewChat.selected();if(!target){status.textContent='Choose a conversation first.';return;}[pick,record,send,clear].forEach(b=>b.disabled=true);status.textContent='Uploading and sending…';try{await uploadPrivateFile(file,{scope:'chat',student:target},id);select(null);input.value='';status.textContent='File sent.';await PreviewChat.refresh();}catch(error){status.textContent=error.message;}finally{[pick,record,send,clear].forEach(b=>b.disabled=false);}};
 if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){record.hidden=true;}
 record.onclick=async()=>{if(recorder?.state==='recording'){recorder.stop();return;}record.disabled=true;status.textContent='Allow microphone access to record a voice note.';try{stream=await navigator.mediaDevices.getUserMedia({audio:true});if(!panel.isConnected){stream.getTracks().forEach(t=>t.stop());return;}select(null);const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);const chunks=[];discard=false;recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=()=>{clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());record.textContent='Voice note';record.setAttribute('aria-label','Record voice note');pick.disabled=false;if(discard)return;const type=recorder.mimeType.split(';')[0],blob=new Blob(chunks,{type});select(new File([blob],'Voice note.'+(type==='audio/mp4'?'m4a':'webm'),{type}));};recorder.start();record.textContent='Stop';record.setAttribute('aria-label','Stop recording');pick.disabled=true;status.textContent='Recording… Tap Stop recording when finished (90-second limit).';timer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},90000);}catch{stream?.getTracks().forEach(t=>t.stop());status.textContent='Microphone unavailable. You can attach an audio file instead.';}finally{record.disabled=false;}};
 function stop(){discard=true;if(recorder?.state==='recording')recorder.stop();stream?.getTracks().forEach(t=>t.stop());clearTimeout(timer);}window.addEventListener('pagehide',stop,{once:true});const observer=new MutationObserver(()=>{if(!panel.isConnected){stop();observer.disconnect();}});observer.observe(document.body,{childList:true,subtree:true});
}
function renderChatLog(log,role){
 applyChatBackground(log,PreviewChat.background());
 const bottom=log.scrollHeight-log.scrollTop-log.clientHeight<100,previousHeight=log.scrollHeight,previousTop=log.scrollTop;
 const template=document.createElement('template');template.innerHTML=previewThread(role);
 const existing=new Map([...log.querySelectorAll('[data-message-id]')].map(node=>[node.dataset.messageId,node]));
 const next=[...template.content.children].map(node=>{const saved=node.dataset.messageId&&existing.get(node.dataset.messageId);if(!saved)return node;
  // Preserve playing attachments and selections; only reconcile delivery metadata.
  saved.className=node.className;const meta=saved.querySelector('.message-meta'),fresh=node.querySelector('.message-meta');if(meta&&fresh&&meta.innerHTML!==fresh.innerHTML)meta.replaceWith(fresh);
  const retry=saved.querySelector('.retry-message'),newRetry=node.querySelector('.retry-message');if(retry&&!newRetry)retry.remove();else if(!retry&&newRetry)saved.append(newRetry);else if(retry&&newRetry)retry.disabled=false;
  return saved;});
 for(let i=0;i<next.length;i++)if(log.children[i]!==next[i])log.insertBefore(next[i],log.children[i]||null);
 while(log.children.length>next.length)log.lastElementChild.remove();if(bottom)log.scrollTop=log.scrollHeight;else if(previousTop<100&&log.scrollHeight>previousHeight)log.scrollTop=previousTop+log.scrollHeight-previousHeight;
}

function applyChatBackground(host,background){
 const imageId=background?.imageId;const photo=typeof imageId==='string'&&/^[a-f0-9-]{36}$/.test(imageId);const color=photo?'#321b29':background?.color;
 if(!/^#[0-9a-f]{6}$/i.test(color||'')){for(const property of ['--conversation-color','--conversation-image','--conversation-size','--conversation-repeat','--chat-muted','--date-bg'])host.style.removeProperty(property);host.removeAttribute('data-conversation-background');return;}
 const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));const dark=(rgb[0]*299+rgb[1]*587+rgb[2]*114)/1000<145;
 const line=dark?'rgba(255,255,255,.07)':'rgba(0,0,0,.06)';host.setAttribute('data-conversation-background','');host.style.setProperty('--conversation-color',color);
 host.style.setProperty('--conversation-image',background.pattern==='grid'?'linear-gradient('+line+' 1px,transparent 1px),linear-gradient(90deg,'+line+' 1px,transparent 1px)':background.pattern==='dots'?'radial-gradient('+line+' 1px,transparent 1px)':'none');
 host.style.setProperty('--conversation-size',background.pattern==='grid'?'32px 32px':'22px 22px');
 host.style.setProperty('--conversation-repeat',photo?'no-repeat':'repeat');
 if(photo){const tint=background.overlay==='pink'?'rgba(174,61,112,.58)':'rgba(66,8,34,.72)';host.style.setProperty('--conversation-image','linear-gradient('+tint+','+tint+'),url("/api/media/'+imageId+'")');host.style.setProperty('--conversation-size','cover');}host.style.setProperty('--chat-muted',dark?'#c4cbd4':'#46515d');host.style.setProperty('--date-bg',dark?'#00000055':'#ffffffaa');
}
