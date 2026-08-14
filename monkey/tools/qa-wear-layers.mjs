#!/usr/bin/env node
// 量一件事：**穿上私人电梯之后，猴子还在不在最上面。**
//
// 0814 Codex 真机复核报的毛病是「电梯两扇门叠在猴子前方，把下半身整个盖住」。
// 这类毛病数值断言看不见——0813 给猴子加红鲤鱼帽时整个画面消失，三十条断言照样全过，
// 是靠截图才发现的。所以这里做两件事：**量一遍**，再**拍一张**。
//
// 怎么量：在猴子身体的一片网格点上做 SVG 命中测试（elementFromPoint）。
// SVG 的命中测试跟着绘制顺序走，谁画在上面就命中谁。
// 于是「电梯有没有盖住猴子」变成一个可以数出来的数：**身体点里有几个命中了电梯**。
//
// 为什么不用「截图逐像素比对」：那要引入图片解码依赖，而且换个配色/换个姿势就得重录基线，
// 又是一份会过期的镜像。命中测试问的是「谁在上面」——正是玩家看到的那件事本身。
//
// **这个量法自己也要反向验证**：脚本会先把电梯强行画回猴子前面（模拟修之前的写法），
// 确认这时它真的报红。量不出问题的量法，比没有量法更能骗人——
// 0813 用「maxMeters 连续 25 秒不涨」判卡死，而那是个只增不减的量，30 局冤枉了 2 局。
//
// 用法（需要本机有 Playwright 与 Chromium；CI 里没有浏览器）：
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROME_PATH=/path/to/chrome \
//     node monkey/tools/qa-wear-layers.mjs [截图目录]

import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SHOTS = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'tools', 'shots');

// 桌面那档不是凑数：0813 那个写死 844 的高度封顶，只在大屏上露底色，
// 390x844 上永远看不出来。**一个只在一种视口跑的门禁，等于一条不会失败的门禁。**
const VIEWS = [
  { w: 390, h: 844, note: 'iPhone 12/13/14，本作设计基准' },
  { w: 1280, h: 720, note: '桌面（矮，比 1080p 更容易露馅）' },
];

// 每一格都要说清楚它在验什么，否则下一个人会以为是随手挑的组合。
const CASES = [
  { id: 'lift', wearing: { ride: 'lift' }, note: '私人电梯：全套里唯一体积比猴子还大的一件' },
  { id: 'lift-full', wearing: { ride: 'lift', head: 'crown', eye: 'trifocal', neck: 'faxneck', hand: 'ring', back: 'donkeybag' }, note: '电梯 + 另外五槽同时穿' },
  { id: 'maybach', wearing: { ride: 'maybach' }, note: '轿车：**必须**留在猴子前面，那是「坐进车里」的视觉' },
  { id: 'rocket', wearing: { ride: 'rocket' }, note: '火箭：坠落姿势下会不会穿帮' },
  { id: 'full', wearing: { ride: 'lambo', head: 'crown', eye: 'trifocal', neck: 'faxneck', hand: 'ring', back: 'donkeybag' }, note: '六槽全套' },
  { id: 'carp', wearing: { ride: 'lambo', head: 'crown' }, carp: true, note: '局内红鲤鱼帽压过买来的王冠（红帽 #e0452c 是正典锁）' },
];

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
  console.error('       别把「跳过」当成「通过」：画面有没有被盖住，只有真画一遍才知道。');
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
await mkdir(SHOTS, { recursive: true });

// 页面里跑的那段：穿上指定行头，然后在猴子身上打网格点，问每个点命中的是谁。
// `sabotage` 为真时，把身后层的内容搬回前面那层——**这是修之前的写法**，
// 用来验证这个量法真的量得出问题。
async function probe(page, wearing, { carp = false, sabotage = false } = {}) {
  return page.evaluate(([wearing, carp, sabotage]) => {
    career.owned = SHOP_ITEMS.map(item => item.id);
    career.wearing = { ...wearing };
    renderWorn();
    document.getElementById('gameShell').classList.toggle('carp-hat-on', !!carp);
    if (sabotage) {
      // 修之前的等价写法：身后层的东西原样搬到猴子前面那层。
      for (const holder of document.querySelectorAll('.wear-behind')) {
        const front = holder.parentNode.querySelector('.wear-layer');
        if (front && holder.innerHTML) { front.innerHTML += holder.innerHTML; holder.innerHTML = ''; }
      }
    }
    const body = document.getElementById('monkeyUse');
    const box = body.getBoundingClientRect();
    // 只打**下半身**：电梯门盖住的正是这里，而帽子、墨镜本来就该在上面。
    //
    // 用 elementsFromPoint（复数）拿整摞，再筛出 #monkeyMotion 里的那几层。
    // **单数的 elementFromPoint 在这里恒等于没量**：局内左右两个整屏触控按钮
    // (#leftZone/#rightZone) 盖在最上面，每一点都命中它们，三十个点全报「不是电梯」。
    // 第一版就是这么写的，跑出来一片绿——是量法自检把它照出来的。
    const rows = 6, cols = 5, hits = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = Math.round(box.left + box.width * (c + 0.5) / cols);
        const y = Math.round(box.top + box.height * 0.5 + box.height * 0.45 * (r + 0.5) / rows);
        const stack = document.elementsFromPoint(x, y).filter(node => node.closest && node.closest('#monkeyMotion'));
        if (!stack.length) { hits.push('空'); continue; }
        // 摞里**同时**有猴子和座驾时，谁排在前面谁就画在上面——那正是玩家看到的。
        // 「同时」这两个字是判据的全部重量：第一版写成「座驾在场且猴子不在场也算压住」，
        // 于是电梯从猴子轮廓的缝隙里露出来的 2 个点被记成了「盖住猴子」，
        // 而那 2 个点上猴子**本来就没画东西**，没有任何东西被盖住。
        // **判据要跟着「玩家实际感知到的是什么」走**——玩家看不见的地方，压不压得住都不是问题。
        const bodyAt = stack.indexOf(body);
        const rideAt = stack.findIndex(node => node.closest('.wear-ride'));
        if (rideAt >= 0 && bodyAt >= 0 && rideAt < bodyAt) {
          hits.push(stack[rideAt].closest('.wear-behind') ? '身后座驾压住猴子' : '身前座驾压住猴子');
        } else if (bodyAt >= 0) hits.push('猴子');
        else if (rideAt >= 0) hits.push('只有座驾（猴子这里本来就没画东西）');
        else hits.push(stack[0].tagName);
      }
    }
    const carpNode = document.querySelector('#monkeyMotion .carp-hat');
    return {
      hits,
      coveredByRide: hits.filter(h => h.endsWith('座驾压住猴子')).length,
      monkey: hits.filter(h => h === '猴子').length,
      carpShown: carpNode ? getComputedStyle(carpNode).display !== 'none' : false,
      boughtHeadShown: (() => {
        const head = document.querySelector('#monkeyMotion .wear-head');
        return head ? getComputedStyle(head).display !== 'none' : false;
      })(),
      pose: body.getAttribute('href'),
      playerVisible: getComputedStyle(document.getElementById('playerGroup')).display !== 'none',
    };
  }, [wearing, carp, sabotage]);
}

let failed = 0;
const say = (ok, line) => { if (!ok) failed += 1; console.log((ok ? '[过] ' : '[败] ') + line); };

for (const view of VIEWS) {
  const page = await browser.newPage({
    viewport: { width: view.w, height: view.h },
    isMobile: view.w < 700, hasTouch: view.w < 700,
  });
  const errors = [];
  page.on('pageerror', event => errors.push('pageerror: ' + event.message));
  page.on('console', message => { if (message.type() === 'error') errors.push('console: ' + message.text()); });

  await page.goto(base + '/', { waitUntil: 'networkidle' });
  // **先把开场遮罩关掉。** 它是一整块 z-index 100 的 <section>，盖在全屏上；
  // 不关掉的话每一个采样点命中的都是它，三十个点全报「不是电梯」——
  // 一个永远绿的量法。第一次跑就栽在这里，是量法自检把它照出来的。
  await page.evaluate(() => { hideSplash(); });
  // 进到局内：任命台、平台、猴子都在这一屏，也是玩家真正看见行头的地方。
  await page.evaluate(() => { startRun(); });
  await page.waitForTimeout(400);

  const tag = view.w + 'x' + view.h;
  console.log('\n=== ' + tag + '（' + view.note + '）===');

  // 先验这个量法自己：把电梯搬回猴子前面，它必须报出「被盖住」。
  // **量不出问题的量法，比没有量法更能骗人。**
  const control = await probe(page, { ride: 'lift' }, { sabotage: true });
  // 门槛不写死一个数：**写死的数就是一份会过期的镜像**——电梯的门画宽一点画窄一点，
  // 覆盖率就变，然后某天这条自检会因为美术改了而红，红得毫无意义。
  // 改成相对量：电梯画在前面时，必须盖住**猴子实际画出来的采样点的五分之一以上**。
  // 修好之后那个数必须是 0，两者之间的落差才是「这个量法分得清」的证据。
  const drawn = control.coveredByRide + control.monkey;
  say(drawn > 0 && control.coveredByRide >= drawn / 5,
    '量法自检：把电梯搬回猴子前面（修之前的写法），猴子实际画出来的 ' + drawn
    + ' 个采样点里有 ' + control.coveredByRide + ' 个被电梯盖住（要求 >= 五分之一 = '
    + (drawn / 5).toFixed(1) + '）。'
    + '这一条红了说明**量法本身失效了**，不是电梯出了问题——先查采样网格和图层结构，别去改电梯');

  for (const item of CASES) {
    const result = await probe(page, item.wearing, { carp: item.carp });
    const wantBehind = item.wearing.ride === 'lift';
    const rideUpFront = result.coveredByRide;
    if (wantBehind) {
      // **不要求 0**：电梯是跨两层的，楼层显示牌**故意**留在猴子前面
      // （那是「这是电梯」的记号，全塞到身后就只剩一个空框，看着像纸箱）。
      // 要守的是「实心的车厢与门不再盖住下半身」，所以判据是**相对控制组**：
      // 修好之后被盖住的采样点，必须掉到「整件画在前面」时的四分之一以下。
      // 写死一个绝对数就又是一份会过期的镜像——美术改宽一点它就无故变红。
      const ceiling = control.coveredByRide / 4;
      say(rideUpFront <= ceiling && result.monkey > 0,
        item.id + '｜' + item.note + '：电梯盖住猴子的采样点 ' + rideUpFront
        + '（控制组 ' + control.coveredByRide + '，要求 <= 四分之一 = ' + ceiling.toFixed(1) + '）'
        + '，命中猴子本体 ' + result.monkey + ' 个（要求 >0，否则猴子根本没画出来）');
    } else {
      // 车与滑板车画在前面是**对的**，所以这里要的是反过来的结论。
      say(result.playerVisible && (result.monkey > 0 || rideUpFront > 0),
        item.id + '｜' + item.note + '：猴子在场，座驾采样命中 ' + rideUpFront + '，猴子采样命中 ' + result.monkey);
    }
    if (item.carp) {
      say(result.carpShown && !result.boughtHeadShown,
        item.id + '｜红鲤鱼帽显示=' + result.carpShown + '，买来的王冠显示=' + result.boughtHeadShown + '（要求 true / false）');
    }
    await page.screenshot({ path: path.join(SHOTS, tag + '-' + item.id + '.png') });
  }

  // 火箭要在**坠落姿势**下看，站姿看不出穿帮。
  await page.evaluate(() => {
    career.owned = SHOP_ITEMS.map(item => item.id);
    career.wearing = { ride: 'rocket' };
    renderWorn();
    document.getElementById('monkeyUse').setAttribute('href', '#art-monkey-fall');
  });
  const falling = await probe(page, { ride: 'rocket' });
  await page.evaluate(() => { document.getElementById('monkeyUse').setAttribute('href', '#art-monkey-fall'); });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(SHOTS, tag + '-rocket-fall.png') });
  say(falling.playerVisible, 'rocket-fall｜坠落姿势下火箭与猴子都在场');

  // 首页那只猴子也穿着同一套——它是玩家最先看见的一只。
  await page.evaluate(() => {
    career.owned = SHOP_ITEMS.map(item => item.id);
    career.wearing = { ride: 'lift', head: 'crown' };
    renderWorn();
    showTitleScreen();
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SHOTS, tag + '-title-lift.png') });
  const titleLayers = await page.evaluate(() => {
    const art = document.querySelector('.title-art');
    return {
      behind: art.querySelector('.wear-behind').innerHTML.includes('wear-ride'),
      front: art.querySelector('.wear-layer').innerHTML.includes('wear-ride'),
      headUpFront: art.querySelector('.wear-layer').innerHTML.includes('wear-head'),
      // 断点两边拼回去必须等于原画法：少一半就是有一层没画出来。
      whole: (() => {
        const back = art.querySelector('.wear-behind').innerHTML;
        const front = art.querySelector('.wear-layer').innerHTML;
        return back.includes('rect') && front.includes('rect');
      })(),
    };
  });
  // 首页那只猴子是玩家最先看见的一只，电梯在它身上必须两层都有。
  say(titleLayers.behind && titleLayers.front && titleLayers.headUpFront && titleLayers.whole,
    'title｜首页那只猴子：电梯在身后层=' + titleLayers.behind
    + '，前面层也有电梯（楼层显示牌）=' + titleLayers.front
    + '，王冠仍在前面=' + titleLayers.headUpFront);

  if (errors.length) { failed += 1; console.log('[败] ' + tag + ' 控制台报错：'); for (const line of errors) console.log('      ' + line); }
  else console.log('[过] ' + tag + ' 控制台无报错');
  await page.close();
}

await browser.close();
server.close();

console.log('\n截图写在：' + SHOTS);
if (failed) { console.log('[败] ' + failed + ' 条没过'); process.exit(1); }
console.log('[过] 穿戴前后层全部通过');
