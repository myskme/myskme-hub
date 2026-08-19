import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const matchRoot = path.resolve(here, '../..');

async function importSource(relative) {
  const source = await readFile(path.join(matchRoot, relative), 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${Date.now()}-${relative}`);
}

const proxy = (await importSource('edge-functions/api/[[default]].js')).default;
const health = (await importSource('edge-functions/api/index.js')).default;
const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass: Boolean(pass), detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` · ${detail}` : ''}`);
};

const originalFetch = globalThis.fetch;
let calls = [];
globalThis.fetch = async (url, init = {}) => {
  const body = init.body ? new TextDecoder().decode(init.body) : '';
  calls.push({ url: String(url), init, body });
  return new Response(JSON.stringify({ ok: true, rows: [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};

try {
  const healthResponse = health({ request: new Request('https://play.myskme.com/api/') });
  const healthBody = await healthResponse.json();
  check('健康检查不触碰上游', healthResponse.status === 200
    && healthBody.service === 'myskme-edge-gateway'
    && healthBody.namespaces?.join(',') === 'gf,monkey,quiz,game,publish'
    && calls.length === 0);

  calls = [];
  const board = await proxy({
    request: new Request('https://play.myskme.com/api/gf/board?scope=world&limit=5', {
      headers: {
        Authorization: 'Bearer should-not-forward',
        Cookie: 'session=should-not-forward',
        Origin: 'https://play.myskme.com',
      },
    }),
  });
  check('榜单读取准确映射到现有 Worker', calls.length === 1
    && calls[0].url === 'https://myskme-leaderboard.wzc1020.workers.dev/gf/board?scope=world&limit=5',
  calls[0]?.url || 'no request');
  check('代理只转发白名单请求头', !calls[0].init.headers.has('Origin')
    && !calls[0].init.headers.has('Host')
    && !calls[0].init.headers.has('Cookie')
    && !calls[0].init.headers.has('Authorization')
    && calls[0].init.headers.get('Accept') === 'application/json');
  check('榜单响应禁止缓存并标识代理', board.headers.get('Cache-Control') === 'no-store'
    && board.headers.get('X-MYSKME-Proxy') === 'edgeone');

  calls = [];
  const submitBody = JSON.stringify({ deviceUUID: 'gf-test-device', alias: '测试矿工', stats: {} });
  const submit = await proxy({
    request: new Request('https://play.myskme.com/api/gf/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: submitBody,
    }),
  });
  check('成绩提交保持 text/plain 与原始 JSON', calls.length === 1
    && calls[0].init.headers.get('Content-Type') === 'text/plain;charset=UTF-8'
    && calls[0].body === submitBody);
  check('成绩提交仍只写同一个 Worker', calls[0]?.url
    === 'https://myskme-leaderboard.wzc1020.workers.dev/gf/submit', calls[0]?.url || 'no request');
  check('跨端 CORS 仍可读取代理结果', submit.headers.get('Access-Control-Allow-Origin') === '*');

  calls = [];
  await proxy({
    request: new Request('https://play.myskme.com/api/quiz/board?scope=world&limit=20'),
  });
  check('词灵榜读取映射到排行榜 Worker 根路由', calls.length === 1
    && calls[0].url === 'https://myskme-leaderboard.wzc1020.workers.dev/board?scope=world&limit=20',
  calls[0]?.url || 'no request');

  calls = [];
  await proxy({
    request: new Request('https://play.myskme.com/api/quiz/hall?scope=world&limit=60'),
  });
  await proxy({
    request: new Request('https://play.myskme.com/api/quiz/factions?scope=world&limit=30'),
  });
  check('词灵榜名人堂与门派榜均准确映射', calls.length === 2
    && calls[0].url.includes('/hall?') && calls[1].url.includes('/factions?'));

  calls = [];
  await proxy({
    request: new Request('https://play.myskme.com/api/quiz/submit', {
      method: 'POST', body: JSON.stringify({ deviceUUID: 'quiz-test' }),
      headers: { 'Content-Type': 'application/json' },
    }),
  });
  check('词灵对决提交仍写原排行榜 Worker', calls.length === 1
    && calls[0].url === 'https://myskme-leaderboard.wzc1020.workers.dev/submit');

  calls = [];
  await proxy({
    request: new Request('https://play.myskme.com/api/quiz/admin', {
      method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' },
    }),
  });
  check('教师审核入口固定映射且密码不由网关处理', calls.length === 1
    && calls[0].url === 'https://myskme-leaderboard.wzc1020.workers.dev/admin');

  calls = [];
  await proxy({ request: new Request('https://play.myskme.com/api/game?config') });
  check('多作品游戏 API 查询映射到既有 game Worker', calls.length === 1
    && calls[0].url === 'https://myskme-game-api.wzc1020.workers.dev/?config');

  calls = [];
  const gameBody = JSON.stringify({ action: 'dmtop', board: 'zmq', day: '0' });
  await proxy({
    request: new Request('https://play.myskme.com/api/game', {
      method: 'POST', body: gameBody, headers: { 'Content-Type': 'application/json' },
    }),
  });
  check('多作品游戏 API 写请求保持原文且不串库', calls.length === 1
    && calls[0].url === 'https://myskme-game-api.wzc1020.workers.dev/'
    && calls[0].body === gameBody
    && calls[0].init.headers.get('Origin') === 'https://myskme.github.io');

  calls = [];
  await proxy({
    request: new Request('https://play.myskme.com/api/publish', {
      method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' },
    }),
  });
  check('课堂发布入口只转发到既有 publish Worker', calls.length === 1
    && calls[0].url === 'https://myskme-publish.wzc1020.workers.dev/');

  calls = [];
  const blocked = await proxy({ request: new Request('https://play.myskme.com/api/https://evil.example/') });
  check('非白名单路径被拦截，不构成开放代理', blocked.status === 404 && calls.length === 0);

  const wrongMethod = await proxy({
    request: new Request('https://play.myskme.com/api/gf/board', { method: 'POST', body: '{}' }),
  });
  check('错误方法返回 405 且不触碰上游', wrongMethod.status === 405 && calls.length === 0);

  globalThis.fetch = async () => { throw new TypeError('upstream unavailable'); };
  const unavailable = await proxy({
    request: new Request('https://play.myskme.com/api/gf/board?scope=world'),
  });
  const unavailableBody = await unavailable.json();
  check('上游故障明确返回可重试 502', unavailable.status === 502
    && unavailableBody.offline === true);
} finally {
  globalThis.fetch = originalFetch;
}

const failed = results.filter(result => !result.pass);
console.log(failed.length ? `FAIL EdgeOne 代理 ${failed.length}/${results.length} 项未通过`
  : `PASS EdgeOne 代理全部 ${results.length} 项通过`);
if (failed.length) process.exitCode = 1;
