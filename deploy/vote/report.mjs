#!/usr/bin/env node
// 民意传真科 · 每日报表生成器（GitHub Actions 定时跑，也可本机手跑）。
//
// 干三件事：
//   1. 按 vote/polls.json 里登记的议题（事实源），逐个拉 /api/vote/board 计票；
//   2. 存一份当日快照 JSON 进 投票报表/快照/（不可变，作历史）；
//   3. 重写 投票报表/最新.md：当前排名 + 与上一份快照的涨跌 + 渠道分布。
//
// 判据两条：
//   · 议题清单**现取** polls.json，不在这里抄一份——抄了就是会漂的镜像；
//   · 涨跌对比「上一份快照文件」，不是对比昨天的日期——某天 Actions 挂了没跑，
//     按日期对比会静默丢一天，按上一份对比永远对得上。
//
// 拉不到计票就**红着失败**，不写「0 票」的假快照——一份错的快照会把后面所有涨跌都带歪。
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const API = process.env.VOTE_API || 'https://myskme.com/api/vote';
const SNAP_DIR = path.join(ROOT, '投票报表', '快照');
const LATEST = path.join(ROOT, '投票报表', '最新.md');

const polls = JSON.parse(await readFile(path.join(ROOT, 'vote', 'polls.json'), 'utf8')).polls || [];
if (!polls.length) { console.error('[败] polls.json 里没有议题'); process.exit(1); }

// 北京时间的今天，作快照名——报表读者在北京时区，UTC 日期会差一天。
const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);

const snapshot = { at: new Date().toISOString(), day: today, polls: {} };
for (const poll of polls) {
  const res = await fetch(API + '/board?pollId=' + encodeURIComponent(poll.id), { signal: AbortSignal.timeout(20000) });
  if (!res.ok) { console.error('[败] 拉 ' + poll.id + ' 计票失败：状态码 ' + res.status); process.exit(1); }
  const data = await res.json();
  if (!data.ok) { console.error('[败] 拉 ' + poll.id + ' 计票失败：' + (data.err || '未知')); process.exit(1); }
  snapshot.polls[poll.id] = { total: data.total, options: data.options, channels: data.channels || {} };
  console.log('[过] ' + poll.id + '：' + data.total + ' 票');
}

await mkdir(SNAP_DIR, { recursive: true });
// 上一份快照 = 目录里字典序最大的那份（文件名就是日期，字典序即时间序）。
const prevName = (await readdir(SNAP_DIR).catch(() => []))
  .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f !== today + '.json').sort().pop();
const prev = prevName ? JSON.parse(await readFile(path.join(SNAP_DIR, prevName), 'utf8')) : null;

await writeFile(path.join(SNAP_DIR, today + '.json'), JSON.stringify(snapshot, null, 1) + '\n');

const lines = [
  '# 民意传真科 · 计票报表（自动生成，勿手改）',
  '',
  '生成时间：' + snapshot.at + '（北京日期 ' + today + '）',
  prev ? '涨跌对比：' + prevName.replace('.json', '') + ' 那份快照' : '涨跌对比：无（这是第一份快照）',
  '数据源：`' + API + '/board`；议题清单现取 `vote/polls.json`。',
  '',
];
for (const poll of polls) {
  const cur = snapshot.polls[poll.id];
  const old = prev && prev.polls && prev.polls[poll.id];
  const oldBy = old ? Object.fromEntries(old.options.map(o => [o.id, o.n])) : {};
  const labelOf = Object.fromEntries(poll.options.map(o => [o.id, o.label]));
  lines.push('## ' + poll.title + '（' + cur.total + ' 票' + (old ? '，較上期 ' + fmtDelta(cur.total - old.total) : '') + '）', '');
  lines.push('| 名次 | 选项 | 票数 | 涨跌 |', '|---|---|---|---|');
  cur.options.slice(0, 15).forEach((o, i) => {
    lines.push('| ' + (i + 1) + ' | ' + (labelOf[o.id] || o.id) + ' | ' + o.n + ' | ' + fmtDelta(o.n - (oldBy[o.id] || 0)) + ' |');
  });
  if (cur.options.length > 15) lines.push('', '（其余 ' + (cur.options.length - 15) + ' 个选项在快照 JSON 里，报表只列前 15——列不下不等于不存在）');
  const ch = Object.entries(cur.channels).sort((a, b) => b[1] - a[1]);
  if (ch.length) lines.push('', '渠道分布：' + ch.map(([k, n]) => k + ' ' + n + ' 票').join(' · '));
  lines.push('');
}
lines.push('---', '快照存档在 `投票报表/快照/`，一天一份，git 历史即完整时间线。');
function fmtDelta(d) { return d > 0 ? '+' + d : d < 0 ? String(d) : '0'; }

await writeFile(LATEST, lines.join('\n') + '\n');
console.log('[过] 快照 ' + today + '.json 与 最新.md 已写出');
