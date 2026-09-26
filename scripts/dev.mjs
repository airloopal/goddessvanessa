import http from 'node:http';
import {Readable} from 'node:stream';
import worker from '../dist/server/index.js';
import {handle} from '../api/index.js';
const server=http.createServer(async(req,res)=>{try{const url='http://localhost:3000'+req.url;const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});const result=new URL(url).pathname.startsWith('/api/')?await handle(request):await worker.fetch(request,{});res.statusCode=result.status;for(const [k,v] of result.headers)if(k!=='set-cookie')res.setHeader(k,v);const cookies=result.headers.getSetCookie();if(cookies.length)res.setHeader('set-cookie',cookies);if(result.body)Readable.fromWeb(result.body).pipe(res);else res.end();}catch{res.writeHead(500);res.end('Local server error');}});
server.listen(3000,'127.0.0.1',()=>console.log('Local preview: http://localhost:3000. Live login requires HTTPS deployment.'));
