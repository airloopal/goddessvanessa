import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const pages=fs.readdirSync('public').filter(p=>p.endsWith('.html'));
const titles=new Set(),descriptions=new Set();
for(const page of pages){
 const html=fs.readFileSync('public/'+page,'utf8');
 const title=html.match(/<title>(.*?)<\/title>/)?.[1];
 const description=html.match(/<meta name="description" content="(.*?)">/)?.[1];
 assert(title&&description,page+' has meaningful metadata');
 assert(!titles.has(title)&&!descriptions.has(description),'unique page metadata');titles.add(title);descriptions.add(description);
 assert(html.includes('og:image')&&html.includes('twitter:image'),page+' share image');
 if(!['index.html','privacy.html'].includes(page))assert(html.includes('content="noindex, nofollow"'),page+' stays private');
 else assert(html.includes('rel="canonical"'),page+' canonical');
}
const home=fs.readFileSync('public/index.html','utf8');const raw=home.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1];
assert.equal(JSON.parse(raw)['@graph'][0]['@type'],'WebSite');
const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));const hash=crypto.createHash('sha256').update(raw).digest('base64');
assert(config.headers[0].headers.find(h=>h.key==='Content-Security-Policy').value.includes("'sha256-"+hash+"'"),'structured data allowed without weakening script policy');
const sitemap=fs.readFileSync('public/sitemap.xml','utf8');assert.equal((sitemap.match(/<loc>/g)||[]).length,2);assert(!sitemap.includes('chat.html'));
console.log('SEO checks passed: unique metadata, public canonical URLs, private exclusions, social previews and CSP-safe schema.');
