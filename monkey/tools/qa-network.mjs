#!/usr/bin/env node
// 拿一个**可编排的假网络**跑一遍世界楼榜的补交队列。
//
// 为什么要有这个文件：2026-08-14 王老师说「网络上传成绩也是不咋地」。
// 查下来根因不是某个 bug，是**根本没有重试**——`flushWorldQueue` 一遇网络级失败就收工，
// 而它只被「打完一局 / 点登记 / 打开楼榜 / online 事件 / 开局 900ms」叫醒。
// 手机上一次很常见的抖动，就让这一局躺在队列里等到玩家哪天碰巧再打开楼榜，
// 屏幕上「待联网」三个字挂在那儿一动不动。
//
// 这类问题**只能这么验**：数源码里有没有 setTimeout 证明不了任何事，
// 页面里的 ?qa=1 也只能验退避器本身排不排得上。真正要回答的是
// 「网络抖成这样时，成绩最后到底有没有交上去」——那就得有一个会按剧本抖的网络。
//
// 判据（每一条都对应一种真实的网络长相）：
//   1. 一次抖动 -> 当场重试就该救回来，不该惊动退避器
//   2. 连续失败 -> 必须自己排上退避重试，并且到点真的会再发
//   3. 化名被退回（HTTP 400）-> 一次都不许重试，重试一万次也没用
//   4. 队列里有一条被退回 -> 不许堵住后面那几条（0813 修过，别回归）
//   5. 回到前台 -> 立刻再试，不用干等退避到点
//   6. 反复切前后台 -> 不许打出请求风暴（实测没节流时 2 秒能发 60 个）
//
// 用法（需要本机有 Playwright 与 Chromium；CI 里没有浏览器，所以这是收工前手动跑的）：
//   node monkey/tools/qa-network.mjs
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROME_PATH=/path/to/chrome node monkey/tools/qa-network.mjs

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json',
};

const playwrightModule = process.env.PLAYWRIGHT_MODULE || 'playwright';
let chromium;
try {
  ({ chromium } = await import(playwrightModule));
} catch {
  console.error('[跳过] 找不到 Playwright（' + playwrightModule + '）。');
  console.error('       别把「跳过」当成「通过」：网络抖动时成绩交不交得上，只有真跑过才知道。');
  process.exit(127);
}

const server = http.createServer(async (req, res) => {
  let file = decodeURIComponent(req.url.split('?')[0]);
  if (file === '/') file = '/index.html';
  try {
    const buffer = await readFile(path.join(ROOT, file));
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buffer);
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise(resolve => server.listen(0, resolve));
const base = 'http://127.0.0.1:' + server.address().port;

const launch = {};
if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
const browser = await chromium.launch(launch);
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const pageErrors = [];
page.on('pageerror', event => pageErrors.push('pageerror: ' + event.message));
await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.click('#splash').catch(() => {});
await page.waitForTimeout(1300);

// 假网络：记下每次请求，按剧本决定成败。
// 剧本用完之后一律成功——「抖过之后网络恢复了」才是最常见的收场。
await page.evaluate(() => {
  window.__net = { calls: [], script: [] };
  window.fetch = async (url, options) => {
    const body = options && options.body ? JSON.parse(options.body) : null;
    window.__net.calls.push({ runId: body && body.run && body.run.runId });
    const verdict = window.__net.script.length ? window.__net.script.shift() : 'ok';
    if (verdict === 'net') throw new TypeError('Failed to fetch');
    // 真服务器退回化名时是 HTTP 400。写成 200 + ok:false 会被当成网络抖动重试，
    // 那样验出来的就不算数——**用例不像真的，结论就不像真的**。
    if (verdict === '400') return { ok: false, status: 400, json: async () => ({ ok: false, err: '化名是保留词' }) };
    return { ok: true, status: 200, json: async () => ({ ok: true, acceptedRunId: body.run.runId, playerToken: 'a'.repeat(64) }) };
  };
});

const arm = (rows, script) => page.evaluate(({ rows, script }) => {
  cancelWorldRetry();
  worldBlockedReason = ''; worldSyncMessage = '';
  localStorage.setItem('myskme_monkey_world_v1', '1');
  localStorage.setItem('myskme_monkey_alias_v1', '测试猴');
  localStorage.setItem('myskme_monkey_pending_v1', JSON.stringify(rows));
  window.__net.calls = []; window.__net.script = script;
}, { rows, script });

const run = id => ({ runId: id, height: 100, score: 200, bananas: 10 });
const snap = () => page.evaluate(() => ({
  calls: window.__net.calls.map(c => c.runId),
  pending: pendingWorldCount(),
  round: worldRetryRound,
  timer: !!worldRetryTimer,
  blocked: worldBlockedReason,
  status: el.worldStatus.textContent,
}));

let failed = 0;
const check = (name, ok, detail) => {
  if (ok) console.log('[过] ' + name);
  else { failed += 1; console.log('[败] ' + name + ' —— ' + JSON.stringify(detail)); }
};

// 1. 一次抖动，当场重试救回来
await arm([run('jitter00001')], ['net']);
await page.evaluate(() => flushWorldQueue());
let s = await snap();
check('一次抖动：当场重试就交上去了，不惊动退避器',
  s.pending === 0 && s.calls.length === 2 && !s.timer, s);

// 2. 连续失败：必须排上退避，并且到点真的会再发
await arm([run('down000001')], ['net', 'net']);
await page.evaluate(() => flushWorldQueue());
s = await snap();
check('连续失败：排上了退避重试，且状态说得出口',
  s.pending === 1 && s.timer && s.round === 1 && /自动重试/.test(s.status), s);

await page.evaluate(() => { window.__net.calls = []; window.__net.script = []; });
await page.waitForTimeout(5200);   // 退避第一档是 4 秒
s = await snap();
// round 必须回到 0：那是 cancelWorldRetry 在成功路径上**唯一观察得到**的作用。
// 不清零的话下一次断网会直接从最长那一档开始等，玩家打完一局想看名次要干等两分钟。
check('退避到点：自己又发了一次、交上去了，并且退避轮次清零',
  s.pending === 0 && s.calls.length === 1 && !s.timer && s.round === 0, s);

// 3. 化名被退回：一次都不许重试
await arm([run('blocked0001')], ['400']);
await page.evaluate(() => flushWorldQueue());
s = await snap();
check('化名被退回：只发一次、不排重试、原因留得住',
  s.calls.length === 1 && !s.timer && s.blocked.includes('保留词'), s);

// 4. 一条被退回不许堵住后面
await arm([run('queue00001'), run('queue00002'), run('queue00003')], ['400', 'ok', 'ok']);
await page.evaluate(() => flushWorldQueue());
s = await snap();
check('一条被退回：后面两条照样发出去了',
  s.calls.length === 3 && new Set(s.calls).size === 3, s);

// 6. 反复切前后台不许打出请求风暴
// 这条是量出来才加的：没有节流时，2.1 秒内猛切 30 次会发 60 个请求，
// 而且把退避轮次顶到 30（下一次自动重试要等满两分钟）——**手动重试反而让自动重试变慢**。
await arm([run('storm00001')], []);
await page.evaluate(() => { window.__net.script = []; window.fetch = async () => { window.__net.calls.push({ runId: 'storm00001' }); throw new TypeError('Failed to fetch'); }; });
const storm = await page.evaluate(async () => {
  window.__net.calls = [];
  for (let i = 0; i < 30; i++) { retryWorldNow(); await new Promise(r => setTimeout(r, 30)); }
  await new Promise(r => setTimeout(r, 900));
  return { calls: window.__net.calls.length, round: worldRetryRound };
});
check('猛切 30 次前后台：请求不超过 4 个、退避轮次不被顶飞',
  storm.calls <= 4 && storm.round <= 2, storm);
// 假网络还原成按剧本走的那个，后面的用例才不受影响。
await page.evaluate(() => {
  window.fetch = async (url, options) => {
    const body = options && options.body ? JSON.parse(options.body) : null;
    window.__net.calls.push({ runId: body && body.run && body.run.runId });
    const verdict = window.__net.script.length ? window.__net.script.shift() : 'ok';
    if (verdict === 'net') throw new TypeError('Failed to fetch');
    if (verdict === '400') return { ok: false, status: 400, json: async () => ({ ok: false, err: '化名是保留词' }) };
    return { ok: true, status: 200, json: async () => ({ ok: true, acceptedRunId: body.run.runId, playerToken: 'a'.repeat(64) }) };
  };
});

// 5. 回到前台立刻再试
// 注意：上一条刚用掉一次手动重试的额度，等过节流窗口再验，否则会被自己的节流挡住。
await new Promise(r => setTimeout(r, 3200));
await arm([run('fore000001')], ['net', 'net']);
await page.evaluate(() => flushWorldQueue());
const before = await snap();
await page.evaluate(() => { window.__net.script = []; retryWorldNow(); });
await page.waitForTimeout(500);
s = await snap();
check('回到前台：不等退避到点就立刻再试并交上去',
  before.timer && s.pending === 0 && !s.timer, { before, after: s });

await browser.close();
server.close();

console.log('');
if (pageErrors.length) { failed += 1; for (const line of pageErrors) console.log('[败] ' + line); }
if (failed) { console.log('有 ' + failed + ' 条没过。'); process.exit(1); }
console.log('假网络六种抖法全部通过。');
