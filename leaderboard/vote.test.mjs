// 民意传真科 · 投票模块自检（照 monkey.test.mjs 的路子：从 worker 源码现抽函数来测，
// 不抄实现——抄一份就是会漂的镜像）。CI 在 gemfall-verify 里跑。
//
// 验证器要两个方向都试：**只验「该收的收」永远发现不了误收那一半**。
import { readFile } from 'node:fs/promises';
import { beijingDayKey, duelPollId, pairForDay } from '../vote/duel-pair.mjs';

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
const pageHtml = await readFile(new URL('../vote/index.html', here), 'utf8');
const reportSrc = await readFile(new URL('../deploy/vote/report.mjs', here), 'utf8');
const pollsFile = JSON.parse(await readFile(new URL('../vote/polls.json', here), 'utf8'));

const body = [
  worker.match(/const VOTE_POLL_RE[^\n]*/)[0],
  worker.match(/const VOTE_OPT_RE[^\n]*/)[0],
  worker.match(/const VOTE_CH_RE[^\n]*/)[0],
  worker.match(/const VOTE_LIMITS[^\n]*/)[0],
  'const VOTE_POLICY = ' + slice(worker, /const VOTE_POLICY = \{/, '{', '}').replace(/^const VOTE_POLICY = /, '') + ';',
  worker.match(/const VOTE_POLICY_DEFAULT[^\n]*/)[0],
  fnOf(worker, 'votePollFam'),
  fnOf(worker, 'voteDayKey'),
  fnOf(worker, 'voteCleanCast'),
  'return { VOTE_POLL_RE, VOTE_OPT_RE, VOTE_CH_RE, VOTE_LIMITS, VOTE_POLICY, votePollFam, voteDayKey, voteCleanCast };',
].join('\n');
const V = new Function(body)();

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

// 固定时刻测（北京 2026-08-22 18:00），别用「现在」——测试的输入也不该是会变的量。
const NOW = Date.UTC(2026, 7, 22, 10, 0, 0);
const TODAY = V.voteDayKey(NOW);
check(TODAY === '20260822', 'voteDayKey 北京日算错了：' + TODAY);

// ---- 清洗器：该收的收 ----
{
  const good = V.voteCleanCast({ pollId: 'fav-character', optionId: 'ziyu', ch: 'CLASS', note: '  子鱼最棒  ' }, NOW);
  check(good.ok, '合法单选（老页面格式）被拒收了');
  check(good.ok && good.optionIds.length === 1 && good.optionIds[0] === 'ziyu', '老页面的 optionId 没折成数组');
  check(good.ch === 'class', '渠道没有折成小写');
  check(good.note === '子鱼最棒', '留言没有剥控制字符并去首尾空白：' + JSON.stringify(good && good.note));
}
{
  const multi = V.voteCleanCast({ pollId: 'fav-character', optionIds: ['wolf', 'zi', 'ziyu'] }, NOW);
  check(multi.ok && multi.optionIds.length === 3, '三选合法票被拒收了');
  const dup = V.voteCleanCast({ pollId: 'fav-character', optionIds: ['wolf', 'wolf', 'zi'] }, NOW);
  check(dup.ok && dup.optionIds.length === 2, '重复选项没有去重');
}
{
  const duel = V.voteCleanCast({ pollId: 'daily-duel-' + TODAY, optionId: 'wolf' }, NOW);
  check(duel.ok, '今天这一期的对决票被拒收了');
  check(duel.ok && duel.fam === 'daily-duel', '对决议题没算出家族名');
}
{
  const long = V.voteCleanCast({ pollId: 'p-1', optionId: 'o-1', note: '啊'.repeat(300) }, NOW);
  check(long.ok && long.note.length === V.VOTE_LIMITS.noteLen, '超长留言没有封顶到 ' + V.VOTE_LIMITS.noteLen);
}
{
  const noCh = V.voteCleanCast({ pollId: 'p-1', optionId: 'o-1', ch: '不合法渠道!!' }, NOW);
  check(noCh.ok && noCh.ch === '', '不合白名单的渠道应当归空，而不是拒收整票');
}

// ---- 清洗器：该拒的拒 ----
for (const [name, bad] of [
  ['议题编号带大写', { pollId: 'FAV', optionId: 'a' }],
  ['议题编号带路径符', { pollId: 'a/../b', optionId: 'a' }],
  ['议题编号超长', { pollId: 'a'.repeat(41), optionId: 'a' }],
  ['选项编号带引号', { pollId: 'ok-poll', optionId: "a'b" }],
  ['选项编号是空串', { pollId: 'ok-poll', optionId: '' }],
  ['整个 body 缺失', null],
  ['角色题超过三选', { pollId: 'fav-character', optionIds: ['a1', 'a2', 'a3', 'a4'] }],
  ['作品题超过两选', { pollId: 'fav-work', optionIds: ['a1', 'a2', 'a3'] }],
  ['对决投昨天那期', { pollId: 'daily-duel-20260821', optionId: 'wolf' }],
  ['对决投明天那期', { pollId: 'daily-duel-20260823', optionId: 'wolf' }],
  ['常驻议题冒充每日议题', { pollId: 'fav-work-20260822', optionIds: ['monkey'] }],
]) check(!V.voteCleanCast(bad, NOW).ok, '该拒的没拒：' + name);

// ---- 策略镜像：worker 的 VOTE_POLICY 必须与 polls.json 的 max/cadence 逐条一致 ----
// 两个方向都对：polls.json 每题都要在 VOTE_POLICY 里且值相同；VOTE_POLICY 每条都要
// 对应一个真实议题——留着已删议题的策略，等于给幽灵议题发白名单。
{
  const fromPolls = Object.fromEntries(pollsFile.polls.map(p => [p.id, { max: p.max, cadence: p.cadence }]));
  for (const [id, want] of Object.entries(fromPolls)) {
    const got = V.VOTE_POLICY[id];
    check(!!got, 'VOTE_POLICY 缺议题 ' + id + '（polls.json 加了题，worker 的策略镜像没跟上）');
    if (got) check(got.max === want.max && got.cadence === want.cadence,
      'VOTE_POLICY 与 polls.json 在 ' + id + ' 上不一致：worker ' + JSON.stringify(got) + ' vs polls ' + JSON.stringify(want));
  }
  for (const id of Object.keys(V.VOTE_POLICY)) {
    check(!!fromPolls[id], 'VOTE_POLICY 里有幽灵议题 ' + id + '（polls.json 里没有它）');
  }
}

// ---- polls.json（事实源）自身必须过 worker 的白名单，否则页面发得出、服务端收不进 ----
for (const poll of pollsFile.polls) {
  check(V.VOTE_POLL_RE.test(poll.id), 'polls.json 议题编号不合白名单：' + poll.id);
  check(Number(poll.max) >= 1 && ['once', 'daily'].includes(poll.cadence), poll.id + ' 缺 max/cadence 策略字段');
  check(poll.options.length <= V.VOTE_LIMITS.options, poll.id + ' 选项数超过服务端上限');
  for (const opt of poll.options) check(V.VOTE_OPT_RE.test(opt.id), poll.id + ' 选项编号不合白名单：' + opt.id);
  const ids = new Set(poll.options.map(o => o.id));
  check(ids.size === poll.options.length, poll.id + ' 有重复选项编号');
  if (poll.optionsFrom) {
    check(pollsFile.polls.some(p => p.id === poll.optionsFrom), poll.id + ' 的 optionsFrom 指向不存在的议题');
  }
}

// ---- 今日对决：配对模块只许有一份，页面与报表都 import 它，且判定可复现 ----
{
  check(pageHtml.includes("from './duel-pair.mjs'"), '投票页没有 import duel-pair.mjs（自己另写一份就是会漂的镜像）');
  check(reportSrc.includes("from '../../vote/duel-pair.mjs'"), '报表没有 import duel-pair.mjs（自己另写一份就是会漂的镜像）');
  const roster = pollsFile.polls.find(p => p.id === 'fav-character').options.map(o => o.id);
  const key = beijingDayKey(NOW);
  const p1 = pairForDay(key, roster), p2 = pairForDay(key, [...roster].reverse());
  check(!!p1 && p1[0] !== p1[1], '当日配对给出了同一个角色打自己');
  check(p1 && p2 && p1[0] === p2[0] && p1[1] === p2[1], '配对结果依赖名单顺序——polls.json 顺序一改历史配对就全变了');
  check(roster.includes(p1[0]) && roster.includes(p1[1]), '配对配出了名单之外的角色');
  const distinct = new Set();
  for (let d = 0; d < 30; d++) distinct.add(String(pairForDay(beijingDayKey(NOW + d * 86400000), roster)));
  check(distinct.size >= 10, '三十天里配对只有 ' + distinct.size + ' 种——说好每天换对手的没换');
  check(/^daily-duel-\d{8}$/.test(duelPollId(key)), '对决议题 id 格式不对：' + duelPollId(key));
}

// ---- 三条路由：worker 与两份网关都要在（网关逐字节一致另有 check-parity 盯）----
for (const route of ['/vote/board', '/vote/cast', '/vote/admin']) {
  check(worker.includes('"' + route + '"'), 'worker 缺路由 ' + route);
  check(gateway.includes("'" + route + "'"), '网关缺路由 ' + route);
}
// 留言的隐私铁律：公共接口永不返回 note。判据是「vote_notes 只被 admin 处理函数 SELECT」。
{
  const publicFns = fnOf(worker, 'voteBoard') + fnOf(worker, 'voteCast') + fnOf(worker, 'voteTally');
  check(!/SELECT[^;]*FROM vote_notes/i.test(publicFns), '公共接口在读留言表——留言只许进管理端');
  check(/FROM vote_notes/.test(fnOf(worker, 'voteAdmin')), '管理端反而读不到留言了');
}
// 防刷与迁移的结构件必须在场（行为由端到端彩排验证，这里守「别被顺手删掉」）：
{
  const castFn = fnOf(worker, 'voteCast');
  check(/vote_ip_guard/.test(castFn) && /ipDay/.test(castFn), 'voteCast 里的当日 IP 限量没了');
  const ensureFn = fnOf(worker, 'voteEnsure');
  check(/ballots2_migrated/.test(ensureFn) && /INSERT OR IGNORE INTO vote_ballots2/.test(ensureFn),
    'voteEnsure 里的一次性搬运（v1 老票并入 v2）没了');
  // 注意闭合引号要锚进判据：不锚的话「WHERE ... AND option_id=?」这种改坏的写法
  // 照样含有这段前缀，门就永远绿（反向验证当场抓到过一次）。
  check(/DELETE FROM vote_ballots2 WHERE poll_id=\? AND voter=\?"/.test(castFn),
    'voteCast 不再整套替换旧选择——多选的「取消勾选」会删不掉旧行');
}

// ---- 同步器（vote/build-polls.mjs）的选项白名单必须与 worker 同义 ----
// 同步器按它放行的 id 会被计票端拒收，就是「页面发得出、服务端收不进」。
// 判据：两处正则**字面一致**——语义等价但写法不同也算漂（没人会去证明等价性）。
{
  const builder = await readFile(new URL('../vote/build-polls.mjs', here), 'utf8');
  const builderRe = (builder.match(/const OPT_RE = (\/[^\n]+\/);/) || [])[1];
  const workerRe = (worker.match(/const VOTE_OPT_RE = (\/[^\n;]+\/);/) || [])[1];
  check(!!builderRe && !!workerRe, '取不到同步器或 worker 的选项正则（写法变了先修本测试的取法）');
  check(builderRe === workerRe, '同步器与计票端的选项白名单漂开了：' + builderRe + ' vs ' + workerRe);
}

if (failures.length) {
  console.error('[败] 投票模块自检 ' + failures.length + ' 条：');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('[过] 投票模块自检全部通过（清洗器两向 + 策略镜像 + 配对单源 + 路由 + 留言隐私 + 防刷结构件）');
