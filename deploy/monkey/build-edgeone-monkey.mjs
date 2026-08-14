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
// 任何「数源码里出现几次」的门禁，**数之前必须先把注释与字符串剥掉**。
// 0813 巡查两个方向都抓到了：
//   假阴性：把 setTimeout(runStressQA,...) 整行注释掉，「自检入口必须被引用」照样绿，
//           24000 帧压力测试静默消失、构建退出码 0。
//   假阳性：注释里写一句「不要再加第二个 fetch(」，「联网出口只能有一个」当场误报。
// 两头都错，根因是同一个：拿源码字面量当程序结构使。
function stripComments(source) {
  // 只剥注释，**不动字符串**。第一版连字符串一起剥，结果被正则字面量里的引号
  // （例如 /['"]/）带偏，从那个引号一路吞到很远，CODE 直接残缺。
  // 而 0813 巡查抓到的两个方向本来就都只关注释：
  //   假阴性：把 setTimeout(runStressQA,...) 整行注释掉，「自检入口必须被引用」照样绿。
  //   假阳性：注释里写一句「不要再加第二个 fetch(」，「联网出口只能有一个」当场误报。
  // 要正确地找出注释，仍然必须认得字符串与正则（'https://x' 里那个 // 不是注释）。
  let out = '', i = 0, prev = '';
  const n = source.length;
  const regexAllowedAfter = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^', 'n']);
  while (i < n) {
    const ch = source[i], two = source.slice(i, i + 2);
    if (two === '//') { while (i < n && source[i] !== '\n') i += 1; continue; }
    if (two === '/*') { i += 2; while (i < n && source.slice(i, i + 2) !== '*/') i += 1; i += 2; continue; }
    if (ch === '"' || ch === "'" || ch === '`') {
      out += ch; i += 1;
      while (i < n && source[i] !== ch) {
        if (source[i] === '\\') { out += source[i]; i += 1; }
        if (i < n) { out += source[i]; i += 1; }
      }
      out += source[i] || ''; i += 1; prev = ch; continue;
    }
    if (ch === '/' && regexAllowedAfter.has(prev)) {
      // 正则字面量：整段原样抄过去，里面的引号与斜杠都不许再被当成别的东西。
      out += ch; i += 1;
      let inClass = false;
      while (i < n) {
        const c = source[i];
        if (c === '\\') { out += c + (source[i + 1] || ''); i += 2; continue; }
        if (c === '[') inClass = true;
        else if (c === ']') inClass = false;
        else if (c === '/' && !inClass) break;
        else if (c === '\n') break;
        out += c; i += 1;
      }
      out += source[i] || ''; i += 1; prev = '/'; continue;
    }
    out += ch;
    if (!/\s/.test(ch)) prev = ch;
    i += 1;
  }
  return out;
}
// CSS 的 /* */ 也会被一起剥掉，正好——那些注释同样不该算作「接线」。
const CODE = stripComments(html);

// 游戏零联网出口。世界楼榜 0814 整体拆除（王老师拍板：联网榜不稳定，
// 本机榜与稳定性第一，日后再说）——从那天起，这个单文件在运行时**一次网都不联**。
// 曾经的门是「fetch 只许有一个且必须在 worldFetch 里」，现在是「一个都不许有」。
// 要恢复联网功能请先跟王老师确认，然后把这一段门改回「唯一出口」的形状。
const FETCH_CALLS = (CODE.match(/\bfetch\s*\(/g) || []).length;
assert(FETCH_CALLS === 0, '游戏代码里出现了 fetch 调用（' + FETCH_CALLS + ' 处）：'
  + '本作 0814 起零联网，世界楼榜已拆除，要联网先跟王老师确认');
// 旁路黑名单照旧全量盯着：sendBeacon / EventSource / XHR / WebSocket / 动态 import。
assert(!/\b(?:XMLHttpRequest|WebSocket|EventSource)\s*\(/.test(CODE), '游戏出现未批准的网络旁路');
assert(!/navigator\s*\.\s*sendBeacon/.test(CODE), '出现 sendBeacon 旁路');
assert(!/\bimport\s*\(/.test(CODE), '出现动态 import：本作是单文件离线包，不许运行时再拉代码');
// 世界楼榜的回潮门：这些标识符一个都不许再出现（历史注释不算——查的是剥注释后的 CODE）。
// 注意别把「世界窗景」(worldWindow) 误伤进来，那是留下的气氛系统。
for (const token of ['MONKEY_API', 'worldFetch', 'WORLD_RETRY_STEPS', 'flushWorldQueue',
  'queueWorldRun', 'playerToken', 'worldDeviceId', 'WORLD_PENDING_KEY']) {
  assert(!CODE.includes(token),
    '世界楼榜的残余又出现了（' + token + '）：0814 已整体拆除，要恢复先跟王老师确认');
}
// 代码里除了品牌网关，不许再出现别的外链地址（图片 src 那类旁路顺带一起挡）。
const URLS = [...new Set((CODE.match(/https?:\/\/[A-Za-z0-9.-]+/g) || []))]
  .filter(u => !u.startsWith('https://myskme.com') && !u.startsWith('https://monkey.myskme.com')
    && !u.startsWith('http://www.w3.org') && !u.startsWith('https://www.w3.org'));
assert(URLS.length === 0, '代码里出现了品牌网关以外的外链：' + URLS.join('、'));
// 本机楼榜的三件事：真的存（rememberLocalRun）、真的登记（submitRank 改名同步旧行）、
// 真的分周（weekStartAt 按北京时间算周一零点，不跟设备时区漂）。
assert(html.includes('function rememberLocalRun(') && html.includes('function weekStartAt(')
  && CODE.includes('for(const row of localBoard)if(!row.npc)row.name=alias;'),
  '本机楼榜链路不完整：存榜、改名同步、按周分口径三样缺一不可');
assert(html.includes('id="recordLine"') && html.includes('personalBestAtStart=IS_TEST_RUN?0:saved.height')
  && html.includes('state.maxMeters>state.personalBestAtStart'), '上次纪录目标线或越线庆祝不完整');
assert(!html.includes('l1fr2z'), '仍含随机旧路径');
assert(!html.includes('myskme.com/fun/monkey'), '仍含已废弃的目录地址');
assert(manifest.name === '是猴就上100层' && manifest.icons?.length >= 3, 'PWA 清单或图标声明不完整');
for (const icon of manifest.icons) await access(path.join(projectRoot, icon.src.replace(/^\.\//, '')));
assert(html.includes('function buildPoster()') && html.includes('function syncViewportMode()'), '海报或安卓宽视口修复缺失');
{
  // 2026-08-13 改了这一条守的东西，理由写清楚，别当成放松。
  //
  // 原来这里断言 .screen 必须是 overflow:hidden，意思是「菜单不许滚」。
  // 但那天巡查实测：手机横过来（844x390）时首页的「单猴挑战，立即上楼」整颗被裁在卡片外，
  // 玩家开不了局；进了称号墙/奶茶图鉴更糟——关闭键在屏外，触屏没有 Esc 的等价物，
  // 八条出路逐个试过只有键盘 Esc 有效，也就是手机上**只能刷新页面**。
  // 也就是说这条门把「装不下」变成了「出不去」，代价远大于它保住的那点洁癖。
  //
  // 真正要保证的从来不是「滚不动」，而是「**不需要滚**」。后者现在由两样东西真量：
  //   页面里的 measureMenuOverflow（拿最坏档案逐屏逐页量 scrollHeight）
  //   monkey/tools/qa-viewports.mjs（把它在 7 个视口上各跑一遍，含 320x568 / 375x553）
  // 而 overflow-y:auto 在内容装得下时和 hidden 完全一样：不出滚动条、滚不动。
  // 所以这里改成守「兜底能滚」，把「不需要滚」交给量出来的那两道。
  // 取规则时要**锚在行首**：`.screen,.card{scrollbar-width:none}` 这种组合选择器
  // 会让不带锚的 /\.card\{/ 先命中它，于是量到的是别人家的声明。
  const screenCss=(html.match(/(?:^|\n)\.screen\{([^}]*)\}/)||[])[1]||'';
  assert(/overflow-y\s*:\s*auto/.test(screenCss),
    '菜单屏幕又被改回滚不动了。单屏是优化不是硬约束——装不下时必须还够得着，'
    + '否则横屏进了子屏幕就只能刷新页面（0813 实测过）。「不需要滚」由 measureMenuOverflow '
    + '与 monkey/tools/qa-viewports.mjs 保证，不靠把滚动关掉来假装。');
  const cardCss=(html.match(/(?:^|\n)\.card\{([^}]*)\}/)||[])[1]||'';
  assert(/overflow-y\s*:\s*auto/.test(cardCss), '卡片又被改回滚不动了，理由同上');
  assert(html.includes('function renderPager(') && html.includes('data-result-page="2"') && html.includes('id="titlesPager"') && html.includes('id="teaPager"'),
    '单屏分页结构不完整，长内容会重新把页面撑出屏幕');
  // 「不需要滚」这件事必须有人真量。少了这个函数，上面那条就变成了单纯的放松。
  assert(html.includes('function measureMenuOverflow('), '真量单屏溢出的那个函数没了，不许只留兜底滚动');
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
  // **必须数剥过注释的 CODE**：0813 巡查实测，把 setTimeout(()=>runStressQA(),60) 整行
  // 注释掉（而不是删掉），这条照样绿，24000 帧压力测试就此静默消失、构建退出码 0。
  // 一条能被注释满足的门禁，和一条永远不会失败的门禁是同一个东西。
  const uses = (CODE.match(new RegExp('\\b' + fn + '\\b', 'g')) || []).length;
  assert(uses >= 2, '自检入口 ' + fn + ' 只有定义没有任何引用，等于形同虚设');
}
assert(html.includes('const SURPRISES=[') && html.includes('MUSIC_TICK_MS=70'), '惊喜池或省电音频调度缺失');
assert(html.includes('id="worldWindow"') && html.includes('const CULTURE_MOTIFS=[')
  && html.includes('function claimCultureMotif(') && html.includes('function choosePosterPair(')
  && html.includes('career.motifs.push(state.motifId)'),
  '世界窗景的八景轮换、正式局收藏或随机海报组合不完整');
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
  // **每一块都要查**，不能只查第一块。0813 巡查实测：在后面再写一块
  // @media(max-width:699px){#gameShell{height:844px}}，构建绿、?qa=1 绿，
  // 而 430x932 上下各露 44px 底色——正是 0813 白天刚修过的那个毛病原样回来。
  // **写法归一之后再匹配。** 原来只认不带空格的 `@media(max-width:699px)`，
  // 按 CSS 常规写法补一块 `@media (max-width: 699px) { … 844px … }` 就能绕过去，
  // 而它同优先级又写在后面，层叠上赢——0813 白天刚修过的毛病原样回来。
  const FLAT = html.replace(/\s+/g, '');
  const blocks = [...FLAT.matchAll(/@media\(max-width:699px\)\{[\s\S]{0,600}?\}\}/g)].map(hit => hit[0]);
  assert(blocks.length >= 1, '手机铺满规则整块没了（0813 修过一次，别再退回 844 死高度）');
  assert(blocks.some(block => /#gameShell\{[^}]*height:min\(100svh/.test(block)), '手机铺满规则里外壳高度没用 100svh');
  for (const block of blocks) {
    assert(!/844/.test(block), '某一块 @media(max-width:699px) 里又出现了 844 这个死高度——大屏手机会重新留出上下边');
  }
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
  // 原来只认对象字面量里的「键:」，于是 state.windCooldownUntil=... 这种**懒创建**的字段
  // 一个都扫不到——0813 实测：暂停 5 秒，windCooldownUntil 白白少了 5114ms，而两道门都是绿的。
  // 所以成员赋值式也要扫。
  const declared = [...new Set([
    ...[...CODE.matchAll(/\b([A-Za-z_$][\w$]*(?:Until|At))\s*:/g)].map(hit => hit[1]),
    ...[...CODE.matchAll(/\.([A-Za-z_$][\w$]*(?:Until|At))\s*=[^=]/g)].map(hit => hit[1]),
  ])];
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

// ---- 导航的人性化底线（2026-08-13 王老师反馈：结算与首页的「下一页下一页」不够人性化）----
// 这几条守的是**结论**，不是像素：线性翻页把去处藏起来、结算回不了首页、
// 主操作会随翻页消失——三样都是玩家一分钟内就会撞上的。
// 注意匹配的是真正的属性写法 data-page-step="…"，不是这五个字出现在任何地方——
// 第一版写成 /data-page-step/ 当场被自己的运行期自检满足了（那条自检里有
// querySelector('[data-page-step]')），检测器和检测目标同形，是这仓库里反复出现的一类坑。
assert(!/data-page-step="/.test(html),
  '结算又退回「上一页/下一页」了。线性翻页把去处藏了起来，玩家只能盲点，0813 已换成命名标签。');
const RESULT_TABS = [...html.matchAll(/data-result-tab="(\d)">([^<]*)</g)];
assert(RESULT_TABS.length === 3 && RESULT_TABS.every(([, , label]) => label.trim().length >= 2),
  '结算的三个分页标签必须都在、且都要有名字——没名字的标签跟「下一页」是一回事。');
assert(html.includes('id="resultHomeButton"') && /el\.resultHome\.addEventListener\('click',\s*resultToTitle\)/.test(html),
  '结算页的「返回首页」没了。改之前这一屏根本没有回首页的路：玩过一局就再也换不了开工装备。');
assert(/function resultToTitle\(\)\{state\.over=false;/.test(html),
  'resultToTitle 必须清掉 state.over，否则回到首页后子屏幕的返回键会把玩家又弹回结算。');
// 翻页只许有一处实现。手势和按钮各写一套，迟早出现「滑得到第 4 页、按钮只到第 3 页」。
// 数的是**裸标识符**，不是带括号的调用——0813 踩过：setTimeout(runQA,50) 根本没有括号，
// 而 html.includes('runQA(') 又会被函数定义自己满足。
// 更要命的是第二层：**数之前必须先把自检代码切掉**。自检里写着
// /stepPage\(/.test(bindSwipePaging.toString())，这一句本身就会被数成一次「引用」，
// 于是把真正的接线整行删掉，门照样绿——0813 反向验证时当场撞到，检测器满足了检测目标。
const QA_AT = CODE.indexOf('function measureMenuOverflow(');
assert(QA_AT > 0, '取不到自检代码的起点（measureMenuOverflow 改名了？先修本门禁的取法）');
// 用剥过注释与字符串的 CODE：一行注释不该算作一次「接线」。
const PRODUCT_CODE = CODE.slice(0, QA_AT);
// claimCultureMotif / choosePosterPair 原来只被断言「函数在不在」，不查调用点——
// 0813 实测把 claimCultureMotif 的调用删掉，构建绿、?qa=1 绿，
// 而八种世界窗景当场退化成四种死循环（前 8 局只出 4 种）。
// syncRotateGate 与 choosePosterPair 0814 补进来：
// 前者原来写的是 `CODE.replace(/function\\s+syncRotateGate/,'')` 再 test 名字，
// **被 runQA 自己那句 `typeof syncRotateGate==='function'` 满足了**——
// 把三行接线全删光，构建照样绿，而横屏时局在后台继续跑、方向键卡在按下状态。
// 后者原来只断言「函数在不在」，把唯一调用点换成写死的第一档，
// 六种纸型退化成一种、纸型收藏线整条死掉，构建与 ?qa=1 双绿。
for (const fn of ['activePager', 'stepPage', 'bindSwipePaging', 'claimCultureMotif',
  'syncRotateGate', 'choosePosterPair', 'loadDressedMonkeyImage', 'renderResultWallet']) {
  assert(new RegExp('function\\s+' + fn + '\\s*\\(').test(PRODUCT_CODE), '导航函数 ' + fn + ' 不见了');
  const uses = (PRODUCT_CODE.match(new RegExp('\\b' + fn + '\\b', 'g')) || []).length;
  assert(uses >= 2, '导航函数 ' + fn + ' 在产品代码里只有定义、没有接线（自检里的引用不算数）');
}
// measureMenuOverflow 本身就是自检的一部分，所以单独查它确实被 runQA 调用了。
assert(/measureMenuOverflow\(\)/.test(html.slice(html.indexOf('function runQA('))),
  '「单屏菜单不溢出」那条自检没有被 runQA 调用，等于白写');
// 主操作必须在三个 .result-page 之外。在里面就意味着翻到别的页它会消失。
const ACTIONS_AT = html.indexOf('class="btn-row result-actions"');
const TABS_AT = html.indexOf('id="resultTabs"');
assert(ACTIONS_AT > 0 && TABS_AT > 0 && ACTIONS_AT > TABS_AT,
  '再来一局/生成成绩海报必须常驻在分页标签之外。核心循环是「摔了再来」，这颗按钮不该会消失。');

// ---- 竖屏锁定（2026-08-13 王老师定：这个作品只做竖屏）----
assert(html.includes('id="rotateGate"'), '竖屏提示层没了。横过来时这栋楼只剩一条缝，得直说，别让人以为游戏坏了。');
{
  // CSS 与 JS 必须用同一条媒体查询，抄错一个就出现「提示层出来了但局没暂停」。
  const jsQuery = (CODE.match(/const LANDSCAPE_QUERY='([^']+)'/) || [])[1];
  assert(jsQuery, '取不到 LANDSCAPE_QUERY（写法变了？先修本门禁的取法）');
  const cssQuery = new RegExp('@media' + jsQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*'));
  assert(cssQuery.test(html.replace(/\s+/g, ' ')) || html.includes('@media(' + jsQuery.slice(1)),
    '竖屏锁定的 CSS 与 JS 用的不是同一条媒体查询');
  // syncRotateGate 的接线由上面那一圈「必须有调用点」统一守（它原来在这里，
  // 写法是 replace 掉定义再 test 名字，被 runQA 自己的 typeof 检查满足了）。
}

// ---- 称号徽章与存档契约 ----
{
  // 称号 id 是**存档契约**，不是镜像：career.titles 里存的就是这些字符串。
  // 改一个 id，所有已经拿到该称号的玩家当场蒸发一枚，而且没有任何报错。
  // 所以这一份写死在门里，和「鱼小姐必须青绿」是同一类立法。要改先想清楚迁移。
  const HONOR_IDS = ['certified','zerofloor','grudge47','genuine','moremonkey','overdue','skimread',
    'lightsugar','fullsugar','noice','roomtemp','nopb','talker','archivist','toolfree','fake'];
  // **先把 HONORS 那一段圈出来再匹配。** 原来直接在整个 html 上匹
  // /\{id:'…',emblem:'…',tint:'…'/，0814 给 PERK_POOL 也配了 emblem+tint 之后当场误报
  // 「扫到 21 条，期望 16」。这是同一类错的第五次（.card 正则、ICON_GLYPHS 找 href=、
  // FACADES 匹到 MODES、hueGap 当多行函数取）：**扫描之前先把范围圈死。**
  const honorBlock = (CODE.match(/const HONORS=\[[\s\S]*?\n\];/) || [''])[0];
  assert(honorBlock, '取不到 HONORS 那一段（写法变了？先修本门禁的取法）');
  const found = [...honorBlock.matchAll(/\{id:'([a-z0-9]+)',emblem:'([a-z]+)',tint:'(#[0-9a-f]{6})'/g)];
  assert(found.length === HONOR_IDS.length,
    '称号条数或写法变了：扫到 ' + found.length + ' 条，期望 ' + HONOR_IDS.length);
  for (const id of HONOR_IDS) {
    assert(found.some(hit => hit[1] === id), '称号 id 「' + id + '」不见了。存档里存的就是它，改名等于让老玩家的称号蒸发');
  }
  // 每个徽章图形都必须真的在图形表里，否则会静默退化成默认的印章，16 枚看着像一枚。
  const glyphBlock = (CODE.match(/const ICON_GLYPHS=\{([\s\S]*?)\n\};/) || [])[1] || '';
  for (const [, , emblem] of found.map(hit => [0, 0, hit[2]])) {
    assert(new RegExp('(^|\\n)\\s*' + emblem + ':').test(glyphBlock), '徽章图形 ' + emblem + ' 不在 ICON_GLYPHS 里，会静默退化成默认印章');
  }
  // 只在**取出来的那一段**里查。第一版写成从 ICON_GLYPHS 一路 [\s\S]*? 找 href=，
  // 结果匹到了文件后面 SVG <use href= 那一堆，构建当场误报——
  // 这跟前面那个「不锚行首的 .card 正则」是同一类错：范围没圈住。
  assert(!/<image|href=/.test(glyphBlock), '徽章里出现了 <image> 或外部 href，就没法当可复用素材导出了');
}

// 部门清单提到块外，立面与调式两道门共用一份——同一个清单取两次，迟早取法不一致。
const DEPT_IDS = [...html.matchAll(/\{id:'([a-z]+)',name:'[^']*',short:/g)].map(hit => hit[1]);

// ---- 建筑立面语言 ----
{
  // 十二个部门必须一一对应十二种立面。少一个就会有一段楼没有立面（静默变白墙），
  // 多一个就有一种永远看不到——两种都不会报错，只能靠这道门。
  const deptIds = DEPT_IDS;
  // **先把 FACADES 那一段圈出来再匹配**。第一版直接在整个 html 上匹
  // /\{id:'…',dept:'…',name:/，结果把结构完全相同的 MODES 也数了进去，报「立面数 24」。
  // 这已经是同一类错的第三次（不锚行首的 .card 正则、从 ICON_GLYPHS 一路找 href=）：
  // **扫描之前先把范围圈死**，否则迟早匹到隔壁那张结构一样的表。
  const facadeBlock = (CODE.match(/const FACADES=\[[\s\S]*?\n\];/) || [''])[0];
  assert(facadeBlock, '取不到 FACADES 那一段（写法变了？先修本门禁的取法）');
  const facadeDepts = [...facadeBlock.matchAll(/\{id:'[a-z0-9]+',dept:'([a-z]+)',name:/g)].map(hit => hit[1]);
  assert(deptIds.length >= 12, '取不到部门清单（写法变了？先修本门禁的取法）');
  assert(facadeDepts.length === deptIds.length,
    '立面数（' + facadeDepts.length + '）与部门数（' + deptIds.length + '）对不上，会出现没有立面的楼层或永远看不到的立面');
  for (const dept of deptIds) {
    assert(facadeDepts.includes(dept), '部门 ' + dept + ' 没有对应的立面语言');
  }
  // 每一种都必须真带一句知识。没有 fact 的立面只是花纹，那就不是王老师要的那件事。
  const facts = [...facadeBlock.matchAll(/fact:'([^']{20,})'/g)];
  assert(facts.length === facadeDepts.length, '有立面缺 fact（或 fact 太短），立面就退化成纯花纹了');
  // 立面是背景纹理，不许盖住台阶与猴子：必须压在 buildingBack 里，且有自己的减淡规则。
  assert(html.indexOf('id="facadeLayer"') > html.indexOf('id="buildingBack"')
    && html.indexOf('id="facadeLayer"') < html.indexOf('id="platformLayer"'),
    '立面层必须在楼体背景里、且在台阶层之前，否则会盖住台阶');
  assert(/#facadeLayer\{[^}]*opacity:/.test(html), '立面层没有减淡规则，会跟台阶抢视线（0813 截图实测过）');
  // 不写字：出海时建筑语言不需要翻译，写了字就得重画。
  assert(!/<text|<image|href=/.test(facadeBlock), '立面里出现了文字或外链，就没法当免翻译的可复用素材了');
}

// ---- 音乐调式 ----
{
  // 十二个部门一一对应十二种调式，理由与立面那条相同：少一个会有一段楼静默用回默认调，
  // 多一个会有一种永远听不到，两种都不报错。
  const modeBlock = (CODE.match(/const MODES=\[[\s\S]*?\n\];/) || [''])[0];
  assert(modeBlock, '取不到 MODES 那一段（写法变了？先修本门禁的取法）');
  const modeDepts = [...modeBlock.matchAll(/\{id:'[a-z0-9]+',dept:'([a-z]+)',name:/g)].map(hit => hit[1]);
  assert(modeDepts.length === DEPT_IDS.length,
    '调式数（' + modeDepts.length + '）与部门数（' + DEPT_IDS.length + '）对不上');
  for (const dept of DEPT_IDS) assert(modeDepts.includes(dept), '部门 ' + dept + ' 没有对应的调式');
  // 每种都要带一句真的乐理，否则它只是换了个音阶名。
  const modeFacts = [...modeBlock.matchAll(/fact:'([^']{20,})'/g)];
  assert(modeFacts.length === modeDepts.length, '有调式缺 fact（或太短），那就只是换了个音阶名');
  // 换调式的前提是「只换色彩、不换曲子」：旋律必须由级数生成，不许再写死半音数组。
  assert(/const MELODY_DEGREES=/.test(CODE) && /function degreeToSemitone\(/.test(CODE),
    '旋律又被写死成半音了。整套调式的前提是「旋律只记第几级」，写死半音就换不了调式了。');
  assert(!/melodies=\[\[12,14,16/.test(CODE), '改版前那份写死的旋律又回来了');
}

// ---- 翻页：页数少时不许再出现上一页/下一页 ----
assert(/function bindTapToAdvance\(/.test(CODE) && (CODE.match(/\bbindTapToAdvance\b/g) || []).length >= 2,
  '「点列表空白处翻下一页」的接线没了。王老师 0813 明说上一页/下一页还是多，这是替代它的那条路。');
assert(/pager-dots solo/.test(html),
  '页数少时应该只留页码点、不给上一页/下一页——那两颗按钮会白占一整行。');

// ---- 局内任命：不许退回模态三选一（2026-08-14 王老师定：弹窗打断连贯性）----
{
  // 弹窗那一套整套拔掉了。留一道门盯着它别被谁「顺手加回来」——
  // 三选一在这个游戏里必须是**一次落点选择**，不是一次读字。
  // 查的是剥过注释的 CODE：反向验证时发现，光是在注释里提一句 openPerkChoice
  // 就能把这道门弄红。一条会被注释误伤的门，用不了几次就会被人当噪音忽略。
  assert(!/choiceScreen|choice-card|openPerkChoice|choosePerk/.test(CODE),
    '模态三选一回来了。它在这个心流型爬楼里有四重代价，最要命的是选择本身没有游戏性：'
    + '这个游戏的动词是「位置」，卡片的动词是「文字」。要改先跟王老师说。');
  assert(!/\bstate\.choiceOpen\b/.test(CODE),
    'state.choiceOpen 回来了。弹窗拆了之后它恒为 false，恒为 false 的开关比没有开关更害人');

  // 任命排的三块台是自己造的，不是挑现成的——第一版挑现成的那排，量下来关卡生成器
  // 极少一排造三块台，三选一常年退化成二选一甚至发不出去。
  const rowFn = (CODE.match(/function addAppointmentRow\([\s\S]*?\n\}/) || [''])[0];
  assert(rowFn, '取不到 addAppointmentRow（写法变了？先修本门禁的取法）');
  assert(/slice\(0,\s*3\)/.test(rowFn), '任命排不再是一次发三份了');
  assert(/addPlatform\(/.test(rowFn) && /addItem\('perk'/.test(rowFn),
    '任命排必须自己造台子再挂任命：挑现成的排会让三选一退化成一选一');
  assert(/state\.perkGroup\s*\+=\s*1/.test(rowFn),
    '同一批任命要有共同的 perkGroup，否则「拿一份、废另两份」认不出同批');

  const takeFn = (CODE.match(/function takePerk\([\s\S]*?\n\}/) || [''])[0];
  assert(takeFn, '取不到 takePerk（写法变了？先修本门禁的取法）');
  assert(/other\.perkGroup!==item\.perkGroup/.test(takeFn) && /other\.declined=true/.test(takeFn),
    '拿一份之后同批的另外两份必须当场作废并淡出，否则摔回去还能把三份都捡了，三选一就名存实亡');

  // 任命图标必须真在图形表里，否则会静默退化成默认印章，五份看着一模一样。
  const glyphs = (CODE.match(/const ICON_GLYPHS=\{([\s\S]*?)\n\};/) || ['', ''])[1];
  const perkBlock = (CODE.match(/const PERK_POOL=\[[\s\S]*?\n\];/) || [''])[0];
  const perkEmblems = [...perkBlock.matchAll(/emblem:'([a-z]+)'/g)].map(hit => hit[1]);
  assert(perkEmblems.length >= 5, '任命少于五份，或不再各带一枚图标');
  for (const emblem of perkEmblems) {
    assert(new RegExp('(^|\\n)\\s*' + emblem + ':').test(glyphs), '任命图形 ' + emblem + ' 不在 ICON_GLYPHS 里');
  }
  // 局内实体一律不靠文字牌解释（台阶只有绕口令与标点例外，那两处另有门禁盯着）。
  // 道具卡原来拿 <text> 画「U / @ / 免 / 梯 / 宽」五个字符，出海要重画，0814 换成图形。
  const itemFn = (CODE.match(/function ensureItemNode\([\s\S]*?\n\}/) || [''])[0];
  assert(itemFn, '取不到 ensureItemNode（写法变了？先修本门禁的取法）');
  assert(!/<text\b/.test(itemFn), '局内道具/任命又开始用 <text> 写字了：那既不是图标风格，也没法当免翻译素材导出');
}

// ---- 首页收藏条（2026-08-14 王老师：首页缺少这些位置）----
{
  const stripBlock = (CODE.match(/const COLLECTIONS=\[[\s\S]*?\n\];/) || [''])[0];
  assert(stripBlock, '取不到 COLLECTIONS（写法变了？先修本门禁的取法）');
  const ids = [...stripBlock.matchAll(/\{id:'([a-z]+)',label:/g)].map(hit => hit[1]);
  // 长期档案里每一条收集线都该在首页有个格子。少一格＝那条线收集了也没人看得见。
  for (const line of ['titles', 'teas', 'outfit', 'perks', 'surprises', 'motifs', 'facades', 'modes']) {
    assert(ids.includes(line), '收藏条少了「' + line + '」这一格：收集了没地方看，等于没做');
  }
  assert(new RegExp('grid-template-columns:repeat\\(' + ids.length + ',1fr\\)').test(CODE),
    '收藏条的列数（CSS）与收集线条数（' + ids.length + '）对不上，会换行，把首页顶出一屏');
  // 首页原来那两个按钮（称号墙/奶茶图鉴）被收藏条吃掉了，入口必须还在。
  assert(/openTitles\(\)/.test(stripBlock) && /openTeas\(\)/.test(stripBlock),
    '称号墙与奶茶图鉴的首页入口没了：那一整行按钮是被收藏条换掉的，入口得跟着搬过来');
  assert(!/id="wornTitleButton"|id="teaButton"/.test(CODE),
    '首页又多出一行按钮了。收藏条当初是拿那一行的高度换来的，两个都留就白换了');
  assert(/career\.perks/.test(CODE),
    '任命没进长期档案：一局作废的增益如果不留收集线，收集控就没有跨局的理由去凑齐它们');
}

// ---- 香蕉商店（2026-08-14 王老师：香蕉没什么用，做成能兑换的行头，像当年的 QQ 秀）----
{
  const shopBlock = (CODE.match(/const SHOP_ITEMS=\[[\s\S]*?\n\];/) || [''])[0];
  const wearBlock = (CODE.match(/const WEAR_ART=\{[\s\S]*?\n\};/) || [''])[0];
  const slotBlock = (CODE.match(/const SHOP_SLOTS=\[[\s\S]*?\n\];/) || [''])[0];
  assert(shopBlock && wearBlock && slotBlock, '取不到商店那几段（写法变了？先修本门禁的取法）');

  const items = [...shopBlock.matchAll(/\{id:'([a-z0-9]+)',slot:'([a-z]+)',tier:([1-5]),/g)]
    .map(hit => ({ id: hit[1], slot: hit[2], tier: Number(hit[3]) }));
  const slots = [...slotBlock.matchAll(/\{id:'([a-z]+)',name:/g)].map(hit => hit[1]);
  assert(items.length >= 16, '行头少于 16 件。王老师要的是「种类多一些、可以比较难获得」，货架太空撑不起那件事');
  assert(new Set(items.map(i => i.id)).size === items.length, '行头 id 有重号——id 是存档契约，重号会让存档指错东西');

  // **最重要的一条：行头是纯外观。**
  // 一旦某件行头开始改数值，「买得起的人更强」就成立了，整个商店从装饰品变成付费墙。
  // 红鲤鱼帽当初也是这么定的，同一条立法。判据是字段名，不是善意：
  // 数据表里只准出现 id/slot/tier/name/line 这五个键。
  const keys = new Set([...shopBlock.matchAll(/[,{]([a-z][a-zA-Z0-9]*):/g)].map(hit => hit[1]));
  for (const key of keys) {
    assert(['id', 'slot', 'tier', 'name', 'line'].includes(key),
      '行头数据里出现了字段「' + key + '」。行头必须是纯外观：一件行头开始改数值，'
      + '商店就从装饰品变成付费墙了。要加玩法请另起一套，别挂在这张表上');
  }
  assert(!/SHOP_ITEMS[\s\S]{0,400}?(?:speed|gravity|bonus|score|damage|shield|multiplier)/.test(shopBlock),
    '行头表里出现了玩法字眼，同上：外观归外观');

  for (const item of items) {
    assert(slots.includes(item.slot), '行头 ' + item.id + ' 的槽位 ' + item.slot + ' 不在 SHOP_SLOTS 里');
    assert(new RegExp('(^|\\n)\\s*' + item.id + ':').test(wearBlock),
      '行头 ' + item.id + ' 没有穿戴图，买了会什么都不显示——那这件东西就等于不存在');
  }
  // 每个槽位都得有货，否则「同槽位只能戴一件」这条规则里会有一个永远空着的位置。
  for (const slot of slots) {
    assert(items.some(i => i.slot === slot), '槽位 ' + slot + ' 一件行头都没有');
  }
  // 档位必须真的越贵越高，否则「五档」只是标签。
  const prices = (CODE.match(/const TIER_PRICE=\{([^}]*)\}/) || ['', ''])[1];
  const tiers = [...prices.matchAll(/([1-5]):(\d+)/g)].map(hit => [Number(hit[1]), Number(hit[2])]);
  assert(tiers.length === 5, '价格档位不是五档了');
  for (let i = 1; i < tiers.length; i += 1) {
    assert(tiers[i][1] > tiers[i - 1][1], '第 ' + tiers[i][0] + ' 档不比第 ' + tiers[i - 1][0] + ' 档贵，分档就没意义了');
  }
  // 穿戴图不许写字：出海要翻译的话，一张带字的图就得重画一遍。
  assert(!/<text\b|<image\b/.test(wearBlock), '穿戴图里出现了 <text> 或 <image>，就不是免翻译素材了');

  // 三处落点必须共用同一段 WEAR_ART：局内的猴子、货架上的试衣镜、海报上的名片照。
  // 分成三份迟早出现「货架上是这样、穿上是那样」。
  assert(/function wornMarkup\(/.test(CODE) && /WEAR_ART\[id\]/.test(CODE), '穿戴图不再是从同一张表取的');
  // 货架的试衣镜现在经由 wearPart 取图（分前后两层用的同一条路），
  // 所以这里认的是**那条链没断**：试衣镜 -> wearPart -> WEAR_ART。
  // 只认最终那个字面量会把这条门变成一份会过期的镜像——它刚刚就是这么红的。
  assert(/function wearPart\(id,where\)\{[\s\S]{0,200}?WEAR_ART\[id\]/.test(CODE),
    'wearPart 不再从 WEAR_ART 取图了');
  assert(/function shopPreviewSvg\([\s\S]{0,500}?(WEAR_ART\[id\]|wearPart\(id,)/.test(CODE),
    '货架预览没用同一段穿戴图，会出现「买之前一个样、买之后另一个样」');
  // **要求调用点在 buildPoster 里面**，不是「名字在文件里出现过」——
  // 后者被函数定义自己满足：把 buildPoster 里那句换成 `const dressed=null`，
  // 十八件行头从名片上消失，构建照样绿。
  const posterFn2 = (CODE.match(/async function buildPoster\(\)\{[\s\S]*?\n\}/) || [''])[0];
  assert(/await loadDressedMonkeyImage\(\)/.test(posterFn2),
    '海报不印穿戴了。名片是「攀比」真正发生的地方，行头必须上那张图');
  assert(/dressedMonkeySvg\(/.test(CODE), '穿好行头的猴子画不出来了');
  assert(/querySelectorAll\('\.wear-layer'\)/.test(CODE),
    '穿戴层不再是一次刷全部了：局内三个环屏副本加首页那只，分开写迟早穿得不一致');
  // 穿戴要分前后两层：私人电梯体积比猴子还大，两扇门画在前面会把下半身整个盖住
  // （0814 Codex 真机复核报的）。断点写在画法字符串里，不另开一张会漂的表。
  assert(/const WEAR_SPLIT='<!--前-->'/.test(CODE), '穿戴的前后断点标记没了');
  assert(/function wornMarkup\(where='front'\)/.test(CODE), '穿戴不再分前后两层');
  assert(/\+wearPart\(id,'back'\)/.test(CODE) && /\+wearPart\(id,'front'\)/.test(CODE),
    '试衣镜不再走 wearPart 了：另抄一遍判断，「买之前看到的」与「穿上之后的」迟早对不上');
  // 电梯必须仍然是**跨两层**的那一件：断点在它的画法里。
  // 只认「断点在不在」，不抄任何一段坐标——抄坐标就是又一份会过期的镜像。
  const liftArt = (CODE.match(/\n  lift:'([^']*)'/) || [])[1] || '';
  assert(liftArt.includes('<!--前-->'),
    '私人电梯的画法没有前后断点了：整件画在前面会盖住猴子下半身，'
    + '整件画到身后又只剩一个空框、看着像纸箱（两种都拍过照）');
  // 断点不能画蛇添足地退化成「其实一边是空的」——那等于没分层。
  const [liftBack, liftFront] = liftArt.split('<!--前-->');
  assert(liftBack.trim() && liftFront.trim(),
    '私人电梯的前后断点有一边是空的，等于没分层');
  // 下面两道门的名字**全部从源码现取**，一个字面量都不抄。
  // 第一版两道都写死了 wear-behind，于是「把图层改名回 wear-back」——也就是 0814 真栽的那个改法——
  // 只会撞上写死名字的计数门，撞名门永远走不到；反向验证当场把这个揪了出来。
  // **门里抄的名字，和文档里抄的数字是同一类东西：会过期的镜像。**
  const slotIds = [...(CODE.match(/const SHOP_SLOTS=\[[\s\S]*?\n\];/) || [''])[0]
    .matchAll(/\{id:'([a-z]+)',name:/g)].map(hit => hit[1]);
  const layerNames = [...CODE.matchAll(/querySelectorAll\('\.(wear-[a-z]+)'\)/g)].map(hit => hit[1]);
  // 「身后」那层认的不是名字，是**它收的是 wornMarkup('back') 的产物**。
  const behindLayer = (CODE.match(
    /const (\w+)=wornMarkup\('back'\);[\s\S]{0,160}?querySelectorAll\('\.(wear-[a-z]+)'\)\)node\.innerHTML=\1;/) || [])[2];
  assert(slotIds.length >= 6 && layerNames.length >= 2 && behindLayer,
    '槽位表或图层名没取到，这道门等于没跑');
  assert((CODE.match(new RegExp('class="' + behindLayer + '"', 'g')) || []).length >= 4,
    '身后层（' + behindLayer + '）不足四处：局内三只环屏副本加首页那只');
  // **图层类名不许与任何槽位类名撞车。** 槽位类名是 wear-<槽位id>，
  // 图层第一版叫 wear-back，而「背上」槽位的 id 就是 back——
  // querySelectorAll 把槽位那个 <g> 也当成图层刷，电梯又画到猴子前面去了。
  // 这是 canon 锁里 carp-hat-on 撞 carp-hat 的同一族错，同样数值全绿、靠截图才看见。
  for (const layer of layerNames) {
    assert(!slotIds.includes(layer.slice(5)),
      '图层类名 ' + layer + ' 与槽位 ' + layer.slice(5) + ' 撞车了：'
      + "querySelectorAll('." + layer + "') 会把槽位那个 <g> 也当成图层刷");
  }

  // ---- 0814 王老师报的三条，加门盯住 ----

  // ① 「香蕉吃了怎么还有」：被收集的道具必须**当帧就不画了**。
  //    a65f9bd 给作废任命加淡出时，把 fade 写成 `declined ? 淡出值 : 1`，
  //    于是普通被收集的道具 fade 恒为 1，`collected && fade<=0` 永远不成立，
  //    唯一的退出路径只剩「滑出视野」——实测滞留中位 3916 ms、最长 8333 ms，
  //    同屏最多同时挂着 7 个已经入了账的道具。数值全对，只有画面是错的。
  //    这里认的是「collected 这一支有没有落到 0」，不是抄那一整行。
  {
    const fadeLine = (CODE.match(/const sy=H-\(item\.y-state\.cameraY\),fade=[^;]+;/) || [''])[0];
    assert(/item\.collected\?0:/.test(fadeLine),
      '被收集的道具没有当帧停画：香蕉入了账、计数器涨了，那根香蕉还在原地飘几秒，'
      + '玩家会把它当成还能捡的再扑一次');
    assert(/if\(fade<=0\|\|sy<-90/.test(CODE),
      '道具的绘制条件不再由 fade 统一决定了，collected 与 declined 会各走各的路');
  }

  // ② toast 必须盖在菜单屏之上。原来 40 < .screen 的 60 < 子屏的 76，
  //    于是首页收藏条九格里凡是用 toast 回话的都点了没反应。
  //    两个数都**从 CSS 现取**，不抄字面量。
  {
    const zOf = (sel) => {
      const rule = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{[^}]*z-index:(\\d+)');
      const hit = CODE.match(rule);
      return hit ? Number(hit[1]) : NaN;
    };
    const toastZ = zOf('#toastLayer'), screenZ = zOf('.screen');
    const subZ = Number((CODE.match(/#leaderboardScreen,#installScreen,#shareScreen,#teaScreen,#shopScreen\{z-index:(\d+)\}/) || [])[1]);
    assert(Number.isFinite(toastZ) && Number.isFinite(screenZ) && Number.isFinite(subZ),
      'toast 或菜单屏的 z-index 取不到，这道门等于没跑');
    assert(toastZ > screenZ && toastZ > subZ,
      'toast 层（' + toastZ + '）没盖过菜单屏（' + screenZ + ' / ' + subZ + '）：'
      + '首页收藏条里用 toast 回话的那几格会点了没反应');
  }

  // ③ 金光描边只在看得见的时候转。原来动画写在基础规则上，opacity:0 也照转——
  //    首页/结算/暂停页什么都不动却每秒触发几十次样式重算。
  // 取「行首那条 #goldAura 规则」——不锚行首的话，`#playerGroup.gold #goldAura{...}`
  // 也会被这个模式吃进去，负向断言当场变成永远为假的假门。
  // **这个仓库里「范围没圈住」已经栽了六次**，所以先取出那一条，再在那一条里问。
  {
    const baseRule = (CODE.match(/\n#goldAura\{[^}]*\}/) || [''])[0];
    assert(baseRule, '取不到 #goldAura 的基础规则，这道门等于没跑');
    assert(!/animation:aura/.test(baseRule),
      '金光描边的动画又写回了基础规则：它在 opacity:0 时照样转，静止的页面白烧 CPU');
  }
  assert(/#playerGroup\.gold #goldAura\{[^}]*animation:aura/.test(CODE),
    '金光描边不转了：动画得跟着 .gold 那条规则走，可见与开销才绑在一起');

  // ④ 每一个子屏都要能用 Esc / 返回键关掉。香蕉商店上线时漏了，
  //    它是十八件行头的入口，却是唯一一个键盘关不掉的屏。
  //    **两边都从源码现取**：子屏清单从 HTML 里数，名单从 activeMenuClose 里读。
  {
    const subScreens = [...html.matchAll(/id="([a-zA-Z]+Screen)" class="screen hidden"/g)].map(hit => hit[1])
      .filter(id => id !== 'resultScreen' && id !== 'pauseScreen');  // 这两个有自己的关法
    const body = (CODE.match(/function activeMenuClose\(\)\{[\s\S]*?\n\}/) || [''])[0];
    assert(subScreens.length >= 5 && body, '子屏清单或 activeMenuClose 取不到，这道门等于没跑');
    // el 映射里 shopScreen -> el.shop，所以按 el.<名> 反查：名字取 id 去掉 Screen 之后的词根。
    const elFor = { titlesScreen: 'titles', teaScreen: 'teas', shopScreen: 'shop',
      leaderboardScreen: 'leaderboard', installScreen: 'install', shareScreen: 'share' };
    for (const id of subScreens) {
      const key = elFor[id];
      assert(key, '新子屏 ' + id + ' 还没登记到这道门的对照表里，先补上再说');
      assert(body.includes('el.' + key + '.classList.contains'),
        id + ' 没登记进 activeMenuClose：这一屏用 Esc / 安卓返回键关不掉');
    }
  }

  // ⑤ 输入框字号不得小于 16px。iOS Safari 对小于 16px 的输入框会在聚焦时放大整页，
  //    而这是个 user-scalable=no 的单屏应用，放大之后缩不回来。
  {
    const inputs = [...CODE.matchAll(/\.([a-z-]*input)\{[^}]*font:\d+ (\d+)px/g)];
    assert(inputs.length >= 1, '找不到任何输入框的字号，这道门等于没跑');
    for (const [, name, size] of inputs) {
      assert(Number(size) >= 16,
        '.' + name + ' 的字号是 ' + size + 'px：iOS Safari 会在聚焦时放大整页，玩家缩不回来');
    }
  }

  // ⑥ 排版表注释里的数字是镜像，得跟计算值对上。floors 那一级曾经写着 232、实际 186，
  //    因为有人把 typeStep(12) 改成了 (11) 而没动注释。
  //    **不删注释**——它读起来有用；改成让它受检。
  {
    // **这一条必须查 html，不能查 CODE**：CODE 是剥过注释的，
    // 而这道门要查的正是注释本身——查 CODE 只会得到「取不到」。
    // （反过来，凡是查「代码里有没有写某句」的门都必须用 CODE，
    //   否则注释里提一嘴就能把门弄绿或弄红，0813 两个方向都栽过。）
    const base = Number((html.match(/const TYPE_BASE=(\d+)/) || [])[1]);
    const ratio = Number((html.match(/TYPE_RATIO=([\d.]+)/) || [])[1]);
    const rows = [...html.matchAll(/(\w+):typeStep\((-?\d+)\),\s*\/\/ (\d+)/g)];
    assert(base && ratio && rows.length >= 5, '排版表取不到，这道门等于没跑');
    for (const [, name, step, said] of rows) {
      const real = Math.round(base * Math.pow(ratio, Number(step)));
      assert(Number(said) === real,
        '排版表 ' + name + ' 的注释写着 ' + said + '，实际算出来是 ' + real + '（typeStep(' + step + ')）');
    }
  }

  // 多人模式的中文残余：模式 0813 拆了，玩家可见文案里却还留着「单猴挑战」——
  // 「单猴」只有在有多人对照时才有意义，单独出现就是没头没脑（0814 王老师抓到的）。
  // 查 CODE 不查 html：历史注释里允许引用旧文案（「当时叫单猴挑战」那条就是），
  // 拦的是**代码与玩家可见文案**里的回潮。
  assert(!/单猴|多人赛|同机公平|同机轮流/.test(CODE),
    '多人模式的中文残余又出现了（单猴/多人赛/同机…）：模式已拆除，这些以多人为参照的'
    + '说法在单人游戏里没头没脑。0814 校对清过一轮，别加回来');

  // ⑦ emoji 全局禁令：monkey 这条发布管线一直一条门都没有。
  //    禁的不只是彩色 emoji，还有「emoji 味」的装饰符——箭头、装饰星、带圈数字、几何块。
  //    例外：`->` 是明文批准的写法（ASCII，不在下面任何一段里）。
  {
    const BANNED = [[0x2190, 0x21FF, '箭头'], [0x2460, 0x24FF, '带圈数字'],
      [0x25A0, 0x25FF, '几何块'], [0x2600, 0x27BF, '杂项符号与装饰'],
      [0x2B00, 0x2BFF, '箭头与几何'], [0x1F300, 0x1FAFF, 'emoji'], [0xFE0F, 0xFE0F, '变体选择符']];
    const found = [];
    for (const ch of html) {
      const cp = ch.codePointAt(0);
      for (const [a, b, name] of BANNED) {
        if (cp >= a && cp <= b) { found.push(JSON.stringify(ch) + '（U+' + cp.toString(16).toUpperCase() + '，' + name + '）'); break; }
      }
    }
    assert(!found.length, 'emoji 全局禁令（0725 起）：发现 ' + [...new Set(found)].join('、')
      + '。装饰符也算——箭头写成 ->，自测输出写 [过]/[败]');
  }

  // ⑧ 结算页那枚印章不许再用写死的 px 定位。原来是 `top:93px`——
  //    那个 93 镜像的是「当时标题占多高」，和 0813 写死 844 屏高是同族错。
  //    实测五个视口全部被它压住正文，320 宽上盖掉了 1888 的最后一位。
  {
    const rule = (CODE.match(/\n\.result-stamp\{[^}]*\}/) || [''])[0];
    assert(rule, '取不到 .result-stamp 的规则，这道门等于没跑');
    assert(!/(^|;)(top|bottom):\s*-?\d+px/.test(rule),
      '结算印章又用写死的 px 定位了：标题改字号、屏一窄它就压到数字上，'
      + '位置得由布局给（现在它是 .result-score 里的 flex 子项）');
    // 数字是这一屏的主角，不许它让位——一让位就是「盒子缩小、字形溢出去压住印章」，
    // 而只量矩形的判据看不见那种压法。
    assert(/\.result-score>b\{flex:none\}/.test(CODE),
      '结算页那个数字又能被压缩了：它的盒子会缩、字形会溢出去压在印章底下，'
      + '而量矩形重叠的判据看不见这种压法（靠截图才发现的）');
  }

  // ⑨ 钱包按钮的主文案不许换行：320 宽上它曾经把「香」「蕉」都拆成两行。
  //    让步的是右边那句提示，不是主文案。
  assert(/\.wallet-main\{[^}]*white-space:nowrap/.test(CODE),
    '香蕉钱包的主文案又能换行了：320 宽上它会断成三四行，连「香蕉」两个字都拆开');
  assert(/\.wallet-main/.test(CODE) && /\.wallet-tail/.test(CODE)
    && /class="wallet-main"/.test(CODE) && /class="wallet-tail"/.test(CODE),
    '钱包按钮的主次两段没有同时接上：CSS 与写入点必须成对，少一边就是没生效');

  // ---- 香蕉经济：这几条守的是**曲线的形状**，不是具体数字 ----
  // 具体定价会随实测收入调，写死一个价钱在门禁里就又是一份会过期的镜像。

  // ⑩ 沿途香蕉密度不许随高度衰减。原来是 clamp(.18-meters/30000,.1,.18)——
  //    18% 一路掉到 10%，也就是玩得越好每米赚得越少，把「变强」和「变富」拧成了反向关系。
  {
    // 取「生成香蕉那一整句」，不去猜条件里长什么样——猜出来的模式一改写法就取不到，
    // 而取不到时这道门只会说「等于没跑」，不会替你把关。
    const spawn = (CODE.match(/^.*addItem\('banana',primary\).*$/m) || [''])[0];
    assert(spawn, '找不到香蕉的生成点，这道门等于没跑');
    assert(!/meters/.test(spawn),
      '香蕉密度又跟高度挂上钩了：玩得越好每米赚得越少，是跑者类里最不该出现的曲线。'
      + '控制长局收入要用结算时那道超线性的高度奖金，不是让沿途密度掉下去');
  }

  // ⑪ 高度奖金必须是**超线性**的：走远要按超过比例地划算，否则没人有理由冒险。
  {
    const power = Number((CODE.match(/HEIGHT_BONUS_POWER=([\d.]+)/) || [])[1]);
    const base = Number((CODE.match(/HEIGHT_BONUS_BASE=([\d.]+)/) || [])[1]);
    assert(Number.isFinite(power) && Number.isFinite(base), '取不到高度奖金的参数，这道门等于没跑');
    assert(power > 1, '高度奖金的指数是 ' + power + '（不超过 1）：'
      + '那就成了「多跑一倍只多赚一倍」，玩家没有理由为了钱去冒摔死的风险');
    assert(base > 0, '高度奖金的系数是 0，等于这道奖金不存在');
    // 奖金必须真的发出去，而且要在**记录成绩之前**发——否则结算页、海报、楼榜
    // 各读各的香蕉数，又是一份对不上的镜像。
    const fin = (CODE.match(/function finishRun\([\s\S]*?\n\}/) || [''])[0];
    const bonusAt = fin.indexOf('heightBananas(');
    const recordAt = fin.indexOf('saved.score=Math.max');
    assert(bonusAt >= 0, '高度奖金没在 finishRun 里发出去：函数写了但没人调用');
    assert(recordAt >= 0 && bonusAt < recordAt,
      '高度奖金发得比记录成绩晚：结算页与本机纪录会差出这一笔');
    assert(/state\.bananas\+=state\.heightBonus;state\.score=/.test(fin),
      '加完奖金没有重算总分：总分的定义是 高度 + 香蕉 + 加成，少算一笔就对不上了');
  }

  // ⑫ 价钱阶梯的**形状**：每一档要比上一档贵，但别贵过头。
  //    2 到 4 倍是这类游戏的常见档位——低于 2 倍分不出档次，高于 4 倍会出现
  //    「攒了很久还差一大截」的断层，玩家在断层前就放弃了。
  {
    const tiers = [...CODE.matchAll(/(\d+):(\d+)/g)];
    const priceBlock = (CODE.match(/const TIER_PRICE=\{[^}]*\}/) || [''])[0];
    const prices = [...priceBlock.matchAll(/\d+:(\d+)/g)].map(hit => Number(hit[1]));
    assert(prices.length >= 5, '取不到定价阶梯，这道门等于没跑');
    for (let i = 1; i < prices.length; i += 1) {
      const ratio = prices[i] / prices[i - 1];
      assert(ratio >= 2 && ratio <= 4,
        '第 ' + (i + 1) + ' 档是第 ' + i + ' 档的 ' + ratio.toFixed(2) + ' 倍，'
        + '落在 2 到 4 倍之外：低于 2 倍分不出档次，高于 4 倍会出现攒不到的断层');
    }
  }

  // 局内捡到的红鲤鱼帽压过买来的帽子（同一个头顶，两顶帽子会糊在一起）。
  assert(/#gameShell\.carp-hat-on \.wear-head\{display:none\}/.test(CODE),
    '买来的帽子会和局内的红鲤鱼帽叠在一起。注意状态类名与资源类名必须分开——0813 撞过一次，整个画面消失');

  // 货币来自已经拿到手的成绩，不是新资源；花掉也不回溯改分。
  assert(/career\.bananas\+=state\.bananas/.test(CODE), '这一局的香蕉没有存进长期账户，商店就没有收入来源');
  assert(!/state\.bananas\s*-=/.test(CODE), '花的是局内香蕉而不是长期账户：那会把已经算过的分数改掉，历史成绩必须不可变');
}

// ---- 世界楼榜的补交重试门 0814 随功能一起拆除 ----
// 原来这里有十几条断言守着退避重试器（递增、上限、节流、回前台立即重试……）。
// 功能整体拆除后它们守的机器不存在了，留着只会红得毫无意义。
// 那套「按失败种类退避」的思路搬去了 deploy/monkey/verify-online-monkey.mjs（发布验收）。

// ---- 香蕉商店的入口必须找得到（2026-08-14 王老师：那个商店没找到）----
{
  // 原来唯一的入口是收藏条上一枚 22 像素的图标。**一个新系统的门必须比它的图标大。**
  assert(/id="walletButton"/.test(CODE) && /class="wallet"/.test(CODE),
    '首页的香蕉钱包没了：它既是商店的门，也是首页唯一显示香蕉余额的地方');
  assert(/id="resultShopButton"/.test(CODE), '结算页的商店入口没了：刚捡完香蕉那一刻购买冲动最高');
  const wired = (CODE.match(/\bopenShop\b/g) || []).length;
  assert(wired >= 4, '商店的入口少于三处（收藏条 / 首页钱包 / 结算页），openShop 只被引用了 ' + (wired - 1) + ' 次');
  // 首页那张卡要长到与屏幕等高，否则大屏上是一张浮在空白纸上的小卡片。
  assert(/#titleScreen \.card\{height:100%/.test(CODE),
    '首页卡不再撑满屏幕了。王老师 0814 明说「首页不是全屏，感觉像是少了什么」——'
    + '量出来是 430x932 上卡片只有 635 高，上下各空 149px');
}

// ---- 0814 收官自审抓到的五条（每条都亲手复现过）----
{
  // 1. 结算页那颗「余额 N 根」与首页钱包显示的是同一个事实，必须走同一条刷新链。
  //    第一版把它写在 finishRun 里，于是在商店花完钱回到结算页，它还写着花之前的数
  //    （实测 134 -> 花 18 -> 仍显示 134）。同一个事实两处显示、一处不在刷新链上，就是会漂的镜像。
  assert(/function renderResultWallet\(/.test(CODE), '结算页余额没有独立的渲染函数，又要变成写死在 finishRun 里的镜像了');
  const careerFn = (CODE.match(/function renderCareer\(\)\{[\s\S]*?\n\}/) || [''])[0];
  assert(/renderResultWallet\(\)/.test(careerFn),
    '结算页余额没接进 renderCareer 那条刷新链：在商店花完钱回到结算页会看到花之前的数');
  // 不变量是**窄的**：结算页那颗按钮只能有一个写入点，且它在刷新链上。
  // 商店说明与购买提示也显示余额，但那两处是现算的，不在问题范围里——
  // 第一版把「余额」出现的次数全数了，拦到了无辜的东西（断言比它想守的东西更宽）。
  const resultWrites = (CODE.match(/el\.resultShop\.innerHTML\s*=/g) || []).length;
  assert(resultWrites === 1,
    '结算页那颗按钮有 ' + resultWrites + ' 个写入点。只能有一个，而且必须在 renderCareer 的刷新链上，'
    + '否则在商店花完钱回到结算页会看到花之前的数');

  // 2. 红鲤鱼帽是局内状态，一局结束必须摘。不摘的话 .wear-head{display:none} 会一直生效，
  //    玩家在首页看到一只光头猴（买的帽子被藏了，而首页没有红鲤鱼帽节点）。
  const finishFn = (CODE.match(/function finishRun\([\s\S]*?\n\}/) || [''])[0];
  assert(finishFn, '取不到 finishRun（写法变了？先修本门禁的取法）');
  assert(/classList\.remove\('carp-hat-on'\)/.test(finishFn),
    '一局结束没摘红鲤鱼帽：.wear-head{display:none} 会一直生效，玩家买的帽子在首页被藏掉');

  // 3. 已购清单不许用 SHOP_BY_ID[id] 判定——原型链上的键会被当成已购（实测塞三个就显示 3/18）。
  assert(!/raw\.owned\.filter\(id=>SHOP_BY_ID\[id\]\)/.test(CODE),
    'owned 用 SHOP_BY_ID[id] 判定，constructor / toString 这类原型链上的键会被当成已购行头');

  // 4. 戴着的必须是解锁过的。原来 worn / cup 只查 id 在不在表里，
  //    手改存档就能戴一枚没打出来的称号并印上海报——和同一行里 wearing 走 safeWearing 的规矩不一致。
  assert(/worn:okTitles\.includes\(raw\.worn\)/.test(CODE) && /cup:okTeas\.includes\(raw\.cup\)/.test(CODE),
    'worn / cup 只校验 id 存在、不校验解锁：没打出来的称号能戴上，还会印进成绩海报');

  // 5. 自检期间不许写盘。?posterqa=1 原来往真档案注入一枚没赚到的称号且从不还原；
  //    runQA 本身也会沿途把「发现的立面」推进 career。自检是诊断，任何一步都不该写盘。
  assert(/function saveCareer\(\)\{if\(careerWriteLocked\)return;/.test(CODE),
    'saveCareer 上没有自检总闸：跑一次 ?qa=1 就会把自检造出来的收集品写进玩家档案');
  assert(/function runQA\(\)\{return withCareerSandbox\(/.test(CODE), 'runQA 没有裹进存档沙箱');
  assert(/function runStressQA\([\s\S]{0,60}withCareerSandbox\(/.test(CODE), '压力测试没有裹进存档沙箱');
  assert(/function runPosterQA\(\)\{[\s\S]{0,200}careerWriteLocked=true;/.test(CODE),
    '海报自检没上锁：它注入一枚「名字最长的称号」试排版，玩家随手买件东西就永久落盘了');
}

// ---- 排版学：海报的字号只准从模块化比例上取（2026-08-14）----
{
  const posterFn = (CODE.match(/async function buildPoster\(\)\{[\s\S]*?\n\}/) || [''])[0];
  assert(posterFn, '取不到 buildPoster（写法变了？先修本门禁的取法）');
  // 海报上一个字面量字号都不许有。原来是十四处（30/46/44/70/28/26/162/35/42/20/25/31/23/19/17），
  // 看着「差不多有层次」，实际相邻级差忽多忽少，眼睛读不出稳定的秩序。
  // 现在全部走 TYPE，谁塞一个 33px 进去，这条当场红。
  const literals = [...posterFn.matchAll(/font\s*=\s*[`'"][^`'"]*?\b(\d+)px/g)].map(hit => hit[1]);
  assert(literals.length === 0,
    '海报里又出现了写死的字号：' + literals.join('、') + '。字号必须从 TYPE 取——'
    + '整版只用一条等比数列，层级关系才固定得下来');
  assert((posterFn.match(/\$\{TYPE\.[a-z]+\}px/g) || []).length >= 12,
    '海报用到 TYPE 的地方太少，多半是有一批字号绕过了比例');

  const typeBlock = (CODE.match(/const TYPE=\{[\s\S]*?\n\};/) || [''])[0];
  assert(typeBlock, '取不到 TYPE（写法变了？先修本门禁的取法）');
  // TYPE 里的每一级都得是 typeStep() 算出来的，不许直接写数字。
  // **不许靠缩进宽度取键名。** 原来 entries 匹的是「行首恰好两个空格」，
  // 于是新加一行写死字号时多敲一个空格就绕过去了（实测三个空格构建绿、两个空格才红）。
  // 一道拦不拦得住取决于敲了几个空格的门，等于没门。
  const steps = [...typeBlock.matchAll(/:\s*typeStep\(-?\d+\)/g)];
  const entries = [...typeBlock.matchAll(/[{,]\s*([a-z][a-zA-Z0-9]*)\s*:/g)];
  assert(steps.length === entries.length,
    'TYPE 里有直接写死的字号（' + entries.length + ' 级里只有 ' + steps.length + ' 级走了 typeStep）');
  assert(/const TYPE_BASE=\d+,TYPE_RATIO=[\d.]+;/.test(CODE), '模块化比例的基准与比率没了');

  // 六种纸型各带一条排版学，和立面/调式/配色一个规格：讲原理，不讲名词。
  const factBlock = (CODE.match(/const TYPE_FACTS=\{[\s\S]*?\n\};/) || [''])[0];
  const factIds = [...factBlock.matchAll(/^\s{2}([a-z]+):/gm)].map(hit => hit[1]);
  const variantBlock = (CODE.match(/const POSTER_VARIANTS=\[[\s\S]*?\n\];/) || [''])[0];
  const variantIds = [...variantBlock.matchAll(/\{id:'([a-z]+)',upto:/g)].map(hit => hit[1]);
  assert(variantIds.length >= 6, '取不到海报纸型清单（写法变了？先修本门禁的取法）');
  for (const id of variantIds) {
    assert(factIds.includes(id), '纸型 ' + id + ' 没有对应的排版学，那它就只是个配色，不是一门学问');
  }
  assert(/career\.posters/.test(CODE), '纸型没进长期档案：知识只在第一次遇见时讲一遍，收藏条得留得住它');
}

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
