import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = await readFile(path.resolve(here, '../../sw.js'), 'utf8');
const precacheMatch = source.match(/const PRECACHE = (\[[\s\S]*?\]);/);
if (!precacheMatch) throw new Error('找不到 PRECACHE 清单');
const expectedPrecache = JSON.parse(precacheMatch[1]).length;
const handlers = {};
const stored = new Map();
let active = 0;
let maxActive = 0;
const fetches = [];

class MockResponse {
  constructor(body, ok = true) { this.body = body; this.ok = ok; this.status = ok ? 200 : 500; }
  clone() { return new MockResponse(this.body, this.ok); }
}

const cache = {
  async put(request, response) { stored.set(String(request.url || request), response); },
  async match(request, options = {}) {
    const key = String(request.url || request).split(options.ignoreSearch ? '?' : '\0')[0];
    for (const [storedKey, response] of stored) {
      if ((options.ignoreSearch ? storedKey.split('?')[0] : storedKey) === key) return response;
    }
    return undefined;
  },
};

const context = {
  URL,
  Response: { error: () => new MockResponse('error', false) },
  Error,
  Promise,
  Array,
  Math,
  setTimeout,
  clearTimeout,
  caches: {
    open: async () => cache,
    keys: async () => [],
    match: (...args) => cache.match(...args),
    delete: async () => true,
  },
  fetch: async (request, options = {}) => {
    const url = String(request.url || request);
    fetches.push({ url, cache: options.cache || '' });
    active++;
    maxActive = Math.max(maxActive, active);
    await new Promise(resolve => setTimeout(resolve, 2));
    active--;
    return new MockResponse(url);
  },
  self: {
    location: { origin: 'https://play.myskme.com' },
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
    addEventListener(type, fn) { handlers[type] = fn; },
  },
};

vm.runInNewContext(source, context, { filename: 'match/sw.js' });

let installPromise;
handlers.install({ waitUntil(promise) { installPromise = promise; } });
await installPromise;
const precacheFetches = fetches.filter(x => x.cache === 'reload');
if (precacheFetches.length !== expectedPrecache) throw new Error(`预缓存请求数错误：${precacheFetches.length}/${expectedPrecache}`);
if (maxActive > 2) throw new Error(`预缓存并发失控：${maxActive}`);
if (stored.size !== expectedPrecache) throw new Error(`预缓存落盘数错误：${stored.size}/${expectedPrecache}`);

let configPromise;
const configRequest = {
  method: 'GET',
  url: 'https://play.myskme.com/network-config.js?fresh=1',
  destination: 'script',
  mode: 'cors',
};
handlers.fetch({ request: configRequest, respondWith(promise) { configPromise = promise; } });
if (!configPromise) throw new Error('network-config.js 没有进入独立网络优先流程');
await configPromise;
const configFetch = fetches.at(-1);
if (configFetch.cache !== 'no-store') throw new Error(`网络配置仍可能吃旧缓存：${configFetch.cache || 'default'}`);

context.fetch = async () => { throw new Error('offline'); };
let offlineConfigPromise;
handlers.fetch({
  request: { ...configRequest, url: 'https://play.myskme.com/network-config.js?fresh=2' },
  respondWith(promise) { offlineConfigPromise = promise; },
});
const offlineConfig = await offlineConfigPromise;
if (!offlineConfig || !offlineConfig.ok) throw new Error('断网时没有回退到已缓存的网络配置');

let apiIntercepted = false;
handlers.fetch({
  request: {
    method: 'GET',
    url: 'https://play.myskme.com/api/gf/board?scope=depth',
    destination: '',
    mode: 'cors',
  },
  respondWith() { apiIntercepted = true; },
});
if (apiIntercepted) throw new Error('榜单 API 被 Service Worker 接管');

console.log(`PASS Service Worker：${expectedPrecache} 项预缓存最大并发 ${maxActive}；网络配置取新且可离线回退；榜单 API 永不缓存`);
