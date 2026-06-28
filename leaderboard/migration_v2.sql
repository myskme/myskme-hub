-- v1 → v2 迁移（对已上线的 myskme-leaderboard 库执行一次）。
-- 注意：ADD COLUMN 若已存在会报 "duplicate column"——deploy.py 会逐句执行并忽略该类错误，可安全重跑。
ALTER TABLE leaderboard ADD COLUMN base_power INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);

CREATE TABLE IF NOT EXISTS hall_of_fame (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season TEXT NOT NULL, scope TEXT NOT NULL, class_tag TEXT DEFAULT '',
  rank INTEGER, alias TEXT, faction TEXT DEFAULT '',
  power INTEGER DEFAULT 0, badges TEXT DEFAULT '', crowned_at TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_hall ON hall_of_fame(scope, season, rank);
CREATE INDEX IF NOT EXISTS idx_hall_class ON hall_of_fame(class_tag, season, rank);

-- 设当前活跃赛季 = 当月，并把现有行统一归入当月、起点清零（软启动，老 demo 行不致消失）
INSERT OR IGNORE INTO meta(k, v) VALUES ('season', strftime('%Y-%m', 'now'));
UPDATE leaderboard SET season = (SELECT v FROM meta WHERE k='season'), base_power = 0;
