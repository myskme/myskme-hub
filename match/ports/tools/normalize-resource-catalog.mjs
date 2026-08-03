#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * build-resource-catalog.mjs 每次都会刷新 generatedAt。CI 若直接 git diff，
 * 即使素材一个字节没变也会失败。这里仅把该非内容字段恢复为 HEAD 的值；
 * 文件清单、大小、哈希、尺寸、分类与平台只要有任何变化，后续精确
 * `git diff --exit-code match/ports/shared/resource-catalog.json` 仍会报错。
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const relativePath = 'match/ports/shared/resource-catalog.json';
const catalogPath = resolve(repoRoot, relativePath);

const generated = JSON.parse(await readFile(catalogPath, 'utf8'));
const committed = JSON.parse(execFileSync('git', ['show', `HEAD:${relativePath}`], {
  cwd: repoRoot,
  encoding: 'utf8',
}));

if (typeof committed.generatedAt !== 'string' || !committed.generatedAt) {
  throw new Error(`HEAD 中的 ${relativePath} 缺少 generatedAt`);
}

generated.generatedAt = committed.generatedAt;
await writeFile(catalogPath, `${JSON.stringify(generated, null, 2)}\n`);
console.log(`Preserved generatedAt from HEAD: ${committed.generatedAt}`);
