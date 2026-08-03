import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const output = path.resolve(process.argv[2]
  || path.join(tmpdir(), 'myskme-homepage-' + Date.now() + '.zip'));
const runtimeEntries = [
  'index.html',
  'manifest.webmanifest',
  'og-cover.png',
  'robots.txt',
  'sitemap.xml',
  'icons',
  'assets',
  'banks',
  'daily',
  'listen',
  'write',
  'wall',
  'print',
];

async function exists(target) {
  try { await access(target); return true; } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function filesUnder(root, relative = '') {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const next = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(root, next));
    else if (entry.isFile()) files.push(next);
  }
  return files;
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

if (await exists(output)) throw new Error('输出文件已存在，拒绝覆盖：' + output);
await mkdir(path.dirname(output), { recursive: true });
const staging = await mkdtemp(path.join(tmpdir(), 'myskme-homepage-stage-'));

try {
  for (const entry of runtimeEntries) {
    const source = path.join(repoRoot, entry);
    if (!(await exists(source))) throw new Error('缺少主页运行资源：' + entry);
    await cp(source, path.join(staging, entry), { recursive: true });
  }
  await cp(path.join(here, 'edgeone.json'), path.join(staging, 'edgeone.json'));

  // 品牌 API 网关：直接取《灵石远征》那一份源码，仓库里始终只有一份，
  // 两个站点不可能出现路由表不一致。过渡期 play.myskme.com 与 myskme.com
  // 各自部署一份完全相同的网关；待六个作品全部切到 myskme.com/api/* 之后，
  // 再把这份源码移出 match/ 并下线 play 侧的旧入口。
  const gatewaySource = path.join(repoRoot, 'match', 'edge-functions');
  if (!(await exists(gatewaySource))) throw new Error('缺少品牌 API 网关源码：match/edge-functions');
  await cp(gatewaySource, path.join(staging, 'edge-functions'), { recursive: true });

  const files = (await filesUnder(staging)).sort();
  const required = [
    'index.html', 'manifest.webmanifest', 'og-cover.png', 'robots.txt', 'sitemap.xml',
    path.join('icons', 'app-icon-512.png'),
    path.join('icons', 'apple-touch-icon.png'),
    path.join('assets', 'hero-wolf.webp'),
    path.join('banks', 'index.html'),
    path.join('edge-functions', 'api', 'index.js'),
    path.join('edge-functions', 'api', '[[default]].js'),
  ];
  for (const file of required) {
    if (!files.includes(file)) throw new Error('发布包缺少关键资源：' + file);
  }

  let sourceBytes = 0;
  for (const file of files) sourceBytes += (await stat(path.join(staging, file))).size;
  await run('zip', ['-qry', output, '.'], { cwd: staging });
  const archive = await readFile(output);
  const sha256 = createHash('sha256').update(archive).digest('hex');
  console.log('MYSKME 主页 EdgeOne 发布包：' + output);
  console.log('运行文件：' + files.length + '；源文件合计：' + sourceBytes + ' B；ZIP：' + archive.byteLength + ' B');
  console.log('SHA-256：' + sha256);
} finally {
  await rm(staging, { recursive: true, force: true });
}
