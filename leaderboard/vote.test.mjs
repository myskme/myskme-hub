// 民意传真科 · 投票模块自检（照 monkey.test.mjs 的路子：从 worker 源码现抽函数来测，
// 不抄实现——抄一份就是会漂的镜像）。CI 在 gemfall-verify 里跑。
//
// 验证器要两个方向都试：**只验「该收的收」永远发现不了误收那一半**。
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
const pollsFile = JSON.parse(await readFile(new URL('../vote/polls.json', here), 'utf8'));

const body = [
  worker.match(/const VOTE_POLL_RE[^\n]*/)[0],
  worker.match(/const VOTE_OPT_RE[^\n]*/)[0],
  worker.match(/const VOTE_CH_RE[^\n]*/)[0],
  worker.match(/const VOTE_LIMITS[^\n]*/)[0],
  fnOf(worker, 'voteCleanCast'),
  'return { VOTE_POLL_RE, VOTE_OPT_RE, VOTE_CH_RE, VOTE_LIMITS, voteCleanCast };',
].join('\n');
const V = new Function(body)();

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

// ---- 清洗器：该收的收 ----
{
  const good = V.voteCleanCast({ pollId: 'fav-character', optionId: 'ziyu', ch: 'CLASS', note: '  子鱼最棒  ' });
  check(good.ok, '合法投票被拒收了');
  check(good.ch === 'class', '渠道没有折成小写');
  check(good.note === '子鱼最棒', '留言没有剥控制字符并去首尾空白：' + JSON.stringify(good && good.note));
}
{
  const long = V.voteCleanCast({ pollId: 'p-1', optionId: 'o-1', note: '啊'.repeat(300) });
  check(long.ok && long.note.length === V.VOTE_LIMITS.noteLen, '超长留言没有封顶到 ' + V.VOTE_LIMITS.noteLen);
}
{
  const noCh = V.voteCleanCast({ pollId: 'p-1', optionId: 'o-1', ch: '不合法渠道!!' });
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
]) check(!V.voteCleanCast(bad).ok, '该拒的没拒：' + name);

// ---- polls.json（事实源）自身必须过 worker 的白名单，否则页面发得出、服务端收不进 ----
for (const poll of pollsFile.polls) {
  check(V.VOTE_POLL_RE.test(poll.id), 'polls.json 议题编号不合白名单：' + poll.id);
  check(poll.options.length <= V.VOTE_LIMITS.options, poll.id + ' 选项数超过服务端上限');
  for (const opt of poll.options) check(V.VOTE_OPT_RE.test(opt.id), poll.id + ' 选项编号不合白名单：' + opt.id);
  const ids = new Set(poll.options.map(o => o.id));
  check(ids.size === poll.options.length, poll.id + ' 有重复选项编号');
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
console.log('[过] 投票模块自检全部通过（清洗器两个方向 + polls.json 合白名单 + 路由齐全 + 留言隐私）');
