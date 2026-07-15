# 名人天梯 · 词灵榜 — 排行榜后端（v2）

MYSKME 题库书架的联网世界榜/班级榜/名人堂。免费、低维护：**一个 Cloudflare Worker + 一个 D1 数据库**。
读路径全静态（书架/词灵对决 GET），写路径只此一个网关，服务端重算分数、防作弊、可审核。

## 线上
- Worker：`https://myskme-leaderboard.wzc1020.workers.dev`（账号 020412…，D1 库 `myskme-leaderboard`）
- 展示：题库书架 `https://myskme.github.io/myskme-hub/banks/`（名人天梯 widget：世界榜 / 班级榜 / 名人堂 + 榜单海报）
- 上榜：词灵对决战绩页「🏆 上榜」（word-duel.html，Netlify）

## v2 新增
- **赛季灵力（月度）**：`赛季灵力 = power − base_power`。`power` = 终身灵力（当前累计），`base_power` = 本赛季起点。榜单按赛季灵力排名 → 新人与老兵每月同起跑线。学生卡同显赛季灵力 + 终身灵力。段位按赛季灵力。
- **永久名人堂**：`hall_of_fame` 表。教师在控制台点「封榜·开新赛季」→ 本赛季世界前 10（及各班前 3）镌刻名人堂（永不重置）→ 所有人 `base_power=power`（赛季清零）→ 赛季推进到下月。
- **榜单海报**：书架端 canvas 浅色海报（当前所见榜单 top 12，可分享家长群）。

## 接口
- `GET /board?scope=world&limit=20` → 世界榜（按赛季灵力）
- `GET /board?scope=class&pw=<原始班级口令>&limit=30` → 班级榜（**v2 改为传原始口令，服务端加盐哈希**；不再用预算哈希 c=）
- `GET /hall?scope=world&limit=60`（或 `scope=class&pw=…`）→ 名人堂（按赛季倒序）
- `POST /submit` → 唯一写入口（词灵对决「上榜」调用）
  body: `{deviceUUID, alias, faction?, pw?(班级口令), src:{lit,killed,acc,days,best,freeBanks,svipBanks}}`
  服务端：15s/设备冷却 + 每赛季 5000 行上限 → 化名/门派白名单+NFKC 归一保留词过滤 → 班级口令加盐命名空间（错/空都不阻断世界榜）→ **重算灵力(无视客户端分数)** → 真实目录压上限（目录不可用则 503 拒绝，不再宽松兜底）→ 段位/徽章 → upsert → 返回 `{power(赛季), lifetime(终身), rank, rankName, badges, classJoined}`
- `POST /admin`（`pw=<王老师管理口令>`，服务端比对 `LB_ADMIN_HASH`，含 8 次/分钟锁定）：`{action: list|hide|unhide|delete|reset|seal, id?, confirm?, top?}`
  - `seal`（封榜）需 `confirm:"SEAL"`；`reset`（清空）需 `confirm:"RESET"`；`list` 返回 `is_class` 布尔（不再泄露班级哈希）。

## 灵力公式（服务端权威）
`灵力 = 点亮词数×10 + 攻克错题×25 + 准确率×2 + 打卡天数×15 + 最佳连胜×30 + 免费辑×120 + ☠炼狱辑×400`
全部取自词灵对决 SAVE 已记录的累计计数，零新埋点。

## 段位天梯（按赛季灵力）
学徒 0 → 习字者 300 → 御词生 800 → 词灵使 1800 → 驭灵师 3600 → 黑域行者 6500 → 噬词者 11000 → 词灵宗师 18000 → ☠狼徒·封号弟子 30000

## 密钥（Worker secret）
- `LB_SALT`（secret）：设备键 + 班级口令 哈希盐，唯一真密钥
- `LB_CLASS_HASH`：**v2 起不再使用**（班级口令改为加盐 sha256("class|"+口令+"|"+SALT)，多班级各自命名空间）。deploy.py 仍注入，无害。
- `LB_ADMIN_HASH` = sha256(管理口令)：审核口令（明文不入库；口令即 hub/书架/作文墙通用管理口令）
- `LB_KILL` = "0"：急停（设 "1" 立即停写）

## 部署（需 Cloudflare API token）
1. 把 CF token 放到 `/tmp/cf_tok`（权限 Workers Scripts:Edit + D1:Edit）。
2. `python3 leaderboard/deploy.py` —— **会先跑 D1 迁移**（幂等：加 base_power 列 / 建 meta+hall_of_fame；一次性数据迁移仅首次加列时执行，重部署不会重置赛季起点），再部署 worker.js。
3. 冒烟自测：`GET /`（应 v:2）、`GET /board?scope=world`、`POST /submit` 一条、`GET /hall`、控制台「封榜」一次看名人堂。
- 全新库可直接 `schema.sql`；已上线库用 `migration_v2.sql`（或 deploy.py 内置迁移）。

## 防作弊姿态（诚实）
课堂级威慑，非银行级安全。重算分数让伪造分被无视、按真实目录压上限让不可能值存不进、15s 冷却 + 每赛季 5000 行上限挡灌水、急停、老师可一键隐藏/删除/封榜/清空。铁了心的学生仍可伪造合法范围内的高分——靠老师审核兜底。

## 隐私（面向未成年人）
默认匿名化名，绝不收真名/学校/精确时间；班级以加盐口令哈希命名空间；admin list 只回 is_class 布尔不泄露班级哈希；按赛季可封榜或一键清空。

MYSKME 题库工坊 / MYSKME × 英语王老师
