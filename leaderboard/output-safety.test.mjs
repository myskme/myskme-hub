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
  fnOf(src, 'monthKeyOf'), fnOf(src, 'gfRenameMonth'), fnOf(src, 'gfRenamePolicy'), fnOf(src, 'gfBadges'),
  fnOf(src, 'rankFor'), fnOf(src, 'gfRankFor'), fnOf(src, 'mapRows'), fnOf(src, 'gfMap'),
  'return { mapRows, gfMap, gfBadges, gfRenamePolicy };',
].join('\n');
const { mapRows, gfMap, gfBadges, gfRenamePolicy } = new Function(body)();

const legacy = mapRows([{ id: 'legacy', power: 30000, base_power: 0,
  rank_name: '☠狼徒·封号弟子', badges: '' }])[0];
const gemfall = gfMap([{ id: 'gemfall', power: 112903,
  rank_name: '☠执灯人·封号矿主', badges: 'g11' }])[0];
const augEnd = Date.UTC(2026, 7, 31, 15, 59);
const sepStart = Date.UTC(2026, 7, 31, 16, 0);
const firstName = gfRenamePolicy('', '新名字', '', augEnd);
const unchanged = gfRenamePolicy('旧名字', '旧名字', '202608', augEnd);
const secondChange = gfRenamePolicy('旧名字', '新名字', '202608', augEnd);
const nextMonth = gfRenamePolicy('旧名字', '新名字', '202608', sepStart);

const failures = [];
if (src.includes('☠')) failures.push('Worker 正本仍含骷髅字符');
if (legacy.rankName !== '狼徒·封号弟子') failures.push('旧词灵榜存量称号未按当前段位表覆盖');
if (gemfall.rankName !== '执灯人·封号矿主') failures.push('旧灵石榜存量称号未按当前段位表覆盖');
if (!gemfall.badges.includes('g11')) failures.push('虹彩资格没有进入公共榜单响应');
if (!gfBadges({ mastery: 6 }).includes('g11') || gfBadges({ mastery: 5 }).includes('g11'))
  failures.push('虹彩资格不是严格的六人全曜衔');
if (!firstName.allowed || !firstName.changed || firstName.month !== '202608')
  failures.push('首次起名没有正确占用北京时间自然月机会');
if (!unchanged.allowed || unchanged.changed) failures.push('未改名的普通成绩提交被误拦');
if (secondChange.allowed) failures.push('同一自然月允许了第二次定名');
if (!nextMonth.allowed || nextMonth.month !== '202609') failures.push('北京时间下月没有重置更名机会');
if (!src.includes('CREATE TABLE IF NOT EXISTS gemfall_alias_month')) failures.push('服务端缺少更名月份持久化表');

if (failures.length) {
  for (const failure of failures) console.error('FAIL ' + failure);
  process.exit(1);
}
console.log('PASS 榜单公共响应不回流历史 emoji');
console.log('PASS 虹彩矿名与自然月更名策略');
