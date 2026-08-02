/* /api/ 健康检查只证明 EdgeOne Function 已运行；不读取或写入榜单。 */

function headers() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-MYSKME-Proxy': 'edgeone',
  };
}

export default function onRequest(context) {
  const method = String(context?.request?.method || 'GET').toUpperCase();
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: headers() });
  if (method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, err: 'method not allowed' }), {
      status: 405,
      headers: { ...headers(), Allow: 'GET, OPTIONS' },
    });
  }
  return new Response(JSON.stringify({
    ok: true,
    service: 'myskme-edge-gateway',
    upstream: 'existing-databases',
    namespaces: ['gf', 'quiz', 'game', 'publish'],
  }), { status: 200, headers: headers() });
}
