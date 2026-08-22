#!/usr/bin/env node
// 民意传真科 · 每日报表生成器（GitHub Actions 定时跑，也可本机手跑）。
//
// 干四件事：
//   1. 按 vote/polls.json 里登记的议题（事实源），逐个拉 /api/vote/board 计票；
//   2. 「今日对决」按 duel-pair.mjs 重算每期配对，逐期拉票、剔除不合本期配对的
//      异常票，并算出对决段位（Elo）；
//   3. 存一份当日快照 JSON 进 投票报表/快照/（不可变，作历史）；
//   4. 重写 投票报表/最新.md：当前排名 + 与上一份快照的涨跌 + 渠道分布 + 异常标记。
//
// 判据几条：
//   · 议题清单**现取** polls.json，不在这里抄一份——抄了就是会漂的镜像；
//   · 对决配对**现算** duel-pair.mjs（与页面 import 同一份实现），计票端零知识，
//     配对之外的选项票在这里如实剔除并计入异常，不静默吞掉；
//   · 涨跌对比「上一份快照文件」，不是对比昨天的日期——某天 Actions 挂了没跑，
//     按日期对比会静默丢一天，按上一份对比永远对得上；
//   · 防刷的最后一层在这里：单日暴涨（涨幅超过 30 且超过原票三倍）会被标记进
//     「需要过目」——限量门挡笨刷子，报表标记让聪明刷子无处藏。
//
// 拉不到计票就**红着失败**，不写「0 票」的假快照——一份错的快照会把后面所有涨跌都带歪。
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beijingDayKey, duelIssueNo, duelPollId, pairForDay, questionForDay } from '../../vote/duel-pair.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const API = process.env.VOTE_API || 'https://myskme.com/api/vote';
const SNAP_DIR = path.join(ROOT, '投票报表', '快照');
const LATEST = path.join(ROOT, '投票报表', '最新.md');

const polls = JSON.parse(await readFile(path.join(ROOT, 'vote', 'polls.json'), 'utf8')).polls || [];
if (!polls.length) { console.error('[败] polls.json 里没有议题'); process.exit(1); }

// 北京时间的今天，作快照名——报表读者在北京时区，UTC 日期会差一天。
const today = beijingDayKey(Date.now());
const todayDashed = today.slice(0, 4) + '-' + today.slice(4, 6) + '-' + today.slice(6, 8);

async function board(pollId) {
  const res = await fetch(API + '/board?pollId=' + encodeURIComponent(pollId), { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error('拉 ' + pollId + ' 计票失败：状态码 ' + res.status);
  const data = await res.json();
  if (!data.ok) throw new Error('拉 ' + pollId + ' 计票失败：' + (data.err || '未知'));
  return data;
}
function die(e) { console.error('[败] ' + (e && e.message || e)); process.exit(1); }

const snapshot = { at: new Date().toISOString(), day: todayDashed, polls: {}, duel: null };
const standing = polls.filter(p => p.kind !== 'duel');
for (const poll of standing) {
  const data = await board(poll.id).catch(die);
  snapshot.polls[poll.id] = { total: data.total, voters: data.voters || 0, options: data.options, channels: data.channels || {} };
  console.log('[过] ' + poll.id + '：' + data.total + ' 票（' + (data.voters || 0) + ' 人）');
}

// ── 今日对决：从第 1 期到今天（最多回看 30 天），逐期取票、验配对、算段位 ──
const duelPoll = polls.find(p => p.kind === 'duel');
const roster = duelPoll && polls.find(p => p.id === duelPoll.optionsFrom);
if (duelPoll && roster && roster.options.length >= 2) {
  const ids = roster.options.map(o => o.id);
  const days = [];
  for (let back = 29; back >= 0; back--) {
    const key = beijingDayKey(Date.now() - back * 86400000);
    if (duelIssueNo(key) >= 1) days.push(key);
  }
  const perDay = {}, rating = {}, record = {};
  const K = 24;
  let junkTotal = 0;
  for (const key of days) {
    const data = await board(duelPollId(key)).catch(die);
    const [a, b] = pairForDay(key, ids);
    const by = Object.fromEntries((data.options || []).map(o => [o.id, o.n]));
    const na = by[a] || 0, nb = by[b] || 0;
    // 配对之外的票是伪造或串期，如实剔除并记数——不静默。
    const junk = (data.options || []).filter(o => o.id !== a && o.id !== b).reduce((s, o) => s + o.n, 0);
    junkTotal += junk;
    perDay[key] = { a, b, na, nb, junk, question: questionForDay(key) };
    if (na + nb) {
      // Elo：每期按票数份额结算一场。期数少时波动大，报表里写明「看趋势别看绝对值」。
      const Ra = rating[a] ?? 1000, Rb = rating[b] ?? 1000;
      const Ea = 1 / (1 + Math.pow(10, (Rb - Ra) / 400));
      const sa = na / (na + nb);
      rating[a] = Ra + K * (sa - Ea);
      rating[b] = Rb + K * ((1 - sa) - (1 - Ea));
      (record[a] = record[a] || { w: 0, l: 0, d: 0 })[na > nb ? 'w' : na < nb ? 'l' : 'd']++;
      (record[b] = record[b] || { w: 0, l: 0, d: 0 })[nb > na ? 'w' : nb < na ? 'l' : 'd']++;
    }
  }
  snapshot.duel = { today: perDay[today] || null, perDay, rating, record, junkTotal };
  console.log('[过] 今日对决：回看 ' + days.length + ' 期，异常票 ' + junkTotal + ' 张已剔除');
}

await mkdir(SNAP_DIR, { recursive: true });
// 上一份快照 = 目录里字典序最大的那份（文件名就是日期，字典序即时间序）。
const prevName = (await readdir(SNAP_DIR).catch(() => []))
  .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f !== todayDashed + '.json').sort().pop();
const prev = prevName ? JSON.parse(await readFile(path.join(SNAP_DIR, prevName), 'utf8')) : null;

await writeFile(path.join(SNAP_DIR, todayDashed + '.json'), JSON.stringify(snapshot, null, 1) + '\n');

const lines = [
  '# 民意传真科 · 计票报表（自动生成，勿手改）',
  '',
  '生成时间：' + snapshot.at + '（北京日期 ' + todayDashed + '）',
  prev ? '涨跌对比：' + prevName.replace('.json', '') + ' 那份快照' : '涨跌对比：无（这是第一份快照）',
  '数据源：`' + API + '/board`；议题清单现取 `vote/polls.json`；对决配对现算 `vote/duel-pair.mjs`。',
  '',
];
const warnings = [];
for (const poll of standing) {
  const cur = snapshot.polls[poll.id];
  const old = prev && prev.polls && prev.polls[poll.id];
  const oldBy = old ? Object.fromEntries(old.options.map(o => [o.id, o.n])) : {};
  const labelOf = Object.fromEntries(poll.options.map(o => [o.id, o.label]));
  lines.push('## ' + poll.title + '（' + cur.total + ' 票 · ' + (cur.voters || 0) + ' 人'
    + (old ? '，较上期 ' + fmtDelta(cur.total - old.total) : '') + '）', '');
  if ((poll.max || 1) > 1) lines.push('（每人至多 ' + poll.max + ' 票，票数为获选次数，人数为投过的设备数）', '');
  lines.push('| 名次 | 选项 | 票数 | 涨跌 |', '|---|---|---|---|');
  cur.options.slice(0, 15).forEach((o, i) => {
    const gain = o.n - (oldBy[o.id] || 0);
    if (prev && gain >= 30 && gain > 3 * Math.max(1, oldBy[o.id] || 0)) {
      warnings.push(poll.title + '：「' + (labelOf[o.id] || o.id) + '」单日暴涨 ' + gain + ' 票（原 ' + (oldBy[o.id] || 0) + ' 票），建议过目');
    }
    lines.push('| ' + (i + 1) + ' | ' + (labelOf[o.id] || o.id) + ' | ' + o.n + ' | ' + fmtDelta(gain) + ' |');
  });
  if (cur.options.length > 15) lines.push('', '（其余 ' + (cur.options.length - 15) + ' 个选项在快照 JSON 里，报表只列前 15——列不下不等于不存在）');
  const ch = Object.entries(cur.channels).sort((a, b) => b[1] - a[1]);
  if (ch.length) lines.push('', '渠道分布（人数）：' + ch.map(([k, n]) => k + ' ' + n).join(' · '));
  lines.push('');
}
if (snapshot.duel) {
  const d = snapshot.duel;
  const labelOf = Object.fromEntries(roster.options.map(o => [o.id, o.label]));
  lines.push('## 今日对决', '');
  if (d.today) {
    lines.push('第 ' + duelIssueNo(today) + ' 期（截至生成时）：' + d.today.question, '');
    lines.push((labelOf[d.today.a] || d.today.a) + ' ' + d.today.na + ' 票 · '
      + (labelOf[d.today.b] || d.today.b) + ' ' + d.today.nb + ' 票', '');
  }
  const ranked = Object.keys(d.rating).map(id => ({ id, r: d.rating[id], rec: d.record[id] || { w: 0, l: 0, d: 0 } }))
    .sort((a, b) => b.r - a.r).slice(0, 10);
  if (ranked.length) {
    lines.push('| 段位榜 | 角色 | 评分 | 战绩 |', '|---|---|---|---|');
    ranked.forEach((x, i) => lines.push('| ' + (i + 1) + ' | ' + (labelOf[x.id] || x.id) + ' | '
      + Math.round(x.r) + ' | ' + x.rec.w + ' 胜 ' + x.rec.l + ' 负 ' + x.rec.d + ' 平 |'));
    lines.push('', '（评分按每期票数份额用 Elo 结算，起点 1000；期数还少时波动大，看趋势别看绝对值）');
  }
  if (d.junkTotal) warnings.push('今日对决：累计剔除不合本期配对的异常票 ' + d.junkTotal + ' 张');
  lines.push('');
}
if (warnings.length) {
  lines.push('## 需要过目', '');
  for (const w of warnings) lines.push('- ' + w);
  lines.push('');
}
lines.push('---', '快照存档在 `投票报表/快照/`，一天一份，git 历史即完整时间线。');
function fmtDelta(d) { return d > 0 ? '+' + d : d < 0 ? String(d) : '0'; }

await writeFile(LATEST, lines.join('\n') + '\n');
console.log('[过] 快照 ' + todayDashed + '.json 与 最新.md 已写出' + (warnings.length ? '（含 ' + warnings.length + ' 条需过目）' : ''));
