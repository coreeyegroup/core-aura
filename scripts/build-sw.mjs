import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const { version } = JSON.parse(await readFile("package.json", "utf8"));
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "packs") out.push(...(await files(p)));
    } else if (!["sw.js", "health.json"].includes(e.name))
      out.push("/" + path.relative("dist", p).split(path.sep).join("/"));
  }
  return out;
}
const assets = ["/", ...(await files("dist"))];
const worker = `
const version=${JSON.stringify(version)};
const key='core-aura-v'+version;
const assets=${JSON.stringify(assets)};
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(key);
  try {
    for(const asset of assets) {
      const response=await fetch(asset+'?release='+version,{cache:'reload'});
      if(!response.ok) throw Error('Incomplete release');
      await cache.put(asset,response);
    }
    const health=await fetch('/health.json?release='+version,{cache:'no-store'}).then(r=>r.json());
    if(health.version!==version) throw Error('Release changed while downloading');
  } catch(error) {await caches.delete(key);throw error;}
})()));
self.addEventListener('message',event=>{
  if(event.data==='VERSION') event.ports[0]?.postMessage(version);
  if(event.data==='APPLY_UPDATE') event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('core-aura-')&&k!==key).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
));
self.addEventListener('push',event=>{
  event.waitUntil((async()=>{let data={};try{data=event.data?.json()||{};}catch{}const planId=typeof data.planId==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(data.planId)?data.planId:'';await self.registration.showNotification(/^chakra-(session|playlist)-/.test(planId)?'Chakra meditation':'Manifestation practice',{body:typeof data.body==='string'?data.body.slice(0,80):'Time for your practice.',tag:typeof data.tag==='string'?data.tag.slice(0,64):'core-aura-practice',icon:'/icon-192.png',data:{planId}});})());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();const planId=event.notification.data?.planId;
  if(typeof planId!=='string') return;
  event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const client=windows.find(c=>new URL(c.url).origin===self.location.origin);if(client){await client.focus();client.postMessage({type:'OPEN_MANIFESTATION',planId});}else await self.clients.openWindow('/?manifestPlan='+encodeURIComponent(planId)+(/^chakra-(session|playlist)-/.test(planId)?'#chakras':'#manifest'));})());
});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!assets.includes(url.pathname)) return;
  event.respondWith(caches.open(key).then(async cache=>{
    if(event.request.mode==='navigate') {
      try {
        const response=await fetch(event.request,{cache:'no-cache'});
        if(response.ok) return response;
        return (await cache.match(url.pathname)) || response;
      } catch(error) {
        const fallback=await cache.match(url.pathname);
        if(fallback) return fallback;
        throw error;
      }
    }
    return (await cache.match(url.pathname)) || fetch(event.request);
  }));
});
`;
await writeFile("dist/sw.js", worker);
await writeFile(
  "dist/health.json",
  JSON.stringify({ status: "ok", version }) + "\n",
);
await writeFile(
  "dist/catalog.json",
  JSON.stringify({
    version,
    engineVersion: "2.0",
    contentReview: "Synthesis studies. Practitioner review pending.",
  }) + "\n",
);
console.log("Prepared versioned offline player", version);
