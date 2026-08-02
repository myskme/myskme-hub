/* 灵石远征 · EdgeOne 同源榜单代理
   玩家请求只允许转发到现有 Cloudflare Worker 的固定 /gf/* 协议；
   不记录请求体、不迁移数据库、不双写，D1 继续是唯一权威数据源。 */

const UPSTREAM_ORIGIN = 'https://myskme-leaderboard.wzc1020.workers.dev';
const ROUTES = new Map([
  ['/gf/board', new Set(['GET'])],
  ['/gf/submit', new Set(['POST'])],
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
  const allowed = ROUTES.get(path);
  if (!allowed) return json({ ok: false, err: 'not found' }, 404);

  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: baseHeaders() });
  if (!allowed.has(method)) {
    return json({ ok: false, err: 'method not allowed' }, 405, {
      Allow: [...allowed, 'OPTIONS'].join(', '),
    });
  }

  const upstreamUrl = new URL(path + url.search, UPSTREAM_ORIGIN);
  // 严格使用请求头白名单，避免把 play.myskme.com 将来可能出现的 Cookie、
  // Authorization 或浏览器来源信息带给榜单上游。
  const headers = new Headers({ Accept: 'application/json' });
  const contentType = request.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);
  headers.set('X-MYSKME-Proxy', 'edgeone');

  const timeout = method === 'POST' ? 12000 : 6500;
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
