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
  slice(src, /const GF_BOSS_CAP\s*=\s*\{/, '{', '}') + ';',
  slice(src, /const GF_RUSH_REWARDS\s*=\s*\[/, '[', ']') + ';',
  slice(src, /const RANKS\s*=\s*\[/, '[', ']') + ';',
  slice(src, /const GF_RANKS\s*=\s*\[/, '[', ']') + ';',
  fnOf(src, 'clampInt'), fnOf(src, 'gfCleanStats'), fnOf(src, 'gfCleanBoss'), fnOf(src, 'gfRushReward'),
  fnOf(src, 'gfRushWeekKey'), fnOf(src, 'gfRushWeekLabel'),
  fnOf(src, 'monthKeyOf'), fnOf(src, 'gfRenameMonth'), fnOf(src, 'gfRenamePolicy'), fnOf(src, 'gfBadges'),
  fnOf(src, 'rankFor'), fnOf(src, 'gfRankFor'), fnOf(src, 'mapRows'), fnOf(src, 'gfMap'),
  fnOf(src, 'gfBoardCmp'),
  'return { mapRows, gfMap, gfBadges, gfRenamePolicy, gfCleanStats, gfCleanBoss, gfRushReward, gfRushWeekKey, gfRushWeekLabel, gfBoardCmp };',
].join('\n');
const { mapRows, gfMap, gfBadges, gfRenamePolicy, gfCleanStats, gfCleanBoss,
  gfRushReward, gfRushWeekKey, gfRushWeekLabel, gfBoardCmp } = new Function(body)();
const clientRushRewards = new Function(
  slice(clientSrc, /const RUSH_WEEK_REWARDS\s*=\s*\[/, '[', ']') + ';return RUSH_WEEK_REWARDS;'
)();

const legacy = mapRows([{ id: 'legacy', power: 30000, base_power: 0,
  rank_name: '☠狼徒·封号弟子', badges: '' }])[0];
const gemfall = gfMap([{ id: 'gemfall', power: 112903,
  best_rush: 612345, rush_all: 812345,
  boss_floor: 27, boss_progress: 6400, boss_score: 1512345, boss_build: 'blast3,echo2',
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
const bossClean = gfCleanBoss({ bossFloor: 1e9, bossProgress: 20000, bossScore: 1e15,
  bossBuild: 'blast3,<script>,echo-2,中文', bossComp: 'zi' });
const bossOrder = [
  { alias: '同层低进度', boss_floor: 12, boss_progress: 3000, boss_score: 1900000, updated_at: 1 },
  { alias: '多一层', boss_floor: 13, boss_progress: 0, boss_score: 100, updated_at: 3 },
  { alias: '同层高进度', boss_floor: 12, boss_progress: 8000, boss_score: 200, updated_at: 2 },
].sort((a, b) => gfBoardCmp('boss', a, b));
const beforeMonday = Date.UTC(2026, 7, 9, 15, 59);
const atMonday = Date.UTC(2026, 7, 9, 16, 0);
const boardSrc = fnOf(src, 'gfBoard');
const submitSrc = fnOf(src, 'gfSubmit');
const adminSrc = fnOf(src, 'gfAdmin');
const rushPart = boardSrc.slice(boardSrc.indexOf('scope === "rush"'), boardSrc.indexOf('scope === "rushAll"'));
const rushAllPart = boardSrc.slice(boardSrc.indexOf('scope === "rushAll"'), boardSrc.indexOf('scope === "boss"'));
const bossPart = boardSrc.slice(boardSrc.indexOf('scope === "boss"'), boardSrc.indexOf('scope === "depth"'));

const failures = [];
if (src.includes('☠')) failures.push('Worker 正本仍含骷髅字符');
if (legacy.rankName !== '狼徒·封号弟子') failures.push('旧词灵榜存量称号未按当前段位表覆盖');
if (gemfall.rankName !== '执灯人·封号矿主') failures.push('旧灵石榜存量称号未按当前段位表覆盖');
if (!gemfall.badges.includes('g11')) failures.push('虹彩资格没有进入公共榜单响应');
if (gemfall.rush !== 612345 || gemfall.rushAll !== 812345)
  failures.push('90 秒周榜没有同时保留本周成绩与历史最佳');
if (gemfall.bossFloor !== 27 || gemfall.bossProgress !== 6400
  || gemfall.bossScore !== 1512345 || gemfall.bossBuild !== 'blast3,echo2')
  failures.push('Boss 连战整组纪录没有进入公共榜单响应');
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
if (bossClean.floor !== 9999 || bossClean.progress !== 10000 || bossClean.score !== 2147483647
  || bossClean.build !== 'blast3,script,echo-2,' || bossClean.comp !== 'zi')
  failures.push('Boss 连战技术安全闸或强化 ID 清洗失效');
if (bossOrder.map(x => x.alias).join(',') !== '同层低进度,同层高进度,多一层')
  failures.push('Boss 连战比较器没有按战果积分、层数、进度排序');
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
  || !rushPart.includes("CASE WHEN w.comp!='' THEN w.comp ELSE g.comp END AS comp")
  || !rushAllPart.includes('WHERE hidden=0 AND best_rush>0')
  || !rushAllPart.includes('ORDER BY best_rush DESC, alias ASC')
  || !src.includes('scope !== "class" && await pacersOn')
  || !src.includes('reward_rank:i+1')
  || !src.includes('rewardRank: r.reward_rank || 0')
  || !src.includes('merged.concat(bots).sort((a,b)=>gfBoardCmp(scope,a,b))')
  || src.includes('bot: !!r.__bot')
  || !src.includes('scope !== "rushAll" || (r.best_rush || 0) > 0'))
  failures.push('90 秒周榜、历史榜或配速员公开榜口径漂移');
if (!src.includes('CREATE TABLE IF NOT EXISTS gf_boss_best')
  || !src.includes('idx_gf_boss_points')
  || !bossPart.includes('FROM gf_boss_best b JOIN gemfall g ON g.id=b.id')
  || !bossPart.includes('ORDER BY b.best_score DESC,b.best_floor DESC,b.best_progress DESC')
  || !submitSrc.includes('WHERE excluded.best_score>COALESCE(gf_boss_best.best_score,0)')
  || !src.includes("gf_boss_points_v3")
  || !src.includes('WHERE best_floor>0`)')
  || !adminSrc.includes('DELETE FROM gf_boss_best WHERE id=?')
  || !adminSrc.includes('DELETE FROM gf_boss_best'))
  failures.push('Boss 连战没有独立持久化、成对更新、真实玩家排序或管理清理');
if (src.includes('gf_rotate_week') || /DROP\s+TABLE/i.test(src))
  failures.push('退役轮转周榜仍在读写，或代码试图删除线上旧表');
/* 天象日榜：独立表、首挖只增不减、时区宽容窗、配速员按日确定性参与、响应回带 day。 */
const dayOrder = [
  { alias: 'BB', day_best: 50000 },
  { alias: 'CC', day_best: 90000 },
  { alias: 'AA', day_best: 50000 },
].sort((a, b) => gfBoardCmp('day', a, b));
if (dayOrder.map(x => x.alias).join(',') !== 'CC,AA,BB')
  failures.push('天象日榜比较器没有按首挖成绩排、同分没按化名稳定排');
if (!src.includes('CREATE TABLE IF NOT EXISTS gf_day_best')
  || !src.includes('idx_gf_day_rank')
  || !src.includes('best=MAX(COALESCE(gf_day_best.best,0),excluded.best)')
  || !src.includes('Math.abs(dvDay - serverDay) <= 1')
  || !src.includes('FROM gf_day_best d JOIN gemfall g ON g.id=d.id')
  || !src.includes('ORDER BY d.best DESC,g.alias ASC')
  || !src.includes('scope !== "day" || (r.day_best || 0) > 0')
  || !src.includes('scope === "day" ? clampInt(url.searchParams.get("day")')
  || gfMap([{ id: 'x', alias: '日榜人', day_best: 87654 }])[0].dayBest !== 87654
  || !clientSrc.includes('dvDay:_dv.d||0')
  || !clientSrc.includes('+d.day===+day'))
  failures.push('天象日榜的表、只增不减、时区窗、配速员隔离或客户端校验口径漂移');

if (failures.length) {
  for (const failure of failures) console.error('FAIL ' + failure);
  process.exit(1);
}
console.log('PASS 榜单公共响应不回流历史 emoji');
console.log('PASS 虹彩矿名与自然月更名策略');
console.log('PASS 90 秒历史/周榜并存与周榜奖励');
console.log('PASS Boss 十二层积分纪录、旧成绩折算与公开世界榜');
