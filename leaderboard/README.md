# 名人天梯 · 词灵榜 — 排行榜后端

MYSKME 题库书架的联网世界榜/班级榜。免费、低维护：**一个 Cloudflare Worker + 一个 D1 数据库**。
读路径全静态（书架/词灵对决 GET 即可），写路径只此一个网关，服务端重算分数、防作弊、可审核。

## 线上
- Worker：`https://myskme-leaderboard.wzc1020.workers.dev`
- D1 库：`myskme-leaderboard`
- 展示：题库书架 `https://myskme.github.io/myskme-hub/banks/`（名人天梯 widget，世界榜 + 班级榜口令）

## 接口
- `GET /board?scope=world&limit=20` → 世界榜（化名/段位/灵力/徽章数）
- `GET /board?scope=class&c=<sha256(班级口令)>&limit=30` → 班级榜
- `POST /submit` → 唯一写入口（由词灵对决战绩页「上榜」调用）
  body: `{deviceUUID, alias, faction?, pw?(班级口令), src:{lit,killed,acc,days,best,freeBanks,svipBanks}}`
  服务端：限频(15s/设备) → 校验化名(2-12位+黑名单) → 班级口令哈希校验 → **重算灵力(无视客户端分数)** → 按真实题库目录压上限(题数/各档辑数/距launch天数) → 算段位+徽章 → upsert 一行 → 返回 `{power,rank,rankName,badges}`
- `POST /admin` → 老师审核（`pw=mrwolf4358`）：`{action:list|hide|unhide|delete|reset, id?, confirm?}`

## 灵力公式（服务端权威）
`灵力 = 点亮词数×10 + 攻克错题×25 + 准确率×2 + 打卡天数×15 + 最佳连胜×30 + 免费辑×120 + ☠炼狱辑×400`
全部取自词灵对决 SAVE 已记录的计数，零新埋点。

## 段位天梯
学徒 0 → 习字者 300 → 御词生 800 → 词灵使 1800 → 驭灵师 3600 → 黑域行者 6500 → 噬词者 11000 → 词灵宗师 18000 → ☠狼徒·封号弟子 30000

## 密钥（Worker secret / 环境变量）
- `LB_SALT`（secret）：设备键哈希盐，唯一真密钥
- `LB_CLASS_HASH` = sha256("myskme2026")：班级口令校验
- `LB_ADMIN_HASH` = sha256("mrwolf4358")：审核口令校验
- `LB_KILL` = "0"：急停开关（设 "1" 立即停写）

## 防作弊姿态（诚实说明）
课堂级威慑，非银行级安全。静态客户端留不住真密钥，所以：**重算分数让伪造分被无视、按真实目录压上限让不可能值存不进、限频、急停、老师可一键删任意行**。一个铁了心的学生仍可伪造合法范围内的高分——靠老师审核兜底（化名+全满战绩一眼可疑）。

## 隐私（面向未成年人）
默认匿名化名，绝不收真名/学校/精确时间；班级以口令哈希命名空间；按赛季可一键清空（admin reset）。

## 重新部署
Worker 源码即 `worker.js`（ES module）。改完用 Cloudflare API（PUT /accounts/{acc}/workers/scripts/myskme-leaderboard，multipart：metadata{main_module,bindings:[d1+secret_text...]} + worker.js）或 `wrangler deploy`。建表见 `schema.sql`。

## 待办（下一步）
- v1-C：词灵对决战绩页加「上榜」按钮（读 SAVE → POST /submit）+ 段位/灵力/徽章 UI（需 Netlify 令牌部署 word-duel）
- 控制台加「排行榜审核」面板（调 /admin）
- v2：赛季月度重置 + 永久名人堂；v3：门派榜

MYSKME 题库工坊 / MYSKME × 英语王老师
