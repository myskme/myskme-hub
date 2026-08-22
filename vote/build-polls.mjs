#!/usr/bin/env node
// 民意传真科 · 角色名单同步器
//
// 干一件事：用 characters.json（正典事实源）重新生成 polls.json 里
// fav-character 议题的选项，**其余议题一个字不碰**。
// 王老师的诉求（0815）：正典更新后，投票页自动跟着变，不要等人手改。
//
// 它被谁调用：expedition 的 sync-bible.sh 第三步（他改正典的既有肌肉记忆
// 就是「跑一次 sync-bible」）。同步逻辑只在这里实现一份——expedition 侧
// 只是调用者，两处各写一份迟早漂。
//
// 用法：
//   node vote/build-polls.mjs <characters.json 路径>          # 同步（幂等）
//   node vote/build-polls.mjs <characters.json 路径> --check  # 只查不改，漂移则退出 1
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const POLLS_PATH = path.join(HERE, 'polls.json');
const src = process.argv[2];
const checkOnly = process.argv.includes('--check');
if (!src) { console.error('[败] 用法：node vote/build-polls.mjs <characters.json 路径> [--check]'); process.exit(2); }

const chars = JSON.parse(readFileSync(src, 'utf8'));
const list = Array.isArray(chars) ? chars : chars.characters;
if (!Array.isArray(list) || !list.length) { console.error('[败] characters.json 读出来不是角色数组'); process.exit(2); }

// 选项 id 必须过计票端的白名单，否则页面发得出、服务端收不进。
// 这条正则与 worker 的 VOTE_OPT_RE 同义；vote.test.mjs 里有断言盯着两边别漂。
const OPT_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;
const bad = list.filter(c => !OPT_RE.test(String(c.id || '')));
if (bad.length) {
  console.error('[败] 这些角色 id 不合计票白名单，先改 id 再同步：' + bad.map(c => c.id).join('、'));
  process.exit(2);
}

const options = list.map(c => ({
  id: c.id,
  label: c.name,
  meta: [c.animal, c.zodiac, c.rarity].filter(Boolean).join(' · '),
  tone: c.faction || c.role || '',
}));

const polls = JSON.parse(readFileSync(POLLS_PATH, 'utf8'));
const fav = (polls.polls || []).find(p => p.id === 'fav-character');
if (!fav) { console.error('[败] polls.json 里找不到 fav-character 议题'); process.exit(2); }

const before = JSON.stringify(fav.options);
const after = JSON.stringify(options);
if (before === after) { console.log('[过] 角色投票名单已是最新（' + options.length + ' 人），无需改动。'); process.exit(0); }

// 说清楚变了什么，让人看得见这次同步的内容。
const oldIds = new Set(fav.options.map(o => o.id)), newIds = new Set(options.map(o => o.id));
const added = options.filter(o => !oldIds.has(o.id)).map(o => o.label + '(' + o.id + ')');
const removed = fav.options.filter(o => !newIds.has(o.id)).map(o => o.label + '(' + o.id + ')');
const renamed = options.filter(o => oldIds.has(o.id) && fav.options.find(x => x.id === o.id).label !== o.label)
  .map(o => o.id + ' -> ' + o.label);
if (added.length) console.log('  新增：' + added.join('、'));
if (removed.length) console.log('  移除：' + removed.join('、'));
if (renamed.length) console.log('  改名：' + renamed.join('、'));
if (!added.length && !removed.length && !renamed.length) console.log('  （meta 或顺序变化）');

if (checkOnly) { console.log('[败] 角色投票名单与正典有出入（--check 模式，未改动文件）。'); process.exit(1); }

fav.options = options;
writeFileSync(POLLS_PATH, JSON.stringify(polls, null, 1) + '\n');
console.log('[过] polls.json 的角色名单已同步为 ' + options.length + ' 人。'
  + 'commit 并 push 到 main 后，主页流水线会自动把投票页发上线。');
