const CACHE='myskme-monkey-20260813-4';
const CORE=['./','./index.html','./manifest.webmanifest','./vendor/qrcode-generator.js','./icons/monkey-100.svg','./icons/monkey-100-180.png','./icons/monkey-100-192.png','./icons/monkey-100-512.png','./icons/monkey-100-maskable-512.png'];

// 安装时必须用 cache:'reload' 绕开浏览器自己的 HTTP 缓存。
// 0812 踩到的：鱼小姐改青绿后，游戏内立绘变了（导航是网络优先），但**成绩海报里还是金鱼**——
// 因为海报画的是 app 图标 PNG，而 cache.addAll 会走 HTTP 缓存，把 EdgeOne 上长缓存的旧金鱼图
// 原封不动装进新版 SW 缓存里。版本号明明升了，资源却是旧的。
// 自鸣棋那边早就修过同一个坑（见其协作日志 0810 网络加固那条），猴子这边当时没跟上。
self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>Promise.all(CORE.map(url=>
    fetch(new Request(url,{cache:'reload'})).then(res=>{ if(res.ok) return cache.put(url,res); })
  ))).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('myskme-monkey-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;
  if(event.request.mode==='navigate'){
    // 只有真正成功的响应才准覆盖离线副本。服务端抽一次风（5xx/错误页）就把
    // 离线版永久换成错误页，玩家断网再打开只剩一张 503——下面静态资源那条一直有这道门，导航这条漏了。
    event.respondWith(fetch(event.request).then(response=>{
      if(response&&response.ok&&response.type!=='opaque'){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy));}
      return response;
    }).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;})));
});
