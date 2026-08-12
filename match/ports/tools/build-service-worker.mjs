import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const matchRoot = path.join(repoRoot, 'match');

const core = [
  'index.html',
  'network-config.js',
  'vendor/qrcode-generator.js',
  'manifest.json',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/apple-touch-icon.png',
  'icons/app-icon-512.png',
];
const art = (await readdir(path.join(matchRoot, 'art')))
  .filter(name => name.endsWith('.webp'))
  .sort()
  .map(name => `art/${name}`);
const files = [...core, ...art];

const hash = createHash('sha256');
let totalBytes = 0;
for (const relative of files) {
  const absolute = path.join(matchRoot, relative);
  const info = await stat(absolute);
  if (!info.isFile()) throw new Error(`Precache entry is not a file: ${relative}`);
  const content = await readFile(absolute);
  totalBytes += content.byteLength;
  hash.update(relative).update('\0').update(content).update('\0');
}
const version = hash.digest('hex').slice(0, 16);
const precache = files.map(file => `./${file}`);

const output = `/* 此文件由 match/ports/tools/build-service-worker.mjs 生成，请勿手改。
   版本 ${version}；预缓存 ${files.length} 项 / ${totalBytes} B。
   音乐与 iOS 启动图不预缓存：首次打开不应在后台额外下载约 19MB。 */
'use strict';

const CACHE_PREFIX = 'gemfall-static-';
const CACHE_NAME = CACHE_PREFIX + '${version}';
const PRECACHE = ${JSON.stringify(precache, null, 2)};
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
`;

await writeFile(path.join(matchRoot, 'sw.js'), output);
console.log(`Generated match/sw.js: ${files.length} entries, ${totalBytes} B, cache ${version}`);
