import fs from 'node:fs';

/* 从 Worker 正本现抽段位表与公共映射函数，避免测试维护第二份逻辑。 */
function slice(src, head, open, close) {
  const match = src.match(head);
  if (!match) throw new Error('抽不到：' + head);
  const start = src.indexOf(match[0]);
  let depth = 0;
  let cursor = src.indexOf(open, start);
  for (;; cursor++) {
    if (src[cursor] === open) depth++;
    else if (src[cursor] === close && --depth === 0) break;
  }
  return src.slice(start, cursor + 1);
}

const fnOf = (src, name) => slice(src, new RegExp('function ' + name + '\\s*\\('), '{', '}');
const src = fs.readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
const body = [
  slice(src, /const RANKS\s*=\s*\[/, '[', ']') + ';',
  slice(src, /const GF_RANKS\s*=\s*\[/, '[', ']') + ';',
  fnOf(src, 'rankFor'), fnOf(src, 'gfRankFor'), fnOf(src, 'mapRows'), fnOf(src, 'gfMap'),
  'return { mapRows, gfMap };',
].join('\n');
const { mapRows, gfMap } = new Function(body)();

const legacy = mapRows([{ id: 'legacy', power: 30000, base_power: 0,
  rank_name: '☠狼徒·封号弟子', badges: '' }])[0];
const gemfall = gfMap([{ id: 'gemfall', power: 112903,
  rank_name: '☠执灯人·封号矿主', badges: '' }])[0];

const failures = [];
if (src.includes('☠')) failures.push('Worker 正本仍含骷髅字符');
if (legacy.rankName !== '狼徒·封号弟子') failures.push('旧词灵榜存量称号未按当前段位表覆盖');
if (gemfall.rankName !== '执灯人·封号矿主') failures.push('旧灵石榜存量称号未按当前段位表覆盖');

if (failures.length) {
  for (const failure of failures) console.error('FAIL ' + failure);
  process.exit(1);
}
console.log('PASS 榜单公共响应不回流历史 emoji');
