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
