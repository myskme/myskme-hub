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
      if (p === "/") return json({ ok: true, name: "名人天梯 · 词灵榜", v: 3, season: await getSeason(env) }, 200, origin);
      return json({ ok: false, err: "not found" }, 404, origin);
    } catch (e) {
      console.error("LB worker error:", e && e.stack || e);
      return json({ ok: false, err: "server error" }, 500, origin);
    }
  },
};
