import { loadGemfall } from './headless-runtime.mjs';

const runtime = await loadGemfall();
const { context } = runtime;
const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass: Boolean(pass), detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` · ${detail}` : ''}`);
};

const defaultBases = Array.from(runtime.run('LB.bases.slice()'));
check('默认生产入口仍指向现有 Worker',
  defaultBases.length === 1 && defaultBases[0] === 'https://myskme-leaderboard.wzc1020.workers.dev',
  defaultBases.join(' → '));

runtime.run(`
  LB.bases.splice(0, LB.bases.length, 'https://primary.example', 'https://fallback.example');
  SAVE.lbApiHint=''; SAVE.lbApiAt=0;
`);
let calls = [];
context.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options });
  if (String(url).startsWith('https://primary.example')) throw new TypeError('network down');
  return { status: 200, json: async () => ({ ok: true, rows: [] }) };
};
const failover = await runtime.run(`LB.board('world')`);
check('主入口网络失败后切到备用入口',
  failover.ok && calls.length === 2
    && calls[0].url.startsWith('https://primary.example/')
    && calls[1].url.startsWith('https://fallback.example/'),
  calls.map(call => call.url).join(' → '));
check('成功入口会写入短期提示',
  runtime.run(`SAVE.lbApiHint`) === 'https://fallback.example');

runtime.run(`SAVE.lbApiHint=''; SAVE.lbApiAt=0;`);
calls = [];
context.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options });
  return { status: 400, json: async () => ({ ok: false, err: '化名需 2-12 位中英文/数字' }) };
};
const rejected = await runtime.run(`LB.fetchJSON('/gf/submit',{method:'POST'},15000)`);
check('真实 4xx 不换后端绕过规则',
  !rejected.ok && rejected.status === 400 && calls.length === 1,
  `HTTP ${rejected.status} / ${calls.length} request`);

runtime.run(`
  LB.bases.splice(0, LB.bases.length, 'https://only.example');
  SAVE.lbApiHint=''; SAVE.lbApiAt=0;
  SAVE.lbAlias='测试矿工'; SAVE.lbFaction=''; SAVE.lbPw='';
`);
calls = [];
context.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options });
  return { status: 200, json: async () => ({ ok: true, power: 1, rank: 1, rankName: '初探者' }) };
};
const submitted = await runtime.run(`LB.submit(true)`);
const contentType = calls[0]?.options?.headers?.['Content-Type'] || '';
check('普通成绩提交使用 simple request，避免 OPTIONS 预检',
  submitted.ok && contentType === 'text/plain;charset=UTF-8', contentType);
check('成绩提交路径保持 /gf/submit 协议',
  calls[0]?.url === 'https://only.example/gf/submit', calls[0]?.url || 'no request');

const failed = results.filter(result => !result.pass);
console.log(failed.length ? `FAIL 网络层 ${failed.length}/${results.length} 项未通过`
  : `PASS 网络层全部 ${results.length} 项通过`);
if (failed.length) process.exitCode = 1;
