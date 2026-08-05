/* 此文件由 match/ports/tools/build-service-worker.mjs 生成，请勿手改。
   版本 4fc1ec6aaf38633f；预缓存 63 项 / 2952786 B。
   音乐与 iOS 启动图不预缓存：首次打开不应在后台额外下载约 19MB。 */
'use strict';

const CACHE_PREFIX = 'gemfall-static-';
const CACHE_NAME = CACHE_PREFIX + '4fc1ec6aaf38633f';
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
  "./art/boss-intro.webp",
  "./art/boss-she.webp",
  "./art/boss-ye.webp",
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
  "./art/lb-banner.webp",
  "./art/lose.webp",
  "./art/ob-bell.webp",
  "./art/ob-cage.webp",
  "./art/ob-crate.webp",
  "./art/ob-crate2.webp",
  "./art/ob-ink.webp",
  "./art/ob-ink2.webp",
  "./art/party-banner.webp",
  "./art/win.webp"
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
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

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  /* fetch()/排行榜请求的 destination 为空：永远直连，绝不能把榜单 JSON 缓存下来。 */
  if (request.destination === '') return;
  if (request.mode === 'navigate') {
    event.respondWith(navigation(request));
    return;
  }
  if (['image', 'audio', 'font', 'style', 'script', 'manifest'].includes(request.destination)) {
    event.respondWith(staticAsset(request));
  }
});
