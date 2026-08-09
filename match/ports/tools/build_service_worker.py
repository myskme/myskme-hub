#!/usr/bin/env python3
"""build-service-worker.mjs 的 Python 孪生版 —— 输出必须逐字节一致。

为什么要有这一份：王老师的两台 Mac 里有一台**没装 node**，
而 index.html 每改一次就必须重新生成 sw.js，否则缓存版本号不变、
装过 PWA 的玩家会一直吃旧代码（这个坑本项目踩过不止一次，
表现是「代码明明改了，浏览器里就是不生效」，极难往缓存上想）。

之前这份重写放在临时目录里，被清空过一次，于是有一次提交漏掉了 sw.js。
所以现在放进仓库跟着走。

**.mjs 仍然是正本**（CI 跑的是它）。改生成逻辑时两份都要改，
下面那条自检会比对两份输出是否一致——有 node 时才跑得动。

    python3 match/ports/tools/build_service_worker.py
"""
import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MATCH = os.path.abspath(os.path.join(HERE, "..", ".."))

CORE = [
    "index.html",
    "network-config.js",
    "manifest.json",
    "icons/favicon-32.png",
    "icons/icon-192.png",
    "icons/apple-touch-icon.png",
    "icons/app-icon-512.png",
]


def build():
    art = sorted(n for n in os.listdir(os.path.join(MATCH, "art")) if n.endswith(".webp"))
    files = CORE + ["art/" + n for n in art]

    h = hashlib.sha256()
    total = 0
    for rel in files:
        p = os.path.join(MATCH, rel)
        if not os.path.isfile(p):
            sys.exit(f"× 预缓存项不是文件：{rel}")
        with open(p, "rb") as f:
            content = f.read()
        total += len(content)
        # 与 .mjs 一致：路径、NUL、内容、NUL（hashlib 的 update 返回 None，不能链式写）
        h.update(rel.encode())
        h.update(b"\0")
        h.update(content)
        h.update(b"\0")
    version = h.hexdigest()[:16]

    # JSON.stringify(x, null, 2) 的等价写法：2 空格缩进、冒号后一个空格
    precache = json.dumps(["./" + f for f in files], indent=2, ensure_ascii=False)

    return version, files, total, precache


TEMPLATE = '''/* 此文件由 match/ports/tools/build-service-worker.mjs 生成，请勿手改。
   版本 {version}；预缓存 {count} 项 / {total} B。
   音乐与 iOS 启动图不预缓存：首次打开不应在后台额外下载约 19MB。 */
'use strict';

const CACHE_PREFIX = 'gemfall-static-';
const CACHE_NAME = CACHE_PREFIX + '{version}';
const PRECACHE = {precache};
const PRECACHE_CONCURRENCY = 2;

/* 旧版 cache.addAll 会把 61 个请求同时推上移动网络。每次发版换缓存指纹时，
   它恰好与开局榜单同步争带宽，弱网下就表现成“更新后榜单连不上”。
   两路受控预取仍保持完整离线包，但不再用一阵请求淹没 API。 */
async function precacheAll(cache) {{
  let cursor = 0;
  const worker = async () => {{
    while (cursor < PRECACHE.length) {{
      const url = PRECACHE[cursor++];
      const response = await fetch(url, {{ cache: 'reload' }});
      if (!response || !response.ok) throw new Error('Precache failed: ' + url);
      await cache.put(url, response);
    }}
  }};
  const count = Math.min(PRECACHE_CONCURRENCY, PRECACHE.length);
  await Promise.all(Array.from({{ length: count }}, () => worker()));
}}

self.addEventListener('install', event => {{
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => precacheAll(cache))
      .then(() => self.skipWaiting())
  );
}});

self.addEventListener('activate', event => {{
  event.waitUntil((async () => {{
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  }})());
}});

async function navigation(request) {{
  const cache = await caches.open(CACHE_NAME);
  try {{
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  }} catch (error) {{
    return (await cache.match(request, {{ ignoreSearch: true }}))
      || (await cache.match('./index.html'))
      || Response.error();
  }}
}}

async function staticAsset(request) {{
  const cached = await caches.match(request, {{ ignoreSearch: true }});
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {{
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }}
  return response;
}}

/* network-config.js 决定榜单入口，不能像普通静态脚本一样永久 cache-first。
   EdgeOne 会给静态文件很长的 immutable 缓存；这里强制取最新，断网才退回离线副本。 */
async function networkConfig(request) {{
  const cache = await caches.open(CACHE_NAME);
  try {{
    const response = await fetch(request, {{ cache: 'no-store' }});
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  }} catch (error) {{
    return (await cache.match(request, {{ ignoreSearch: true }})) || Response.error();
  }}
}}

self.addEventListener('fetch', event => {{
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  /* fetch()/排行榜请求的 destination 为空：永远直连，绝不能把榜单 JSON 缓存下来。 */
  if (request.destination === '') return;
  if (url.pathname.endsWith('/network-config.js')) {{
    event.respondWith(networkConfig(request));
    return;
  }}
  if (request.mode === 'navigate') {{
    event.respondWith(navigation(request));
    return;
  }}
  if (['image', 'audio', 'font', 'style', 'script', 'manifest'].includes(request.destination)) {{
    event.respondWith(staticAsset(request));
  }}
}});
'''


if __name__ == "__main__":
    version, files, total, precache = build()
    out = TEMPLATE.format(version=version, count=len(files), total=total, precache=precache)
    with open(os.path.join(MATCH, "sw.js"), "w", encoding="utf-8") as f:
        f.write(out)
    print(f"Generated match/sw.js: {len(files)} entries, {total} B, cache {version}")
