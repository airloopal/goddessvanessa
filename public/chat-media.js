'use strict';
async function uploadPrivateFile(file,params,id){
 if(typeof CHAT_EDITOR!=='undefined'&&CHAT_EDITOR)throw Error('Uploads are unavailable in the visual-editor preview.');
 if(!file||file.size>50*1024*1024)throw Error('Choose a file no larger than 50 MB.');
 const headers={'Content-Type':'application/json','X-Chat-Role':document.body.classList.contains('dashboard')?'admin':'student'};
 const api=async(path,data)=>{const r=await fetch('/api/media/'+path,{method:'POST',headers,body:JSON.stringify(data)});const result=await r.json();if(!r.ok)throw Error(result.error||'Upload failed. Please retry.');return result;};
 const ready=await api('prepare',{...params,id,name:file.name,size:file.size,type:file.type||'application/octet-stream'});
 if(ready.file)return ready;
 if(ready.uploadUrl){const r=await fetch(ready.uploadUrl,{method:'PUT',headers:{'Content-Type':file.type||'application/octet-stream','x-upsert':'false'},body:file});if(!r.ok)throw Error('The file could not be uploaded. Choose the file again and retry.');}
 return api('complete',{id});
}
function mediaMessage(file){if(!file||!/^\/api\/media\/[a-f0-9-]{36}$/.test(file.url))return '';const url=eduEscape(file.url),name=eduEscape(file.name);let content='';if(file.mime.startsWith('image/'))content='<a href="'+url+'?download=1" target="_blank" rel="noopener"><img loading="lazy" src="'+url+'" alt="'+name+'"></a>';else if(file.mime.startsWith('video/'))content='<video controls playsinline preload="none" src="'+url+'" aria-label="'+name+'"></video>';else if(file.mime.startsWith('audio/'))return voiceNoteMarkup(url);return '<div class="message-attachment">'+content+'<a href="'+url+'?download=1" target="_blank" rel="noopener">'+name+' · '+(file.size/1048576).toFixed(1)+' MB</a></div>';}
function bindChatMedia(form){if(form.id==='floating-form'||form.dataset.mediaBound)return;form.dataset.mediaBound='true';const panel=document.createElement('div');panel.className='chat-attachment-controls';panel.innerHTML='<input type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm,application/pdf" hidden><button class="quiet" type="button" data-pick>＋ Attach</button><button class="quiet" type="button" data-record>Voice note</button><span class="attachment-selection" hidden></span><button class="p-button" type="button" data-send-file hidden>Send file</button><button class="quiet" type="button" data-clear-file hidden>Cancel</button><span class="attachment-status" role="status"></span>';form.before(panel);const input=panel.querySelector('input'),pick=panel.querySelector('[data-pick]'),record=panel.querySelector('[data-record]'),send=panel.querySelector('[data-send-file]'),clear=panel.querySelector('[data-clear-file]'),label=panel.querySelector('.attachment-selection'),status=panel.querySelector('[role=status]');let file=null,id=null,recorder=null,stream=null,timer=null,discard=false;
 function select(value){file=value;id=crypto.randomUUID();label.textContent=value?.name||'';label.hidden=!value;send.hidden=!value;clear.hidden=!value;status.textContent=value?'Ready to send · '+(value.size/1048576).toFixed(1)+' MB':'';}
 if(form.id==='client-composer'){
 pick.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m8 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9M8 12l-2 2a1 1 0 0 0 2 2l8-8"/></svg>';pick.setAttribute('aria-label','Attach file');pick.title='Attach file';
 record.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 10v2a6 6 0 0 0 12 0v-2M12 18v3m-4 0h8"/></svg>';record.setAttribute('aria-label','Record voice note');record.title='Record voice note';
 }
 pick.onclick=()=>input.click();input.onchange=()=>{const chosen=input.files[0];if(chosen?.size>50*1024*1024){status.textContent='Choose a file no larger than 50 MB.';input.value='';return;}select(chosen);};clear.onclick=()=>{select(null);input.value='';};
 send.onclick=async()=>{if(!file)return;const target=PreviewChat.selected();if(!target){status.textContent='Choose a conversation first.';return;}[pick,record,send,clear].forEach(b=>b.disabled=true);status.textContent='Uploading and sending…';try{await uploadPrivateFile(file,{scope:'chat',student:target},id);select(null);input.value='';status.textContent='File sent.';await PreviewChat.refresh();}catch(error){status.textContent=error.message;}finally{[pick,record,send,clear].forEach(b=>b.disabled=false);}};
 if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){record.hidden=true;}
 record.onclick=async()=>{if(recorder?.state==='recording'){recorder.stop();return;}record.disabled=true;status.textContent='Allow microphone access to record a voice note.';try{stream=await navigator.mediaDevices.getUserMedia({audio:true});if(!panel.isConnected){stream.getTracks().forEach(t=>t.stop());return;}select(null);const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);const chunks=[];discard=false;recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=()=>{clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());record.textContent='Voice note';record.setAttribute('aria-label','Record voice note');pick.disabled=false;if(discard)return;const type=recorder.mimeType.split(';')[0],blob=new Blob(chunks,{type});select(new File([blob],'Voice note.'+(type==='audio/mp4'?'m4a':'webm'),{type}));};recorder.start();record.textContent='Stop';record.setAttribute('aria-label','Stop recording');pick.disabled=true;status.textContent='Recording… Tap Stop recording when finished (5-minute limit).';timer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},300000);}catch{stream?.getTracks().forEach(t=>t.stop());status.textContent='Microphone unavailable. You can attach an audio file instead.';}finally{record.disabled=false;}};
 function stop(){discard=true;if(recorder?.state==='recording')recorder.stop();stream?.getTracks().forEach(t=>t.stop());clearTimeout(timer);}window.addEventListener('pagehide',stop,{once:true});const observer=new MutationObserver(()=>{if(!panel.isConnected){stop();observer.disconnect();}});observer.observe(document.body,{childList:true,subtree:true});
}
function renderChatLog(log,role){
 applyChatBackground(log,PreviewChat.background());
 installVoiceNoteStyle();
 const bottom=log.scrollHeight-log.scrollTop-log.clientHeight<100,previousHeight=log.scrollHeight,previousTop=log.scrollTop;
 const template=document.createElement('template');template.innerHTML=previewThread(role);
 const existing=new Map([...log.querySelectorAll('[data-message-id]')].map(node=>[node.dataset.messageId,node]));
 const next=[...template.content.children].map(node=>{const saved=node.dataset.messageId&&existing.get(node.dataset.messageId);if(!saved)return node;
  // Preserve playing attachments and selections; only reconcile delivery metadata.
  saved.className=node.className;const meta=saved.querySelector('.message-meta'),fresh=node.querySelector('.message-meta');if(meta&&fresh&&meta.innerHTML!==fresh.innerHTML)meta.replaceWith(fresh);
  const retry=saved.querySelector('.retry-message'),newRetry=node.querySelector('.retry-message');if(retry&&!newRetry)retry.remove();else if(!retry&&newRetry)saved.append(newRetry);else if(retry&&newRetry)retry.disabled=false;
  return saved;});
 for(let i=0;i<next.length;i++)if(log.children[i]!==next[i])log.insertBefore(next[i],log.children[i]||null);
 bindVoiceNotes(log);
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

function voiceNoteMarkup(url){
 return '<div class="voice-note"><audio preload="metadata" src="'+url+'" aria-label="Voice note"></audio><button type="button" class="voice-note-play" aria-label="Play voice note">▶</button><div class="voice-note-track"><div class="voice-note-wave" aria-hidden="true">'+Array.from({length:32},(_,i)=>'<i style="height:'+([24,45,72,38,90,56,32,68][i%8])+'%"></i>').join('')+'</div><input class="voice-note-seek" type="range" min="0" max="100" value="0" step="0.1" aria-label="Seek voice note" disabled><div class="voice-note-details"><span>Voice note</span><output class="voice-note-time">0:00</output></div><span class="voice-note-error" role="status"></span></div><a class="voice-note-download" href="'+url+'?download=1" aria-label="Download voice note" title="Download voice note">↓</a></div>';
}
function installVoiceNoteStyle(){
 if(document.getElementById('voice-note-style'))return;
 const style=document.createElement('style');style.id='voice-note-style';style.textContent=`
 .voice-note{display:flex;align-items:center;gap:12px;width:320px;max-width:100%;box-sizing:border-box;padding:8px 2px;color:inherit}.voice-note audio{display:none}.voice-note-play{flex:0 0 44px;width:44px;height:44px;border:0;border-radius:50%;background:#a54d72;color:#fff;font-size:18px;cursor:pointer}.voice-note-track{position:relative;flex:1;min-width:0}.voice-note-wave{height:30px;display:flex;align-items:center;gap:3px;overflow:hidden}.voice-note-wave i{flex:1;min-width:2px;border-radius:3px;background:currentColor;opacity:.3}.voice-note-wave i.is-played{opacity:1}.voice-note-seek{position:absolute;top:0;left:0;width:100%;height:32px;margin:0;opacity:0;cursor:pointer}.voice-note-track:focus-within{outline:2px solid currentColor;outline-offset:4px;border-radius:5px}.voice-note-details{display:flex;justify-content:space-between;gap:8px;font-size:12px;margin-top:6px;line-height:1.4}.voice-note-download{color:inherit!important;text-decoration:none!important;font-size:22px!important;min-width:28px;text-align:center}.voice-note-play:focus-visible,.voice-note-download:focus-visible{outline:2px solid currentColor;outline-offset:3px}.voice-note-error{font-size:12px;display:block}.voice-note-error:empty{display:none}@media(max-width:420px){.voice-note{width:270px;gap:8px}.voice-note-wave{gap:2px}}
 `;document.head.append(style);
}
function bindVoiceNotes(log){
 const clock=value=>{const seconds=Math.max(0,Math.floor(Number.isFinite(value)?value:0));return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');};
 log.querySelectorAll('.voice-note').forEach(player=>{
  if(player.dataset.bound)return;player.dataset.bound='true';
  const audio=player.querySelector('audio'),button=player.querySelector('button'),seek=player.querySelector('input'),time=player.querySelector('output'),error=player.querySelector('[role="status"]'),bars=[...player.querySelectorAll('i')];
  const update=()=>{const duration=audio.duration,known=Number.isFinite(duration)&&duration>0,progress=known?audio.currentTime/duration:0;seek.disabled=!known;seek.value=String(progress*100);seek.setAttribute('aria-valuetext',clock(audio.currentTime)+(known?' of '+clock(duration):''));time.textContent=clock(audio.currentTime)+(known?' / '+clock(duration):'');button.textContent=audio.paused?'▶':'Ⅱ';button.setAttribute('aria-label',audio.paused?'Play voice note':'Pause voice note');bars.forEach((bar,i)=>bar.classList.toggle('is-played',i<progress*bars.length));};
  button.onclick=async()=>{error.textContent='';if(!audio.paused){audio.pause();return;}document.querySelectorAll('.voice-note audio').forEach(other=>{if(other!==audio)other.pause();});try{await audio.play();}catch{error.textContent='Unable to play. Tap play to retry or download the voice note.';}update();};
  seek.oninput=()=>{if(Number.isFinite(audio.duration)){audio.currentTime=Number(seek.value)/100*audio.duration;update();}};
  ['loadedmetadata','durationchange','timeupdate','play','pause','ended'].forEach(event=>audio.addEventListener(event,update));audio.addEventListener('error',()=>{error.textContent='Voice note unavailable. Try downloading it.';update();});update();
 });
}
