#!/usr/bin/env node
// 量「有没有压到字」和「有没有断行」——两件截图看得见、断言看不见的事。
//
// 起因是 0814 的两处：结算页那枚印章写死 `top:93px`（那个 93 镜像的是「当时标题占多高」，
// 和 0813 写死 844 屏高是同族错），以及 320 宽上香蕉钱包按钮把「香」「蕉」都拆成了两行。
//
// **这个文件的一半价值在于它记着三次判据写错的教训**，三次都是「量了数据结构里的字段，
// 不是玩家看见的那件事」：
//   1. 数「按钮里有几个不同的基线」当断行 —— `<b>42</b>` 与旁边文字差一像素就算两行，
//      每个视口都误报，包括根本没断行的 430。
//   2. 比子元素的 top 当「排成几排」 —— 图标 22px、文字 14px，居中对齐之下 top 本来就不同。
//   3. 只量矩形是否相交 —— flex 子项写了 min-width:0 时，挤不下会把**盒子**压小，
//      而 overflow 是 visible，**字形照样溢出去压在印章底下**。矩形报「0 处重叠」，
//      截图里那个 8 明明白白压在印章下面。所以现在还要问一句「内容比盒子宽没有」。
//
// 判据自己也要验：先拿修之前的源码跑一遍（`node monkey/tools/qa-layout.mjs 旧文件`），
// **它必须报红**；一个在已知坏版本上也全绿的判据，等于没有判据。
//
// 用法（需要本机有 Playwright 与 Chromium；CI 里没有浏览器）：
//   PLAYWRIGHT_MODULE=... CHROME_PATH=... node monkey/tools/qa-layout.mjs [要量的 index.html]
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PINNED = await readFile(process.argv[2] || path.join(ROOT, 'index.html'));
const server = http.createServer(async (req, res) => {
  let f = decodeURIComponent(req.url.split('?')[0]);
  if (f === '/') f = '/index.html';
  if (f === '/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PINNED); return; }
  try { res.writeHead(200); res.end(await readFile(path.join(ROOT, f))); } catch { res.writeHead(404); res.end('x'); }
});
await new Promise(r => server.listen(0, r));
const base = 'http://127.0.0.1:' + server.address().port;
const playwrightModule = process.env.PLAYWRIGHT_MODULE || 'playwright';
let chromium;
try {
  ({ chromium } = await import(playwrightModule));
} catch {
  console.error('[跳过] 找不到 Playwright（' + playwrightModule + '）。');
  console.error('       别把「跳过」当成「通过」：压没压到字，只有真排一遍才知道。');
  process.exit(127);
}
const launch = {};
if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
const browser = await chromium.launch(launch);

// 视口清单要把**最坏的那档**喂进去。0813 学过一次：只在 390x844 跑的门等于不会失败的门。
const VIEWS = [[320, 568], [375, 553], [360, 640], [390, 844], [430, 932]];
let failed = 0;
const say = (ok, line) => { if (!ok) failed += 1; console.log((ok ? '[过] ' : '[败] ') + line); };

for (const [w, h] of VIEWS) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { hideSplash(); });

  // ---- 钱包按钮：文案断没断行 ----
  const wallet = await page.evaluate(() => {
    const btn = document.getElementById('walletButton');
    if (!btn) return null;
    const box = btn.getBoundingClientRect();
    // 断行判据：用 Range 逐段量出每个文字节点的行盒数量。
    // **不能拿 scrollHeight 比 clientHeight**——按钮里有个 22px 的图标，
    // 它本来就比一行字高，那样量出来永远是「没断行」，是个永远绿的判据。
    // **判据是「同一段文字有没有被拆到两行」，不是「按钮里有几个不同的基线」。**
    // 第一版把所有文字节点的 top 塞进一个 Set 再数——`<b>42</b>` 与它旁边的文字
    // 基线差一个像素就被数成两行，于是每个视口都报「3 行」，包括根本没断行的 430。
    // 判据一错，后面所有的调整都是在追一个不存在的问题。
    let worstRows = 1, worst = '';
    const walk = document.createTreeWalker(btn, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walk.nextNode())) {
      if (!node.textContent.trim()) continue;
      const r = document.createRange(); r.selectNodeContents(node);
      const tops = new Set([...r.getClientRects()].filter(x => x.width > 0.5).map(x => Math.round(x.top)));
      if (tops.size > worstRows) { worstRows = tops.size; worst = node.textContent.trim().slice(0, 24); }
    }
    // 「排成一排」判据：所有直接子元素的**垂直中心**要重合。
    // 上一版比的是 top——图标 22px、文字 14px，align-items:center 之下 top 本来就不同，
    // 于是每个视口都报「3 排」，包括完全正常的 430。**同一个错犯了两次：
    // 比的是数据结构里的字段，不是玩家看见的那件事。**
    // 藏起来的子元素要跳过：display:none 的矩形是 (0,0,0,0)，
    // 中心算出来是 0，会被当成「另起了一排」。窄屏上提示语本来就是故意藏掉的。
    const kidTops = new Set([...btn.children]
      .map(k => k.getBoundingClientRect())
      .filter(r => r.width > 0 && r.height > 0)
      .map(r => Math.round((r.top + r.bottom) / 2)));
    return { rows: worstRows, flexRows: kidTops.size, worst, h: Math.round(box.height),
      text: btn.textContent.replace(/\s+/g, ' ').trim().slice(0, 46) };
  });
  say(wallet && wallet.rows <= 1 && wallet.flexRows <= 1,
    `${w}x${h} 香蕉钱包按钮：最长的一段文字占 ${wallet ? wallet.rows : '?'} 行、按钮排成 ${wallet ? wallet.flexRows : '?'} 排（各要求 1）`
    + (wallet && wallet.worst ? `，断开的是「${wallet.worst}」` : '') + `｜高 ${wallet ? wallet.h : '?'}px｜「${wallet ? wallet.text : ''}」`);

  // ---- 结算页印章：跟统计数字有没有重叠 ----
  const stamp = await page.evaluate(() => {
    // 造一局最坏的结算：印章要出现，统计要满。
    resetWorld(0x77aa); state.running = true;
    state.maxMeters = 1888; state.bananas = 26; state.bonus = 210; state.score = 2124;
    state.maxFlow = 11; state.nearMisses = 7; state.surpriseCount = 4;
    state.visited = new Set(['lobby', 'quality', 'fax', 'rent', 'monkey', 'redundancy', 'fertilizer']);
    finishRun();
    const st = document.querySelector('.result-stamp');
    if (!st || getComputedStyle(st).display === 'none') return { none: true };
    const a = st.getBoundingClientRect();
    const hits = [];
    for (const el of document.querySelectorAll('#resultScreen .card *')) {
      if (el.contains(st) || st.contains(el)) continue;
      if (!el.textContent.trim() || el.children.length) continue;
      const b = el.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) continue;
      const ov = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
        * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      if (ov > 4) hits.push(el.textContent.trim().slice(0, 18) + '（重叠 ' + Math.round(ov) + ' 平方像素）');
    }
    // **矩形不重叠不等于像素不重叠。** flex 子项写了 min-width:0 时，
    // 挤不下会把**盒子**压小，而 overflow 是 visible——字形照样溢出去盖在印章底下。
    // 第一版只量矩形，报「0 处重叠」，截图里那个 8 明明白白压在印章下面。
    // 所以再问一句：分数行里有没有元素的内容比它自己的盒子宽。
    for (const el of document.querySelectorAll('.result-score > *')) {
      if (el.scrollWidth > el.clientWidth + 1) {
        hits.push(el.textContent.trim().slice(0, 12) + '（字形溢出盒子 '
          + (el.scrollWidth - el.clientWidth) + 'px，会压到旁边）');
      }
    }
    return { top: Math.round(a.top), hits, stampText: st.textContent.trim() };
  });
  if (stamp.none) say(true, `${w}x${h} 结算印章：这一局没盖章，跳过`);
  else say(stamp.hits.length === 0,
    `${w}x${h} 结算印章「${stamp.stampText}」：压住了 ${stamp.hits.length} 处文字`
    + (stamp.hits.length ? ' -> ' + stamp.hits.join('、') : ''));

  await page.close();
}
await browser.close(); server.close();
console.log(failed ? `\n[败] ${failed} 条没过` : '\n[过] 全过');
process.exit(failed ? 1 : 0);
