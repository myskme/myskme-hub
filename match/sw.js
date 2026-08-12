/* 此文件由 match/ports/tools/build-service-worker.mjs 生成，请勿手改。
   版本 337cd15b724c01c8；预缓存 67 项 / 3295718 B。
   音乐与 iOS 启动图不预缓存：首次打开不应在后台额外下载约 19MB。 */
'use strict';

const CACHE_PREFIX = 'gemfall-static-';
const CACHE_NAME = CACHE_PREFIX + '337cd15b724c01c8';
const PRECACHE = [
  "./index.html",
  "./network-config.js",
  "./manifest.json",
  "./icons/favicon-32.png",
  "./icons/icon-192.png",
  "./icons/apple-touch-icon.png",
  "./icons/app-icon-512.png",
  "./art/ally-jun.webp",
  "./art/ally-qi.webp",
  "./art/ally-wolf.webp",
  "./art/ally-xi.webp",
  "./art/ally-xiao.webp",
  "./art/ally-zi.webp",
  "./art/boss-both.webp",
  "./art/boss-hang.webp",
  "./art/boss-intro.webp",
  "./art/boss-parrot.webp",
  "./art/boss-she.webp",
  "./art/boss-ye.webp",
  "./art/boss-yin.webp",
  "./art/box-closed.webp",
  "./art/box-open.webp",
  "./art/card-back.webp",
  "./art/card-cage.webp",
  "./art/card-crate.webp",
  "./art/card-crate2.webp",
  "./art/card-ink.webp",
  "./art/card-ink2.webp",
  "./art/card-vista-1.webp",
  "./art/card-vista-2.webp",
  "./art/card-vista-3.webp",
  "./art/card-vista-4.webp",
  "./art/card-vista-5.webp",
  "./art/card-vista-6.webp",
  "./art/card-vista-7.webp",
  "./art/card-vista-8.webp",
  "./art/cat.webp",
  "./art/chapter-1.webp",
  "./art/chapter-2.webp",
  "./art/chapter-3.webp",
  "./art/chapter-4.webp",
  "./art/chapter-5.webp",
  "./art/chapter-6.webp",
  "./art/chapter-7.webp",
  "./art/chapter-8.webp",
  "./art/chapter-endless.webp",
  "./art/chest.webp",
  "./art/gem-0.webp",
  "./art/gem-1.webp",
  "./art/gem-2.webp",
  "./art/gem-3.webp",
  "./art/gem-4.webp",
  "./art/gem-5.webp",
  "./art/gem-orb.webp",
  "./art/hero.webp",
  "./art/lamp.webp",
  "./art/lose.webp",
  "./art/ob-bell.webp",
  "./art/ob-cage.webp",
  "./art/ob-crate.webp",
  "./art/ob-crate2.webp",
  "./art/ob-ink.webp",
  "./art/ob-ink2.webp",
  "./art/support-jia.webp",
  "./art/support-nuo.webp",
  "./art/support-yue.webp",
  "./art/win.webp"
];
const PRECACHE_CONCURRENCY = 2;

/* 旧版 cache.addAll 会把 61 个请求同时推上移动网络。每次发版换缓存指纹时，
   它恰好与开局榜单同步争带宽，弱网下就表现成“更新后榜单连不上”。
   两路受控预取仍保持完整离线包，但不再用一阵请求淹没 API。 */
async function precacheAll(cache) {
  let cursor = 0;
  const worker = async () => {
    while (cursor < PRECACHE.length) {
      const url = PRECACHE[cursor++];
      const response = await fetch(url, { cache: 'reload' });
      if (!response || !response.ok) throw new Error('Precache failed: ' + url);
      await cache.put(url, response);
    }
  };
  const count = Math.min(PRECACHE_CONCURRENCY, PRECACHE.length);
  await Promise.all(Array.from({ length: count }, () => worker()));
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => precacheAll(cache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function navigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    return (await cache.match(request, { ignoreSearch: true }))
      || (await cache.match('./index.html'))
      || Response.error();
  }
}

async function staticAsset(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

/* network-config.js 决定榜单入口，不能像普通静态脚本一样永久 cache-first。
   EdgeOne 会给静态文件很长的 immutable 缓存；这里强制取最新，断网才退回离线副本。 */
async function networkConfig(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    return (await cache.match(request, { ignoreSearch: true })) || Response.error();
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  /* fetch()/排行榜请求的 destination 为空：永远直连，绝不能把榜单 JSON 缓存下来。 */
  if (request.destination === '') return;
  if (url.pathname.endsWith('/network-config.js')) {
    event.respondWith(networkConfig(request));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(navigation(request));
    return;
  }
  if (['image', 'audio', 'font', 'style', 'script', 'manifest'].includes(request.destination)) {
    event.respondWith(staticAsset(request));
  }
});
