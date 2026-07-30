import { createHash } from 'node:crypto';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const catalogPath = path.resolve(here, '../shared/resource-catalog.json');
const wechatRoot = path.resolve(here, '../wechat-minigame');
const failures = [];

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function fail(message) {
  failures.push(message);
  console.error(`FAIL ${message}`);
}

const required = [
  'match/ports/ios-capacitor/package.json',
  'match/ports/ios-capacitor/capacitor.config.ts',
  'match/ports/ios-capacitor/scripts/sync-web.mjs',
  'match/ports/wechat-minigame/game.js',
  'match/ports/wechat-minigame/game.json',
  'match/ports/wechat-minigame/project.config.json',
];

for (const relative of required) {
  if (!(await exists(path.join(repoRoot, relative)))) fail(`缺文件：${relative}`);
}

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
for (const asset of catalog.assets) {
  const absolute = path.join(repoRoot, asset.path);
  if (!(await exists(absolute))) {
    fail(`源资源不存在：${asset.path}`);
    continue;
  }
  const digest = createHash('sha256').update(await readFile(absolute)).digest('hex');
  if (digest !== asset.sha256) fail(`源资源哈希变化：${asset.path}`);
}

const sourceArt = (await readdir(path.join(repoRoot, 'match/art')))
  .filter((name) => name.endsWith('.webp')).sort();
const wechatArtDir = path.join(wechatRoot, 'assets/art');
const copiedArt = (await exists(wechatArtDir))
  ? (await readdir(wechatArtDir)).filter((name) => name.endsWith('.webp')).sort()
  : [];

if (sourceArt.join('\n') !== copiedArt.join('\n')) {
  fail(`微信美术副本不完整：源 ${sourceArt.length}，副本 ${copiedArt.length}`);
}

for (const name of sourceArt) {
  const a = await readFile(path.join(repoRoot, 'match/art', name));
  const bPath = path.join(wechatArtDir, name);
  if (!(await exists(bPath))) continue;
  const b = await readFile(bPath);
  if (!a.equals(b)) fail(`微信美术副本不一致：${name}`);
}

async function sizeOfTree(root) {
  let total = 0;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const target = path.join(root, entry.name);
    total += entry.isDirectory() ? await sizeOfTree(target) : (await stat(target)).size;
  }
  return total;
}

const wechatBytes = await sizeOfTree(wechatRoot);
const conservativeMainPackageBudget = 4 * 1024 * 1024;
if (wechatBytes >= conservativeMainPackageBudget) {
  fail(`微信目录 ${wechatBytes} B 已超过保守 4 MiB 主包预算`);
}

if (failures.length) {
  console.error(`\n${failures.length} 项失败`);
  process.exitCode = 1;
} else {
  console.log(`PASS 资源 ${catalog.assets.length} 项；微信美术 ${sourceArt.length} 张；目录 ${wechatBytes} B`);
}
