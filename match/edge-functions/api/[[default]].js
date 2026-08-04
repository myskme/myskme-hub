/* MYSKME · EdgeOne 品牌 API 网关
   只把明确列入白名单的路径转发到三套既有 Cloudflare Worker；不记录请求体、
   不迁移数据库、不双写，各 Worker 背后的原数据库继续是唯一权威数据源。 */

const UPSTREAMS = Object.freeze({
  leaderboard: 'https://myskme-leaderboard.wzc1020.workers.dev',
  game: 'https://myskme-game-api.wzc1020.workers.dev',
  publish: 'https://myskme-publish.wzc1020.workers.dev',
});
const ROUTES = new Map([
  ['/gf/board', { origin: UPSTREAMS.leaderboard, upstreamPath: '/gf/board', methods: new Set(['GET']) }],
  ['/gf/factions', { origin: UPSTREAMS.leaderboard, upstreamPath: '/gf/factions', methods: new Set(['GET']) }],
  ['/gf/camps', { origin: UPSTREAMS.leaderboard, upstreamPath: '/gf/camps', methods: new Set(['GET']) }],
  ['/gf/submit', { origin: UPSTREAMS.leaderboard, upstreamPath: '/gf/submit', methods: new Set(['POST']) }],
  ['/gf/admin', { origin: UPSTREAMS.leaderboard, upstreamPath: '/gf/admin', methods: new Set(['POST']) }],
  ['/quiz/board', { origin: UPSTREAMS.leaderboard, upstreamPath: '/board', methods: new Set(['GET']) }],
  ['/quiz/factions', { origin: UPSTREAMS.leaderboard, upstreamPath: '/factions', methods: new Set(['GET']) }],
  ['/quiz/hall', { origin: UPSTREAMS.leaderboard, upstreamPath: '/hall', methods: new Set(['GET']) }],
  ['/quiz/submit', { origin: UPSTREAMS.leaderboard, upstreamPath: '/submit', methods: new Set(['POST']) }],
  ['/quiz/admin', { origin: UPSTREAMS.leaderboard, upstreamPath: '/admin', methods: new Set(['POST']) }],
  ['/game', {
    origin: UPSTREAMS.game,
    upstreamPath: '/',
    methods: new Set(['GET', 'POST']),
    // 原 game Worker 用 GitHub Pages Origin 做来源校验。这里写死服务端来源，
    // 不透传客户端 Origin，避免伪造或把未来其他站点信息带给上游。
    originHeader: 'https://myskme.github.io',
  }],
  ['/publish', { origin: UPSTREAMS.publish, upstreamPath: '/', methods: new Set(['POST']) }],
]);

function baseHeaders(contentType = 'application/json; charset=utf-8') {
  return new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'X-MYSKME-Proxy': 'edgeone',
  });
}

function json(body, status = 200, extraHeaders = {}) {
  const headers = baseHeaders();
  for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, value);
  return new Response(JSON.stringify(body), { status, headers });
}

function routeFrom(requestUrl) {
  const url = new URL(requestUrl);
  const path = url.pathname.replace(/^\/api(?=\/|$)/, '') || '/';
  return { url, path };
}

export default async function onRequest(context) {
  const request = context && context.request;
  if (!request) return json({ ok: false, err: 'missing request' }, 500);

  const method = String(request.method || 'GET').toUpperCase();
  const { url, path } = routeFrom(request.url);
  const route = ROUTES.get(path);
  if (!route) return json({ ok: false, err: 'not found' }, 404);

  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: baseHeaders() });
  if (!route.methods.has(method)) {
    return json({ ok: false, err: 'method not allowed' }, 405, {
      Allow: [...route.methods, 'OPTIONS'].join(', '),
    });
  }

  const upstreamUrl = new URL(route.upstreamPath + url.search, route.origin);
  // 严格使用请求头白名单，避免把 play.myskme.com 将来可能出现的 Cookie、
  // Authorization 或浏览器来源信息带给榜单上游。
  const headers = new Headers({ Accept: 'application/json' });
  const contentType = request.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);
  if (route.originHeader) headers.set('Origin', route.originHeader);
  headers.set('X-MYSKME-Proxy', 'edgeone');

  const timeout = method === 'POST' ? 20000 : 10000;
  const init = {
    method,
    headers,
    redirect: 'manual',
    eo: {
      timeoutSetting: {
        connectTimeout: Math.min(4000, timeout),
        readTimeout: timeout,
        writeTimeout: timeout,
      },
    },
  };
  if (method !== 'GET' && method !== 'HEAD') init.body = await request.arrayBuffer();

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, init);
  } catch (_error) {
    return json({ ok: false, err: '矿脉榜上游暂不可用', offline: true }, 502);
  }

  const responseHeaders = baseHeaders(
    upstream.headers.get('Content-Type') || 'application/json; charset=utf-8',
  );
  const retryAfter = upstream.headers.get('Retry-After');
  if (retryAfter) responseHeaders.set('Retry-After', retryAfter);
  responseHeaders.set('X-MYSKME-Upstream-Status', String(upstream.status));

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
