import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const wechatRoot = path.resolve(here, '..');
const repoRoot = path.resolve(here, '../../../..');
const sourceArt = path.join(repoRoot, 'match/art');
const targetArt = path.join(wechatRoot, 'assets/art');

await rm(targetArt, { recursive: true, force: true });
await mkdir(path.dirname(targetArt), { recursive: true });
await cp(sourceArt, targetArt, { recursive: true });

async function treeBytes(root) {
  let bytes = 0;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    const target = path.join(root, entry.name);
    bytes += entry.isDirectory() ? await treeBytes(target) : (await stat(target)).size;
  }
  return bytes;
}

const artCount = (await readdir(targetArt)).filter((name) => name.endsWith('.webp')).length;
const packageBytes = await treeBytes(wechatRoot);
const budget = 4 * 1024 * 1024;

console.log(`Synced ${artCount} WebP files to ${path.relative(repoRoot, targetArt)}`);
console.log(`Wechat directory: ${packageBytes} B / conservative ${budget} B budget`);

if (packageBytes >= budget) {
  console.error('Package budget exceeded. Move optional art/audio to subpackages before import.');
  process.exitCode = 1;
}
