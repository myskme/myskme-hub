import { readFile } from 'node:fs/promises';

function slice(src, head, open, close) {
  const m = src.match(head);
  if (!m) throw new Error('抽不到：' + head);
  const i = src.indexOf(m[0]);
  let depth = 0, k = src.indexOf(open, i);
  for (;; k++) {
    if (src[k] === open) depth++;
    else if (src[k] === close && --depth === 0) break;
  }
  return src.slice(i, k + 1);
}
const fnOf = (src, name) => slice(src, new RegExp('function ' + name + '\\s*\\('), '{', '}');

const here = new URL('.', import.meta.url);
const worker = await readFile(new URL('./worker.js', here), 'utf8');
const gateway = await readFile(new URL('../deploy/gateway/api/[[default]].js', here), 'utf8');
const mirror = await readFile(new URL('../match/edge-functions/api/[[default]].js', here), 'utf8');
const body = [
  worker.match(/const MONKEY_CAP[^\n]*/)[0],
  worker.match(/const MONKEY_SCOPES[^\n]*/)[0],
  fnOf(worker, 'clampInt'), fnOf(worker, 'monkeyWeekKey'), fnOf(worker, 'monkeyWeekLabel'),
  fnOf(worker, 'monkeyDayKey'), fnOf(worker, 'monkeyCleanRun'), fnOf(worker, 'monkeyOrder'),
  fnOf(worker, 'monkeyMapRow'),
  'return { MONKEY_CAP, MONKEY_SCOPES, monkeyWeekKey, monkeyWeekLabel, monkeyDayKey, monkeyCleanRun, monkeyOrder, monkeyMapRow };',
].join('\n');
const M = new Function(body)();
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const before = Date.UTC(2026, 7, 16, 15, 59, 59);
const monday = Date.UTC(2026, 7, 16, 16, 0, 0);
check(M.monkeyWeekKey(before) === '20260810', '北京时间周日结束前换周过早');
check(M.monkeyWeekKey(monday) === '20260817', '北京时间周一零点没有换周');
check(M.monkeyWeekLabel('20260817') === '8月17日-8月23日', '周榜日期文案漂移');
check(M.monkeyDayKey(monday) === '2026-08-17', '每日补交上限没有按北京时间计算');

const valid = M.monkeyCleanRun({ run: { runId: 'abc_DEF-123', height: 555, score: 699, bananas: 7 } });
const clamped = M.monkeyCleanRun({ runId: 'very-long-run-1', height: 999999999, score: 999999999, bananas: 999999999 });
check(valid.ok && valid.height === 555 && valid.score === 699 && valid.bananas === 7, '正常成绩清洗失败');
check(clamped.ok && clamped.height === 500000 && clamped.score === 10000000 && clamped.bananas === 1000000, '技术安全闸漂移');
check(!M.monkeyCleanRun({ runId: 'too-short', height: 500, score: 499, bananas: 0 }).ok, '分数低于高度的脏数据未拦截');
check(!M.monkeyCleanRun({ runId: 'bad space id', height: 1, score: 1, bananas: 0 }).ok, '本局编号白名单失效');
check(M.monkeyOrder('weekly').startsWith('week_height DESC'), '本周榜不再按本周高度排序');
check(M.monkeyOrder('alltime').startsWith('best_height DESC'), '生涯榜不再按生涯高度排序');
check(M.monkeyOrder('effort').startsWith('runs DESC,total_meters DESC'), '不白摔榜不再优先累计局数');

const publicRow = M.monkeyMapRow({ id: 'private-hash-ab', alias: '测试猴', rank: 9, best_height: 555, best_score: 699, week_height: 300, week_score: 333, runs: 7, total_meters: 1234 });
check(!('id' in publicRow) && publicRow.tag === 'ab' && publicRow.totalMeters === 1234, '公共榜回传了设备哈希或丢失累计数据');
check(worker.includes('CREATE TABLE IF NOT EXISTS monkey_players') && worker.includes('CREATE TABLE IF NOT EXISTS monkey_runs'), '猴子榜独立表缺失');
check(worker.includes('WHERE NOT EXISTS (SELECT 1 FROM monkey_runs WHERE run_hash=?)') && worker.includes('INSERT OR IGNORE INTO monkey_runs'), '断线重传的单局幂等门禁缺失');
check(worker.includes('acceptedRunId: runId') && worker.includes('daySubmits >= 240'), '精确回执或每日技术限流缺失');
check(worker.includes('playerToken: id') && worker.includes('url.searchParams.get("playerToken")') && !worker.includes('url.searchParams.get("deviceUUID")'), '个人附近名次没有使用匿名榜单令牌');
check(worker.includes('UPDATE monkey_players SET alias=? WHERE id=?') && worker.includes('if (duplicate)'), '同一局改名或幂等重传路径缺失');
check(worker.includes('ROW_NUMBER() OVER') && worker.includes('nearby'), '个人名次与附近玩家查询缺失');
check(worker.includes('p === "/monkey/board"') && worker.includes('p === "/monkey/submit"') && worker.includes('p === "/monkey/admin"'), 'Worker 路由不完整');
check(worker.includes('v: 5') && worker.includes('["wordduel", "gemfall", "monkey"]'), 'Worker 健康检查未登记猴子榜');
for (const src of [gateway, mirror]) {
  check(src.includes("['/monkey/board'") && src.includes("['/monkey/submit'") && src.includes("['/monkey/admin'"), '品牌网关猴子榜白名单不完整');
}
check(gateway === mirror, '品牌网关正本与副本不一致');

if (failures.length) {
  for (const failure of failures) console.error('[败] ' + failure);
  process.exit(1);
}
console.log('[过] 本周、生涯、不白摔三榜口径');
console.log('[过] 单局幂等、补交限流与公共响应隐私');
console.log('[过] Worker 与两份品牌网关路由');
