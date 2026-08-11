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
const clientSrc = fs.readFileSync(new URL('../match/index.html', import.meta.url), 'utf8');
const body = [
  src.match(/const GF_RECORD_CAP[^\n]*/)[0],
  slice(src, /const GF_CAP\s*=\s*\{/, '{', '}') + ';',
  slice(src, /const GF_RUSH_REWARDS\s*=\s*\[/, '[', ']') + ';',
  slice(src, /const RANKS\s*=\s*\[/, '[', ']') + ';',
  slice(src, /const GF_RANKS\s*=\s*\[/, '[', ']') + ';',
  fnOf(src, 'clampInt'), fnOf(src, 'gfCleanStats'), fnOf(src, 'gfRushReward'),
  fnOf(src, 'gfRushWeekKey'), fnOf(src, 'gfRushWeekLabel'),
  fnOf(src, 'monthKeyOf'), fnOf(src, 'gfRenameMonth'), fnOf(src, 'gfRenamePolicy'), fnOf(src, 'gfBadges'),
  fnOf(src, 'rankFor'), fnOf(src, 'gfRankFor'), fnOf(src, 'mapRows'), fnOf(src, 'gfMap'),
  'return { mapRows, gfMap, gfBadges, gfRenamePolicy, gfCleanStats, gfRushReward, gfRushWeekKey, gfRushWeekLabel };',
].join('\n');
const { mapRows, gfMap, gfBadges, gfRenamePolicy, gfCleanStats,
  gfRushReward, gfRushWeekKey, gfRushWeekLabel } = new Function(body)();
const clientRushRewards = new Function(
  slice(clientSrc, /const RUSH_WEEK_REWARDS\s*=\s*\[/, '[', ']') + ';return RUSH_WEEK_REWARDS;'
)();

const legacy = mapRows([{ id: 'legacy', power: 30000, base_power: 0,
  rank_name: '☠狼徒·封号弟子', badges: '' }])[0];
const gemfall = gfMap([{ id: 'gemfall', power: 112903,
  best_rush: 612345, rush_all: 812345,
  best_rotate: 512345,
  rank_name: '☠执灯人·封号矿主', badges: 'g11' }])[0];
const augEnd = Date.UTC(2026, 7, 31, 15, 59);
const sepStart = Date.UTC(2026, 7, 31, 16, 0);
const firstName = gfRenamePolicy('', '新名字', '', augEnd);
const unchanged = gfRenamePolicy('旧名字', '旧名字', '202608', augEnd);
const secondChange = gfRenamePolicy('旧名字', '新名字', '202608', augEnd);
const nextMonth = gfRenamePolicy('旧名字', '新名字', '202608', sepStart);
const realHigh = gfCleanStats({ score: 712345, rush: 765432, lv: 1234, stars: 192,
  chain: 42, runs: 500, days: 100, dbest: 80, mv: 900001, luck: 5, mastery: 6 });
const clamped = gfCleanStats({ score: 1e12, rush: 1e12, lv: 1e12, chain: 1e12,
  runs: 500, days: 900, dbest: 800, mv: 1e12 });
const beforeMonday = Date.UTC(2026, 7, 9, 15, 59);
const atMonday = Date.UTC(2026, 7, 9, 16, 0);
const boardSrc = fnOf(src, 'gfBoard');
const rushPart = boardSrc.slice(boardSrc.indexOf('scope === "rush"'), boardSrc.indexOf('scope === "rotate"'));
const rotatePart = boardSrc.slice(boardSrc.indexOf('scope === "rotate"'), boardSrc.indexOf('scope === "depth"'));

const failures = [];
if (src.includes('☠')) failures.push('Worker 正本仍含骷髅字符');
if (legacy.rankName !== '狼徒·封号弟子') failures.push('旧词灵榜存量称号未按当前段位表覆盖');
if (gemfall.rankName !== '执灯人·封号矿主') failures.push('旧灵石榜存量称号未按当前段位表覆盖');
if (!gemfall.badges.includes('g11')) failures.push('虹彩资格没有进入公共榜单响应');
if (gemfall.rush !== 612345 || gemfall.rushAll !== 812345)
  failures.push('90 秒周榜没有同时保留本周成绩与历史最佳');
if (gemfall.rotate !== 512345) failures.push('轮转周榜成绩没有进入公共榜单响应');
if (!gfBadges({ mastery: 6 }).includes('g11') || gfBadges({ mastery: 5 }).includes('g11'))
  failures.push('虹彩资格不是严格的六人全曜衔');
if (!firstName.allowed || !firstName.changed || firstName.month !== '202608')
  failures.push('首次起名没有正确占用北京时间自然月机会');
if (!unchanged.allowed || unchanged.changed) failures.push('未改名的普通成绩提交被误拦');
if (secondChange.allowed) failures.push('同一自然月允许了第二次定名');
if (!nextMonth.allowed || nextMonth.month !== '202609') failures.push('北京时间下月没有重置更名机会');
if (!src.includes('CREATE TABLE IF NOT EXISTS gemfall_alias_month')) failures.push('服务端缺少更名月份持久化表');
if (realHigh.score !== 712345 || realHigh.rush !== 765432 || realHigh.mv !== 900001
  || realHigh.lv !== 1234 || realHigh.chain !== 42)
  failures.push('50 万以上的真实成绩仍被静默截断');
if (clamped.score !== 18999999 || clamped.rush !== 18999999 || clamped.mv !== 18999999
  || clamped.lv !== 99999 || clamped.chain !== 120 || clamped.days !== 500 || clamped.dbest !== 500)
  failures.push('矿脉榜技术安全闸或统计相互约束失效');
if (gfRushWeekKey(beforeMonday) !== '20260803' || gfRushWeekKey(atMonday) !== '20260810'
  || gfRushWeekLabel('20260810') !== '8月10日—8月16日')
  failures.push('90 秒周榜没有在北京时间周一零点换榜');
if ([1, 2, 3].map(n => {
  const r = gfRushReward(n); return r && r.boxes + '/' + r.dust;
}).join(',') !== '3/180,2/100,1/60') failures.push('90 秒周榜前三奖励表漂移');
if (JSON.stringify(clientRushRewards) !== JSON.stringify([1, 2, 3].map(gfRushReward)))
  failures.push('90 秒周榜前三奖励在客户端与服务端不一致');
if (!src.includes('CREATE TABLE IF NOT EXISTS gf_rush_week')
  || !src.includes('CREATE TABLE IF NOT EXISTS gf_rush_award')
  || !src.includes('CREATE TABLE IF NOT EXISTS gf_rotate_week')
  || !rushPart.includes("CASE WHEN w.comp!='' THEN w.comp ELSE g.comp END AS comp")
  || !rotatePart.includes("'' AS comp")
  || !src.includes('scope !== "class" && scope !== "rush" && scope !== "rotate"'))
  failures.push('竞技周榜未独立持久化，或配速员仍会占真实玩家名次');

if (failures.length) {
  for (const failure of failures) console.error('FAIL ' + failure);
  process.exit(1);
}
console.log('PASS 榜单公共响应不回流历史 emoji');
console.log('PASS 虹彩矿名与自然月更名策略');
console.log('PASS 高分真实值、技术安全闸与两条竞技周榜');
