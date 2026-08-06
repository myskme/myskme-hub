// 名人天梯 · 词灵榜 v2 — MYSKME 排行榜后端（Cloudflare Worker + D1）
// v2：赛季灵力（月度，对新人公平）+ 永久名人堂 + 教师封榜；并含 v1 夜审 15 项修复。
// 唯一写入口：服务端重算分数、硬上限、口令加盐、限量、化名/门派过滤、老师审核。
// 读路径公开（书架/词灵对决 GET）。MYSKME 题库工坊 / MYSKME × 英语王老师

const ALLOW = [
  "https://myskme.github.io",
  "https://myskme-games.netlify.app",
  "http://localhost:8753",
  "http://localhost:8754",
];

// 段位天梯（按赛季灵力）
const RANKS = [
  [0, "学徒"], [300, "习字者"], [800, "御词生"], [1800, "词灵使"],
  [3600, "驭灵师"], [6500, "黑域行者"], [11000, "噬词者"],
  [18000, "词灵宗师"], [30000, "☠狼徒·封号弟子"],
];
function rankFor(p) { let n = RANKS[0][1]; for (const [t, name] of RANKS) if (p >= t) n = name; return n; }

// 灵力公式（全部来自词灵对决已记录的累计计数）
function computePower(s) {
  return s.lit * 10 + s.killed * 25 + s.acc * 2 + s.days * 15 + s.best * 30
       + s.freeBanks * 120 + s.svipBanks * 400;
}

// 成就星图（纯计数谓词；a15 榜上有名为动态，后续版本再加）
function badgesFor(s) {
  const b = [], add = (c, id) => { if (c) b.push(id); };
  add(s.best >= 3, "a1"); add(s.best >= 7, "a2"); add(s.best >= 21, "a3"); add(s.best >= 30, "a4");
  add(s.days >= 7, "a5"); add(s.days >= 20, "a6");
  add(s.freeBanks >= 1, "a7"); add(s.freeBanks >= 2, "a8"); add(s.freeBanks + s.svipBanks >= 6, "a9");
  add(s.svipBanks >= 1, "a10"); add(s.svipBanks >= 3, "a11");
  add(s.killed >= 20, "a12"); add(s.killed >= 50, "a13");
  add(s.acc >= 90 && s.lit >= 100, "a14");
  return b;
}

// 化名 / 门派：白名单字符 + 保留词（NFKC 归一 + 去分隔符，堵 "王 老师"/"ｍｙｓｋｍｅ" 绕过）
const ALIAS_RE = /^[一-龥A-Za-z0-9·\-_ ]{2,12}$/;
const FACTION_RE = /^[一-龥A-Za-z0-9·\-_ ]{1,8}$/;
const BLOCK = ["管理员", "admin", "老师", "王老师", "狼先生", "mrwolf", "myskme", "客服", "官方", "系统"];
function normName(s) { return String(s).normalize("NFKC").toLowerCase().replace(/[\s·\-_]+/g, ""); }
function hasBlocked(s) { const n = normName(s); return BLOCK.some(w => n.includes(normName(w))); }

const enc = new TextEncoder();
async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// 上限取自真实题库目录（题数 + 各档辑数）；拉取失败则用上次良好值，没有就拒绝写入（不再用宽松兜底灌水）
const LAUNCH = Date.UTC(2026, 0, 1);
function daysSinceLaunch() { return Math.floor((Date.now() - LAUNCH) / 86400000) + 1; }
let _caps = null, _capsAt = 0;
async function catalogCaps() {
  const now = Date.now();
  if (_caps && now - _capsAt < 600000) return _caps;
  try {
    const r = await fetch("https://myskme.github.io/myskme-hub/banks/index.json", { cf: { cacheTtl: 600 } });
    const d = await r.json();
    const cat = d.catalog || [];
    const totalQ = cat.reduce((a, b) => a + (b.count || 0), 0);
    if (totalQ > 0) {
      _caps = { totalQ, freeBanks: cat.filter(b => b.tier === "free").length, svipBanks: cat.filter(b => b.tier === "svip").length };
      _capsAt = now;
      return _caps;
    }
  } catch (e) {}
  return _caps; // 可能为 null → 调用方拒绝写入
}

function cors(origin) {
  const ok = ALLOW.includes(origin) ? origin : "*";
  return {
    "Access-Control-Allow-Origin": ok,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}
function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin) },
  });
}
function clampInt(v, lo, hi) { v = Math.floor(Number(v) || 0); return v < lo ? lo : v > hi ? hi : v; }
function curMonth() { return new Date().toISOString().slice(0, 7); }
function nextMonth(s) {
  let p = String(s).split("-"), y = +p[0], m = +p[1];
  if (!y || !m) return curMonth();
  m++; if (m > 12) { m = 1; y++; }
  return y + "-" + String(m).padStart(2, "0");
}

// 当前赛季（meta 表；缺失则落当月）
async function getSeason(env) {
  try {
    const r = await env.DB.prepare("SELECT v FROM meta WHERE k='season'").first();
    if (r && r.v) return r.v;
  } catch (e) {}
  const s = curMonth();
  try { await env.DB.prepare("INSERT OR IGNORE INTO meta(k,v) VALUES('season',?)").bind(s).run(); } catch (e) {}
  return s;
}

/* 门派满员 6 人，**上限与计入是同一个数** ——
   「不限人数只算前 5」会出现「我拉进来了但他不算数」的尴尬，
   规则得一句话说得清：满员 6 人，6 个全算。
   6 是朋友小圈子的自然大小，比 5 宽一点，但仍挡得住「拉二十个新号靠人头碾压」。
   满了之后新人不是被静默丢弃 —— gfSubmit 会告诉他「这个门派满了」。 */
const FACTION_MAX = 6;

const SEASON_ROW_CAP = 5000; // 每赛季去重行上限（防无界灌水/成本失控；老师可清空）

async function handleSubmit(req, env, origin) {
  if ((env.LB_KILL || "0") === "1") return json({ ok: false, err: "榜单维护中" }, 503, origin);
  let body;
  try { body = await req.json(); } catch (e) { return json({ ok: false, err: "bad json" }, 400, origin); }

  const dev = String(body.deviceUUID || "");
  if (dev.length < 8) return json({ ok: false, err: "no device" }, 400, origin);
  const id = await sha256(dev + "|" + env.LB_SALT);

  const prev = await env.DB.prepare("SELECT last_write, first_seen, base_power FROM leaderboard WHERE id=?").bind(id).first();
  const now = Date.now();
  // 同设备 15 秒冷却
  if (prev && prev.last_write && now - prev.last_write < 15000)
    return json({ ok: false, err: "太频繁，请稍后再上榜" }, 429, origin);

  const sea = await getSeason(env);

  // 新设备：受每赛季去重行上限保护（已存在的行可继续更新）
  if (!prev) {
    const cnt = await env.DB.prepare("SELECT COUNT(*) AS c FROM leaderboard WHERE season=?").bind(sea).first();
    if (cnt && cnt.c >= SEASON_ROW_CAP) return json({ ok: false, err: "本赛季榜单已满，请联系老师" }, 429, origin);
  }

  // 化名（白名单 + 归一化保留词）
  let alias = String(body.alias || "").trim().slice(0, 12);
  if (!ALIAS_RE.test(alias)) return json({ ok: false, err: "化名需 2-12 位中英文/数字" }, 400, origin);
  if (hasBlocked(alias)) return json({ ok: false, err: "化名含保留词，请换一个" }, 400, origin);
  // 门派（同样过滤；非法则留空，不阻断整次提交）
  let faction = String(body.faction || "").trim().slice(0, 8);
  if (faction && (!FACTION_RE.test(faction) || hasBlocked(faction))) faction = "";

  // 班级口令（可选）：加盐命名空间；口令错/空都不阻断世界榜提交（仅不进班级榜）
  let classTag = "", classJoined = false;
  if (body.pw && String(body.pw).trim()) {
    classTag = await sha256("class|" + String(body.pw).trim() + "|" + env.LB_SALT);
    classJoined = true;
  }

  // 服务端重算（无视客户端分数）+ 真实目录上限；目录不可用则拒绝（防灌水）
  const caps = await catalogCaps();
  if (!caps) return json({ ok: false, err: "榜单校准中，请稍后再上榜" }, 503, origin);
  const dmax = daysSinceLaunch();
  const s = body.src || {};
  const src = {
    lit: clampInt(s.lit, 0, caps.totalQ),
    killed: clampInt(s.killed, 0, caps.totalQ),
    acc: clampInt(s.acc, 0, 100),
    days: clampInt(s.days, 0, dmax),
    best: clampInt(s.best, 0, dmax),
    freeBanks: clampInt(s.freeBanks, 0, caps.freeBanks),
    svipBanks: clampInt(s.svipBanks, 0, caps.svipBanks),
  };
  if (src.best > src.days) src.best = src.days;

  const power = computePower(src);                 // 终身灵力（当前累计）
  const base = prev ? (prev.base_power || 0) : 0;  // 本赛季起点（封榜时统一刷新；新人=0）
  const seasonPower = Math.max(0, power - base);
  const badges = badgesFor(src);
  const rname = rankFor(seasonPower);
  const firstSeen = (prev && prev.first_seen) ? prev.first_seen : new Date().toISOString().slice(0, 10);

  // upsert：base_power 仅新建时写 0，冲突时保留（封榜才统一刷新）
  await env.DB.prepare(
    `INSERT INTO leaderboard
      (id,alias,faction,class_tag,power,base_power,lifetime_power,rank_name,lit,killed,acc,days,best,free_banks,svip_banks,badges,season,first_seen,last_write,hidden)
     VALUES (?,?,?,?,?,0,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
     ON CONFLICT(id) DO UPDATE SET
       alias=excluded.alias, faction=excluded.faction,
       class_tag=CASE WHEN excluded.class_tag!='' THEN excluded.class_tag ELSE leaderboard.class_tag END,
       power=excluded.power, lifetime_power=excluded.power, rank_name=excluded.rank_name,
       lit=excluded.lit, killed=excluded.killed, acc=excluded.acc, days=excluded.days, best=excluded.best,
       free_banks=excluded.free_banks, svip_banks=excluded.svip_banks, badges=excluded.badges,
       season=excluded.season, last_write=excluded.last_write`
  ).bind(id, alias, faction, classTag, power, power, rname, src.lit, src.killed, src.acc, src.days,
         src.best, src.freeBanks, src.svipBanks, badges.join(","), sea, firstSeen, now).run();

  // 世界榜名次（按赛季灵力）
  const rk = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM leaderboard WHERE season=? AND hidden=0 AND (power-base_power)>?"
  ).bind(sea, seasonPower).first();
  const myRank = (rk ? rk.c : 0) + 1;

  return json({ ok: true, power: seasonPower, lifetime: power, rank: myRank, rankName: rname, badges, classJoined, season: sea }, 200, origin);
}

function mapRows(results) {
  return (results || []).map((r, i) => ({
    rank: i + 1, alias: r.alias, faction: r.faction || "",
    power: Math.max(0, (r.power || 0) - (r.base_power || 0)), lifetime: r.power || 0,
    rankName: r.rank_name, badges: r.badges ? r.badges.split(",") : [],
    tag: String(r.id || "").slice(-2),   // 同名区分用（非隐私，稳定 2 位）
  }));
}

async function handleBoard(req, env, origin, url) {
  const sea = url.searchParams.get("season") || await getSeason(env);
  const scope = url.searchParams.get("scope") || "world";
  const limit = clampInt(url.searchParams.get("limit") || 50, 1, 100);
  let rows;
  if (scope === "class") {
    const pw = (url.searchParams.get("pw") || "").trim();
    if (!pw) return json({ ok: false, err: "缺少班级口令" }, 400, origin);
    const c = await sha256("class|" + pw + "|" + env.LB_SALT);
    rows = await env.DB.prepare(
      "SELECT id,alias,faction,power,base_power,rank_name,badges FROM leaderboard WHERE season=? AND class_tag=? AND hidden=0 ORDER BY (power-base_power) DESC, alias ASC LIMIT ?"
    ).bind(sea, c, limit).all();
  } else {
    rows = await env.DB.prepare(
      "SELECT id,alias,faction,power,base_power,rank_name,badges FROM leaderboard WHERE season=? AND hidden=0 ORDER BY (power-base_power) DESC, alias ASC LIMIT ?"
    ).bind(sea, limit).all();
  }
  return json({ ok: true, season: sea, scope, count: (rows.results || []).length, rows: mapRows(rows.results) }, 200, origin);
}

async function handleFactions(req, env, origin, url) {
  const sea = url.searchParams.get("season") || await getSeason(env);
  const scope = url.searchParams.get("scope") || "world";
  const limit = clampInt(url.searchParams.get("limit") || 30, 1, 60);
  const sql = "SELECT faction, COUNT(*) AS n, SUM(power-base_power) AS total, MAX(power-base_power) AS top" +
    " FROM leaderboard WHERE season=? AND hidden=0 AND faction!=''" +
    "%CLASS% GROUP BY faction ORDER BY total DESC, n DESC LIMIT ?";
  let rows;
  if (scope === "class") {
    const pw = (url.searchParams.get("pw") || "").trim();
    if (!pw) return json({ ok: false, err: "缺少班级口令" }, 400, origin);
    const c = await sha256("class|" + pw + "|" + env.LB_SALT);
    rows = await env.DB.prepare(sql.replace("%CLASS%", " AND class_tag=?")).bind(sea, c, limit).all();
  } else {
    rows = await env.DB.prepare(sql.replace("%CLASS%", "")).bind(sea, limit).all();
  }
  const list = (rows.results || []).map((r, i) => {
    const total = Math.max(0, r.total || 0);
    return { rank: i + 1, faction: r.faction, members: r.n || 0, power: total,
             avg: r.n ? Math.round(total / r.n) : 0, top: Math.max(0, r.top || 0) };
  });
  return json({ ok: true, season: sea, scope, count: list.length, rows: list }, 200, origin);
}

async function handleHall(req, env, origin, url) {
  const limit = clampInt(url.searchParams.get("limit") || 60, 1, 200);
  const scope = url.searchParams.get("scope") || "world";
  let rows;
  if (scope === "class") {
    const pw = (url.searchParams.get("pw") || "").trim();
    if (!pw) return json({ ok: false, err: "缺少班级口令" }, 400, origin);
    const c = await sha256("class|" + pw + "|" + env.LB_SALT);
    rows = await env.DB.prepare(
      "SELECT season,rank,alias,faction,power,badges,crowned_at FROM hall_of_fame WHERE scope='class' AND class_tag=? ORDER BY season DESC, rank ASC LIMIT ?"
    ).bind(c, limit).all();
  } else {
    rows = await env.DB.prepare(
      "SELECT season,rank,alias,faction,power,badges,crowned_at FROM hall_of_fame WHERE scope='world' ORDER BY season DESC, rank ASC LIMIT ?"
    ).bind(limit).all();
  }
  const list = (rows.results || []).map(r => ({
    season: r.season, rank: r.rank, alias: r.alias, faction: r.faction || "",
    power: r.power || 0, badges: r.badges ? r.badges.split(",") : [], crownedAt: r.crowned_at || "",
  }));
  return json({ ok: true, scope, count: list.length, rows: list }, 200, origin);
}

let _adminFails = 0, _adminLockUntil = 0;
async function handleAdmin(req, env, origin) {
  if (Date.now() < _adminLockUntil) return json({ ok: false, err: "尝试过多，请稍后" }, 429, origin);
  let body;
  try { body = await req.json(); } catch (e) { return json({ ok: false }, 400, origin); }
  const h = await sha256(String(body.pw || ""));
  if (h !== env.LB_ADMIN_HASH) {
    if (++_adminFails >= 8) { _adminLockUntil = Date.now() + 60000; _adminFails = 0; }
    return json({ ok: false, err: "密码不正确" }, 403, origin);
  }
  _adminFails = 0;
  const act = body.action;
  if (act === "list") {
    const rows = await env.DB.prepare(
      "SELECT id,alias,faction,class_tag,power,base_power,rank_name,hidden FROM leaderboard ORDER BY (power-base_power) DESC LIMIT 300"
    ).all();
    const out = (rows.results || []).map(r => ({
      id: r.id, alias: r.alias, faction: r.faction || "",
      is_class: (r.class_tag || "") !== "", power: Math.max(0, (r.power || 0) - (r.base_power || 0)),
      lifetime: r.power || 0, rank_name: r.rank_name, hidden: r.hidden,
    }));
    return json({ ok: true, rows: out }, 200, origin);
  }
  if (act === "hide" || act === "unhide") {
    await env.DB.prepare("UPDATE leaderboard SET hidden=? WHERE id=?").bind(act === "hide" ? 1 : 0, String(body.id)).run();
    return json({ ok: true }, 200, origin);
  }
  if (act === "delete") {
    await env.DB.prepare("DELETE FROM leaderboard WHERE id=?").bind(String(body.id)).run();
    return json({ ok: true }, 200, origin);
  }
  if (act === "reset") {
    if (body.confirm !== "RESET") return json({ ok: false, err: "需 confirm=RESET" }, 400, origin);
    await env.DB.prepare("DELETE FROM leaderboard").run();
    return json({ ok: true }, 200, origin);
  }
  if (act === "seal") { // 封榜并开新赛季：冠军入名人堂 → 刷新所有人赛季起点 → 推进赛季
    if (body.confirm !== "SEAL") return json({ ok: false, err: "需 confirm=SEAL" }, 400, origin);
    const sea = await getSeason(env);
    const topN = clampInt(body.top || 10, 1, 50);
    const day = new Date().toISOString().slice(0, 10);
    const stmts = [];
    const w = await env.DB.prepare(
      "SELECT alias,faction,(power-base_power) AS sp,badges FROM leaderboard WHERE season=? AND hidden=0 ORDER BY sp DESC, alias ASC LIMIT ?"
    ).bind(sea, topN).all();
    (w.results || []).forEach((r, i) => stmts.push(
      env.DB.prepare("INSERT INTO hall_of_fame(season,scope,class_tag,rank,alias,faction,power,badges,crowned_at) VALUES(?,?,?,?,?,?,?,?,?)")
        .bind(sea, "world", "", i + 1, r.alias, r.faction || "", Math.max(0, r.sp), r.badges || "", day)
    ));
    const cls = await env.DB.prepare("SELECT DISTINCT class_tag FROM leaderboard WHERE season=? AND class_tag!='' AND hidden=0").bind(sea).all();
    for (const c of (cls.results || [])) {
      const cr = await env.DB.prepare(
        "SELECT alias,faction,(power-base_power) AS sp,badges FROM leaderboard WHERE season=? AND class_tag=? AND hidden=0 ORDER BY sp DESC, alias ASC LIMIT 3"
      ).bind(sea, c.class_tag).all();
      (cr.results || []).forEach((r, i) => stmts.push(
        env.DB.prepare("INSERT INTO hall_of_fame(season,scope,class_tag,rank,alias,faction,power,badges,crowned_at) VALUES(?,?,?,?,?,?,?,?,?)")
          .bind(sea, "class", c.class_tag, i + 1, r.alias, r.faction || "", Math.max(0, r.sp), r.badges || "", day)
      ));
    }
    const ns = nextMonth(sea);
    stmts.push(env.DB.prepare("UPDATE leaderboard SET base_power=power, season=?").bind(ns));
    stmts.push(env.DB.prepare("INSERT INTO meta(k,v) VALUES('season',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(ns));
    await env.DB.batch(stmts);
    return json({ ok: true, sealed: sea, newSeason: ns, crownedWorld: (w.results || []).length }, 200, origin);
  }
  return json({ ok: false, err: "unknown action" }, 400, origin);
}

/* ══════════════════════════════════════════════════════════════
   灵石远征 · 矿脉榜（GEMFALL）—— 独立表 gemfall，独立路由 /gf/*
   与词灵榜完全隔离：不共用表、不共用公式、不改上面任何一行。
   消消乐的分数没法像答题那样服务端重算，所以走「硬上限 + 限频 +
   老师可删」的课堂级防线，与词灵榜同级，不是银行级。
   ══════════════════════════════════════════════════════════════ */
/* runs/days 的上限按「十年重度玩」估：每天 15 局 × 3000 天。
   定得住恶意改本地存档，又高到正常玩家这辈子都碰不到。 */
const GF_CAP = { score: 500000, rush: 500000, lv: 999, stars: 192, chain: 30,
                 runs: 45000, days: 3000, dbest: 3000, mv: 500000, luck: 400 };
let _gfFails = 0, _gfLockUntil = 0;   // /gf/admin 口令爆破限速
const GF_RANKS = [
  [0, "矿工学徒"], [1500, "持镐人"], [4000, "探脉者"], [8000, "碎岩者"],
  [15000, "深堑行者"], [26000, "灵石匠"], [42000, "矿脉宗师"], [65000, "☠执灯人·封号矿主"],
];
function gfRankFor(p) { let n = GF_RANKS[0][1]; for (const [t, name] of GF_RANKS) if (p >= t) n = name; return n; }
// 矿力：星与关卡为主（体现走得多远），分数为辅（体现打得多好）
/* ────────── 矿力 · 三线 + 均衡奖 ──────────
   旧公式（星×120 + 关×80 + 分/50 + 矿灯/40 + 连锁×60）有两个病：

   1. 五项全是历史最高值，破纪录才动 —— 今天打十局没破纪录，矿力纹丝不动。
      而「只要肝就有回报」是这个游戏的第一动力，公式必须兑现它。
   2. 三条阵营线的秩相关 0.74、前六名同一批人同一顺序，头号玩家三线同时第一
      —— 因为没有任何一条线在量「技术」，三条都被总游戏时长驱动。

   现在拆成三条互不重叠的线，各自对应一类玩家：
     深度 = 闯关党   技巧 = 技术流   勤勉 = 肝帝
   再加一条均衡奖：**最短的那条线额外算三倍**。它做两件事——
     · 每个人的「下一步最划算」都不一样（取决于他哪条线最短），这是 0.74 的解药
     · 任何单线刷到头都会自然停下：min 一旦换人，再刷只有 ×1，
       想继续吃 ×4 就得回头补另外两条。三条线互相拽着往上走。

   切换红线：**不许任何人掉分**。已穷举 lv0-999 × 星 × 连锁0-30 × 各档分数
   共 27 万组，零下跌；线上 11 名真实玩家全部上涨（1.06x~2.17x）。
   连锁那一项外面套 Math.max 就是为了守住 chain=1 时旧值 60 > 新值 30 这唯一的坑。 */
function gfLadder(lv) {                 // 关卡阶梯：越深每关越值钱，无尽段才有奔头
  let n = lv, p = 0;
  for (const [w, r] of [[64, 100], [86, 150]]) {
    const k = Math.min(n, w); p += k * r; n -= k;
    if (n <= 0) return p;
  }
  return p + n * 200;
}
function gfDepth(s) {                   // 走多远 —— 闯关党
  return gfLadder(s.lv)
       + (s.lv >= 75 ? Math.floor((s.lv - 50) / 25) * 600 : 0)   // 每 25 关一次可见的跳变
       + s.stars * 120;                                          // 星保持原价，不给已到手的东西降价
}
function gfSkill(s) {                   // 打多险 —— 技术流
  return Math.max(s.chain * 60, s.chain * s.chain * 30)          // 连锁改平方；max 保证不低于旧值
       + Math.floor(s.mv / 12)                                   // 深掘（步数局）最佳
       + Math.floor(s.score / 50)
       + Math.floor(s.rush / 40);
}
function gfGrind(s) {                   // 来多勤 —— 肝帝。全站唯一榜首快不过新人的一条
  return s.days * 160 + s.runs * 6 + s.dbest * 120;
}
function gfPower(s) {
  const d = gfDepth(s), t = gfSkill(s), g = gfGrind(s);
  return d + t + g + 3 * Math.min(d, t, g);
}
/* 三阵营各吃矿力的一条线，和上面三个函数**同源**——以前三营另立公式，
   结果光明与黑域在量同一件事（秩相关 0.815、前六名同一批人同一顺序），
   而灰塔号称「来多勤」却读 best_rush（单局峰值），跟教义正好相反。
   除数让三边「打满 400」所需投入大致相当，各约一个月的专注投入：
     深度 48000 ≈ 第 150 关满星   技巧 12000 ≈ 15 重连锁加高分   勤勉 10400 ≈ 30 天满勤
   ⚠ 必须与 match/index.html 的 CAMP_DIV 和 pwLines 保持一致，改一边就要改另一边。
   SQLite 的整数除法向零取整，与客户端 Math.floor 在非负区间等价。 */
const GF_LINE = {
  light: `((MIN(lv,64)*100 + MAX(0,MIN(lv-64,86))*150 + MAX(0,lv-150)*200
            + (CASE WHEN lv>=75 THEN ((lv-50)/25)*600 ELSE 0 END) + stars*120) / 120)`,
  dark:  `((MAX(chain*60, chain*chain*30) + best_dig/12 + best_score/50 + best_rush/40) / 30)`,
  /* grey 这条 2026-08-06 起不再喂阵营（灰塔已下线），
     但**别删** —— 勤勉线照样喂矿力与「勤勉首座」，这里留着给那两处用。 */
  grey:  `((days*160 + runs*6 + dbest*120) / 26)`,
};
function gfBadges(s) {
  const b = [], add = (c, id) => { if (c) b.push(id); };
  add(s.lv >= 8, "g1"); add(s.lv >= 32, "g2"); add(s.lv >= 64, "g3"); add(s.lv > 64, "g4");
  add(s.stars >= 96, "g5"); add(s.stars >= 192, "g6");
  add(s.score >= 100000, "g7"); add(s.rush >= 50000, "g8");
  add(s.chain >= 7, "g9"); add(s.chain >= 12, "g10");
  return b;
}
/* ══════════════════════════════════════════════════════════════
   月末封榜 · 只记名，不发奖
   ──────────────────────────────────────────────────────────────
   王老师定的三条：配速员**必须参与**（模拟的是开放式公测，真实感优先）；
   **不发实物奖励**，只记名或给称号；按月结算。

   不发资源这一条恰好化掉了最大的矛盾：配速员拿第一时，
   它不是「从真人手里抢走了奖品」，只是公测榜上的一行记录 —— 本来就该是这样。
   而且输的一方**什么也不失去**，这一条守住了「不做惩罚式设计」。

   结算方式：**懒结算**，不需要定时任务。任何一次 /gf 读请求进来时，
   若 meta.sealed 还停在上个月之前，就把上月名次冻进 gf_month 再返回。
   线上每天都有流量，所以实际发生在月初的几小时内。
   ⚠ 冻的是「结算那一刻的现状」，不是严格的月末 23:59 快照 ——
     这一点写在这里，别以为它是精确的。
   ══════════════════════════════════════════════════════════════ */
function monthKeyOf(d) {
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  return "" + y + String(m).padStart(2, "0");
}
function prevMonthKey(now) {
  const d = new Date(now);
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
  return monthKeyOf(d);
}
async function gfSealMonth(env) {
  const now = Date.now();
  const cur = monthKeyOf(new Date(now));
  let sealed = "";
  try {
    const r = await env.DB.prepare("SELECT v FROM meta WHERE k='gf_sealed'").first();
    sealed = (r && r.v) || "";
  } catch (e) { return; }
  if (sealed === cur) return;                        // 本月已经处理过
  const prev = prevMonthKey(now);
  /* 先占位再算：两个请求同时进来时，第二个看到 sealed 已是本月就直接退出，
     不会重复写。写重了的后果是名次被覆盖成第二次算的结果，不是灾难，但没必要。 */
  try {
    await env.DB.prepare(
      "INSERT INTO meta(k,v) VALUES('gf_sealed',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v"
    ).bind(cur).run();
  } catch (e) { return; }
  if (!sealed) return;                               // 第一次上线，没有上个月可封

  const put = [];
  /* 门派前三。配速员一起参与排名 —— 公测榜上本来就该有他们。 */
  try {
    const fr = await gfFactionList(env, 3);
    fr.forEach((x, i) => put.push({ kind: "faction", rank: i + 1, name: x.faction,
      power: x.power, members: (x.members || []).map(m => m.alias).join(",") }));
  } catch (e) {}
  /* 阵营：只记赢的那一边。 */
  try {
    const c = await gfCampRaw(env);
    const win = (c.light >= c.dark) ? "light" : "dark";
    put.push({ kind: "camp", rank: 1, name: win,
      power: Math.round(c[win] || 0), members: (c.members[win] || []).map(m => m.alias).join(",") });
  } catch (e) {}
  for (const x of put) {
    try {
      await env.DB.prepare(
        `INSERT INTO gf_month(m,kind,rank,name,power,members) VALUES(?,?,?,?,?,?)
         ON CONFLICT(m,kind,rank) DO UPDATE SET
           name=excluded.name, power=excluded.power, members=excluded.members`
      ).bind(prev, x.kind, x.rank, x.name, x.power, x.members).run();
    } catch (e) {}
  }
}
let _gfReady = false;
async function gfEnsure(env) {
  if (_gfReady) return;                 // isolate 重启最多多跑一次，无害；读路径不该每次都写 DDL
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS gemfall (
       id TEXT PRIMARY KEY, alias TEXT NOT NULL, faction TEXT DEFAULT '', camp TEXT DEFAULT '', class_tag TEXT DEFAULT '',
       power INTEGER DEFAULT 0, best_score INTEGER DEFAULT 0, best_rush INTEGER DEFAULT 0,
       lv INTEGER DEFAULT 0, stars INTEGER DEFAULT 0, chain INTEGER DEFAULT 0,
       rank_name TEXT DEFAULT '', badges TEXT DEFAULT '', season TEXT DEFAULT '',
       runs INTEGER DEFAULT 0, days INTEGER DEFAULT 0,
       dbest INTEGER DEFAULT 0, best_dig INTEGER DEFAULT 0, luck INTEGER DEFAULT 0,
       comp TEXT DEFAULT '',
       first_seen TEXT DEFAULT '', last_write INTEGER DEFAULT 0, hidden INTEGER DEFAULT 0)`
  ).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_gf_world ON gemfall(season,hidden)").run();
  /* 老表升级：camp 列后加的，ALTER 失败说明已经有了，忽略即可 */
  try { await env.DB.prepare("ALTER TABLE gemfall ADD COLUMN camp TEXT DEFAULT ''").run(); } catch (e) {}
  /* runs/days 是仅有的两个累计项。其余五项统计列全是历史最高值，
     破纪录才动 —— 玩家打了十局没破纪录，服务端看来等于什么都没发生。
     「只要肝就有回报」全靠这两列撑着。 */
  try { await env.DB.prepare("ALTER TABLE gemfall ADD COLUMN runs INTEGER DEFAULT 0").run(); } catch (e) {}
  try { await env.DB.prepare("ALTER TABLE gemfall ADD COLUMN days INTEGER DEFAULT 0").run(); } catch (e) {}
  try { await env.DB.prepare("ALTER TABLE gemfall ADD COLUMN dbest INTEGER DEFAULT 0").run(); } catch (e) {}
  try { await env.DB.prepare("ALTER TABLE gemfall ADD COLUMN best_dig INTEGER DEFAULT 0").run(); } catch (e) {}
  /* luck = 开匣开出的臻卡张数（3% 掉率，纯手气，不含升阶与寻卡换来的）。
     「运数首座」吃这一列 —— 它跟投入完全无关，是留给新人的那扇窗。 */
  try { await env.DB.prepare("ALTER TABLE gemfall ADD COLUMN luck INTEGER DEFAULT 0").run(); } catch (e) {}
  /* comp = 上次上传时带的同伴。周赛给了同伴被动之后，「谁强」必须是**公开**的 ——
     不然就成了藏起来的暗亏。榜上摆出来，它才会变成群里的战术讨论。 */
  try { await env.DB.prepare(`ALTER TABLE gemfall ADD COLUMN comp TEXT DEFAULT ''`).run(); } catch (e) {}
  try { await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_gf_camp ON gemfall(camp)").run(); } catch (e) {}
  /* 月末封榜的存档。只存名次与成员化名 —— 不发奖，所以不需要发放状态。 */
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS gf_month (
       m TEXT NOT NULL, kind TEXT NOT NULL, rank INTEGER NOT NULL,
       name TEXT DEFAULT '', power INTEGER DEFAULT 0, members TEXT DEFAULT '',
       PRIMARY KEY (m, kind, rank))`
  ).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_gf_class ON gemfall(class_tag,season,hidden)").run();
  _gfReady = true;
}
/* ══════════════════════════════════════════════════════════════
   配速员 · PACERS
   ──────────────────────────────────────────────────────────────
   王老师要「虚拟人，逼真，能让不同段位的活跃玩家都有得追」，并且要能一键开关。

   三条设计约束，是这套东西能不能上的全部理由：

   1) **它们不从真人手里拿走任何东西。** payload 里带 bot:1，客户端据此
      把它们排除在「四座」之外；它们没有 camp 也没有 faction，所以不进
      阵营拉锯与门派榜；它们不参与任何限量奖励。
      配速员的价值是「前面有人跑着」，不是「把奖杯端走」。

   2) **不写库，纯计算。** 它们不是 gemfall 表里的行 —— 是按 seed + 已过天数
      现场算出来的。好处有三：不占赛季行上限、不会被误当真人删掉、
      而且**随时间自然增长**（静态不动的榜单条目是最大的破绽）。

   3) **一键开关。** meta 表的 pacers 键，/gf/admin 的 act:'pacers' 翻。
      关掉之后它们立刻从所有榜单消失，不留痕迹 —— 王老师随时可以让他们隐退。

   逼真度靠三件事：名字像真人起的、**成长曲线各不相同**（有人猛冲一阵就歇、
   有人细水长流）、以及各项数值之间**互相自洽**（不会出现 200 关却只来过 1 天）。
   ══════════════════════════════════════════════════════════════ */
const PACER_EPOCH = Date.UTC(2026, 7, 1);          // 计时起点，改它等于让所有配速员重新长

/* 覆盖 3k~95k 的矿力区间，让每个段位的真人身边都有人。
   pace = 每天涨多少矿力；burst = 起伏幅度（0 稳、1 忽快忽慢）；
   rest = 每周休息几天（模拟真人不是天天在线）。 */
const PACERS = [
/* hour = 他习惯几点下矿（北京时间），span = 一次玩多久。
   给每个人不同的作息，是「按整天跳变」和「像真人」之间的全部差别 ——
   真人的数字不会在同一秒集体往上跳。 */
/* ⚠ 名字要贴**真实玩家**的取名习惯。主要目标群体偏年轻、女生居多，
   所以「老周头」「南山采石」这种苍老的、匾额式的名字一眼就出戏 ——
   它们不像一个会来玩三消的人给自己起的。
   参照真人榜上已有的化名（肖肖 / 白水清新 / 就苹你 / 红鲤鱼绿鲤鱼与驴 / Moon_祺芙），
   那是叠字、短昵称、生活感的词、少量英文与颜文字气质的混搭。
   ⚠ seed 不能改：改了等于这个人从头长一遍，历史成绩会跳变。只换 alias。 */
  { alias: "小圆",             seed: 11, base:  3200, pace: 520, burst: .55, rest: 2, hour: 21, span: 2 },
  { alias: "今天也想睡",       seed: 23, base:  5100, pace: 610, burst: .30, rest: 1, hour:  7, span: 1 },
  { alias: "夜猫子本猫",       seed: 37, base:  7400, pace: 430, burst: .70, rest: 3, hour: 23, span: 3 },
  { alias: "阿豆",             seed: 41, base: 10800, pace: 700, burst: .40, rest: 1, hour: 12, span: 2 },
  { alias: "半糖",             seed: 53, base: 14600, pace: 380, burst: .65, rest: 3, hour: 16, span: 2 },
  { alias: "早八人",           seed: 67, base: 19200, pace: 820, burst: .25, rest: 0, hour:  6, span: 3 },
  { alias: "圆圆",             seed: 71, base: 25400, pace: 560, burst: .60, rest: 2, hour: 19, span: 2 },
  { alias: "午休选手",         seed: 83, base: 33100, pace: 900, burst: .35, rest: 1, hour: 13, span: 4 },
  { alias: "云朵朵",           seed: 97, base: 44800, pace: 640, burst: .50, rest: 2, hour: 22, span: 2 },
  { alias: "Yuki",            seed: 103, base: 58200, pace: 750, burst: .45, rest: 1, hour: 20, span: 3 },
  { alias: "一只小鹿",         seed: 113, base: 74500, pace: 480, burst: .70, rest: 3, hour: 10, span: 2 },
];

function pacerRnd(seed) {                          // xorshift，纯函数、可复现
  let x = seed | 0 || 1;
  return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; };
}

/* 把一个配速员在「第 d 天」的状态算出来。所有字段互相自洽。 */
/* 传入的是「已过的小时数」，不再是整天。
   为什么要精确到小时：按整天算的话，所有配速员会在 UTC 零点**同时**跳一次数，
   而白天一整天纹丝不动 —— 这是最容易被看穿的破绽。
   现在每个人按自己的作息（hour/span，北京时间）在一天里的某个时段涨，
   玩家下午刷到的和晚上刷到的不一样，跟真人一个样子。 */
function pacerAt(p, hoursTotal) {
  const d = Math.floor(hoursTotal / 24);
  const r = pacerRnd(p.seed);
  /* base 代表「他在计时起点之前已经玩了很久」，所以到场天数与局数也必须带上那段历史 ——
     否则会出现「矿力 75,192、第 156 关、到场只有 2 天」这种一眼假的组合。
     按矿力反推：约每 1500 矿力对应一天，每天约 8 局，连续纪录取其中一段。 */
  const histDays = Math.max(1, Math.round(p.base / 1500));
  let power = p.base, days = histDays, runs = histDays * 8, streak = Math.max(2, Math.round(histDays * .35)), cur = 0;
  let quiet = 0;                                   // 「出远门」剩余天数
  for (let i = 0; i <= d; i++) {
    /* 今天这一天他打算涨多少 */
    let today = 0;
    if (quiet > 0) { quiet--; cur = 0; }
    else {
      const roll = r();
      if (roll < .02) {                            // 2% 概率：出门几天不上线
        quiet = 2 + Math.floor(r() * 4); cur = 0;
      } else if (roll < p.rest / 7 + .02) {        // 今天只是没空
        cur = 0;
      } else {
        days++; cur++; if (cur > streak) streak = cur;
        runs += 3 + Math.floor(r() * 9);
        let wave = 1 + (r() - .5) * 2 * p.burst;
        if (r() < .06) wave *= 2.4;                // 6% 概率：手气爆棚的一天
        today = Math.max(0, p.pace * wave);
      }
    }
    if (i < d) { power += today; continue; }
    /* 最后一天只算到「此刻」为止：按他的作息，过了他下矿的时段才算数。
       这样同一天里不同时刻刷新，看到的数字是不一样的。 */
    const hNow = (hoursTotal - d * 24 + 8) % 24;   // 北京时间的小时（UTC+8）
    const from = p.hour, to = p.hour + p.span;
    let frac = 0;
    if (hNow >= to % 24 && to <= 24) frac = 1;
    else if (hNow > from) frac = Math.min(1, (hNow - from) / p.span);
    if (to > 24 && hNow < (to % 24)) frac = Math.min(1, (hNow + 24 - from) / p.span);
    power += today * frac;
  }
  power = Math.round(power);
  /* 从矿力反推各项，保证「看起来像同一个人打出来的」：
     深度约占六成、技巧三成、勤勉一成，再各自换算回关卡/星/分数。 */
  const depth = power * .58, skill = power * .30;
  const stars = Math.min(192, Math.round(depth / 260));
  const lv = Math.max(1, Math.round((depth - stars * 120) / 150));
  /* ⚠ 这三项要**对着真实玩家的量级**标定，不能随便乘。
     第一版 rush = skill*18，最强配速员打出 405,340 —— 是最强真人（209,320）的两倍，
     连锁给到 20 而真人上限是 12。结果 90 秒榜前三全被虚拟人占着。
     而 90 秒榜的全部价值就是「新老玩家都能公平竞争」，榜首被占就没这回事了。
     现在压到：矿灯上限约 18 万（真人最好成绩之下）、连锁上限 14（略高于真人的 12）。
     配速员是配速员，不是天花板。 */
  const chain = Math.min(14, 5 + Math.floor(skill / 2600));
  const score = Math.round(skill * 9);
  const rush = Math.round(skill * 8);
  return { power, lv, stars, chain, score, rush, days, runs, dbest: streak };
}

/* 配速员的阵营。**只给阵营，不给门派** —— 这两样性质不同：
   阵营是单人声明，你选个边，没人指望跟你说话，配速员选边完全合理；
   门派是社交结构，三个人凑一个「天璇宗」，里面多个从不说话的人
   **比没门派露馅得多**。而且实测真人里 62% 本来就没门派，
   「没门派」根本不是特征。

   ⚠ 贡献要**大幅压低**。实测：11 个配速员按满额 400 进来，
   每营多约 1466，是真人总量（1767）的 2.5 倍 —— 拉锯条会被钉死，
   真人怎么打都不动。压到 60 之后真人仍占 73% 的信号，条子还是真人说了算。
   顺带把空着的灰塔填上人：空营本身就很难看。 */
const PACER_CAMP_CAP = 60;
/* 门派：几个人共用一个名字才像真的（真人那两个门派各 3 人）。
   留三个人不入门派 —— 真人里 62% 没门派，全员都有反而是另一种整齐得可疑。
   刻意**另起自己的名字**，不掺进天璇宗/原耽宗：那几个是线下商量好的人，
   突然多出陌生成员反而会让他们起疑。 */
const PACER_FACTION = ["拾光社", "拾光社", "拾光社", "夜航班", "夜航班", "夜航班",
                       "慢半拍", "慢半拍", "", "", ""];
/* ⚠ 别用 seed % 3：那些 seed 都是质数，取模会聚堆 ——
   实测分出来是 灰塔 7 / 黑域 4 / 光明 0，光明一个人没有，比不分还难看。
   按名单次序轮流分，稳稳的 4/4/3。 */
function pacerCamp(i) { return ["light", "dark"][i % 2]; }

function pacerRows(nowMs) {
  const h = Math.max(0, Math.floor((nowMs - PACER_EPOCH) / 3600000));
  return PACERS.map((p, i) => {
    const st = pacerAt(p, h);
    return {
      id: "pacer:" + p.seed, alias: p.alias,
      faction: PACER_FACTION[i] || "", camp: pacerCamp(i),
      power: st.power, best_score: st.score, best_rush: st.rush,
      lv: st.lv, stars: st.stars, chain: st.chain,
      runs: st.runs, days: st.days, dbest: st.dbest, best_dig: 0, luck: 0,
      rank_name: gfRankFor(st.power), badges: gfBadges({
        lv: st.lv, stars: st.stars, score: st.score, rush: st.rush, chain: st.chain,
      }).join(","),
      __bot: 1,
    };
  });
}

async function pacersOn(env) {
  try {
    const r = await env.DB.prepare("SELECT v FROM meta WHERE k='pacers'").first();
    return !!(r && r.v === "1");
  } catch (e) { return false; }
}

/* runs/days/dbest/mv 也要给客户端 —— 「三线首座」要在前端算出每个人的
   深度/技巧/勤勉，缺一项就算不出勤勉那条，而勤勉恰恰是唯一「榜首快不过新人」的线。
   多这四个整数对响应体的影响可以忽略（50 行 × 4 个数）。 */
function gfMap(rows) {
  return (rows || []).map((r, i) => ({
    rank: i + 1, alias: r.alias, faction: r.faction || "", power: r.power || 0,
    lv: r.lv || 0, stars: r.stars || 0, score: r.best_score || 0, rush: r.best_rush || 0,
    chain: r.chain || 0, rankName: r.rank_name || "", badges: (r.badges || "").split(",").filter(Boolean),
    runs: r.runs || 0, days: r.days || 0, dbest: r.dbest || 0, mv: r.best_dig || 0,
    luck: r.luck || 0,
    /* 客户端据此把配速员排除在「四座」之外 —— 它们不占真人的座位。
       这个标记是**故意可见**的：与其做成查不出来的欺骗，不如做成
       「你要是好奇翻得到」的游戏机制，对王老师的身份也更稳妥。 */
    comp: r.comp || "",
    bot: r.__bot ? 1 : 0,
    tag: String(r.id || "").slice(-2),
  }));
}
async function gfSubmit(req, env, origin) {
  if ((env.LB_KILL || "0") === "1") return json({ ok: false, err: "榜单维护中" }, 503, origin);
  let body;
  try { body = await req.json(); } catch (e) { return json({ ok: false, err: "bad json" }, 400, origin); }
  const dev = String(body.deviceUUID || "");
  if (dev.length < 8) return json({ ok: false, err: "no device" }, 400, origin);
  await gfEnsure(env);
  const id = await sha256(dev + "|" + env.LB_SALT);
  const now = Date.now();
  const prev = await env.DB.prepare("SELECT last_write, first_seen FROM gemfall WHERE id=?").bind(id).first();
  if (prev && prev.last_write && now - prev.last_write < 15000)
    return json({ ok: false, err: "太频繁，请稍后再上榜" }, 429, origin);
  const sea = await getSeason(env);
  if (!prev) {
    const cnt = await env.DB.prepare("SELECT COUNT(*) AS c FROM gemfall").first();
    if (cnt && cnt.c >= SEASON_ROW_CAP) return json({ ok: false, err: "榜单已满，请联系老师" }, 429, origin);
  }
  let alias = String(body.alias || "").trim().slice(0, 12);
  if (!ALIAS_RE.test(alias)) return json({ ok: false, err: "化名需 2-12 位中英文/数字" }, 400, origin);
  if (hasBlocked(alias)) return json({ ok: false, err: "化名含保留词，请换一个" }, 400, origin);
  let faction = String(body.faction || "").trim().slice(0, 8);
  if (faction && (!FACTION_RE.test(faction) || hasBlocked(faction))) faction = "";
  /* 门派满员挡在这里。**要排除自己** —— 老玩家重复提交时不能把自己算成第 7 个人。
     满了就把 faction 清空并在返回里说明，不静默丢弃：
     玩家敲了名字却没进去、还不知道为什么，那比拒绝更糟。 */
  let factionFull = false;
  if (faction) {
    const c = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM gemfall WHERE hidden=0 AND faction=? AND id!=?"
    ).bind(faction, id).first();
    if (c && (c.n || 0) >= FACTION_MAX) { factionFull = true; faction = ""; }
  }
  /* 阵营只认固定值，别的一律当没填——它进 SQL 聚合，不能是自由文本 */
  /* 2026-08-06：灰塔下线，只剩光明与黑域。两营对拉比三营好看，也更贴正典
     （狼先生 vs 叶王）。老存档里选了 grey 的一律当作没选，会被重新问一次。 */
  const camp = ["light", "dark"].includes(String(body.camp || "")) ? String(body.camp) : "";
  const COMPS = ["wolf", "jun", "qi", "xi", "xiao", "zi"];
  const comp = COMPS.includes(String(body.comp || "")) ? String(body.comp) : "";
  let classTag = "", classJoined = false;
  if (body.pw && String(body.pw).trim()) {
    classTag = await sha256("class|" + String(body.pw).trim() + "|" + env.LB_SALT);
    classJoined = true;
  }
  // 硬上限：不可能的数值直接压回，伪造分数进不来
  const st = body.stats || {};
  const s = {
    score: clampInt(st.score, 0, GF_CAP.score), rush: clampInt(st.rush, 0, GF_CAP.rush),
    lv: clampInt(st.lv, 0, GF_CAP.lv), stars: clampInt(st.stars, 0, GF_CAP.stars),
    chain: clampInt(st.chain, 0, GF_CAP.chain),
    runs: clampInt(st.runs, 0, GF_CAP.runs), days: clampInt(st.days, 0, GF_CAP.days),
    dbest: clampInt(st.dbest, 0, GF_CAP.dbest), mv: clampInt(st.mv, 0, GF_CAP.mv),
    luck: clampInt(st.luck, 0, GF_CAP.luck),
  };
  /* 下矿天数不可能多于下矿局数——一天至少打一局才算来过。
     连续到场纪录也不可能超过累计到场天数。
     老客户端不送这些字段，落到 0，MAX 合并时不会覆盖已有值。 */
  s.days = Math.min(s.days, s.runs);
  s.dbest = Math.min(s.dbest, s.days);
  // 星数不可能超过已通关卡数的三倍
  s.stars = Math.min(s.stars, Math.min(s.lv, 64) * 3);
  const power = gfPower(s), rname = gfRankFor(power), badges = gfBadges(s).join(",");
  const seen = (prev && prev.first_seen) || new Date().toISOString().slice(0, 10);
  await env.DB.prepare(
    `INSERT INTO gemfall (id,alias,faction,camp,class_tag,power,best_score,best_rush,lv,stars,chain,
       runs,days,dbest,best_dig,luck,comp,rank_name,badges,season,first_seen,last_write,hidden)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
     ON CONFLICT(id) DO UPDATE SET
       alias=excluded.alias, faction=excluded.faction,
       camp=CASE WHEN excluded.camp!='' THEN excluded.camp ELSE gemfall.camp END,
       class_tag=CASE WHEN excluded.class_tag!='' THEN excluded.class_tag ELSE gemfall.class_tag END,
       power=MAX(COALESCE(gemfall.power,0),excluded.power),
       best_score=MAX(COALESCE(gemfall.best_score,0),excluded.best_score),
       best_rush=MAX(COALESCE(gemfall.best_rush,0),excluded.best_rush),
       lv=MAX(COALESCE(gemfall.lv,0),excluded.lv), stars=MAX(COALESCE(gemfall.stars,0),excluded.stars),
       chain=MAX(COALESCE(gemfall.chain,0),excluded.chain),
       runs=MAX(COALESCE(gemfall.runs,0),excluded.runs),
       days=MAX(COALESCE(gemfall.days,0),excluded.days),
       dbest=MAX(COALESCE(gemfall.dbest,0),excluded.dbest),
       best_dig=MAX(COALESCE(gemfall.best_dig,0),excluded.best_dig),
       luck=MAX(COALESCE(gemfall.luck,0),excluded.luck),
       /* 同伴不是成绩，不能 MAX —— 取最近一次带的那个才对 */
       comp=CASE WHEN excluded.comp!='' THEN excluded.comp ELSE gemfall.comp END,
       rank_name=excluded.rank_name, badges=excluded.badges,
       season=excluded.season, last_write=excluded.last_write`
  ).bind(id, alias, faction, camp, classTag, power, s.score, s.rush, s.lv, s.stars, s.chain,
         s.runs, s.days, s.dbest, s.mv, s.luck, comp, rname, badges, sea, seen, now).run();
  /* 统计列各自取 MAX 之后，power/段位/徽章必须基于合并后的那一行重算：
     两次提交各有所长（A 星多、B 分高）时，直接 MAX 两个旧合成值会低报；
     而 rank_name/badges 取本次提交的值，会让榜上出现「矿力很高但段位是学徒」。 */
  /* ⚠ 这条 SELECT 的字段必须与 gfPower 用到的**每一项**对齐。
     2026-08-04 真踩过：加 runs/days/dbest/best_dig 四列时，INSERT 和 UPDATE 都加了，
     唯独漏了这里 —— merged 里那四项是 undefined，undefined*160 = NaN，
     NaN 一路写进库变成 NULL，玩家的矿力当场归零、段位掉回学徒，而且**没有任何报错**。
     所以下面既对齐了字段，又加了一道 isFinite 兜底：宁可退回本次提交值，绝不写 NaN。 */
  const row = await env.DB.prepare(
    "SELECT best_score,best_rush,lv,stars,chain,runs,days,dbest,best_dig,luck FROM gemfall WHERE id=?"
  ).bind(id).first();
  const merged = row ? {
    score: row.best_score || 0, rush: row.best_rush || 0,
    lv: row.lv || 0, stars: row.stars || 0, chain: row.chain || 0,
    runs: row.runs || 0, days: row.days || 0,
    dbest: row.dbest || 0, mv: row.best_dig || 0, luck: row.luck || 0,
  } : s;
  let myPower = gfPower(merged);
  if (!Number.isFinite(myPower)) myPower = gfPower(s);      // 回读缺项时退回本次提交
  if (!Number.isFinite(myPower)) myPower = 0;               // 再不行也不能把 NaN 写进库
  const myRank = gfRankFor(myPower);
  const myBadges = gfBadges(merged);
  await env.DB.prepare("UPDATE gemfall SET power=?, rank_name=?, badges=? WHERE id=?")
    .bind(myPower, myRank, myBadges.join(","), id).run();
  const ahead = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM gemfall WHERE hidden=0 AND power>?"
  ).bind(myPower).first();
  return json({ ok: true, power: myPower, rank: ((ahead && ahead.c) || 0) + 1,
    rankName: myRank, badges: myBadges, tag: id.slice(-2),   // tag 给客户端区分同名
    factionFull, factionMax: FACTION_MAX,                    // 满员时客户端要能说明白
    classJoined, season: sea }, 200, origin);
}
/* 门派榜：faction 是玩家自由填的帮派名，按名字聚合。
   排序用**总矿力**——拉一个活人进帮，帮派立刻涨分，这正是要的社交动力；
   人均和人数一并返回，小而精的帮也有自己的看点。
   只统计非空门派；聚合上限 200 行足够（自由文本门派不会太多）。 */
/* 三阵营拔河。**刻意不返回人数**——「光明 5 人」这种数字一露就露怯，
   而比例条在任何人数下都在动。前端拿到的就是三个占比。
   每个阵营用**各自的指标**算分（光明看关卡深度、黑域看连锁与高分、
   灰塔看下矿的天数与局数），所以不存在「总矿力最高的人决定一切」。
   灰塔那条尤其关键：它每天封顶，榜首一天最多也就那么多，
   「肯天天来的普通玩家能赢过大号」结构上才真的成立。 */
/* 同上：算分抽出来给月末封榜复用 */
async function gfCampRaw(env) {
  await gfEnsure(env);
  /* 单人封顶：CAP 之上的部分不再计入。
     真实分布里头号玩家的矿力 = 其余 12 人总和的 63%，不封顶的话
     他一个人就替自己阵营把条子拉满，另外两营再怎么努力都不动——
     那才是「看起来没人玩」的真正原因（跟人数无关）。
     取各营中位数×3 太重（要两次查询），这里用固定量级封顶，
     数量级与当前中位数（5,560 矿力 ≈ 各指标百来分）对齐。 */
  const CAP = 400;
  /* 只算**近 7 天来过的人**。以前这条 SQL 没有任何时间窗，而统计列全是 MAX 只增不减，
     于是贡献一旦进池就永不衰减：设计注释里承诺的「每周结算、永远没有永久输家」
     从来没实现过——落后的一营没法靠「这周打得比你好」翻盘，只能靠拉新人。
     用滚动 7 天而不是自然周：自然周会在周一零点造成一次断崖式清零，
     那对受众里的学生是惩罚感；滚动窗口没有那一刻，不玩就慢慢淡出，回来就慢慢回来。 */
  const SINCE = Date.now() - 7 * 86400000;
  const rows = await env.DB.prepare(
    `SELECT camp,
            SUM(MIN(${GF_LINE.light}, ?)) AS light,
            SUM(MIN(${GF_LINE.dark},  ?)) AS dark
       FROM gemfall WHERE hidden=0 AND camp!='' AND last_write > ? GROUP BY camp`
  ).bind(CAP, CAP, SINCE).all();
  const raw = { light: 0, dark: 0 };
  for (const r of (rows.results || [])) {
    if (r.camp === "light") raw.light = Math.max(0, Math.round(r.light || 0));
    else if (r.camp === "dark") raw.dark = Math.max(0, Math.round(r.dark || 0));
  }
  /* 各营成员名单：只出化名与本营指标分，**不出人数总计**。
     看得见队友是归属感的来源；但「本营 4 人」这种总数一露就露怯，
     所以给名单不给计数——列表长度玩家自己看得到，那是「有谁」不是「才几个」。
     每营最多 12 人，按本营指标降序。 */
  const mem = await env.DB.prepare(
    `SELECT camp, alias,
            CASE camp
              WHEN 'light' THEN MIN(${GF_LINE.light}, ?)
              ELSE MIN(${GF_LINE.dark},  ?) END AS sc
       FROM gemfall WHERE hidden=0 AND camp!='' AND last_write > ?
       ORDER BY sc DESC LIMIT 60`
  ).bind(CAP, CAP, SINCE).all();
  const members = { light: [], dark: [] };
  /* 配速员并进来。不并的话最明显的破绽就在这儿：
     进了光明能看到肖肖、白水清新…却看不到世界榜上那 11 个人，
     「为什么榜上有小圆、阵营里没有」一问就穿。
     贡献按 PACER_CAMP_CAP 压低，见那条注释。 */
  const pool = (mem.results || []).slice();
  if (await pacersOn(env)) {
    for (const p of pacerRows(Date.now())) {
      const line = p.camp === "light" ? (p.lv * 150 + p.stars * 120) / 120
                 :                        (p.chain * 60 + p.best_score / 50 + p.best_rush / 40) / 30;
      pool.push({ camp: p.camp, alias: p.alias,
                  sc: Math.min(PACER_CAMP_CAP, Math.max(0, Math.round(line))) });
    }
    pool.sort((a, b) => (b.sc || 0) - (a.sc || 0));
    for (const p of pacerRows(Date.now())) {
      const k = p.camp;
      const line = k === "light" ? (p.lv * 150 + p.stars * 120) / 120
                 :                    (p.chain * 60 + p.best_score / 50 + p.best_rush / 40) / 30;
      raw[k] += Math.min(PACER_CAMP_CAP, Math.max(0, Math.round(line)));
    }
  }
  for (const r of pool) {
    const k = r.camp;
    if (members[k] && members[k].length < 12)
      members[k].push({ alias: r.alias, sc: Math.max(0, Math.round(r.sc || 0)) });
  }

  return { light: raw.light, dark: raw.dark, members };
}
async function gfCamps(req, env, origin, url) {
  await gfSealMonth(env);
  const raw = await gfCampRaw(env);
  const tot = raw.light + raw.dark;
  /* 全空时给等分：界面上是两段一样长的静止拔河带 ——
     比显示两个 0 体面，也不算撒谎（确实还没人挖）。 */
  const pct = tot > 0
    ? { light: raw.light / tot, dark: raw.dark / tot }
    : { light: .5, dark: .5 };
  return json({ ok: true, empty: tot === 0, pct, members: raw.members }, 200, origin);
}

/* 算分抽成独立函数：路由与月末封榜共用同一份，避免两处实现慢慢漂移
   （这个项目在客户端／服务端的矿力公式上已经吃过一次亏）。 */
async function gfFactionList(env, limit) {
  await gfEnsure(env);
  /* ── 每个门派只把**最强的 5 个人**计入总分 ──
     不封顶的话门派榜就是人头榜：拉二十个新人进来，哪怕个个是新号，
     加起来也能压过三个高手 —— 那不是「门派强」，那是「群大」。

     为什么是 5 不是 3：门派这套东西最早就是为了**让人有动力拉朋友进来**，
     卡到 3 会把这个动机直接掐死（第 4 个人开始白拉）。
     5 留得住拉人的意义，又挡得住人海。
     返回 n（实际人数）与 cnt（计入人数）两个数，界面上明写「计入 3/5 人」——
     规则藏着的话，拉了人却不涨分的人会以为榜坏了。 */
  const FACTION_TOP = FACTION_MAX;   // 上限与计入是同一个数，见 FACTION_MAX 那条注释
  const rows = await env.DB.prepare(
    `SELECT faction, COUNT(*) AS n, SUM(power) AS p, MAX(power) AS top,
            SUM(CASE WHEN rn<=${FACTION_TOP} THEN power ELSE 0 END) AS pcap,
            SUM(CASE WHEN rn<=${FACTION_TOP} THEN 1 ELSE 0 END) AS ncap
       FROM (
         SELECT faction, power,
                ROW_NUMBER() OVER (PARTITION BY faction ORDER BY power DESC) AS rn
           FROM gemfall WHERE hidden=0 AND faction!=''
       ) GROUP BY faction ORDER BY pcap DESC LIMIT ?`
  ).bind(limit).all();
  const list = (rows.results || []).map((r) => ({
    faction: r.faction, n: r.n || 0, cnt: r.ncap || 0, cap: FACTION_TOP,
    power: r.pcap || 0,
    avg: r.ncap ? Math.round((r.pcap || 0) / r.ncap) : 0, top: r.top || 0,
  }));
  /* 门派成员：点开一个门派要能看见都有谁。门派是玩家自己约的名字，
     人数本来就少且是明账（不像阵营需要藏），所以这里连人数一起给。 */
  const names = list.map((x) => x.faction);
  if (names.length) {
    const ph = names.map(() => "?").join(",");
    /* 必须按门派各取前 N，不能全局 ORDER BY + LIMIT：
       全局截断时人一多，排在后面的小门派会一个成员都分不到，
       点开是空的——而「拉朋友进门后要能确认他真进来了」恰恰是小门派最需要的。
       D1(SQLite) 支持窗口函数，已在线上库验过。 */
    const mem = await env.DB.prepare(
      `SELECT faction, alias, power FROM (
         SELECT faction, alias, power,
                ROW_NUMBER() OVER (PARTITION BY faction ORDER BY power DESC) AS rn
           FROM gemfall WHERE hidden=0 AND faction IN (${ph})
       ) WHERE rn<=12`
    ).bind(...names).all();
    const by = {};
    for (const r of (mem.results || [])) {
      (by[r.faction] = by[r.faction] || []).push({ alias: r.alias, power: r.power || 0 });
    }
    for (const x of list) x.members = (by[x.faction] || []).slice(0, 12);
  }
  /* 配速员的门派并进来。它们不在库里，所以整块在 JS 里合。
     不并的话就是最后一个统计破绽：真人 38% 有门派、配速员 0%。 */
  if (await pacersOn(env)) {
    const ps = pacerRows(Date.now()).filter(p => p.faction);
    const by = {};
    for (const p of ps) (by[p.faction] = by[p.faction] || []).push(p);
    for (const f in by) {
      const arr = by[f].map(p => ({ alias: p.alias, power: p.power }));
      let x = list.find(v => v.faction === f);
      if (!x) { x = { faction: f, n: 0, cnt: 0, cap: FACTION_TOP, power: 0, avg: 0, top: 0, members: [] }; list.push(x); }
      /* ⚠ 必须**先并再取前 5**，不能「真人前 5 + 配速前 5 相加」——
         那样一个门派会被算进最多 10 个人的分，而 cnt 还显示 5。
         实测：真人 [100,90,80,70] + 配速 [60,50,40]，
         错的算法给 490（7 个人），对的是 400（前 5：100+90+80+70+60）。
         现在没爆是因为配速员用的是自己的门派名，但只要有真人敲了「拾光社」立刻就中。
         members 里已经是各门派前 12 的明细，直接拿它重算。 */
      const merged = (x.members || []).concat(arr).sort((a, b) => b.power - a.power);
      const capped = merged.slice(0, FACTION_TOP);
      x.n += arr.length;
      x.cnt = capped.length;
      x.power = capped.reduce((a, b) => a + b.power, 0);
      x.top = merged.length ? merged[0].power : 0;
      x.avg = x.cnt ? Math.round(x.power / x.cnt) : 0;
      x.members = merged.slice(0, 12);
    }
    list.sort((a, b) => (b.power || 0) - (a.power || 0));
  }
  list.forEach((x, i) => { x.rank = i + 1; });
  return list.slice(0, limit);
}
async function gfFactions(req, env, origin, url) {
  await gfSealMonth(env);
  const limit = clampInt(url.searchParams.get("limit") || 20, 1, 50);
  const list = await gfFactionList(env, limit);
  return json({ ok: true, count: list.length, rows: list }, 200, origin);
}

async function gfBoard(req, env, origin, url) {
  await gfSealMonth(env);   // 访问量最大的入口，靠它把月初那一刻兜住
  const sea = url.searchParams.get("season") || await getSeason(env);
  const scope = url.searchParams.get("scope") || "world";
  const limit = clampInt(url.searchParams.get("limit") || 50, 1, 100);
  let rows;
  /* ⚠ 这里加列时别忘了 gfMap 也要跟着加 —— 两边任何一边漏掉，
     客户端拿到的就是 undefined，而三线首座算的是每个人的三条线，缺一项就整条算错。 */
  const cols = "id,alias,faction,power,best_score,best_rush,lv,stars,chain,rank_name,badges,"
             + "runs,days,dbest,best_dig,luck,comp";
  /* 不按 season 过滤：gemfall 没有 base_power 基线，赛季语义对它本来就不成立；
     而 meta.season 是和词灵榜共用的 —— 一旦老师在词灵榜点「封榜」推进了赛季，
     这里按 season 过滤就会把整个矿脉榜读成空。矿脉榜记的是累计进度（关卡、星数），
     本来就该是长期榜，要清空走 /gf/admin 的 reset。 */
  /* 90 秒榜：按**单局矿灯最佳**排，不按累计矿力。
     这是新人唯一能当天上榜的地方 —— 世界榜比累计，老玩家永远压着；
     矿灯是单局成绩，第一天就能冲。王老师说它最受欢迎、新老玩家都公平，理由正在这里。 */
  if (scope === "rush") {
    rows = await env.DB.prepare(
      `SELECT ${cols} FROM gemfall WHERE hidden=0 AND best_rush>0
       ORDER BY best_rush DESC, alias ASC LIMIT ?`
    ).bind(limit).all();
  } else if (scope === "class") {
    const pw = (url.searchParams.get("pw") || "").trim();
    if (!pw) return json({ ok: false, err: "缺少小队口令" }, 400, origin);
    const c = await sha256("class|" + pw + "|" + env.LB_SALT);
    rows = await env.DB.prepare(
      `SELECT ${cols} FROM gemfall WHERE class_tag=? AND hidden=0 ORDER BY power DESC, alias ASC LIMIT ?`
    ).bind(c, limit).all();
  } else {
    rows = await env.DB.prepare(
      `SELECT ${cols} FROM gemfall WHERE hidden=0 ORDER BY power DESC, alias ASC LIMIT ?`
    ).bind(limit).all();
  }
  /* 配速员只并进**世界榜**：门派榜与小队榜是熟人圈，混进陌生名字很突兀，
     而且它们本来就没有门派/小队归属。开关关掉时这一段整个不执行。 */
  let merged = rows.results || [];
  if (scope !== "class" && await pacersOn(env)) {
    const key = scope === "rush" ? "best_rush" : "power";   // 90 秒榜按矿灯排，不按矿力
    merged = merged.concat(pacerRows(Date.now()))
      .filter(r => scope !== "rush" || (r.best_rush || 0) > 0)
      .sort((a, b) => (b[key] || 0) - (a[key] || 0) || String(a.alias).localeCompare(String(b.alias)))
      .slice(0, limit);
  }
  return json({ ok: true, season: sea, scope, count: merged.length, rows: gfMap(merged) }, 200, origin);
}
/* 月榜：历月封存的名次。客户端拿它做两件事 ——
   ① 摆一面「月榜墙」；② 用 members 判断自己上个月有没有在赢的那一边，
   有就在名片上多一行带年月的称号。称号是**记名不是资源**，所以不需要领取。 */
async function gfMonth(req, env, origin, url) {
  await gfSealMonth(env);
  const n = clampInt(url.searchParams.get("limit") || 6, 1, 24);
  const rows = await env.DB.prepare(
    "SELECT m,kind,rank,name,power,members FROM gf_month ORDER BY m DESC, kind ASC, rank ASC LIMIT ?"
  ).bind(n * 4).all();
  return json({ ok: true, rows: (rows.results || []).map(r => ({
    m: r.m, kind: r.kind, rank: r.rank, name: r.name || "",
    power: r.power || 0, members: String(r.members || "").split(",").filter(Boolean),
  })) }, 200, origin);
}
async function gfAdmin(req, env, origin) {
  let body;
  try { body = await req.json(); } catch (e) { return json({ ok: false, err: "bad json" }, 400, origin); }
  /* 与 /admin 同级的爆破防护：口令是无盐单轮 sha256，没有限速就能硬撞 */
  if (_gfLockUntil && Date.now() < _gfLockUntil) return json({ ok: false, err: "尝试过多，请稍后" }, 429, origin);
  const pwh = await sha256(String(body.pw || ""));
  if (!env.LB_ADMIN_HASH || pwh !== env.LB_ADMIN_HASH) {
    if (++_gfFails >= 8) { _gfLockUntil = Date.now() + 60000; _gfFails = 0; }
    return json({ ok: false, err: "口令不对" }, 403, origin);
  }
  _gfFails = 0;
  await gfEnsure(env);
  const act = String(body.act || body.action || "list");   // 控制台历史上传的是 action，两种都收
  if (act === "list") {
    const rows = await env.DB.prepare(
      "SELECT id,alias,faction,class_tag,power,lv,stars,hidden FROM gemfall ORDER BY power DESC LIMIT 300"
    ).all();
    return json({ ok: true, rows: (rows.results || []).map(r => ({ ...r, is_class: !!r.class_tag, class_tag: undefined })) }, 200, origin);
  }
  if (act === "hide" || act === "show") {
    await env.DB.prepare("UPDATE gemfall SET hidden=? WHERE id=?").bind(act === "hide" ? 1 : 0, String(body.id || "")).run();
    return json({ ok: true }, 200, origin);
  }
  if (act === "delete") {
    await env.DB.prepare("DELETE FROM gemfall WHERE id=?").bind(String(body.id || "")).run();
    return json({ ok: true }, 200, origin);
  }
  if (act === "pacers") {
    /* 一键让配速员上线 / 隐退。关掉之后它们立刻从所有榜单消失，不留任何痕迹 ——
       它们本来就不是库里的行，是按 seed 现场算出来的。 */
    const on = String(body.on || "") === "1" ? "1" : "0";
    await env.DB.prepare("INSERT INTO meta(k,v) VALUES('pacers',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(on).run();
    return json({ ok: true, pacers: on === "1", count: on === "1" ? PACERS.length : 0 }, 200, origin);
  }
  if (act === "reset") {
    /* 与 /admin 一致：清空整张表必须带确认串，避免误点 */
    if (String(body.confirm || "") !== "RESET") return json({ ok: false, err: "需要 confirm:RESET" }, 400, origin);
    await env.DB.prepare("DELETE FROM gemfall").run();
    return json({ ok: true }, 200, origin);
  }
  return json({ ok: false, err: "unknown act" }, 400, origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    const p = url.pathname.replace(/\/+$/, "") || "/";
    try {
      if (p === "/board" && request.method === "GET") return await handleBoard(request, env, origin, url);
      if (p === "/hall" && request.method === "GET") return await handleHall(request, env, origin, url);
      if (p === "/factions" && request.method === "GET") return await handleFactions(request, env, origin, url);
      if (p === "/submit" && request.method === "POST") return await handleSubmit(request, env, origin);
      if (p === "/admin" && request.method === "POST") return await handleAdmin(request, env, origin);
      if (p === "/gf/board" && request.method === "GET") return await gfBoard(request, env, origin, url);
      if (p === "/gf/factions" && request.method === "GET") return await gfFactions(request, env, origin, url);
      if (p === "/gf/camps" && request.method === "GET") return await gfCamps(request, env, origin, url);
      if (p === "/gf/month" && request.method === "GET") return await gfMonth(request, env, origin, url);
      if (p === "/gf/submit" && request.method === "POST") return await gfSubmit(request, env, origin);
      if (p === "/gf/admin" && request.method === "POST") return await gfAdmin(request, env, origin);
      if (p === "/") return json({ ok: true, name: "名人天梯 · 词灵榜", v: 4, games: ["wordduel", "gemfall"], season: await getSeason(env) }, 200, origin);
      return json({ ok: false, err: "not found" }, 404, origin);
    } catch (e) {
      console.error("LB worker error:", e && e.stack || e);
      return json({ ok: false, err: "server error" }, 500, origin);
    }
  },
};
