import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, cp, mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
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
assert(html.includes("const PARTY_KEY='myskme_monkey_party_v1'"), '2–6 人比赛保存缺失');
assert(html.includes('function partyRoundSeed('), '多人同轮公平种子缺失');
assert(html.includes('function finishPartyTurn('), '多人轮转结算缺失');
assert(html.includes('<link rel="manifest" href="./manifest.webmanifest">'), 'PWA 清单入口缺失');
assert(html.includes('<script src="./vendor/qrcode-generator.js"></script>'), '本地二维码模块入口缺失');
assert(!/<script\s+[^>]*src=["']https?:/i.test(html), '游戏包含外部脚本');
assert(!/<link\s+[^>]*rel=["']stylesheet/i.test(html), '游戏包含外部样式');
assert(!/\b(fetch|XMLHttpRequest|WebSocket)\s*\(/.test(html), '游戏包含网络请求');
assert(!html.includes('l1fr2z'), '仍含随机旧路径');
assert(!html.includes('myskme.com/fun/monkey'), '仍含已废弃的目录地址');
assert(manifest.name === '是猴就上100层' && manifest.icons?.length >= 3, 'PWA 清单或图标声明不完整');
for (const icon of manifest.icons) await access(path.join(projectRoot, icon.src.replace(/^\.\//, '')));
assert(html.includes('function buildPoster()') && html.includes('function syncViewportMode()'), '海报或安卓宽视口修复缺失');
assert(html.includes('const SURPRISES=[') && html.includes('MUSIC_TICK_MS=70'), '惊喜池或省电音频调度缺失');
await access(path.join(projectRoot, 'vendor/qrcode-generator.js'));
const swSource = await readFile(path.join(projectRoot, 'sw.js'), 'utf8');
// Service Worker 安装必须绕开浏览器 HTTP 缓存，否则「版本升了、资源还是旧的」。
// 0812 血泪：鱼小姐改青绿后成绩海报里仍是金鱼——海报画的是 app 图标 PNG，
// 而 cache.addAll 走 HTTP 缓存，把 EdgeOne 上长缓存的旧图装进了新版 SW 缓存。
assert(/cache:\s*'reload'/.test(swSource), "sw.js 安装没用 cache:'reload'，新版缓存会被旧的 HTTP 缓存污染（0812 海报金鱼就是这么来的）");
const SW_CACHE = (swSource.match(/const CACHE='([^']+)'/) || [])[1];
assert(SW_CACHE, '取不到 sw.js 的缓存版本名（const CACHE 的写法变了？）');

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
