import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const projectRoot = path.join(repoRoot, 'monkey');
const source = path.join(projectRoot, 'index.html');
const output = path.resolve(process.argv[2] || path.join(tmpdir(), 'myskme-monkey-' + Date.now() + '.zip'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(
      new Error(command + ' 退出码 ' + code + (stderr ? '：' + stderr.trim() : '')),
    ));
  });
}

async function filesUnder(root) {
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(target));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}

async function pwaAssetHash() {
  // 这里只盯安装清单与桌面图标。index.html 是导航网络优先，不属于这道缓存换代门；
  // 把它算进来会导致每次改文案或玩法都让所有玩家白白重下静态资源。
  const files = [
    path.join(projectRoot, 'manifest.webmanifest'),
    ...await filesUnder(path.join(projectRoot, 'icons')),
  ].sort((a, b) => a.localeCompare(b, 'en'));
  assert(files.length >= 6, 'PWA 哈希输入不完整：manifest.webmanifest 加 icons/ 至少应有 6 个文件');
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(path.relative(projectRoot, file).split(path.sep).join('/'));
    hash.update('\0');
    hash.update(await readFile(file));
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

try { await access(output); throw new Error('输出文件已存在，拒绝覆盖：' + output); } catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const html = await readFile(source, 'utf8');
const manifest = JSON.parse(await readFile(path.join(projectRoot, 'manifest.webmanifest'), 'utf8'));
assert(html.includes('<title>是猴就上100层 · MYSKME</title>'), '标题不匹配');
assert(html.includes('https://monkey.myskme.com/'), '缺少正式域名');
// 鱼小姐是绿鲤鱼成精，canon 上不存在金鲤鱼。她已经被改成金色两次——
// 第二次连交接文档和 PWA 图标描述都跟着写成了「金色鱼小姐」，等于把错误转正了。
// **这一条是立法，不是镜像**：版本号那种会变的东西要从源头取，而 canon 是约束，就该写死在这里。
// 谁再把她改离青绿系，构建/发布直接失败。2026-08-12 定。
const FISH_TEAL = '#3fab84';
assert(html.includes(`fill="${FISH_TEAL}"`), '鱼小姐主色必须是青绿 ' + FISH_TEAL + '（绿鲤鱼成精，canon 无金鲤鱼）');
assert(!html.includes('fill="#e3ad32"'), '鱼小姐又被改回金色了。canon 不存在金鲤鱼，这已是第三次，不要再改。');
const symbolSource = id => (html.match(new RegExp('<symbol id="' + id + '"[\\s\\S]*?</symbol>')) || [])[0] || '';
const donkeyArt = symbolSource('art-donkey'), eggArt = symbolSource('art-egg'), snakeArt = symbolSource('art-snake');
assert(donkeyArt.includes('data-part="donkey-ears"') && donkeyArt.includes('data-part="donkey-muzzle"') && !/<text\b/.test(donkeyArt),
  '驴必须保留长耳与口鼻识别特征，且不许再挂生硬的文字牌');
assert(eggArt.includes('data-part="egg-shell"') && !/<text\b/.test(eggArt) && !eggArt.includes('#d94b32'),
  '蛋必须是纯角色：不许写 egg/蛋字样，也不许恢复那条红色删除线');
assert(snakeArt.includes('data-part="snake-body"') && !snakeArt.includes('art-egg') && !snakeArt.includes('egg-shell'),
  '蛇必须是纯蛇身，不许再把蛋或蛋形部件接回身上');
// 版本号从源头取，不再硬写。0812 就是这么出事的：sw 缓存名从 -7 升到 -8，
// 构建器跟着改了、线上验收器被漏了，结果发布成功却被自己的验收判失败。
const RELEASE = (html.match(/const RELEASE='([^']+)'/) || [])[1];
assert(RELEASE, '取不到 RELEASE 版本号（index.html 里 const RELEASE 的写法变了？）');
const META = (html.match(/<meta name="myskme-release" content="([^"]+)">/) || [])[1];
assert(META === RELEASE, `meta 版本标记(${META}) 与 RELEASE(${RELEASE}) 不一致，两处版本串又打架了`);
assert(html.includes('id="monkeyUse"'), '缺少完整主猴渲染节点');
assert(!html.includes("translate(100 0) scale(-1 1)"), '仍含会把猴子推出画面的 SVG use 镜像');
assert(html.includes('function repairPlayerState(now)'), '猴子可见性看门狗缺失');
assert(html.includes('function startMusic()'), '自适应音乐引擎缺失');
assert(html.includes("const TOOL_POOL=['magnet','clip','waiver','rocket','wide']"), '帮助道具池不完整');
assert(html.includes('const MISSIONS=['), '轮值任务系统缺失');
// 2–6 人多人模式 0813 已按王老师要求整体拆除，原来守着它的三条断言一并撤掉。
// 反过来加一条：别再被悄悄加回来（要加就是一次正式决定，不是顺手粘回来）。
assert(!/\bparty\b/i.test(html), '多人模式的代码又出现了。0813 已明确拆除，要恢复请先跟王老师确认');
assert(html.includes('<link rel="manifest" href="./manifest.webmanifest">'), 'PWA 清单入口缺失');
assert(html.includes('<script src="./vendor/qrcode-generator.js"></script>'), '本地二维码模块入口缺失');
assert(!/<script\s+[^>]*src=["']https?:/i.test(html), '游戏包含外部脚本');
assert(!/<link\s+[^>]*rel=["']stylesheet/i.test(html), '游戏包含外部样式');
// 世界楼榜只准从一个封装出口联网。数调用点而不是搜函数名，避免定义自己满足门禁。
// 品牌网关是固定正门，客户端不直连 Worker，也不许另开 WebSocket 或 XHR 旁路。
const FETCH_CALLS = (html.match(/\bfetch\s*\(/g) || []).length;
assert(FETCH_CALLS === 1 && html.includes('async function worldFetch('), '世界楼榜联网出口必须且只能有一个');
assert(html.includes("MONKEY_API='https://myskme.com/api/monkey'"), '世界楼榜没有走 MYSKME 品牌网关');
assert(!/\b(?:XMLHttpRequest|WebSocket)\s*\(/.test(html), '游戏出现未批准的网络旁路');
assert(html.includes('function queueWorldRun(') && html.includes('function flushWorldQueue(')
  && html.includes('acceptedRunId!==queued.runId') && html.includes("window.addEventListener('online'"),
  '世界榜本机先存、精确回执或联网补交链路不完整');
assert(html.includes('id="recordLine"') && html.includes('personalBestAtStart=IS_TEST_RUN?0:saved.height')
  && html.includes('state.maxMeters>state.personalBestAtStart'), '上次纪录目标线或越线庆祝不完整');
assert(!html.includes('l1fr2z'), '仍含随机旧路径');
assert(!html.includes('myskme.com/fun/monkey'), '仍含已废弃的目录地址');
assert(manifest.name === '是猴就上100层' && manifest.icons?.length >= 3, 'PWA 清单或图标声明不完整');
for (const icon of manifest.icons) await access(path.join(projectRoot, icon.src.replace(/^\.\//, '')));
assert(html.includes('function buildPoster()') && html.includes('function syncViewportMode()'), '海报或安卓宽视口修复缺失');
{
  const screenCss=(html.match(/\.screen\{([^}]*)\}/)||[])[1]||'';
  assert(/overflow\s*:\s*hidden/.test(screenCss), '菜单屏幕又开始依赖上下滚动了');
  assert(!/#(?:title|result)Screen\{[^}]*overflow-y\s*:\s*auto/.test(html), '首页或结算页又恢复成上下滚动了');
  assert(html.includes('function renderPager(') && html.includes('data-result-page="2"') && html.includes('id="titlesPager"') && html.includes('id="teaPager"'),
    '单屏分页结构不完整，长内容会重新把页面撑出屏幕');
}
// 每个自检入口都必须有对应的函数定义，而且不许有悬空调用。
// 0813 血泪：拆多人模式时「从 runPartyQA 一路删到 runPosterQA」，把夹在中间的
// runStressQA 一起删掉了——而 ?qa=1 覆盖不到 ?stress=1，于是自检全绿、
// 24000 帧压力测试其实已经没了（CLAUDE.md 里它是零容忍项）。
// 同一类错这次是第二次：更早一次差点把主循环 loop() 删掉。
// 教训写成门：**按函数名删整段之前，先确认区间中间夹着谁**。
for (const fn of ['runQA', 'runStressQA', 'runPosterQA']) {
  assert(new RegExp('function\\s+' + fn + '\\s*\\(').test(html), '自检入口 ' + fn + ' 的定义不见了（删整段时被夹带走了？）');
  // 光 includes(fn+'(') 会被函数定义自己满足，等于没查；而且调用点未必带括号
  // （`setTimeout(runQA,50)` 就是把函数本身传过去）。所以数裸标识符，要求至少两处：定义 + 引用。
  const uses = (html.match(new RegExp('\\b' + fn + '\\b', 'g')) || []).length;
  assert(uses >= 2, '自检入口 ' + fn + ' 只有定义没有任何引用，等于形同虚设');
}
assert(html.includes('const SURPRISES=[') && html.includes('MUSIC_TICK_MS=70'), '惊喜池或省电音频调度缺失');
assert(html.includes('function pauseGame(') && html.includes('function resumeGame(') && html.includes('function shiftDeadlines('), '暂停系统缺失');
assert(html.includes('const HONORS=['), '称号系统缺失');
// 红鲤鱼帽必须是红的。做成青绿它就是鱼小姐本人了，「猴假扮红鲤鱼、驴说仿的」这个梗当场作废。
assert(/id="art-carp-hat"[\s\S]{0,1200}?fill="#e0452c"/.test(html), '红鲤鱼帽必须是红的（青绿那条是鱼小姐本人，戴上就不是梗了）');
// 状态类名不许和资源类名同名。0813 踩过：给 #gameShell 加 .carp-hat 时它自己命中了
// `.carp-hat{display:none}`，整个游戏画面当场消失，而所有数值自检都照样全绿。
assert(html.includes('#gameShell.carp-hat-on .carp-hat'), '戴帽子的状态类与资源类又同名了，会把整个画面藏掉');
// 手机上必须铺满屏幕。0813 之前 #gameShell 高度封顶 844（iPhone 13 时代的高度），
// 于是 iPhone 15 Pro Max（932）、16 Pro Max（956）、Pixel 8（915）加到桌面全屏启动后
// 上下各露一条底色，用户看到的就是「不是全屏」。这里守住铺满规则本身。
// 门守的是「意图」不是「那一行字」：≤699px 里外壳高度必须用 svh 且不许再出现 844 这个死高度。
// 宽度写法允许调整（0813 晚上就从 100vw 改成了 min(100vw,460px)，为的是别把折叠屏/半屏窗口拉扁）。
{
  const m = html.match(/@media\(max-width:699px\)\{[\s\S]{0,600}?\n\}/);
  assert(m, '手机铺满规则整块没了（0813 修过一次，别再退回 844 死高度）');
  assert(/#gameShell\{[^}]*height:min\(100svh/.test(m[0]), '手机铺满规则里外壳高度没用 100svh');
  assert(!/844/.test(m[0]), '手机铺满规则里又出现了 844 这个死高度——大屏手机会重新留出上下边');
}
assert(html.includes('html.wide-mobile-viewport #gameShell{width:min(100vw,460px)'), '安卓宽虚拟视口的固定盒兜底被铺满规则带偏了');
assert(html.includes('<meta name="apple-mobile-web-app-capable" content="yes">')
  && html.includes('<meta name="mobile-web-app-capable" content="yes">'), 'PWA 全屏声明缺失，iOS 加到主屏幕后不会独立全屏');
assert(html.includes('viewport-fit=cover') && html.includes('env(safe-area-inset-top)') && html.includes('env(safe-area-inset-bottom)'),
  '安全区声明缺失，刘海或 Home 指示条会压住 HUD 和按钮');

// 暂停要真暂停：绝对计时字段漏登记 = 暂停十秒白送十秒道具时间。
// 这里在构建期把源码里所有以 Until / At 结尾的对象字面量键扫一遍，和三张登记表对账。
// 门里写死的不是「有几个字段」（那是会过期的镜像），而是「一个都不许漏登记」（这是约束）。
{
  const tableOf = name => {
    const m = html.match(new RegExp('const ' + name + '=\\[([\\s\\S]*?)\\];'));
    assert(m, '取不到 ' + name + '（登记表写法变了？先修本脚本的取法）');
    return (m[1].match(/'[^']+'/g) || []).map(s => s.slice(1, -1));
  };
  const registered = new Set([
    ...tableOf('PAUSE_TIME_FIELDS'), ...tableOf('PAUSE_PLAYER_TIME_FIELDS'),
    ...tableOf('PAUSE_ENTITY_TIME_FIELDS'), ...tableOf('PAUSE_NON_TIME_FIELDS'),
  ]);
  const declared = [...new Set([...html.matchAll(/\b([A-Za-z_$][\w$]*(?:Until|At))\s*:/g)].map(m => m[1]))];
  assert(declared.length >= 14, '没从源码里扫到足够的计时字段，取法过时了（正则要跟着更新）');
  const missing = declared.filter(k => !registered.has(k));
  assert(missing.length === 0, '这些绝对计时字段没登记进 PAUSE_* 表，暂停会白送时间：' + missing.join('、'));
}
await access(path.join(projectRoot, 'vendor/qrcode-generator.js'));
const swSource = await readFile(path.join(projectRoot, 'sw.js'), 'utf8');
// Service Worker 安装必须绕开浏览器 HTTP 缓存，否则「版本升了、资源还是旧的」。
// 0812 血泪：鱼小姐改青绿后成绩海报里仍是金鱼——海报画的是 app 图标 PNG，
// 而 cache.addAll 走 HTTP 缓存，把 EdgeOne 上长缓存的旧图装进了新版 SW 缓存。
assert(/cache:\s*'reload'/.test(swSource), "sw.js 安装没用 cache:'reload'，新版缓存会被旧的 HTTP 缓存污染（0812 海报金鱼就是这么来的）");
const SW_CACHE = (swSource.match(/const CACHE='([^']+)'/) || [])[1];
assert(SW_CACHE, '取不到 sw.js 的缓存版本名（const CACHE 的写法变了？）');
const PWA_ASSET_HASH = await pwaAssetHash();
assert(SW_CACHE.endsWith('-' + PWA_ASSET_HASH),
  'icons/ 或 manifest.webmanifest 已变化，但 sw.js CACHE 没带当前哈希 -' + PWA_ASSET_HASH
  + '。只在这两类资源变化时更新 CACHE；index.html 不在本门禁范围内。');

// 可复用美术资源必须跟正本同步。以前这只是交接文档里的一条手工步骤，
// 漏跑就悄悄过期；现在是发布门禁，改了 index.html 的美术却没重跑导出器直接构建失败。
await run(process.execPath, [path.join(projectRoot, 'tools/extract-assets.mjs'), '--check'], { cwd: repoRoot });

await mkdir(path.dirname(output), { recursive: true });
const staging = await mkdtemp(path.join(tmpdir(), 'myskme-monkey-stage-'));
try {
  await cp(source, path.join(staging, 'index.html'));
  await cp(path.join(projectRoot, 'manifest.webmanifest'), path.join(staging, 'manifest.webmanifest'));
  await cp(path.join(projectRoot, 'sw.js'), path.join(staging, 'sw.js'));
  await cp(path.join(projectRoot, 'vendor'), path.join(staging, 'vendor'), { recursive: true });
  await cp(path.join(projectRoot, 'icons'), path.join(staging, 'icons'), { recursive: true });
  await cp(path.join(here, 'edgeone.json'), path.join(staging, 'edgeone.json'));
  await cp(path.join(here, 'robots.txt'), path.join(staging, 'robots.txt'));
  await cp(path.join(here, 'sitemap.xml'), path.join(staging, 'sitemap.xml'));
  await run('zip', ['-qry', output, '.'], { cwd: staging });
  const archive = await readFile(output);
  const bytes = (await stat(source)).size;
  const sha256 = createHash('sha256').update(archive).digest('hex');
  console.log('是猴就上100层 EdgeOne 发布包：' + output);
  console.log('单文件游戏首页：' + bytes + ' B；ZIP：' + archive.byteLength + ' B');
  console.log('SHA-256：' + sha256);
} finally {
  await rm(staging, { recursive: true, force: true });
}
