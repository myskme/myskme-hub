// 品牌 API 网关：确认「正本」与《灵石远征》里那份副本逐字节一致。
//
// 为什么需要两份：myskme.com 与 play.myskme.com 是两个独立的 EdgeOne 项目，
// 各自的发布包里都得**物理带着**一份边缘函数，没法共享一个目录。
// 正本放在 deploy/gateway/（中立位置，不属于任何一个作品），
// match/edge-functions/ 是《灵石远征》发布包用的副本。
//
// 两份一旦不一致，两个域名上的网关行为就会分叉——这是最难查的一类故障，
// 所以主页构建会先跑这个检查，不一致直接构建失败。

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
export const CANONICAL = path.join(repoRoot, 'deploy/gateway/api');
export const MIRROR = path.join(repoRoot, 'match/edge-functions/api');

async function filesUnder(root, relative = '') {
  const entries = await readdir(path.join(root, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const next = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(root, next));
    else if (entry.isFile()) files.push(next);
  }
  return files.sort();
}

async function digest(root, relative) {
  return createHash('sha256').update(await readFile(path.join(root, relative))).digest('hex');
}

export async function checkParity() {
  const [canonical, mirror] = await Promise.all([filesUnder(CANONICAL), filesUnder(MIRROR)]);
  const problems = [];

  for (const file of canonical) if (!mirror.includes(file)) problems.push(`副本缺少 ${file}`);
  for (const file of mirror) if (!canonical.includes(file)) problems.push(`副本多出 ${file}`);

  for (const file of canonical.filter(f => mirror.includes(f))) {
    const [a, b] = await Promise.all([digest(CANONICAL, file), digest(MIRROR, file)]);
    if (a !== b) problems.push(`${file} 内容不一致（正本 ${a.slice(0, 12)}…／副本 ${b.slice(0, 12)}…）`);
  }

  if (problems.length) {
    throw new Error(
      '品牌 API 网关的两份源码已经分叉，两个域名上的行为会不一样：\n'
      + problems.map(p => '  · ' + p).join('\n')
      + '\n\n正本是 deploy/gateway/api/。确认正本无误后，用这条命令把副本同步回去：\n'
      + '  rm -rf match/edge-functions/api && cp -R deploy/gateway/api match/edge-functions/api\n'
      + '（若改动本来就该发生在《灵石远征》那侧，请先把它挪进正本，再同步。）',
    );
  }

  return canonical.length;
}

// 直接执行时当作独立校验器用；被 import 时只导出函数。
if (import.meta.url === `file://${process.argv[1]}`) {
  const count = await checkParity();
  console.log(`PASS 品牌 API 网关正本与副本一致（${count} 个文件）`);
}
