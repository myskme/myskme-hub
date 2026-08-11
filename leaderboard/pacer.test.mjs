/* 配速员的不变量。CI 跑它；本机没 node 时可在浏览器里 import 后调 runChecks。
 *
 * 为什么单独有这一份：配速员活在 worker 里，而前端的 window.__selftest() 够不着它 ——
 * 「125 条全绿」曾经和「11 个人里 10 个每晚成绩倒退」同时成立了好几天。
 *
 *     node leaderboard/pacer.test.mjs
 *
 * ⚠ 它**从源码里现抽函数**，不另存一份拷贝。拷贝会漂移，
 *   漂移之后测的就是拷贝，而不是线上真正在跑的那一份。
 */

/* 按括号配对切出一段声明 —— 比正则可靠，注释里带括号也不会切错。 */
function slice(src, head, open, close) {
  const m = src.match(head);
  if (!m) throw new Error('抽不到：' + head);
  const i = src.indexOf(m[0]);
  let depth = 0, k = src.indexOf(open, i);
  for (;; k++) {
    if (src[k] === open) depth++;
    else if (src[k] === close) { depth--; if (!depth) break; }
  }
  return src.slice(i, k + 1);
}

const fnOf = (src, name) => slice(src, new RegExp('function ' + name + '\\s*\\('), '{', '}');

export function loadFrom(src) {
  const body = [
    slice(src, /const PACERS\s*=\s*\[/, '[', ']') + ';',
    fnOf(src, 'pacerRnd'), fnOf(src, 'gfLadder'), fnOf(src, 'gfDepth'),
    fnOf(src, 'gfSkill'), fnOf(src, 'gfGrind'), fnOf(src, 'gfPower'),
    fnOf(src, 'gfBoardCmp'),
    src.match(/const PACER_DECAY_FROM[^\n]*/)[0],
    src.match(/const PACER_CEIL[^\n]*/)[0],
    src.match(/const GAME_EPOCH[^\n]*/)[0],
    src.match(/const PACER_EPOCH[^\n]*/)[0],
    src.match(/const GAME_DAYS_BEFORE_PACER[^\n]*/)[0],
    fnOf(src, 'pacerAt'), fnOf(src, 'pacerStats'),
    'return { PACERS, pacerAt, pacerStats, gfPower, gfBoardCmp, PACER_CEIL, PACER_EPOCH,'
    + ' GAME_EPOCH, GAME_DAYS_BEFORE_PACER };',
  ].join('\n');
  return new Function(body)();
}

/* 当前榜上最强真人的量级。真人涨了可以往上调，别往下调。 */
const REAL = { power: 102698, score: 144777, rush: 212792, lv: 335 };
/* 王老师定的：配速员**可以偶尔越过真人**，越过后停滞一阵再继续 —— 这是刺激点。
   但「偶尔」要有确切含义，否则又变成虚拟人霸榜。三条量化的规矩： */
const OVERTAKE = {
  maxOver: .08,      // 越过榜首最多 8%（打一局就能拿回来的距离）
  notBefore: 300,    // 前 300 天不许发生 —— 要是开服头一年就被机器压着，那不叫刺激
  atMost: 1,         // 任何一刻最多只有一个配速员在榜首之上
};

export function runChecks(M, hoursNow, clientSrc, workerSrc) {
  const { PACERS, pacerAt, PACER_CEIL } = M;
  const out = [];
  const ok = (name, pass, detail) => out.push({ name, pass, detail: detail || '' });

  /* ① 只增不减。原来 d 用 UTC 日序、hNow 用北京小时，北京 00:00-07:59 那 8 小时
        frac 从 1 掉回 0 —— 11 个人里 10 个每晚成绩倒退，早八点又回来。
        真人的数字不会缩水，这是配速员最容易露馅的地方。 */
  const fell = [], rushFell = [], rushMovers = [];
  for (const p of PACERS) {
    let prev = -1, prevRush = -1, n = 0, nr = 0, moved = 0, eg = '', egRush = '';
    for (let h = hoursNow - 48; h < hoursNow + 24 * 120; h++) {
      const v = pacerAt(p, h);
      if (prev >= 0 && v.power < prev) { n++; if (!eg) eg = `h=${h} ${prev}→${v.power}`; }
      if (prevRush >= 0 && v.rush < prevRush) { nr++; if (!egRush) egRush = `h=${h} ${prevRush}→${v.rush}`; }
      if (prevRush >= 0 && v.rush > prevRush) moved++;
      prev = v.power; prevRush = v.rush;
    }
    if (n) fell.push(`${p.alias} 跌 ${n} 次 (${eg})`);
    if (nr) rushFell.push(`${p.alias} 跌 ${nr} 次 (${egRush})`);
    if (moved) rushMovers.push(p.alias);
  }
  ok('矿力逐小时 120 天只增不减', !fell.length, fell.join('; '));
  ok('90 秒成绩逐小时不回退且仍会随作息更新',
     !rushFell.length && rushMovers.length >= 6,
     rushFell.length ? rushFell.join('; ') : `${rushMovers.length}/${PACERS.length} 人继续推进`);

  /* ② 作息不许跨北京日：跨了会被 min(24,·) 压成几十分钟的假窗口，
        夜猫子本猫原来的 23+3 就是这么被压没的。 */
  const win = PACERS.filter(p => p.hour + p.span > 24).map(p => `${p.alias} ${p.hour}+${p.span}`);
  ok('作息窗口不跨北京日', !win.length, win.join('; '));

  /* ③ 十年之内每一项都在最强真人之下；顺带确认兜底闸没被用上 ——
        闸一旦触发说明饱和曲线标定错了，该回去改曲线，不是靠闸兜。 */
  const peak = { power: 0, score: 0, rush: 0, lv: 0 }, who = {};
  let hit = 0;
  for (const p of PACERS) {
    for (let d = 0; d < 3650; d += 30) {
      const v = pacerAt(p, hoursNow + d * 24);
      for (const k in peak) if (v[k] > peak[k]) { peak[k] = v[k]; who[k] = p.alias; }
      if (v.score >= PACER_CEIL.score || v.rush >= PACER_CEIL.rush || v.lv >= PACER_CEIL.lv) hit++;
    }
  }
  /* 单关 / 矿灯 / 关卡 仍旧全部在真人之下 —— 90 秒榜的立身之本是
     「新老玩家都能公平竞争」，那个榜首被机器占走，这个模式就没意义了。
     可以越过的只有**世界榜的矿力**，而且要守下面三条。 */
  const over = ['score', 'rush', 'lv'].filter(k => peak[k] >= REAL[k])
                     .map(k => `${k} ${peak[k]}(${who[k]}) >= 真人 ${REAL[k]}`);
  ok('单关/矿灯/关卡 十年内都在最强真人之下', !over.length, over.join('; '));

  /* 越过世界榜榜首：允许，但要「偶尔」—— 三条都得成立。 */
  let firstCross = null, maxOver = 0, maxSimul = 0;
  /* 5 天一格的话这一段要跑 8000 次 pacerAt，而 pacerAt 是 O(天数) —— 十年那头一次 45ms。
     30 天一格足够判断「有没有越过、越了多少、同时几个」。 */
  for (let d = 0; d < 3650; d += 30) {
    const above = PACERS.filter(p => pacerAt(p, hoursNow + d * 24).power > REAL.power);
    if (!above.length) continue;
    if (firstCross === null) firstCross = d;
    if (above.length > maxSimul) maxSimul = above.length;
    for (const p of above) {
      const o = pacerAt(p, hoursNow + d * 24).power / REAL.power - 1;
      if (o > maxOver) maxOver = o;
    }
  }
  ok(`越过榜首不早于第 ${OVERTAKE.notBefore} 天`,
     firstCross === null || firstCross >= OVERTAKE.notBefore,
     firstCross === null ? '十年内没越过' : `第 ${firstCross} 天`);
  ok(`越过榜首的幅度 <= ${OVERTAKE.maxOver * 100}%`, maxOver <= OVERTAKE.maxOver,
     `最大 ${(maxOver * 100).toFixed(1)}%`);
  ok(`同一时刻最多 ${OVERTAKE.atMost} 个配速员在榜首之上`, maxSimul <= OVERTAKE.atMost,
     `实测最多 ${maxSimul} 个`);
  ok('兜底闸十年内没被触发（曲线自己守得住）', hit === 0, hit ? `触发 ${hit} 次` : '');

  /* ④ 十年后不许一排人整整齐齐停在整百上 ——「恰好停在 16000」比涨太快还假。 */
  const round = PACERS.map(p => pacerAt(p, hoursNow + 3650 * 24).power).filter(v => v % 100 === 0);
  ok('十年后没人停在整百', !round.length, round.join(','));

  /* ⑤ 到顶之后是**整个号一起停**，不是只冻矿力。只压矿力不压出勤的话，
        勤勉 = days*160 + runs*6 还在涨，而勤勉本身就是矿力的一部分 ——
        公开矿力会越过天花板无限涨（实测过：一年 3.09 倍、十年 13.4 倍）。 */
  const zombie = PACERS.filter(p => {
    const a = pacerAt(p, hoursNow + 3650 * 24), b = pacerAt(p, hoursNow + 3285 * 24);
    return a.days - b.days > 40 && a.power - b.power < 40;
  }).map(p => p.alias);
  ok('到顶的人连人带号一起停，不是只冻矿力', !zombie.length, zombie.join(','));

  /* ⑤b 到场天数**不得超过「游戏上线到那一天」**。
        这是名片上最容易露馅的一格：真人到场最多 3 天（中位 1 天），
        而配速员一度写着「到场 27 天、216 局」—— 在一个上线第 9 天的游戏里。
        数字再合理，这一格错了就全白搭。 */
  const impossible = [];
  for (const p of PACERS) for (const day of [0, 30, 365, 3650]) {
    const v = pacerAt(p, hoursNow + day * 24);
    const live = M.GAME_DAYS_BEFORE_PACER + Math.floor((hoursNow + day * 24 + 8) / 24) + 1;
    if (v.days > live) impossible.push(`${p.alias} 第${day}天 到场 ${v.days} > 游戏存在 ${live}`);
  }
  ok('到场天数没超过游戏存在的天数', !impossible.length, impossible.slice(0, 3).join('; '));

  /* ⑥ 别挤在同一个数上：真人在同一矿力上下能差一倍
        （矿力 32,751 打 124,274，矿力 33,910 打 187,923）。 */
  const rs = PACERS.map(p => pacerAt(p, hoursNow + 365 * 24).rush).sort((a, b) => b - a);
  const spread = (rs[0] - rs[rs.length - 1]) / rs[0];
  ok('矿灯有真人那样的离散度（极差 > 30%）', spread > .3, `极差 ${(spread * 100).toFixed(0)}%`);

  /* ⑦ 跨端：**名片上的矿力必须等于榜单上的矿力**。
        真人这两处天生相等（都从三条线算）；配速员曾经是「先编一个 power 再倒推各项」，
        于是榜上 76,002、点开名片 110,930 —— 差 46%，
        而且那个名片值已经压过最强真人的 102,698。点开就露馅。
        这条是唯一一条跨文件断言，也是最值钱的一条：拿 index.html 里**真的**
        pwTotal 去算，不是抄一份公式过来比 —— 抄的那份会跟着漂移。 */
  if (clientSrc) {
    const pwTotal = new Function(
      fnOf(clientSrc, 'pwLadder') + fnOf(clientSrc, 'pwLines') + fnOf(clientSrc, 'pwTotal')
      + 'return pwTotal')();
    const bad = [];
    for (const p of PACERS) for (const day of [0, 30, 365, 3650]) {
      const v = pacerAt(p, hoursNow + day * 24);
      const card = pwTotal({ lv: v.lv, stars: v.stars, chain: v.chain, score: v.score,
        rush: v.rush, mv: v.mv || 0, runs: v.runs, days: v.days, dbest: v.dbest });
      if (card !== v.power) bad.push(`${p.alias} 第${day}天 榜单 ${v.power} vs 名片 ${card}`);
    }
    ok('名片矿力 == 榜单矿力（跨端同源）', !bad.length, bad.slice(0, 4).join('; '));
  }

  /* ⑧ 性能守卫。pacerAt 要从第 0 天一路模拟到目标日，**开销随天数线性增长**，
        而 gfLadder 里那个 `for (const [w,r] of [[64,100],[86,150]])` 每次调用
        都要新建两个数组 —— 它现在每模拟一天就被调一次。
        线上靠 pacerRows 的按小时缓存摊薄（今天约 1ms/小时），但十年那头是
        11 × 45ms ≈ 500ms/小时。这条守卫不是要它变快，是**不许它再变慢一个数量级**；
        真顶到 Workers 的 CPU 上限时，正解是把每月的状态存进 D1 做断点续算。 */
  const t0 = Date.now();
  pacerAt(PACERS[PACERS.length - 1], hoursNow + 3650 * 24);
  const ms = Date.now() - t0;
  ok('单次 pacerAt（十年那头）< 120ms', ms < 120, `实测 ${ms}ms`);

  /* ⑨ 新闯关榜也必须真正并入配速员，而且真人与配速员共用关卡→星数→单关最佳
        这一套排序。只测比较器不够：还要盯住 gfBoard 的公开榜合并条件，
        防止又写回 scope !== "depth"，导致服务端悄悄把它们排除。 */
  if (workerSrc) {
    const mixed = [
      { alias: '普通条目', lv: 20, stars: 60, best_score: 50000 },
      { alias: '成长条目', lv: 21, stars: 57, best_score: 42000, __bot: 1 },
      { alias: '同关高星', lv: 20, stars: 61, best_score: 30000, __bot: 1 },
    ].sort((a, b) => M.gfBoardCmp('depth', a, b));
    const boardSrc = fnOf(workerSrc, 'gfBoard');
    const merged = /scope\s*!==\s*["']class["']\s*&&\s*scope\s*!==\s*["']rush["']\s*&&\s*await pacersOn/.test(boardSrc)
      && /concat\(pacerRows/.test(boardSrc)
      && /gfBoardCmp\(scope/.test(boardSrc);
    ok('闯关榜并入配速员并共用关卡排序',
       merged && mixed.map(x => x.alias).join(',') === '成长条目,同关高星,普通条目');
  }

  return out;
}

/* node 入口。浏览器里 import 本文件只会拿到上面几个函数，不会跑到这儿。 */
if (typeof process !== 'undefined' && process.argv && process.argv[1]) {
  const fs = await import('node:fs');
  const url = await import('node:url');
  if (process.argv[1] === url.fileURLToPath(import.meta.url)) {
    const here = import.meta.url;
    const src = fs.readFileSync(new URL('./worker.js', here), 'utf8');
    const client = fs.readFileSync(new URL('../match/index.html', here), 'utf8');
    const M = loadFrom(src);
    const hoursNow = Math.floor((Date.now() - M.PACER_EPOCH) / 3600000);
    const res = runChecks(M, hoursNow, client, src);
    let failed = 0;
    for (const r of res) {
      if (!r.pass) failed++;
      console.log(`${r.pass ? 'ok  ' : 'FAIL'} ${r.name}${r.detail ? '  —— ' + r.detail : ''}`);
    }
    console.log(`\n配速员不变量：${res.length - failed}/${res.length} 通过`);
    if (failed) process.exit(1);
  }
}
