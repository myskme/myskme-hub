#!/usr/bin/env node
// 作品总目 · 对外口径自检（跨仓库）
//
// 由来（2026-08-10）：自鸣棋搬到 zimingqi.myskme.com 之后，主页这边三处还指着 github.io——
//   build_hub.py 的作品清单、README 收录表、以及《灵石远征》游戏内的「其他作品」。
//   Pages 会 301 所以没人发现链接坏了，但主页详情页扫出来的二维码印的仍是旧址，品牌域等于白搬。
//   同一天还发现主页写的自鸣棋单位数停在旧口径。这类错不会让页面挂掉，所以只能靠脚本盯。
//
// 本脚本负责的责任田：**主页对外宣传别人家作品的信息，必须对得上那个作品仓库里的事实源。**
//   自鸣棋正门的事实源 = 自鸣棋仓库根的 CNAME（GitHub Pages 认的就是这个文件）
//   自鸣棋单位数的事实源 = 自鸣棋 index.html 的 UNITS
//
// 拿不到自鸣棋仓库就整体跳过（本机没克隆是常态，不是故障）。CI 里会先 checkout 它。
// 用法：node qa-consistency.mjs            （自鸣棋默认找 ../myskme-zimingqi）
//      ZIMINGQI_DIR=<路径> node qa-consistency.mjs

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ZMQ = process.env.ZIMINGQI_DIR || '../myskme-zimingqi';
const 错 = [], 疑 = [], 过 = [];
const 读 = p => { try { return readFileSync(p, 'utf8'); } catch { return null; } };

const 线 = '─'.repeat(56);
const 收尾 = () => {
  console.log('\n' + 线);
  过.forEach(m => console.log('[过] ' + m));
  if (错.length) { console.log(`\n[错] 确定错误 ${错.length} 处（必修）`); 错.forEach(e => console.log('     ' + e)); }
  else console.log('\n[过] 确定错误：0');
  if (疑.length) { console.log(`[疑] 需人工判读 ${疑.length} 处`); 疑.forEach(w => console.log('     ' + w)); }
  console.log(线 + '\n');
  process.exit(错.length ? 1 : 0);
};

console.log('\n' + 线 + '\n作品总目 · 对外口径自检（跨仓库）\n' + 线);

if (!existsSync(ZMQ)) {
  疑.push(`找不到自鸣棋仓库（${ZMQ}），跨仓库检查整体跳过。本机没克隆是正常的；CI 里会先 checkout。`);
  收尾();
}

// ── 事实源：全部取自自鸣棋仓库，不采信主页自己写的任何数字 ──
const zmqHtml = 读(join(ZMQ, 'index.html'));
const zmqCname = 读(join(ZMQ, 'CNAME'));
if (!zmqHtml || !zmqCname) { 疑.push(`自鸣棋仓库里缺 index.html 或 CNAME，跳过`); 收尾(); }

const 段 = zmqHtml.slice(zmqHtml.indexOf('const UNITS = ['), zmqHtml.indexOf('const UMAP'));
const UNITS = (段.match(/\{id:'[a-z_]+',/g) || []).length;
const 正门 = `https://${zmqCname.trim()}/`;
if (!UNITS) { 疑.push('没能从自鸣棋 index.html 数出 UNITS，脚本取法可能过时了'); 收尾(); }
console.log(`事实源（取自自鸣棋仓库）：UNITS=${UNITS} · 正门=${正门}`);

const 核对 = (名, 文件, 正则, 期望, 出处) => {
  const t = 读(文件);
  if (t == null) { 疑.push(`${名}：找不到 ${文件}，跳过`); return; }
  const m = t.match(正则);
  if (!m) { 疑.push(`${名}：没匹配到声明（文案或结构改写过？正则要跟着更新，否则这处从此不再受检）`); return; }
  if (m[1] !== String(期望)) 错.push(`${名} 写的是「${m[1]}」，但 ${出处} 是「${期望}」`);
  else 过.push(`${名} 对上 ${出处}（${期望}）`);
};

// ── 自鸣棋正门：三处主链接真正住的位置 ──
// 只查这三处，不做全文扫描——旧地址出现在 README 灾备说明、LEGACY_DEFAULT_URL 回填白名单、
// 交接单的历史记录里都是合法的，全文扫描只会制造假警报。
核对('主页作品清单的自鸣棋网址', 'build_hub.py', /"key": "zimingqi"[\s\S]{0,800}?"url": "([^"]+)"/, 正门, '自鸣棋仓库 CNAME');
核对('主页 README 收录表的自鸣棋网址', 'README.md', /自鸣棋[^|\n]*\|\s*(\S+)\s*\|/, 正门, '自鸣棋仓库 CNAME');
核对('灵石远征游戏内的自鸣棋网址', 'match/index.html', /t:'自鸣棋'[\s\S]{0,300}?u:'([^']+)'/, 正门, '自鸣棋仓库 CNAME');

// ── 自鸣棋单位数：主页两处宣传文案 ──
核对('主页自鸣棋作品介绍的单位数', 'build_hub.py', /(\d+) 位可玩单位/, UNITS, '自鸣棋 index.html 的 UNITS');
核对('主页 README 的自鸣棋单位数', 'README.md', /自鸣棋 · (\d+) 单位/, UNITS, '自鸣棋 index.html 的 UNITS');

收尾();
