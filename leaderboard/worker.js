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
  [18000, "词灵宗师"], [30000, "狼徒·封号弟子"],
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

  // 小队口令（可选）：加盐命名空间；口令错/空都不阻断世界榜提交（仅不进小队榜）
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
    /* 段位名始终按权威公式现算，避免 D1 旧行把退役字符继续带回公共响应。 */
    rankName: rankFor(Math.max(0, (r.power || 0) - (r.base_power || 0))),
    badges: r.badges ? r.badges.split(",") : [],
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
    if (!pw) return json({ ok: false, err: "缺少小队口令" }, 400, origin);
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
    if (!pw) return json({ ok: false, err: "缺少小队口令" }, 400, origin);
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
    if (!pw) return json({ ok: false, err: "缺少小队口令" }, 400, origin);
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
      lifetime: r.power || 0,
      rank_name: rankFor(Math.max(0, (r.power || 0) - (r.base_power || 0))), hidden: r.hidden,
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
   消除局的分数无法由服务端完整重算，所以走「硬上限 + 限频 +
   管理端可删」的常规防线，不是银行级。
   ══════════════════════════════════════════════════════════════ */
/* runs/days 的上限按「十年重度玩」估：每天 15 局 × 3000 天。
   定得住恶意改本地存档，又高到正常玩家这辈子都碰不到。 */
/* 这些是防止脏数据撑爆 D1 的技术闸，不是玩法上限。
   500,000 曾被当成“不可能达到”，但 90 秒实战已经越过，导致真实最佳
   在服务端静默变成 500,000。分数类统一放到远高于可玩区间的安全整数；
   关卡与连锁也留足无尽模式的增长空间。 */
const GF_RECORD_CAP = 18999999;
const GF_CAP = { score: GF_RECORD_CAP, rush: GF_RECORD_CAP, lv: 99999, stars: 192, chain: 120,
                 runs: 45000, days: 3000, dbest: 3000, mv: GF_RECORD_CAP, luck: 400, mastery: 6 };
/* Boss 连战不进入矿力，只在独立世界榜比较。层数与下一层进度留足长期增长，
   战果使用 32 位有符号整数上限，避免长局真实成绩被普通关卡的技术闸截断。 */
const GF_BOSS_CAP = { floor: 9999, progress: 10000, score: 2147483647 };
const GF_RUSH_REWARDS = [
  { rank: 1, boxes: 3, dust: 180 },
  { rank: 2, boxes: 2, dust: 100 },
  { rank: 3, boxes: 1, dust: 60 },
];
function gfRushReward(rank) { return GF_RUSH_REWARDS.find(x => x.rank === rank) || null; }
/* 90 秒周榜统一按北京时间周一换榜。key 是该周周一 YYYYMMDD，
   字典序就是时间序，D1 可以直接比较。 */
function gfRushWeekKey(now) {
  const d = new Date(now + 8 * 3600000);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return "" + d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, "0")
    + String(d.getUTCDate()).padStart(2, "0");
}
function gfRushWeekLabel(key) {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(key || ""));
  if (!m) return "本周";
  const a = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const b = new Date(a.getTime() + 6 * 86400000);
  return (a.getUTCMonth() + 1) + "月" + a.getUTCDate() + "日—"
    + (b.getUTCMonth() + 1) + "月" + b.getUTCDate() + "日";
}
function gfCleanStats(st) {
  st = st || {};
  const s = {
    score: clampInt(st.score, 0, GF_CAP.score), rush: clampInt(st.rush, 0, GF_CAP.rush),
    lv: clampInt(st.lv, 0, GF_CAP.lv), stars: clampInt(st.stars, 0, GF_CAP.stars),
    chain: clampInt(st.chain, 0, GF_CAP.chain),
    runs: clampInt(st.runs, 0, GF_CAP.runs), days: clampInt(st.days, 0, GF_CAP.days),
    dbest: clampInt(st.dbest, 0, GF_CAP.dbest), mv: clampInt(st.mv, 0, GF_CAP.mv),
    luck: clampInt(st.luck, 0, GF_CAP.luck), mastery: clampInt(st.mastery, 0, GF_CAP.mastery),
  };
  s.days = Math.min(s.days, s.runs);
  s.dbest = Math.min(s.dbest, s.days);
  s.stars = Math.min(s.stars, Math.min(s.lv, 64) * 3);
  return s;
}
function gfCleanBoss(st) {
  st = st || {};
  const comps = ["wolf", "jun", "qi", "xi", "xiao", "zi"];
  return {
    floor: clampInt(st.bossFloor, 0, GF_BOSS_CAP.floor),
    progress: clampInt(st.bossProgress, 0, GF_BOSS_CAP.progress),
    score: clampInt(st.bossScore, 0, GF_BOSS_CAP.score),
    /* build 只收受控强化 ID。既不让任意文本进入公共响应，也给客户端留够
       组合摘要空间；数组经 String() 后自然成为逗号分隔的 ID。 */
    build: String(st.bossBuild || "").slice(0, 160).replace(/[^a-z0-9,_:+.\-]/gi, ""),
    comp: comps.includes(String(st.bossComp || "")) ? String(st.bossComp) : "",
  };
}
let _gfFails = 0, _gfLockUntil = 0;   // /gf/admin 口令爆破限速
const GF_RANKS = [
  [0, "矿工学徒"], [1500, "持镐人"], [4000, "探脉者"], [8000, "碎岩者"],
  [15000, "深堑行者"], [26000, "灵石匠"], [42000, "矿脉宗师"], [65000, "执灯人·封号矿主"],
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
/* 两阵营各吃矿力的一条线，和上面函数**同源**——旧版曾另立公式，
   结果光明与黑域在量同一件事（秩相关 0.815、前六名同一批人同一顺序），
   而灰塔号称「来多勤」却读 best_rush（单局峰值），跟教义正好相反。
   除数让两边「打满 400」所需投入大致相当，各约一个月的专注投入：
     深度 48000 ≈ 第 150 关满星   技巧 12000 ≈ 15 重连锁加高分
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
  add(s.mastery >= 6, "g11");                                  // 六位同行全部曜衔 · 虹彩矿名
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
function gfRenameMonth(now) {
  return monthKeyOf(new Date(now + 8 * 3600000));               // 自然月按北京时间重置
}
function gfRenamePolicy(prevAlias, nextAlias, usedMonth, now) {
  const month = gfRenameMonth(now), changed = !prevAlias || prevAlias !== nextAlias;
  return { changed, month, allowed: !changed || usedMonth !== month };
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
  /* 阵营：只记赢的那一边，不封存成员名单。 */
  try {
    const c = await gfCampRaw(env);
    const win = (c.light >= c.dark) ? "light" : "dark";
    put.push({ kind: "camp", rank: 1, name: win,
      power: Math.round(c[win] || 0), members: "" });
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
  /* 月末封存表沿用旧结构；当前只写阵营胜方，members 保留为空以兼容旧库。 */
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS gf_month (
       m TEXT NOT NULL, kind TEXT NOT NULL, rank INTEGER NOT NULL,
       name TEXT DEFAULT '', power INTEGER DEFAULT 0, members TEXT DEFAULT '',
       PRIMARY KEY (m, kind, rank))`
  ).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_gf_class ON gemfall(class_tag,season,hidden)").run();
  /* 化名首定与改名共用自然月额度。独立小表避免给事故敏感的 gemfall 主表加第八条同步链。 */
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS gemfall_alias_month (
       id TEXT PRIMARY KEY, changed_month TEXT NOT NULL DEFAULT '')`
  ).run();
  /* 90 秒周榜独立建表，不往事故敏感的 gemfall 主表追加列。
     周成绩只收真实设备提交；公开周榜仍可并入配速员，但它们不占资源奖励。 */
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS gf_rush_week (
       week TEXT NOT NULL, id TEXT NOT NULL, alias TEXT NOT NULL,
       best_rush INTEGER NOT NULL DEFAULT 0, comp TEXT DEFAULT '', updated_at INTEGER DEFAULT 0,
       PRIMARY KEY (week,id))`
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS idx_gf_rush_week_rank ON gf_rush_week(week,best_rush DESC)"
  ).run();
  /* Boss 一命连战独立于 gemfall 主表，三项成绩始终作为同一趟纪录更新。
     不加主表列就不会触碰矿力七处同步链，也不会改变既有段位。 */
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS gf_boss_best (
       id TEXT PRIMARY KEY,
       best_floor INTEGER NOT NULL DEFAULT 0,
       best_progress INTEGER NOT NULL DEFAULT 0,
       best_score INTEGER NOT NULL DEFAULT 0,
       build TEXT DEFAULT '', comp TEXT DEFAULT '', updated_at INTEGER DEFAULT 0)`
  ).run();
  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_gf_boss_rank
       ON gf_boss_best(best_floor DESC,best_progress DESC,best_score DESC,updated_at ASC)`
  ).run();
  await env.DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_gf_boss_points
       ON gf_boss_best(best_score DESC,best_floor DESC,best_progress DESC,updated_at ASC)`
  ).run();
  /* 旧版按无限层数排位，新版是一趟十二层、按战果积分排位。每一条旧纪录都把
     深度折成不低于原战果的传承积分，绝不降分；标记落在 meta，整个库只换算一次。 */
  try {
    const done = await env.DB.prepare("SELECT v FROM meta WHERE k='gf_boss_points_v3'").first();
    if (!done || done.v !== "1") {
      await env.DB.batch([
        env.DB.prepare(`UPDATE gf_boss_best
          SET best_score=MAX(COALESCE(best_score,0),COALESCE(best_floor,0)*60000+COALESCE(best_progress,0)*6)
          WHERE best_floor>0`),
        env.DB.prepare("INSERT INTO meta(k,v) VALUES('gf_boss_points_v3','1') ON CONFLICT(k) DO UPDATE SET v='1'"),
      ]);
    }
  } catch (e) {}
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS gf_rush_award (
       week TEXT NOT NULL, id TEXT NOT NULL, rank INTEGER NOT NULL,
       boxes INTEGER NOT NULL DEFAULT 0, dust INTEGER NOT NULL DEFAULT 0, created_at INTEGER DEFAULT 0,
       PRIMARY KEY (week,id))`
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS gf_rush_seal (
       week TEXT PRIMARY KEY, sealed_at INTEGER NOT NULL DEFAULT 0)`
  ).run();
  _gfReady = true;
}

/* 懒封榜：任一榜单读写都会把已结束的周定格。
   奖励行与 seal 标记同一个 batch 落库；INSERT OR IGNORE 让并发请求也不会重复颁发。 */
async function gfSealRushWeeks(env, now) {
  const current = gfRushWeekKey(now);
  const old = await env.DB.prepare(
    `SELECT DISTINCT w.week FROM gf_rush_week w
      LEFT JOIN gf_rush_seal s ON s.week=w.week
      WHERE w.week<? AND s.week IS NULL ORDER BY w.week ASC LIMIT 16`
  ).bind(current).all();
  for (const x of (old.results || [])) {
    const top = await env.DB.prepare(
      `SELECT w.id,w.best_rush FROM gf_rush_week w
        JOIN gemfall g ON g.id=w.id
        WHERE w.week=? AND w.best_rush>0 AND g.hidden=0
        ORDER BY w.best_rush DESC,g.alias ASC LIMIT 3`
    ).bind(x.week).all();
    const stmts = [];
    for (let i = 0; i < (top.results || []).length; i++) {
      const r = top.results[i], reward = gfRushReward(i + 1);
      stmts.push(env.DB.prepare(
        `INSERT OR IGNORE INTO gf_rush_award(week,id,rank,boxes,dust,created_at)
         VALUES(?,?,?,?,?,?)`
      ).bind(x.week, r.id, reward.rank, reward.boxes, reward.dust, now));
    }
    stmts.push(env.DB.prepare(
      "INSERT OR IGNORE INTO gf_rush_seal(week,sealed_at) VALUES(?,?)"
    ).bind(x.week, now));
    await env.DB.batch(stmts);
  }
}
/* ══════════════════════════════════════════════════════════════
   配速员 · PACERS
   ──────────────────────────────────────────────────────────────
   王老师要「虚拟人，逼真，能让不同段位的活跃玩家都有得追」，并且要能一键开关。

   三条设计约束，是这套东西能不能上的全部理由：

   1) **它们不从玩家手里拿走任何东西。** 它们不进入任何成员名单，只以低封顶的聚合量
      参与阵营实力带，也不参与任何限量奖励；公开榜里则与普通条目使用相同字段、排序与名片。
      配速员的价值是「前面有人跑着」，不是「把奖杯端走」。

   2) **不写库，纯计算。** 它们不是 gemfall 表里的行 —— 是按 seed + 已过天数
      现场算出来的。好处有三：不占赛季行上限、不会被误当真人删掉、
      而且**随时间自然增长**（静态不动的榜单条目是最大的破绽）。

   3) **一键开关。** meta 表的 pacers 键，/gf/admin 的 act:'pacers' 翻。
      关掉之后它们立刻从所有榜单消失，不留痕迹 —— 王老师随时可以让他们隐退。

   逼真度靠三件事：名字像真人起的、**成长曲线各不相同**（有人猛冲一阵就歇、
   有人细水长流）、以及各项数值之间**互相自洽**（不会出现 200 关却只来过 1 天）。
   ══════════════════════════════════════════════════════════════ */
/* 游戏上线日。配速员的**到场天数不得超过「上线到今天」** ——
   这是整张名片上最容易露馅的一格：真人到场最多 3 天（中位 1 天），
   而配速员一度写着「到场 27 天、216 局」，在一个上线第 9 天的游戏里。
   数字再合理，这一格错了就全白搭。 */
const GAME_EPOCH = Date.UTC(2026, 6, 29);
const PACER_EPOCH = Date.UTC(2026, 7, 1);
const GAME_DAYS_BEFORE_PACER = Math.round((PACER_EPOCH - GAME_EPOCH) / 86400000);          // 计时起点，改它等于让所有配速员重新长

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
/* ⚠ 作息**不许跨北京日**（hour + span <= 24）。跨日的话最后一天那段 frac 算不干净，
     而且 to 会被 min(24,·) 压成一个几十分钟的假窗口。夜猫子本猫原来是 23+3，
     被压成 23:00-24:00 一小时，等于作息设定没生效 —— 改成 21+3。
   ⚠ ceil = 他这辈子大概能到的矿力。真人不会永远直线上涨，**涨到某个段位就基本停住**，
     配速员也得这样，否则一年后榜首就是虚拟人（实测 48 天后就超过最强真人）。
     ⚠ 单位是**公开矿力**（gfPower 的输出），不是内部的 eff。
   ⚠ **ceil 是平常待的地方，peak 是这辈子的最高处**，只有冲刺期够得到。
     王老师定的：配速员可以偶尔越过真人，越过之后停滞一阵再继续 —— 这是刺激点。
     10 个人的 peak 都在最强真人（102,698）之下，只有一只小鹿的 108,000 够得着，
     而且要冲上四五次台阶、约两年才摸得到，越过的幅度也只有 5%。
     真人被越过之后打一局就能拿回来 —— 这正是它该有的样子。
     ⚠ 故意不取整：取整的话十年后会有人**正好停在 19000** 上，
     「一排人恰好停在整千」比涨得太快还假（这条自测抓到过一次）。 */
  { alias: "小圆",             seed: 11, base:   110, pace: 130, burst: .55, rest: 3, hour: 21, span: 2, ceil: 13840, peak: 17300 },
  { alias: "今天也想睡",       seed: 23, base:  1614, pace: 300, burst: .30, rest: 4, hour:  7, span: 1, ceil: 18760, peak: 23450 },
  { alias: "夜猫子本猫",       seed: 37, base:   190, pace: 430, burst: .70, rest: 3, hour: 21, span: 3, ceil: 22910, peak: 28640 },
  { alias: "阿豆",             seed: 41, base:    20, pace: 700, burst: .40, rest: 1, hour: 12, span: 2, ceil: 29640, peak: 37050 },
  { alias: "半糖",             seed: 53, base:  4090, pace: 380, burst: .65, rest: 3, hour: 16, span: 2, ceil: 34870, peak: 43590 },
  { alias: "早八人",           seed: 67, base:  2301, pace: 820, burst: .25, rest: 0, hour:  6, span: 3, ceil: 44520, peak: 55650 },
  { alias: "圆圆",             seed: 71, base:  9583, pace: 560, burst: .60, rest: 2, hour: 19, span: 2, ceil: 49380, peak: 61730 },
  { alias: "午休选手",         seed: 83, base: 17275, pace: 900, burst: .35, rest: 1, hour: 13, span: 4, ceil: 59260, peak: 74080 },
  { alias: "云朵朵",           seed: 97, base: 27357, pace: 640, burst: .50, rest: 2, hour: 22, span: 2, ceil: 67410, peak: 84260 },
  { alias: "Yuki",            seed: 103, base: 51835, pace: 750, burst: .45, rest: 1, hour: 20, span: 3, ceil: 77530, peak: 96910 },
  { alias: "一只小鹿",         seed: 113, base: 73454, pace: 480, burst: .70, rest: 3, hour: 10, span: 2, ceil: 86940, peak: 108000 },
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
/* 天花板从第 0 天就生效 —— 也就是「他这辈子一直有这个上限」。
   本来想只管往后不重算历史，但那样 base 与 ceil 是两套单位，
   量纲对不上；从头生效反而自洽，代价是上线时有一次性校正。 */
const PACER_DECAY_FROM = 0;
/* 兜底闸。曲线标定对的话**永远不会触发** —— CI 里有一条断言跑 10 年验证它确实没触发。
   留着是因为「配速员的成绩超过真人」这件事已经发生过两次（第一版 rush=skill*18，
   这一版 score=skill*9），不能只靠标定，得有个结构性的保证。 */
const PACER_CEIL = { score: 130000, rush: 195000, lv: 300 };

function pacerAt(p, hoursTotal) {
  /* ⚠ 日序与小时**必须同一个时区**。原来 d 用 UTC 日序、hNow 用北京小时，
     于是北京 00:00-07:59 这 8 小时里 d 还没进位、hNow 却已经绕回 0，
     frac 从 1 掉回 0 —— 11 个人里 10 个**每晚成绩倒退**，早八点才回来。
     真人的数字永远不会缩水，这是配速员最容易露馅的地方。 */
  const bj = hoursTotal + 8;                       // 北京时区的总小时数
  const d = Math.floor(bj / 24);                   // 北京日序
  const hNow = bj - d * 24;                        // 0..23，北京小时
  const r = pacerRnd(p.seed);
  /* base 代表「他在计时起点之前已经玩了很久」，所以到场天数与局数也必须带上那段历史 ——
     ⚠ 这 11 个数是**反解出来**的：目标是让改版后每个人「今天的公开矿力」
     正好落回改版前榜单上的那个数，这样榜单排位不动，只有名片上那个虚高的数降下来对齐。
     改动 pace / ceil / 生成公式里的任何一处，都要重新反解一遍，否则会出现一次性跳变。
     否则会出现「矿力 75,192、第 156 关、到场只有 2 天」这种一眼假的组合。
     按矿力反推：约每 1500 矿力对应一天，每天约 8 局，连续纪录取其中一段。 */
  /* ⚠ 上限 = 计时起点之前游戏总共存在了几天。base 再大也不能凭空多出到场天数。 */
  const histDays = Math.max(1, Math.min(GAME_DAYS_BEFORE_PACER, Math.round(p.base / 1500)));
  /* ⚠ eff 是**内部的投入量**，不是矿力。矿力一律走 gfPower() ——
     跟真人同一个公式、同一个来源。
     原来的写法是「先编一个 power，再从它倒推关卡/星/分数」，
     而倒推**不是 gfPower 的逆运算**：于是榜单按编出来的 power 排，
     名片却按各项现算，两个数差 37%~73%（最大 34,928），
     一只小鹿名片上 110,930 甚至压过最强真人的 102,698 —— 点开就露馅。
     真人这两处偏差是 0，因为他们本来就只有一个来源。 */
  let eff = p.base, days = histDays, runs = histDays * 8, streak = Math.max(2, Math.round(histDays * .35)), cur = 0;
  let quiet = 0;                                   // 「出远门」剩余天数
  /* ── 冲刺期 ──
     真人不是匀速爬的：某个星期忽然连着打，冲上一个台阶，然后好久不见人影。
     匀速爬看上去最假 —— 一条直线上没有故事。
     周期 130~199 天（约每四到六个月一次），一次持续 6~14 天；
     11 个人错开相位，全服平均每 12 天左右有一个人在冲。
     ⚠ 从第 60 天才开始，好让上线当天的数字不受影响（base 是按今天反解的）。 */
  const sPeriod = 130 + (p.seed % 70), sLen = 6 + (p.seed % 9), sPhase = (p.seed * 17) % sPeriod;

  for (let i = 0; i <= d; i++) {
    /* 今天这一天他打算涨多少 */
    let today = 0;
    const t = i - 60;
    const surging = t >= 0 && ((t + sPhase) % sPeriod) < sLen;
    const step = t < 0 ? 0 : Math.floor((t + sPhase) / sPeriod);   // 已经冲上过几级台阶
    /* 台阶越往上越难，渐近到 peak —— 不会一级一级无限往上垒。 */
    const ceilNow = p.peak - (p.peak - p.ceil) * Math.exp(-step * .45);
    /* 冲刺期把上限临时抬高一截，正好够冲过下一级；平时就是 ceilNow。
       冲完 ceilNow 才补上来，所以**冲完必然是一段长停滞** —— 王老师要的就是这个。 */
    const lim = surging ? Math.min(p.peak, ceilNow * 1.22) : ceilNow;
    /* room = 离自己的段位天花板还有多远。1 = 刚起步，0 = 到顶了。
       ⚠ 拿**公开矿力**算，不是拿 eff —— 要压住的是玩家看得见的那个数。 */
    /* 立方而不是线性：平时照常涨，快撞到自己的台阶才急刹。
       线性衰减的话只能爬到上限的 93%，台阶等于白设 —— 实测越过榜首要 5.6 年，
       够不上「偶尔」。 */
    const room = i >= PACER_DECAY_FROM
      ? Math.max(0, 1 - Math.pow(gfPower(pacerStats(p, eff, days, runs, streak)) / lim, 3)) : 1;
    if (quiet > 0) { quiet--; cur = 0; }
    else {
      const roll = r();
      if (roll < .02) {                            // 2% 概率：出门几天不上线
        quiet = 2 + Math.floor(r() * 4); cur = 0;
      } else if (roll < p.rest / 7 + .02 + (1 - room) * (1 - p.rest / 7 - .02)) {
        /* 今天没空。⚠ 越接近天花板越常「没空」，到顶那天概率正好是 1（彻底淡出）。
           这一项必须有，而且必须收到 1：只压矿力不压出勤的话，
           勤勉 = days*160 + runs*6 还在涨，公开矿力就会**越过天花板无限涨**
           （实测一年 3.09 倍、十年 13.4 倍）。到顶的人是连人带号一起停的。 */
        cur = 0;
      } else {
        days++; cur++; if (cur > streak) streak = cur;
        runs += 3 + Math.floor(r() * 9);
        let wave = 1 + (r() - .5) * 2 * p.burst;
        if (r() < .06) wave *= 2.4;                // 6% 概率：手气爆棚的一天
        /* 段位天花板：越接近自己的上限涨得越慢，逼近但不越过。
           线性衰减是三种形状里贴顶最慢的（一年后 79~99%，还在动），
           平方与立方一年就贴死了。 */
        /* 冲刺期日增翻倍 —— 只抬上限不加速的话，一次冲刺只多涨两三成，
           在榜上看不出「他这周在拼」。 */
        today = Math.max(0, p.pace * wave * room * (surging ? 2.2 : 1));
      }
    }
    if (i < d) { eff += today; continue; }
    /* 最后一天只算到「此刻」为止：按他的作息，过了他下矿的时段才算数。
       这样同一天里不同时刻刷新，看到的数字是不一样的。 */
    const from = p.hour, to = Math.min(24, p.hour + p.span);
    /* frac 在一个北京日内**单调不减**：0 → 1，到 23:59 必然是 1，
       次日 00:00 新一天的 frac 从 0 起算而昨天的已整份落袋 —— 全程只增不减。 */
    const frac = to > from ? Math.min(1, Math.max(0, (hNow - from) / (to - from))) : 1;
    eff += today * frac;
  }
  /* 再兜一道：到场天数**永远**不超过游戏存在的天数。
     上面的 histDays 管起点，这里管此后每一天。 */
  const maxDays = GAME_DAYS_BEFORE_PACER + d + 1;
  if (days > maxDays) { runs = Math.round(runs * maxDays / days); days = maxDays; }
  if (streak > days) streak = days;
  const st = pacerStats(p, eff, days, runs, streak);
  return { power: gfPower(st), ...st };
}

/* 从投入量 eff 生成各项。**只有这一个地方造数字**，矿力由 gfPower 从这里算出来。 */
function pacerStats(p, eff, days, runs, streak) {
  const depth = eff * .58, skill = eff * .30;
  /* ⚠ lv 必须对 eff **单调**。原来是 lv = (depth - stars*120)/150 ——
     stars 进位那一刻会从 lv 的分子里扣掉 120，而深段一级值 150 以上，
     于是「星 +1、关卡 −1」净值为负，矿力**倒退二三十分**。
     数值小，但它是 bug 不是噪声：真人的成绩不会倒退。 */
  const lv = Math.max(1, Math.min(PACER_CEIL.lv, Math.round(depth / 190)));
  /* ⚠ 星按**每关三星**算，不是另立一条线。看线上真人：
       关卡  2 星   6      关卡 14 星  42      关卡 45 星 135
       关卡  5 星  15      关卡 21 星  63      关卡 48 星 144
     一水儿的 3.0 —— 大家都是三星过了才往下走，到 192 封顶。
     旧写法让星与关卡各自从 depth 算，比值成了 1.07（每关只拿一颗星），
     11 个人整整齐齐都这样，这是比数值高低更明显的破绽。
     grip 让各人差一点，不至于全是精确的 3.0。 */
  const starRate = 2.5 + (.62 + ((p.seed * 37) % 100) / 100 * .38) * .5;   // 2.81~3.00
  const stars = Math.min(192, Math.round(lv * starRate));
  /* ⚠ 单局成绩（单关分、矿灯）**不能拿矿力乘一个固定倍数** —— 那样它会跟着矿力
     无限涨，而真人的手艺是会到顶的。线上真实散点长这样：
       矿力  6,507 → 矿灯 145,886       矿力  9,798 → 矿灯 176,500
       矿力 46,939 → 矿灯 121,830       矿力 102,698 → 矿灯 212,792（最强真人）
     矿力翻了 15 倍，矿灯只多四成 —— 是一条**很快压平的饱和曲线**，不是直线。
     这个错犯过两次：第一版 rush=skill*18 让配速员打出 405,340（真人两倍），
     改成 *8 只是把斜率调小，**没改掉「无限涨」这个性质**；于是 score=skill*9
     又把「一只小鹿」顶到单关 205,205，比最强真人的 144,777 高出 42%，今天就在榜上。
     grip 是各人的手感（按 seed 定死，不动随机流否则历史会跳变）。真人在同一矿力
     上下能差一倍（矿力 32,751 打 124,274，矿力 33,910 打 187,923），
     没有 grip 这 11 个人会挤在同一个数上 —— 那才是真·一眼假。 */
  const grip = .62 + ((p.seed * 37) % 100) / 100 * .38;        // 0.62~1.00，按 seed 定死
  const sat = (asym, k) => Math.round(asym * grip * (1 - Math.exp(-eff / k)));
  const chain = Math.min(14, 5 + Math.floor(skill / 2600));
  /* ⚠ K 是按 **eff** 的量级标的，不是矿力。矿力含 3× 均衡奖，
     大约是 eff 的 1.9 倍 —— 改生成公式导致 eff 缩水时，这两个 K 必须跟着缩，
     否则低分段会长出「第 3 关、单关只有 3,059」这种明显偏低的组合。 */
  const score = Math.min(PACER_CEIL.score, sat(120000, 14000));
  /* ⚠ 矿灯的渐近线**别往上抬**。K=4800 意味着 eff 过两万就基本到顶了，
     所以抬渐近线不是「慢慢长上去」，是**11 个人当场一起跳**（试过 210,000：
     云朵朵今天就从 155,170 蹦到 190,000）。90 秒榜上配速员已经插在 4/6/7/8 名，
     中段的反超天天都有；榜首前两名留给人。 */
  const rush  = Math.min(PACER_CEIL.rush,  sat(185000,  4800));
  return { lv, stars, chain, score, rush, mv: 0, days, runs, dbest: streak };
}

/* 配速员只以匿名聚合量进入阵营比例，接口绝不下发其阵营归属或成员记录。
   ⚠ 贡献要**大幅压低**。实测：11 个配速员按满额 400 进来，
   每营多约 1466，是真人总量（1767）的 2.5 倍 —— 拉锯条会被钉死，
   真人怎么打都不动。压到 60 之后真人仍占 73% 的信号，条子还是真人说了算。 */
const PACER_CAMP_CAP = 60;
/* 两营按名单次序交错；只用于服务端求和，不随榜单响应下发。 */
function pacerCamp(i) { return ["light", "dark"][i % 2]; }

/* 同一小时内所有请求算出来的是同一份，缓存一小时。
   ⚠ 这不是可有可无的优化：pacerAt 要从第 0 天一路模拟到今天，开销**随天数线性增长**。
   今天 d≈8，一次约 0.1ms；一年后约 5ms，十年后约 45ms —— 乘以 11 个人就是 500ms。
   缓存之后每小时只付一次，所以近几年都够用。
   ⚠ 但它会一直涨。真顶到 Workers 的 CPU 上限时（大约两年后），
   正解是**把每月月初的模拟状态存进 D1 做断点续算**，把每次的模拟长度压到 31 天以内。
   pacer.test.mjs 有一条守卫盯着它别再慢一个数量级。 */
let _pacerCache = { h: -1, rows: null };

function pacerRows(nowMs) {
  const h = Math.max(0, Math.floor((nowMs - PACER_EPOCH) / 3600000));
  if (_pacerCache.h === h) return _pacerCache.rows;
  const rows = PACERS.map((p, i) => {
    const st = pacerAt(p, h);
    /* 同行必须与关卡解锁相容。按 seed 从当前可用人物中固定挑一个，
       既不会出现第 3 关带着第 32 关人物，也不会每次刷新换人。 */
    const comps = [["wolf",1],["jun",4],["qi",10],["xi",16],["xiao",24],["zi",32]]
      .filter(([, unlock]) => st.lv >= unlock);
    const bossScore = Math.max(0, Math.round(st.score * 7 + st.rush * .8 + st.runs * 2500 + st.days * 18000));
    const bossFloor = bossScore > 0 ? Math.min(12, Math.max(1, Math.floor(bossScore / 170000) + 1)) : 0;
    const bossProgress = bossFloor >= 12 ? 0 : (p.seed * 1871 + st.runs * 379 + st.days * 613) % 10000;
    const bossBuild = ["fury:" + Math.min(5, 1 + Math.floor(st.runs / 24)),
      "guard:" + Math.min(3, Math.floor(st.days / 3)),
      "recovery:" + Math.min(3, Math.floor(st.runs / 30))].filter(x => !/:0$/.test(x)).join(",");
    return {
      id: "pacer:" + p.seed, alias: p.alias,
      camp: pacerCamp(i),
      power: st.power, best_score: st.score, best_rush: st.rush,
      lv: st.lv, stars: st.stars, chain: st.chain,
      runs: st.runs, days: st.days, dbest: st.dbest, best_dig: 0, luck: 0,
      rank_name: gfRankFor(st.power), badges: gfBadges({
        lv: st.lv, stars: st.stars, score: st.score, rush: st.rush, chain: st.chain,
      }).join(","),
      comp: comps[p.seed % comps.length][0],
      boss_floor: bossFloor, boss_progress: bossProgress, boss_score: bossScore, boss_build: bossBuild,
      __bot: 1,
    };
  });
  _pacerCache = { h, rows };
  return rows;
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
    rank: i + 1, alias: r.alias, power: r.power || 0,
    lv: r.lv || 0, stars: r.stars || 0, score: r.best_score || 0, rush: r.best_rush || 0,
    rushAll: r.rush_all || r.best_rush || 0,
    bossFloor: r.boss_floor || 0, bossProgress: r.boss_progress || 0,
    bossScore: r.boss_score || 0, bossBuild: r.boss_build || "",
    chain: r.chain || 0,
    /* 历史存量可能还保留旧称号；公共输出只认当前权威段位表。 */
    rankName: gfRankFor(r.power || 0), badges: (r.badges || "").split(",").filter(Boolean),
    runs: r.runs || 0, days: r.days || 0, dbest: r.dbest || 0, mv: r.best_dig || 0,
    luck: r.luck || 0,
    comp: r.comp || "",
    /* 90 秒资源奖只认 D1 真人名次。公开名次仍按所有条目的分数统一排序，
       客户端只拿到可领奖名次，不下发任何身份标签。 */
    rewardRank: r.reward_rank || 0,
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
  const prev = await env.DB.prepare("SELECT alias,badges,last_write,first_seen FROM gemfall WHERE id=?").bind(id).first();
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
  const aliasLog = await env.DB.prepare(
    "SELECT changed_month FROM gemfall_alias_month WHERE id=?"
  ).bind(id).first();
  const rename = gfRenamePolicy((prev && prev.alias) || "", alias,
    (aliasLog && aliasLog.changed_month) || "", now);
  if (!rename.allowed) return json({ ok: false, code: "rename_month",
    err: "本月化名已经确定，下月可再改", aliasMonth: rename.month }, 409, origin);
  /* 自由文本门派已退役。列保留用于旧数据兼容，新提交统一清空。 */
  const faction = "";
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
  // 硬上限只拦明显脏数据，不再把真实成绩压在 50 万
  const st = body.stats || {};
  const s = gfCleanStats(st);
  /* 下矿天数不可能多于下矿局数——一天至少打一局才算来过。
     连续到场纪录也不可能超过累计到场天数。
     老客户端不送这些字段，落到 0，MAX 合并时不会覆盖已有值。 */
  const rushWeekKey = String(st.rushWeekKey || "");
  const rushWeek = rushWeekKey === gfRushWeekKey(now)
    ? clampInt(st.rushWeek, 0, GF_CAP.rush) : 0;
  const boss = gfCleanBoss(st);
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
  if (rename.changed) await env.DB.prepare(
    `INSERT INTO gemfall_alias_month(id,changed_month) VALUES(?,?)
     ON CONFLICT(id) DO UPDATE SET changed_month=excluded.changed_month`
  ).bind(id, rename.month).run();
  if (rushWeek > 0) await env.DB.prepare(
    `INSERT INTO gf_rush_week(week,id,alias,best_rush,comp,updated_at) VALUES(?,?,?,?,?,?)
     ON CONFLICT(week,id) DO UPDATE SET
       alias=excluded.alias,
       best_rush=MAX(COALESCE(gf_rush_week.best_rush,0),excluded.best_rush),
       comp=CASE WHEN excluded.comp!='' THEN excluded.comp ELSE gf_rush_week.comp END,
       updated_at=excluded.updated_at`
  ).bind(rushWeekKey, id, alias, rushWeek, comp, now).run();
  if (boss.floor > 0) await env.DB.prepare(
    `INSERT INTO gf_boss_best(id,best_floor,best_progress,best_score,build,comp,updated_at)
     VALUES(?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       best_floor=excluded.best_floor,
       best_progress=excluded.best_progress,
       best_score=excluded.best_score,
       build=excluded.build,
       comp=CASE WHEN excluded.comp!='' THEN excluded.comp ELSE gf_boss_best.comp END,
       updated_at=excluded.updated_at
     WHERE excluded.best_score>COALESCE(gf_boss_best.best_score,0)
        OR (excluded.best_score=COALESCE(gf_boss_best.best_score,0)
            AND excluded.best_floor>COALESCE(gf_boss_best.best_floor,0))
        OR (excluded.best_score=COALESCE(gf_boss_best.best_score,0)
            AND excluded.best_floor=COALESCE(gf_boss_best.best_floor,0)
            AND excluded.best_progress>COALESCE(gf_boss_best.best_progress,0))`
  ).bind(id, boss.floor, boss.progress, boss.score, boss.build, boss.comp || comp, now).run();
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
  /* 虹彩资格只增不减：旧客户端不送 mastery，也不能把已取得的终身奖励冲掉。 */
  merged.mastery=Math.max(s.mastery||0,String((prev&&prev.badges)||'').split(',').includes('g11')?6:0);
  let myPower = gfPower(merged);
  if (!Number.isFinite(myPower)) myPower = gfPower(s);      // 回读缺项时退回本次提交
  if (!Number.isFinite(myPower)) myPower = 0;               // 再不行也不能把 NaN 写进库
  const myRank = gfRankFor(myPower);
  const myBadges = gfBadges(merged);
  await env.DB.prepare("UPDATE gemfall SET power=?, rank_name=?, badges=? WHERE id=?")
    .bind(myPower, myRank, myBadges.join(","), id).run();
  /* 客户端主榜已改为闯关榜：真实通关数优先，其次星数、单关最佳。
     power 仍保留给阵营聚合和旧客户端，但不再拿累计复合值制造追榜挫败。 */
  const aheadDepth = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM gemfall WHERE hidden=0 AND (
       lv>? OR (lv=? AND stars>?) OR (lv=? AND stars=? AND best_score>?)
     )`
  ).bind(merged.lv, merged.lv, merged.stars, merged.lv, merged.stars, merged.score).first();
  const aheadPower = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM gemfall WHERE hidden=0 AND power>?"
  ).bind(myPower).first();
  await gfSealRushWeeks(env, now);
  const awards = await env.DB.prepare(
    `SELECT week,rank,boxes,dust FROM gf_rush_award WHERE id=?
     ORDER BY week DESC LIMIT 24`
  ).bind(id).all();
  return json({ ok: true, power: myPower, rank: ((aheadPower && aheadPower.c) || 0) + 1,
    depthRank: ((aheadDepth && aheadDepth.c) || 0) + 1,
    rankName: myRank, badges: myBadges, tag: id.slice(-2),   // tag 给客户端区分同名
    aliasMonth: rename.changed ? rename.month : ((aliasLog && aliasLog.changed_month) || ""),
    rushAwards: (awards.results || []).map(a => ({
      week: a.week, rank: a.rank, boxes: a.boxes, dust: a.dust,
    })),
    classJoined, season: sea }, 200, origin);
}
/* 两阵营实力比。只返回占比：不返回人数、化名或个人贡献。
   光明看关卡深度，黑域看连锁与高分，并用单人封顶避免头部玩家决定一切。 */
/* 同上：算分抽出来给月末封榜复用 */
async function gfCampRaw(env) {
  await gfEnsure(env);
  /* 单人封顶：CAP 之上的部分不再计入。
     真实分布里头号玩家的矿力 = 其余 12 人总和的 63%，不封顶的话
     他一个人就替自己阵营把条子拉满，另一营再怎么努力都不动——
     那才是「看起来没人玩」的真正原因（跟人数无关）。
     取各营中位数×3 太重（要两次查询），这里用固定量级封顶，
     数量级与当前中位数（5,560 矿力 ≈ 各指标百来分）对齐。 */
  const CAP = 400;
  /* 只算**近 7 天来过的人**。以前这条 SQL 没有任何时间窗，而统计列全是 MAX 只增不减，
     于是贡献一旦进池就永不衰减：设计注释里承诺的「每周结算、永远没有永久输家」
     从来没实现过——落后的一营没法靠「这周打得比你好」翻盘，只能靠拉新人。
     用滚动 7 天而不是自然周：自然周会在周一零点造成一次断崖式清零，
     而滚动窗口没有那一刻，不活跃就慢慢淡出，回来就慢慢回来。 */
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
  /* 配速员只以封顶后的聚合分参与，不下发任何个人记录。 */
  if (await pacersOn(env)) {
    for (const p of pacerRows(Date.now())) {
      const k = p.camp;
      const line = k === "light" ? (p.lv * 150 + p.stars * 120) / 120
                 :                    (p.chain * 60 + p.best_score / 50 + p.best_rush / 40) / 30;
      raw[k] += Math.min(PACER_CAMP_CAP, Math.max(0, Math.round(line)));
    }
  }
  return { light: raw.light, dark: raw.dark };
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
  return json({ ok: true, empty: tot === 0, pct }, 200, origin);
}

/* 公开榜合并后的唯一排序器。数据库行与配速员都走这里，避免“先各排一遍再拼”
   造成同关不同序；闯关榜严格复用客户端公开的关卡、星数、单关最佳三层规则。 */
function gfBoardCmp(scope, a, b) {
  if (scope === "depth") return (b.lv || 0) - (a.lv || 0)
    || (b.stars || 0) - (a.stars || 0)
    || (b.best_score || 0) - (a.best_score || 0)
    || String(a.alias).localeCompare(String(b.alias));
  if (scope === "boss") return (b.boss_score || 0) - (a.boss_score || 0)
    || (b.boss_floor || 0) - (a.boss_floor || 0)
    || (b.boss_progress || 0) - (a.boss_progress || 0)
    || (a.updated_at || 0) - (b.updated_at || 0)
    || String(a.alias).localeCompare(String(b.alias));
  const key = (scope === "rush" || scope === "rushAll") ? "best_rush" : "power";
  return (b[key] || 0) - (a[key] || 0) || String(a.alias).localeCompare(String(b.alias));
}

async function gfBoard(req, env, origin, url) {
  await gfEnsure(env);
  await gfSealMonth(env);   // 访问量最大的入口，靠它把月初那一刻兜住
  await gfSealRushWeeks(env, Date.now());
  const sea = url.searchParams.get("season") || await getSeason(env);
  const scope = url.searchParams.get("scope") || "world";
  const limit = clampInt(url.searchParams.get("limit") || 50, 1, 100);
  let rows;
  /* ⚠ 这里加列时别忘了 gfMap 也要跟着加 —— 两边任何一边漏掉，
     客户端拿到的就是 undefined，而三线首座算的是每个人的三条线，缺一项就整条算错。 */
  const cols = "id,alias,power,best_score,best_rush,lv,stars,chain,rank_name,badges,"
             + "runs,days,dbest,best_dig,luck,comp";
  /* 不按 season 过滤：gemfall 没有 base_power 基线，赛季语义对它本来就不成立；
     而 meta.season 是和词灵榜共用的 —— 一旦老师在词灵榜点「封榜」推进了赛季，
     这里按 season 过滤就会把整个矿脉榜读成空。矿脉榜记的是累计进度（关卡、星数），
     本来就该是长期榜，要清空走 /gf/admin 的 reset。 */
  /* 90 秒榜：只比本周真实玩家的单局最佳。长期历史最佳仍留在 gemfall，
     用于矿灯段位、名片和个人纪录；周榜单独让新人有重新追榜的窗口。 */
  if (scope === "rush") {
    const week = gfRushWeekKey(Date.now());
    rows = await env.DB.prepare(
      `SELECT g.id,g.alias,g.power,g.best_score,w.best_rush,g.best_rush AS rush_all,g.lv,g.stars,g.chain,
              g.rank_name,g.badges,g.runs,g.days,g.dbest,g.best_dig,g.luck,
              CASE WHEN w.comp!='' THEN w.comp ELSE g.comp END AS comp
         FROM gf_rush_week w JOIN gemfall g ON g.id=w.id
        WHERE w.week=? AND g.hidden=0 AND w.best_rush>0
        ORDER BY w.best_rush DESC,g.alias ASC LIMIT ?`
    ).bind(week, limit).all();
  } else if (scope === "rushAll") {
    rows = await env.DB.prepare(
      `SELECT ${cols} FROM gemfall WHERE hidden=0 AND best_rush>0
       ORDER BY best_rush DESC, alias ASC LIMIT ?`
    ).bind(limit).all();
  } else if (scope === "boss") {
    rows = await env.DB.prepare(
      `SELECT g.id,g.alias,g.power,g.best_score,g.best_rush,g.lv,g.stars,g.chain,
              g.rank_name,g.badges,g.runs,g.days,g.dbest,g.best_dig,g.luck,
              CASE WHEN b.comp!='' THEN b.comp ELSE g.comp END AS comp,
              b.best_floor AS boss_floor,b.best_progress AS boss_progress,
              b.best_score AS boss_score,b.build AS boss_build,b.updated_at
         FROM gf_boss_best b JOIN gemfall g ON g.id=b.id
        WHERE g.hidden=0 AND b.best_floor>0
        ORDER BY b.best_score DESC,b.best_floor DESC,b.best_progress DESC,
                 b.updated_at ASC,g.alias ASC LIMIT ?`
    ).bind(limit).all();
  } else if (scope === "depth") {
    rows = await env.DB.prepare(
      `SELECT ${cols} FROM gemfall WHERE hidden=0 AND lv>0
       ORDER BY lv DESC, stars DESC, best_score DESC, alias ASC LIMIT ?`
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
  /* 配速员进入全部公开玩法榜；私榜仍隔离。90 秒周奖只按真实 D1 行封榜，
     配速员不写库、不领匣，也不会改变任何真人已经取得的奖励。先给真人行记下
     独立奖励名次，再统一按分数混排，避免周初出现低分压在高分上面的假榜。 */
  let merged = rows.results || [];
  if(scope==="rush")merged=merged.map((r,i)=>Object.assign({},r,{reward_rank:i+1}));
  if (scope !== "class" && await pacersOn(env)) {
    let bots=pacerRows(Date.now()).map(r=>Object.assign({},r));
    if(scope==="rush"){
      const week=gfRushWeekKey(Date.now());
      bots=bots.map(r=>{const q=.80+pacerRnd((parseInt(String(r.id).split(':')[1],10)||1)+(parseInt(week,10)||0))()*.17;return Object.assign({},r,{best_rush:Math.round((r.best_rush||0)*q)})});
    }
    bots=bots.filter(r => scope !== "rushAll" || (r.best_rush || 0) > 0)
      .filter(r => scope !== "rush" || (r.best_rush || 0) > 0)
      .filter(r => scope !== "depth" || (r.lv || 0) > 0)
      .filter(r => scope !== "boss" || (r.boss_score || 0) > 0)
      .sort((a,b)=>gfBoardCmp(scope,a,b));
    merged=merged.concat(bots).sort((a,b)=>gfBoardCmp(scope,a,b)).slice(0,limit);
  }
  const week = scope === "rush" ? gfRushWeekKey(Date.now()) : "";
  return json({ ok: true, season: sea, scope, count: merged.length, rows: gfMap(merged),
    week, weekLabel: week ? gfRushWeekLabel(week) : "",
    rewards: scope === "rush" ? GF_RUSH_REWARDS : [] }, 200, origin);
}
/* 月结算只返回阵营胜方与实力，不返回旧表中的 members 或旧门派记录。 */
async function gfMonth(req, env, origin, url) {
  await gfSealMonth(env);
  const n = clampInt(url.searchParams.get("limit") || 6, 1, 24);
  const rows = await env.DB.prepare(
    "SELECT m,kind,rank,name,power FROM gf_month WHERE kind='camp' ORDER BY m DESC, rank ASC LIMIT ?"
  ).bind(n).all();
  return json({ ok: true, rows: (rows.results || []).map(r => ({
    m: r.m, kind: r.kind, rank: r.rank, name: r.name || "",
    power: r.power || 0,
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
    const id = String(body.id || "");
    await env.DB.batch([
      env.DB.prepare("DELETE FROM gemfall WHERE id=?").bind(id),
      env.DB.prepare("DELETE FROM gemfall_alias_month WHERE id=?").bind(id),
      env.DB.prepare("DELETE FROM gf_rush_week WHERE id=?").bind(id),
      env.DB.prepare("DELETE FROM gf_rush_award WHERE id=?").bind(id),
      env.DB.prepare("DELETE FROM gf_boss_best WHERE id=?").bind(id),
    ]);
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
    await env.DB.batch([
      env.DB.prepare("DELETE FROM gemfall"),
      env.DB.prepare("DELETE FROM gemfall_alias_month"),
      env.DB.prepare("DELETE FROM gf_rush_week"),
      env.DB.prepare("DELETE FROM gf_rush_award"),
      env.DB.prepare("DELETE FROM gf_rush_seal"),
      env.DB.prepare("DELETE FROM gf_boss_best"),
    ]);
    return json({ ok: true }, 200, origin);
  }
  return json({ ok: false, err: "unknown act" }, 400, origin);
}

/* ══════════════════════════════════════════════════════════════
   是猴就上100层 · 世界楼榜
   独立表、独立路由 /monkey/*。三条榜分别量本周最好、生涯最好、
   以及「不白摔」的累计局数；单局 runId 只记一次，断线重传不会重复加局。
   ══════════════════════════════════════════════════════════════ */
const MONKEY_CAP = { height: 500000, score: 10000000, bananas: 1000000 };
const MONKEY_ALIAS_RE = /^[一-龥A-Za-z0-9·\-_ ]{2,12}$/;
const MONKEY_SCOPES = new Set(["weekly", "alltime", "effort"]);
let _monkeyReady = false, _monkeyAdminFails = 0, _monkeyAdminLockUntil = 0;

function monkeyWeekKey(now) {
  const d = new Date(now + 8 * 3600000);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return "" + d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, "0")
    + String(d.getUTCDate()).padStart(2, "0");
}
function monkeyWeekLabel(key) {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(key || ""));
  if (!m) return "本周";
  const a = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const b = new Date(a.getTime() + 6 * 86400000);
  return (a.getUTCMonth() + 1) + "月" + a.getUTCDate() + "日-"
    + (b.getUTCMonth() + 1) + "月" + b.getUTCDate() + "日";
}
function monkeyDayKey(now) {
  return new Date(now + 8 * 3600000).toISOString().slice(0, 10);
}
function monkeyCleanRun(body) {
  const src = body && body.run || body || {};
  const runId = String(src.runId || "").trim();
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(runId)) return { ok: false, err: "本局编号无效" };
  const height = clampInt(src.height, 0, MONKEY_CAP.height);
  const score = clampInt(src.score, 0, MONKEY_CAP.score);
  const bananas = clampInt(src.bananas, 0, MONKEY_CAP.bananas);
  if (score < height || bananas > score) return { ok: false, err: "本局数据关系不成立" };
  return { ok: true, runId, height, score, bananas };
}
function monkeyOrder(scope) {
  if (scope === "effort") return "runs DESC,total_meters DESC,best_height DESC,alias ASC";
  if (scope === "weekly") return "week_height DESC,week_score DESC,runs DESC,alias ASC";
  return "best_height DESC,best_score DESC,runs DESC,alias ASC";
}
async function monkeyEnsure(env) {
  if (_monkeyReady) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS monkey_players (
       id TEXT PRIMARY KEY, alias TEXT NOT NULL,
       best_height INTEGER DEFAULT 0, best_score INTEGER DEFAULT 0,
       week_key TEXT DEFAULT '', week_height INTEGER DEFAULT 0, week_score INTEGER DEFAULT 0,
       runs INTEGER DEFAULT 0, total_meters INTEGER DEFAULT 0,
       day_key TEXT DEFAULT '', day_submits INTEGER DEFAULT 0,
       first_seen TEXT DEFAULT '', last_write INTEGER DEFAULT 0, hidden INTEGER DEFAULT 0)`
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS monkey_runs (
       run_hash TEXT PRIMARY KEY, player_id TEXT NOT NULL, at INTEGER DEFAULT 0)`
  ).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_monkey_all ON monkey_players(hidden,best_height,best_score)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_monkey_week ON monkey_players(week_key,hidden,week_height,week_score)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_monkey_effort ON monkey_players(hidden,runs,total_meters)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_monkey_runs_at ON monkey_runs(at)").run();
  _monkeyReady = true;
}
function monkeyMapRow(r) {
  if (!r) return null;
  return {
    rank: Number(r.rank) || 0, alias: r.alias, tag: String(r.id || "").slice(-2),
    height: Number(r.best_height) || 0, score: Number(r.best_score) || 0,
    weekHeight: Number(r.week_height) || 0, weekScore: Number(r.week_score) || 0,
    runs: Number(r.runs) || 0, totalMeters: Number(r.total_meters) || 0,
  };
}
async function monkeyRanked(env, scope, week, id, limit) {
  const order = monkeyOrder(scope), where = scope === "weekly" ? "hidden=0 AND week_key=?" : "hidden=0";
  const bindPrefix = scope === "weekly" ? [week] : [];
  const cte = `WITH ranked AS (
    SELECT id,alias,best_height,best_score,week_height,week_score,runs,total_meters,
      ROW_NUMBER() OVER (ORDER BY ${order}) AS rank
    FROM monkey_players WHERE ${where})`;
  const top = await env.DB.prepare(`${cte} SELECT * FROM ranked ORDER BY rank LIMIT ?`).bind(...bindPrefix, limit).all();
  let me = null, nearby = [];
  if (id) {
    me = await env.DB.prepare(`${cte} SELECT * FROM ranked WHERE id=?`).bind(...bindPrefix, id).first();
    if (me) {
      const lo = Math.max(1, Number(me.rank) - 2), hi = Number(me.rank) + 2;
      const near = await env.DB.prepare(`${cte} SELECT * FROM ranked WHERE rank BETWEEN ? AND ? ORDER BY rank`).bind(...bindPrefix, lo, hi).all();
      nearby = (near.results || []).map(monkeyMapRow);
    }
  }
  return { rows: (top.results || []).map(monkeyMapRow), me: monkeyMapRow(me), nearby };
}
async function monkeyPlayerId(env, raw) {
  const dev = String(raw || "");
  if (dev.length < 12 || dev.length > 120) return "";
  return sha256("monkey|" + dev + "|" + env.LB_SALT);
}
async function monkeyBoard(req, env, origin, url) {
  await monkeyEnsure(env);
  const scope = MONKEY_SCOPES.has(url.searchParams.get("scope")) ? url.searchParams.get("scope") : "weekly";
  const limit = clampInt(url.searchParams.get("limit") || 20, 1, 50);
  const week = monkeyWeekKey(Date.now());
  const token = String(url.searchParams.get("playerToken") || "");
  const id = /^[0-9a-f]{64}$/.test(token) ? token : "";
  const board = await monkeyRanked(env, scope, week, id, limit);
  return json({ ok: true, game: "monkey", scope, week, weekLabel: monkeyWeekLabel(week), ...board }, 200, origin);
}
async function monkeySubmitReport(env, id, runId, duplicate, origin) {
  const week = monkeyWeekKey(Date.now());
  const player = await env.DB.prepare(
    "SELECT id,alias,best_height,best_score,week_height,week_score,runs,total_meters FROM monkey_players WHERE id=?"
  ).bind(id).first();
  const all = await monkeyRanked(env, "alltime", week, id, 1);
  const weekly = await monkeyRanked(env, "weekly", week, id, 1);
  const effort = await monkeyRanked(env, "effort", week, id, 1);
  return json({ ok: true, game: "monkey", acceptedRunId: runId, duplicate, playerToken: id, player: monkeyMapRow(player),
    ranks: { weekly: weekly.me?.rank || 0, alltime: all.me?.rank || 0, effort: effort.me?.rank || 0 },
    week, weekLabel: monkeyWeekLabel(week) }, 200, origin);
}
async function monkeySubmit(req, env, origin) {
  if ((env.LB_KILL || "0") === "1") return json({ ok: false, err: "榜单维护中" }, 503, origin);
  await monkeyEnsure(env);
  let body;
  try { body = await req.json(); } catch (e) { return json({ ok: false, err: "bad json" }, 400, origin); }
  const id = await monkeyPlayerId(env, body.deviceUUID);
  if (!id) return json({ ok: false, err: "缺少匿名设备编号" }, 400, origin);
  let alias = String(body.alias || "").trim().slice(0, 12);
  if (!MONKEY_ALIAS_RE.test(alias)) return json({ ok: false, err: "化名需 2-12 位中英文或数字" }, 400, origin);
  if (hasBlocked(alias)) return json({ ok: false, err: "化名含保留词，请换一个" }, 400, origin);
  const run = monkeyCleanRun(body);
  if (!run.ok) return json({ ok: false, err: run.err }, 400, origin);
  const runHash = await sha256(id + "|" + run.runId), now = Date.now();
  const duplicate = await env.DB.prepare("SELECT run_hash FROM monkey_runs WHERE run_hash=?").bind(runHash).first();
  if (duplicate) {
    // 同一局重传只能更新公开化名，绝不能再增加局数与累计米数。
    // 这样玩家可以改名，也让断网重试保持真正幂等。
    await env.DB.prepare("UPDATE monkey_players SET alias=? WHERE id=?").bind(alias, id).run();
    return monkeySubmitReport(env, id, run.runId, true, origin);
  }

  const prev = await env.DB.prepare("SELECT day_key,day_submits FROM monkey_players WHERE id=?").bind(id).first();
  const day = monkeyDayKey(now), daySubmits = prev && prev.day_key === day ? Number(prev.day_submits) || 0 : 0;
  if (daySubmits >= 240) return json({ ok: false, err: "今日补交过多，请明天再试" }, 429, origin);
  const week = monkeyWeekKey(now), firstSeen = new Date(now).toISOString().slice(0, 10);
  const update = env.DB.prepare(
    `INSERT INTO monkey_players
      (id,alias,best_height,best_score,week_key,week_height,week_score,runs,total_meters,day_key,day_submits,first_seen,last_write,hidden)
     SELECT ?,?,?,?,?,?,?,1,?,?,1,?,?,0 WHERE NOT EXISTS (SELECT 1 FROM monkey_runs WHERE run_hash=?)
     ON CONFLICT(id) DO UPDATE SET
       alias=excluded.alias,
       best_height=MAX(monkey_players.best_height,excluded.best_height),
       best_score=MAX(monkey_players.best_score,excluded.best_score),
       week_height=CASE WHEN monkey_players.week_key=excluded.week_key THEN MAX(monkey_players.week_height,excluded.week_height) ELSE excluded.week_height END,
       week_score=CASE WHEN monkey_players.week_key=excluded.week_key THEN MAX(monkey_players.week_score,excluded.week_score) ELSE excluded.week_score END,
       week_key=excluded.week_key,runs=monkey_players.runs+1,total_meters=monkey_players.total_meters+excluded.total_meters,
       day_key=excluded.day_key,day_submits=CASE WHEN monkey_players.day_key=excluded.day_key THEN monkey_players.day_submits+1 ELSE 1 END,
       last_write=excluded.last_write`
  ).bind(id, alias, run.height, run.score, week, run.height, run.score, run.height, day, firstSeen, now, runHash);
  const marker = env.DB.prepare("INSERT OR IGNORE INTO monkey_runs(run_hash,player_id,at) VALUES(?,?,?)").bind(runHash, id, now);
  await env.DB.batch([update, marker]);
  if (now % 31 === 0) {
    try { await env.DB.prepare("DELETE FROM monkey_runs WHERE at<?").bind(now - 90 * 86400000).run(); } catch (e) {}
  }
  return monkeySubmitReport(env, id, run.runId, false, origin);
}
async function monkeyAdmin(req, env, origin) {
  if (Date.now() < _monkeyAdminLockUntil) return json({ ok: false, err: "尝试过多，请稍后" }, 429, origin);
  await monkeyEnsure(env);
  let body;
  try { body = await req.json(); } catch (e) { return json({ ok: false }, 400, origin); }
  if (await sha256(String(body.pw || "")) !== env.LB_ADMIN_HASH) {
    if (++_monkeyAdminFails >= 8) { _monkeyAdminLockUntil = Date.now() + 60000; _monkeyAdminFails = 0; }
    return json({ ok: false, err: "密码不正确" }, 403, origin);
  }
  _monkeyAdminFails = 0;
  const act = String(body.action || "");
  if (act === "list") {
    const rows = await env.DB.prepare("SELECT id,alias,best_height,best_score,runs,total_meters,hidden FROM monkey_players ORDER BY best_height DESC LIMIT 300").all();
    return json({ ok: true, rows: rows.results || [] }, 200, origin);
  }
  if (act === "hide" || act === "unhide") {
    await env.DB.prepare("UPDATE monkey_players SET hidden=? WHERE id=?").bind(act === "hide" ? 1 : 0, String(body.id || "")).run();
    return json({ ok: true }, 200, origin);
  }
  if (act === "delete") {
    const id = String(body.id || "");
    await env.DB.batch([env.DB.prepare("DELETE FROM monkey_players WHERE id=?").bind(id), env.DB.prepare("DELETE FROM monkey_runs WHERE player_id=?").bind(id)]);
    return json({ ok: true }, 200, origin);
  }
  return json({ ok: false, err: "unknown action" }, 400, origin);
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
      if (p === "/gf/camps" && request.method === "GET") return await gfCamps(request, env, origin, url);
      if (p === "/gf/month" && request.method === "GET") return await gfMonth(request, env, origin, url);
      if (p === "/gf/submit" && request.method === "POST") return await gfSubmit(request, env, origin);
      if (p === "/gf/admin" && request.method === "POST") return await gfAdmin(request, env, origin);
      if (p === "/monkey/board" && request.method === "GET") return await monkeyBoard(request, env, origin, url);
      if (p === "/monkey/submit" && request.method === "POST") return await monkeySubmit(request, env, origin);
      if (p === "/monkey/admin" && request.method === "POST") return await monkeyAdmin(request, env, origin);
      if (p === "/") return json({ ok: true, name: "MYSKME 排行榜", v: 5, games: ["wordduel", "gemfall", "monkey"], season: await getSeason(env) }, 200, origin);
      return json({ ok: false, err: "not found" }, 404, origin);
    } catch (e) {
      console.error("LB worker error:", e && e.stack || e);
      return json({ ok: false, err: "server error" }, 500, origin);
    }
  },
};
