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
`;

await writeFile(path.join(matchRoot, 'sw.js'), output);
console.log(`Generated match/sw.js: ${files.length} entries, ${totalBytes} B, cache ${version}`);
