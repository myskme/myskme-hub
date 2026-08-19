import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const matchRoot = path.join(repoRoot, 'match');
const output = path.resolve(process.argv[2]
  || path.join(tmpdir(), `gemfall-edgeone-${Date.now()}.zip`));
const runtimeEntries = [
  'index.html',
  'manifest.json',
  'network-config.js',
  'sw.js',
  'edgeone.json',
  'art',
  'audio',
  'icons',
  'vendor',
  'edge-functions',
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
      new Error(`${command} 退出码 ${code}${stderr ? `：${stderr.trim()}` : ''}`),
    ));
  });
}

if (await exists(output)) throw new Error(`输出文件已存在，拒绝覆盖：${output}`);
await mkdir(path.dirname(output), { recursive: true });
const staging = await mkdtemp(path.join(tmpdir(), 'gemfall-edgeone-stage-'));

try {
  for (const entry of runtimeEntries) {
    const source = path.join(matchRoot, entry);
    if (!(await exists(source))) throw new Error(`缺少 EdgeOne 运行资源：match/${entry}`);
    await cp(source, path.join(staging, entry), { recursive: true });
  }

  const files = (await filesUnder(staging)).sort();
  const requiredFunctions = [
    path.join('edge-functions', 'api', '[[default]].js'),
    path.join('edge-functions', 'api', 'index.js'),
  ];
  for (const required of requiredFunctions) {
    if (!files.includes(required)) throw new Error(`发布包缺少函数：${required}`);
  }

  /* index.html 引用的本地脚本必须都在包里。
     vendor/qrcode-generator.js 曾因不在白名单而漏发——线上分享卡从 0812 起
     一直画不出二维码，页面却不报任何错（drawShareQr 静默回落）。
     这类「页面要、包里没有」的缺口从此在打包时就拦下。 */
  const html = await readFile(path.join(staging, 'index.html'), 'utf8');
  for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
    const src = m[1];
    if (/^(https?:)?\/\//.test(src) || src.startsWith('data:')) continue;
    const rel = src.replace(/^\.\//, '').split('?')[0];
    if (!files.includes(path.join(...rel.split('/')))) {
      throw new Error(`index.html 引用了 ${src}，但发布包里没有它——检查 runtimeEntries 白名单`);
    }
  }

  let sourceBytes = 0;
  for (const file of files) sourceBytes += (await stat(path.join(staging, file))).size;
  await run('zip', ['-qry', output, '.'], { cwd: staging });
  const archive = await readFile(output);
  const sha256 = createHash('sha256').update(archive).digest('hex');
  console.log(`EdgeOne 发布包：${output}`);
  console.log(`运行文件：${files.length}；源文件合计：${sourceBytes} B；ZIP：${archive.byteLength} B`);
  console.log(`SHA-256：${sha256}`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
