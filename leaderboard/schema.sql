-- 名人天梯 · 词灵榜 v2 — D1 schema（Cloudflare D1 / SQLite）。全新库用此文件；已上线库用 migration.sql。
CREATE TABLE IF NOT EXISTS leaderboard (
  id TEXT PRIMARY KEY,            -- sha256(deviceUUID + LB_SALT)，匿名设备键（永不存原始 UUID）
  alias TEXT NOT NULL,            -- 化名（2-12 位中英文/数字/·-_）
  faction TEXT DEFAULT '',        -- 门派（可选，同样过滤保留词）
  class_tag TEXT DEFAULT '',      -- 班级命名空间 = sha256("class|"+班级口令+"|"+LB_SALT)（加盐）
  power INTEGER NOT NULL DEFAULT 0,        -- 终身灵力（当前累计，服务端重算）
  base_power INTEGER NOT NULL DEFAULT 0,   -- 本赛季起点（封榜时统一刷新为 power；新人=0）。赛季灵力 = power - base_power
  lifetime_power INTEGER NOT NULL DEFAULT 0, -- = power（保留列；不再单调棘轮）
  rank_name TEXT DEFAULT '',      -- 段位名（按赛季灵力）
  lit INTEGER DEFAULT 0, killed INTEGER DEFAULT 0, acc INTEGER DEFAULT 0,
  days INTEGER DEFAULT 0, best INTEGER DEFAULT 0,
  free_banks INTEGER DEFAULT 0, svip_banks INTEGER DEFAULT 0,
  badges TEXT DEFAULT '',         -- 逗号分隔徽章 id（a1..a14）
  season TEXT NOT NULL DEFAULT '',-- 当前所属赛季 YYYY-MM
  updated_bucket TEXT DEFAULT '', first_seen TEXT DEFAULT '',
  last_write INTEGER DEFAULT 0,   -- epoch ms，限频用（不对外）
  hidden INTEGER DEFAULT 0        -- 老师隐藏标记
);
CREATE INDEX IF NOT EXISTS idx_lb_world ON leaderboard(season, hidden);
CREATE INDEX IF NOT EXISTS idx_lb_class ON leaderboard(class_tag, season, hidden);

-- 赛季元信息（当前活跃赛季）
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);

-- 永久名人堂（封榜时镌刻；永不重置）
CREATE TABLE IF NOT EXISTS hall_of_fame (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season TEXT NOT NULL,           -- 该届赛季 YYYY-MM
  scope TEXT NOT NULL,            -- 'world' | 'class'
  class_tag TEXT DEFAULT '',      -- scope=class 时的班级命名空间
  rank INTEGER, alias TEXT, faction TEXT DEFAULT '',
  power INTEGER DEFAULT 0,        -- 该届赛季灵力
  badges TEXT DEFAULT '', crowned_at TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_hall ON hall_of_fame(scope, season, rank);
CREATE INDEX IF NOT EXISTS idx_hall_class ON hall_of_fame(class_tag, season, rank);
