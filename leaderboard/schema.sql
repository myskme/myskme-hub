-- 名人天梯 · 词灵榜 — D1 schema（Cloudflare D1 / SQLite）
-- 数据库：myskme-leaderboard
CREATE TABLE IF NOT EXISTS leaderboard (
  id TEXT PRIMARY KEY,            -- sha256(deviceUUID + LB_SALT)，匿名设备键（永不存原始 UUID）
  alias TEXT NOT NULL,            -- 化名（2-12 位中英文/数字/·-_）
  faction TEXT DEFAULT '',        -- 门派（可选）
  class_tag TEXT DEFAULT '',      -- 班级命名空间 = sha256(班级口令)
  power INTEGER NOT NULL DEFAULT 0,        -- 服务端重算的赛季灵力
  lifetime_power INTEGER NOT NULL DEFAULT 0,
  rank_name TEXT DEFAULT '',      -- 段位名
  lit INTEGER DEFAULT 0,          -- 原始计数（用于徽章判定 + 服务端复核上限）
  killed INTEGER DEFAULT 0,
  acc INTEGER DEFAULT 0,
  days INTEGER DEFAULT 0,
  best INTEGER DEFAULT 0,
  free_banks INTEGER DEFAULT 0,
  svip_banks INTEGER DEFAULT 0,
  badges TEXT DEFAULT '',         -- 逗号分隔的徽章 id（a1..a14）
  season TEXT NOT NULL DEFAULT '',-- YYYY-MM
  updated_bucket TEXT DEFAULT '', -- 预留：粗粒度时间（隐私，不存精确时间）
  first_seen TEXT DEFAULT '',     -- 首次提交日期（预留：按入站天数收紧上限）
  last_write INTEGER DEFAULT 0,   -- epoch ms，限频用（不对外暴露）
  hidden INTEGER DEFAULT 0        -- 老师隐藏标记
);
CREATE INDEX IF NOT EXISTS idx_lb_world ON leaderboard(season, hidden, power DESC);
CREATE INDEX IF NOT EXISTS idx_lb_class ON leaderboard(class_tag, season, hidden, power DESC);
