import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkParity } from '../gateway/check-parity.mjs';

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
  'classroom/index.html',
  'banks',
  'daily',
  'listen',
  'write',
  'wall',
  'print',
  'vote',
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

  // 品牌 API 网关：正本在 deploy/gateway/api/（中立位置，不属于任何一个作品）。
  // match/edge-functions/api/ 是《灵石远征》发布包用的副本，两份必须逐字节一致——
  // 分叉会让两个域名上的网关行为不一样，是最难查的一类故障，所以这里先校验、再打包。
  await checkParity();
  const gatewaySource = path.join(repoRoot, 'deploy', 'gateway', 'api');
  if (!(await exists(gatewaySource))) throw new Error('缺少品牌 API 网关正本：deploy/gateway/api');
  await cp(gatewaySource, path.join(staging, 'edge-functions', 'api'), { recursive: true });

  // 主页专有的边缘函数（目前只有题库短链 /q/<兑换码>）。与网关分开放：
  // 网关那份要与《灵石远征》的副本保持一致，这些则只属于 myskme.com。
  const homepageFunctions = path.join(here, 'edge-functions');
  if (await exists(homepageFunctions)) {
    for (const entry of await readdir(homepageFunctions)) {
      await cp(path.join(homepageFunctions, entry),
        path.join(staging, 'edge-functions', entry), { recursive: true });
    }
  }

  const files = (await filesUnder(staging)).sort();
  const required = [
    'index.html', 'manifest.webmanifest', 'og-cover.png', 'robots.txt', 'sitemap.xml',
    path.join('icons', 'app-icon-512.png'),
    path.join('icons', 'apple-touch-icon.png'),
    path.join('assets', 'hero-wolf.webp'),
    path.join('classroom', 'index.html'),
    path.join('banks', 'index.html'),
    path.join('vote', 'index.html'),
    path.join('vote', 'polls.json'),
    path.join('edge-functions', 'api', 'index.js'),
    path.join('edge-functions', 'api', '[[default]].js'),
    path.join('edge-functions', 'q', '[[default]].js'),
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
