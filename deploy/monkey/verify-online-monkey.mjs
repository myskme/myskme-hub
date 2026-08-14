import { readFileSync } from 'node:fs';

const attempts = Number.parseInt(process.env.VERIFY_ATTEMPTS || '12', 10);
// 重试间隔按失败的**种类**给，不是一刀切 5 秒。
// 0814 收官发布当场栽的：EdgeOne 发布成功后，源站有一个几分钟的传播/回源窗口，
// 12 次 x 5 秒只铺了不到 4 分钟，全程都落在窗口里——超时、502、fetch failed 打满 12 次，
// 最后一次仍是 502，于是**发布其实成功、验收判失败**（和 0812/0813 那两次同一个结论，
// 但根因不同：那两次是验收器自己过期，这次是重试窗口太窄）。
// 断言不匹配（版本不对、缺节点）5 秒重试是对的——CDN 刷新是秒级的；
// 网络层失败（超时/5xx/连不上）要退避着等——传播是分钟级的，密集打 5 秒一次全是白问。
// 退避序列与楼榜补交用同一个思路（4/10/25/60/120），总窗口拉到 13 分钟以上。
const delayMs = Number.parseInt(process.env.VERIFY_DELAY_MS || '5000', 10);
const NETWORK_BACKOFF_MS = [5000, 10000, 20000, 40000, 60000, 90000, 120000];
const isNetworkFailure = (error) => {
  const text = String(error && error.message || error);
  return /timeout|aborted|fetch failed|ECONN|ETIMEDOUT|ENOTFOUND|状态码 5\d\d/.test(text);
};

// 期望值一律从仓库源文件里现取，**不要在这里硬写任何会跟着代码变的字符串**。
// 这个坑已经踩过两次，两次死法一模一样：
//   2026-08-12：sw 缓存名从 -7 升到 -8，构建器跟着改了、本文件被漏了。
//   2026-08-13：手机铺满规则的 CSS 从 width:100vw 改成 width:min(100vw,460px)，
//               构建门禁改成了「守意图」，本文件里那段字面量又被漏了。
// 两次都是**发布其实成功、线上也确实是新版，却被自己的验收脚本判失败**，重试 12 次全红。
//
// 所以本文件现在有两道保险：
//   1. 会变的东西一律现取（版本号、sw 缓存名、铺满规则整块）。
//   2. **先拿本地源文件跑一遍同一批断言**——如果连本地都过不了，那就是验收器自己过期了，
//      当场报「验收器过期」并退出，而不是拿 12 次重试去冤枉线上。
const localHtml = readFileSync('monkey/index.html', 'utf8');
const localSw = readFileSync('monkey/sw.js', 'utf8');
const EXPECT_RELEASE = (localHtml.match(/const RELEASE='([^']+)'/) || [])[1];
const EXPECT_SW_CACHE = (localSw.match(/const CACHE='([^']+)'/) || [])[1];
const EXPECT_FILL_RULE = (localHtml.match(/#gameShell\{width:[^}]*height:min\(100svh[^}]*\}/) || [])[0];

for (const [name, value] of [['RELEASE', EXPECT_RELEASE], ['sw CACHE', EXPECT_SW_CACHE], ['铺满规则', EXPECT_FILL_RULE]]) {
  if (value) continue;
  console.error('[错] 取不到本地的「' + name + '」——源文件写法变了，先修本脚本的取法，别改线上。');
  process.exit(2);
}
console.log('期望线上版本：RELEASE=' + EXPECT_RELEASE + ' · sw 缓存=' + EXPECT_SW_CACHE);
console.log('期望线上铺满规则：' + EXPECT_FILL_RULE);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// 只看 HTML 内容的那批断言。抽出来是为了能先拿本地源文件跑一遍。
function checkHtml(html) {
  assert(html.includes('<title>是猴就上100层 · MYSKME</title>'), '标题不匹配');
  assert(html.includes('https://monkey.myskme.com/'), '正式域名元数据缺失');
  // 鱼小姐是绿鲤鱼成精，canon 上不存在金鲤鱼。这是约束不是镜像，就该写死。
  assert(html.includes('fill="#3fab84"'), '鱼小姐不是青绿色（绿鲤鱼成精，canon 无金鲤鱼）');
  assert(!html.includes('fill="#e3ad32"'), '鱼小姐还是金色的');
  assert(html.includes(EXPECT_RELEASE), '版本不是 ' + EXPECT_RELEASE);
  assert(html.includes('id="monkeyUse"'), '缺少完整主猴渲染节点');
  assert(!html.includes('translate(100 0) scale(-1 1)'), '仍含会把猴子推出画面的 SVG use 镜像');
  assert(html.includes('function repairPlayerState(now)'), '猴子可见性看门狗缺失');
  assert(html.includes('function startMusic()'), '自适应音乐引擎缺失');
  assert(html.includes("const TOOL_POOL=['magnet','clip','waiver','rocket','wide']"), '帮助道具池不完整');
  assert(html.includes('const MISSIONS=['), '轮值任务系统缺失');
  assert(!/\bparty\b/i.test(html), '又出现多人模式代码（0813 已拆除）');
  assert(html.includes('function buildPoster()') && html.includes('function syncViewportMode()'), '海报或安卓宽视口修复缺失');
  assert(html.includes('const SURPRISES=[') && html.includes('MUSIC_TICK_MS=70'), '惊喜池或省电音频调度缺失');
  assert(html.includes('id="worldWindow"') && html.includes('const CULTURE_MOTIFS=[')
    && html.includes('function claimCultureMotif(') && html.includes('function choosePosterPair('),
    '世界窗景或随机海报组合缺失');
  assert(html.includes('function pauseGame(') && html.includes('function shiftDeadlines('), '暂停系统缺失');
  assert(html.includes('const HONORS=[') && html.includes('const TEAS=['), '称号或奶茶图鉴缺失');
  assert(html.includes('id="art-carp-hat"'), '红鲤鱼帽美术缺失');
  assert(html.includes('#gameShell.carp-hat-on .carp-hat'), '戴帽子的状态类与资源类同名，会把整个画面藏掉');
  assert(html.includes(EXPECT_FILL_RULE), '手机铺满规则与本地源文件不一致');
  assert(html.includes('<meta name="mobile-web-app-capable" content="yes">'), 'PWA 全屏声明缺失');
  assert(!/<script\s+[^>]*src=["']https?:/i.test(html), '出现外部脚本');
  assert(!/<link\s+[^>]*rel=["']stylesheet/i.test(html), '出现外部样式');
}

// 保险第二道：本地源文件必须先过。过不了就是验收器自己过期了。
try {
  checkHtml(localHtml);
} catch (error) {
  console.error('[错] 验收器自己过期了：本地源文件都过不了这条断言 ——「' + error.message + '」');
  console.error('     也就是说这条期望和 monkey/index.html 已经对不上，问题在验收脚本，不在线上。');
  console.error('     0812 与 0813 各踩过一次，两次都白白重试 12 次去冤枉线上。先修本脚本。');
  process.exit(2);
}
console.log('本地源文件自检通过，开始查线上。');

async function verify() {
  const stamp = Date.now();
  const response = await fetch('https://monkey.myskme.com/?release-check=' + stamp, {
    headers: { 'cache-control': 'no-cache', 'user-agent': 'MYSKME-monkey-release-check/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  const html = await response.text();
  assert(response.status === 200, '首页状态码 ' + response.status);
  try { checkHtml(html); } catch (error) { throw new Error('线上' + error.message + '（CDN 还没刷新，或发布包不对）'); }
  const manifestResponse = await fetch('https://monkey.myskme.com/manifest.webmanifest?release-check=' + stamp, { signal: AbortSignal.timeout(15000) });
  const manifest = await manifestResponse.json(); assert(manifestResponse.status === 200 && manifest.name === '是猴就上100层', '线上 PWA 清单不匹配');
  const iconResponse = await fetch('https://monkey.myskme.com/icons/monkey-100-192.png?release-check=' + stamp, { signal: AbortSignal.timeout(15000) }); const icon = await iconResponse.arrayBuffer(); assert(iconResponse.status === 200 && icon.byteLength > 1000, '线上桌面图标缺失');
  const qrResponse = await fetch('https://monkey.myskme.com/vendor/qrcode-generator.js?release-check=' + stamp, { signal: AbortSignal.timeout(15000) }); const qr = await qrResponse.text(); assert(qrResponse.status === 200 && qr.includes('QR Code Generator for JavaScript') && qr.length > 50000, '线上本地二维码模块缺失');
  const swResponse = await fetch('https://monkey.myskme.com/sw.js?release-check=' + stamp, { signal: AbortSignal.timeout(15000) }); const sw = await swResponse.text(); assert(swResponse.status === 200 && sw.includes(EXPECT_SW_CACHE), '线上离线缓存脚本不是 ' + EXPECT_SW_CACHE + '（CDN 还没刷新，或 sw.js 没进发布包）');
}

let lastError;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    console.log('是猴就上100层线上验收：第 ' + attempt + '/' + attempts + ' 次');
    await verify();
    console.log('PASS https://monkey.myskme.com/');
    process.exit(0);
  } catch (error) {
    lastError = error;
    const network = isNetworkFailure(error);
    console.error('FAIL ' + error.message + (network ? '（网络层，退避重试）' : ''));
    if (attempt < attempts) {
      const wait = network
        ? NETWORK_BACKOFF_MS[Math.min(attempt - 1, NETWORK_BACKOFF_MS.length - 1)]
        : delayMs;
      await new Promise(resolve => setTimeout(resolve, wait));
    }
  }
}
console.error(lastError?.stack || lastError);
process.exit(1);
