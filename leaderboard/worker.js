// 名人天梯 · 词灵榜 — MYSKME 排行榜后端（Cloudflare Worker + D1）
// 唯一写入口：服务端重算分数、硬上限、口令哈希、限频、化名过滤、老师审核。
// 读路径公开（书架/词灵对决 GET），写路径仅信任原始计数后重算。
// MYSKME 题库工坊 / MYSKME × 英语王老师

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

// 灵力公式（全部来自词灵对决已记录的计数）
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

const ALIAS_RE = /^[一-龥A-Za-z0-9·\-_ ]{2,12}$/;
const BLOCK = ["管理员", "admin", "老师", "王老师", "狼先生", "mrwolf", "myskme", "客服", "官方", "系统"];

const enc = new TextEncoder();
async function sha256(str) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// 上限取自真实题库目录（题数 + 各档辑数），防止字段灌水
const LAUNCH = Date.UTC(2026, 0, 1); // 产品基准日，days/best 上限 = 距今天数
function daysSinceLaunch() { return Math.floor((Date.now() - LAUNCH) / 86400000) + 1; }
let _caps = null, _capsAt = 0;
async function catalogCaps() {
  const now = Date.now();
  if (_caps && now - _capsAt < 600000) return _caps;
  let caps = { totalQ: 500, freeBanks: 8, svipBanks: 8 }; // 兜底
  try {
    const r = await fetch("https://myskme.github.io/myskme-hub/banks/index.json", { cf: { cacheTtl: 600 } });
    const d = await r.json();
    const cat = d.catalog || [];
    const totalQ = cat.reduce((a, b) => a + (b.count || 0), 0);
    if (totalQ > 0) {
      caps = { totalQ, freeBanks: cat.filter(b => b.tier === "free").length, svipBanks: cat.filter(b => b.tier === "svip").length };
      _caps = caps; _capsAt = now;
    }
  } catch (e) {}
  return caps;
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
function season() { return new Date().toISOString().slice(0, 7); }

async function handleSubmit(req, env, origin) {
  if ((env.LB_KILL || "0") === "1") return json({ ok: false, err: "榜单维护中" }, 503, origin);
  let body;
  try { body = await req.json(); } catch (e) { return json({ ok: false, err: "bad json" }, 400, origin); }

  const dev = String(body.deviceUUID || "");
  if (dev.length < 8) return json({ ok: false, err: "no device" }, 400, origin);
  const id = await sha256(dev + "|" + env.LB_SALT);

  // 限频：同一设备 15 秒冷却
  const prev = await env.DB.prepare("SELECT last_write, first_seen, lifetime_power FROM leaderboard WHERE id=?").bind(id).first();
  const now = Date.now();
  if (prev && prev.last_write && now - prev.last_write < 15000)
    return json({ ok: false, err: "太频繁，请稍后再上榜" }, 429, origin);

  // 化名
  let alias = String(body.alias || "").trim().slice(0, 12);
  if (!ALIAS_RE.test(alias)) return json({ ok: false, err: "化名需 2-12 位中英文/数字" }, 400, origin);
  const low = alias.toLowerCase();
  if (BLOCK.some(w => low.includes(w))) return json({ ok: false, err: "化名含保留词，请换一个" }, 400, origin);
  const faction = String(body.faction || "").trim().slice(0, 8);

  // 班级口令（可选）：仅正确口令进入班级榜命名空间
  let classTag = "";
  if (body.pw) {
    const h = await sha256(String(body.pw));
    if (h === env.LB_CLASS_HASH) classTag = h;
    else return json({ ok: false, err: "班级口令不正确" }, 403, origin);
  }

  // 服务端重算（无视客户端传来的分数）+ 硬上限（取自真实题库目录）
  const caps = await catalogCaps();
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
  const power = computePower(src);
  const badges = badgesFor(src);
  const rname = rankFor(power);
  const sea = season();
  const firstSeen = (prev && prev.first_seen) ? prev.first_seen : new Date().toISOString().slice(0, 10);
  const lifetime = Math.max(power, (prev && prev.lifetime_power) || 0);

  await env.DB.prepare(
    `INSERT INTO leaderboard
      (id,alias,faction,class_tag,power,lifetime_power,rank_name,lit,killed,acc,days,best,free_banks,svip_banks,badges,season,first_seen,last_write,hidden)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0)
     ON CONFLICT(id) DO UPDATE SET
       alias=excluded.alias, faction=excluded.faction,
       class_tag=CASE WHEN excluded.class_tag!='' THEN excluded.class_tag ELSE leaderboard.class_tag END,
       power=excluded.power, lifetime_power=excluded.lifetime_power, rank_name=excluded.rank_name,
       lit=excluded.lit, killed=excluded.killed, acc=excluded.acc, days=excluded.days, best=excluded.best,
       free_banks=excluded.free_banks, svip_banks=excluded.svip_banks, badges=excluded.badges,
       season=excluded.season, last_write=excluded.last_write`
  ).bind(id, alias, faction, classTag, power, lifetime, rname, src.lit, src.killed, src.acc, src.days,
         src.best, src.freeBanks, src.svipBanks, badges.join(","), sea, firstSeen, now).run();

  // 计算名次（世界榜）
  const rk = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM leaderboard WHERE season=? AND hidden=0 AND power>?"
  ).bind(sea, power).first();
  const myRank = (rk ? rk.c : 0) + 1;

  return json({ ok: true, power, lifetimePower: lifetime, rank: myRank, rankName: rname, badges }, 200, origin);
}

async function handleBoard(req, env, origin, url) {
  const sea = url.searchParams.get("season") || season();
  const scope = url.searchParams.get("scope") || "world";
  const limit = clampInt(url.searchParams.get("limit") || 50, 1, 100);
  let rows;
  if (scope === "class") {
    const c = url.searchParams.get("c") || "";
    if (!c) return json({ ok: false, err: "缺少班级标识" }, 400, origin);
    rows = await env.DB.prepare(
      "SELECT alias,faction,power,rank_name,badges FROM leaderboard WHERE season=? AND class_tag=? AND hidden=0 ORDER BY power DESC, alias ASC LIMIT ?"
    ).bind(sea, c, limit).all();
  } else {
    rows = await env.DB.prepare(
      "SELECT alias,faction,power,rank_name,badges FROM leaderboard WHERE season=? AND hidden=0 ORDER BY power DESC, alias ASC LIMIT ?"
    ).bind(sea, limit).all();
  }
  const list = (rows.results || []).map((r, i) => ({
    rank: i + 1, alias: r.alias, faction: r.faction || "",
    power: r.power, rankName: r.rank_name, badges: r.badges ? r.badges.split(",") : [],
  }));
  return json({ ok: true, season: sea, scope, count: list.length, rows: list }, 200, origin);
}

async function handleAdmin(req, env, origin) {
  let body;
  try { body = await req.json(); } catch (e) { return json({ ok: false }, 400, origin); }
  const h = await sha256(String(body.pw || ""));
  if (h !== env.LB_ADMIN_HASH) return json({ ok: false, err: "密码不正确" }, 403, origin);
  const act = body.action;
  if (act === "list") {
    const rows = await env.DB.prepare(
      "SELECT id,alias,faction,class_tag,power,rank_name,hidden FROM leaderboard ORDER BY power DESC LIMIT 200"
    ).all();
    return json({ ok: true, rows: rows.results || [] }, 200, origin);
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
      if (p === "/submit" && request.method === "POST") return await handleSubmit(request, env, origin);
      if (p === "/admin" && request.method === "POST") return await handleAdmin(request, env, origin);
      if (p === "/") return json({ ok: true, name: "名人天梯 · 词灵榜", season: season() }, 200, origin);
      return json({ ok: false, err: "not found" }, 404, origin);
    } catch (e) {
      return json({ ok: false, err: "server error", detail: String(e && e.message || e) }, 500, origin);
    }
  },
};
