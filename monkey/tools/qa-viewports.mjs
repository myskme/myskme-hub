#!/usr/bin/env node
// 在**多个视口**上跑一遍 ?qa=1 的静态质检。
//
// 为什么要有这个文件：页面里的自检只能量「它当下这个视口」。
// 2026-08-13 就栽在这上面——「单屏菜单不溢出」那条自检本身是真量的，
// 但只在 390x844 跑，而真正的崩法在 320x568：世界楼榜上只要有人用了 12 字化名，
// 行就换成两行，五行一起把卡片顶爆，**被裁掉的正好是唯一那颗退出键**，
// 手机上又没有 Esc，玩家只能杀掉进程。在 390x844 上永远看不到这个现象。
//
// 判据：**任何「在小屏上才会犯」的毛病，都必须在小屏上量**。
// 一条只在宽屏跑的门禁，和一条永远不会失败的门禁是同一类东西。
//
// 这个文件放在仓库里而不是某个会话的临时目录，也是有原因的：
// 上一轮的验收脚本躺在临时目录里，PR 41 加分页之后它们静默红了一整天没人发现。
// 会过期的验收脚本和不会失败的门禁，是同一个问题的两面。
//
// 用法（需要本机有 Playwright 与 Chromium）：
//   node monkey/tools/qa-viewports.mjs
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROME_PATH=/path/to/chrome node monkey/tools/qa-viewports.mjs
//
// CI 里没有浏览器，所以这一步是人和 AI 收工前手动跑的；构建门禁
// （deploy/monkey/build-edgeone-monkey.mjs）负责守结构，这里负责守「小屏上放不放得下」。

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

// 视口清单。**每一条都要写清楚它代表什么**，否则下一个人会以为是随手挑的数字，
// 然后在某次「顺手清理」里把最小的那个删掉——而最小的那个正是唯一会出事的那个。
const VIEWPORTS = [
  { w: 320, h: 568, note: 'iPhone SE 一代 / 5s，课堂上最旧的一档，也是唯一真正紧张的一档' },
  { w: 360, h: 800, note: '安卓主流' },
  { w: 390, h: 844, note: 'iPhone 12/13/14，本作的设计基准' },
  { w: 430, h: 932, note: 'iPhone 15 Pro Max' },
  { w: 1280, h: 720, note: '桌面（矮，比 1080p 更容易露馅）' },
];

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json',
};

const playwrightModule = process.env.PLAYWRIGHT_MODULE || 'playwright';
let chromium;
try {
  ({ chromium } = await import(playwrightModule));
} catch (error) {
  console.error('[跳过] 找不到 Playwright（' + playwrightModule + '）。');
  console.error('       这一步需要本机有浏览器；装好后再跑，或用 PLAYWRIGHT_MODULE 指到它的位置。');
  console.error('       别把「跳过」当成「通过」：小屏放不放得下，只有真跑过才知道。');
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

let failed = 0;
for (const view of VIEWPORTS) {
  const page = await browser.newPage({
    viewport: { width: view.w, height: view.h },
    isMobile: view.w < 700, hasTouch: view.w < 700,
  });
  const errors = [];
  page.on('pageerror', event => errors.push('pageerror: ' + event.message));
  page.on('console', message => { if (message.type() === 'error') errors.push('console: ' + message.text()); });

  await page.goto(base + '/?qa=1', { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => document.getElementById('qaReport')?.style.display === 'block',
    null, { timeout: 30000 },
  );
  const report = await page.textContent('#qaReport');
  const bad = report.split('\n').filter(line => line.startsWith('FAIL'));

  const head = view.w + 'x' + view.h;
  if (bad.length || errors.length) {
    failed += 1;
    console.log('[败] ' + head + '（' + view.note + '）');
    for (const line of bad) console.log('      ' + line);
    for (const line of errors) console.log('      ' + line);
  } else {
    console.log('[过] ' + head + '（' + view.note + '）');
  }
  await page.close();
}

await browser.close();
server.close();

console.log('');
if (failed) {
  console.log('有 ' + failed + ' 个视口没过。注意看是不是只有最小的那个红——那说明问题只在小屏上犯，');
  console.log('而只在 390x844 跑自检是看不见的（0813 的世界楼榜退出键就是这么漏掉的）。');
  process.exit(1);
}
console.log('五个视口全部通过。');
