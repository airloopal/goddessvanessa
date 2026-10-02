// Notifications only: never cache private pages, messages or media.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick',event=>{event.notification.close();const id=event.notification.data?.studentId;event.waitUntil((async()=>{const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});const dashboard=clients.find(c=>new URL(c.url).pathname==='/dashboard.html');if(dashboard){await dashboard.focus();if(id)dashboard.postMessage({type:'open-chat',studentId:id});return;}const url=new URL('/dashboard.html',self.location.origin);if(typeof id==='string')url.searchParams.set('conversation',id);await self.clients.openWindow(url.href);})());});
