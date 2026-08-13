# 名人天梯 · 词灵榜 — 排行榜后端（v2）

MYSKME 题库书架的联网世界榜/班级榜/名人堂。免费、低维护：**一个 Cloudflare Worker + 一个 D1 数据库**。
读路径全静态（书架/词灵对决 GET），写路径只此一个网关，服务端重算分数、防作弊、可审核。

## 线上
- Worker：`https://myskme-leaderboard.wzc1020.workers.dev`（账号 020412…，D1 库 `myskme-leaderboard`）
- 展示：题库书架 `https://myskme.github.io/myskme-hub/banks/`（名人天梯 widget：世界榜 / 班级榜 / 名人堂 + 榜单海报）
- 上榜：词灵对决战绩页「上榜」（word-duel.html，Netlify）

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
`灵力 = 点亮词数×10 + 攻克错题×25 + 准确率×2 + 打卡天数×15 + 最佳连胜×30 + 免费辑×120 + 炼狱辑×400`
全部取自词灵对决 SAVE 已记录的累计计数，零新埋点。

## 段位天梯（按赛季灵力）
学徒 0 → 习字者 300 → 御词生 800 → 词灵使 1800 → 驭灵师 3600 → 黑域行者 6500 → 噬词者 11000 → 词灵宗师 18000 → 狼徒·封号弟子 30000

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

---

## 灵石远征 · 矿脉榜（GEMFALL）—— 2026-07-29 新增

消消乐《灵石远征》的排行榜。**与词灵榜完全隔离**：独立表 `gemfall`、独立路由 `/gf/*`，
上面那套词灵榜的表、公式、路由一行没动。

### 为什么不复用 /submit

词灵榜的 `/submit` 会**服务端重算灵力**（按题库目录压上限），那套公式绑死在答题数据上。
消消乐的分数没法这样重算，所以走另一条防线：**硬上限 + 15 秒限频 + 每赛季行数上限 + 老师可删**，
与词灵榜同为**课堂级**防作弊，不是银行级。伪造的分数进不来（会被钳到上限），
不可能的数值存不进去（星数不会超过已通关卡数的三倍），老师随时能删。

### 路由

| 路由 | 方法 | 说明 |
|---|---|---|
| `/gf/board?scope=world\|class&pw=&limit=` | GET | 读榜。class 需班级口令（服务端加盐哈希） |
| `/gf/submit` | POST | 上榜。body 含化名、阵营、同行及成绩／累计／六人熟练度摘要；服务端重算矿力与徽记 |
| `/gf/admin` | POST | 老师：list / hide / show / delete / reset（pw 用管理员口令，与 `/admin` 同一个 `LB_ADMIN_HASH`） |

### 矿力公式

```
矿力 = 星数×120 + 已通关卡数×80 + 单关最佳÷50 + 矿灯最佳÷40 + 最长连锁×60
```

星与关卡为主（走得多远），分数为辅（打得多好）。段位见 `GF_RANKS`。

### 与词灵榜的赛季隔离（重要）

矿脉榜**不按赛季过滤**。原因：`gemfall` 没有 `base_power` 基线，赛季语义对它本来就不成立；
而 `meta.season` 是和词灵榜共用的 —— 一旦老师在词灵榜点「封榜·开新赛季」，
矿脉榜若按 season 过滤就会**整个读成空**（老玩家的记录全部消失）。

矿脉榜记的是累计进度（关卡、星数、最佳分），本来就该是长期榜。
要清空走 `/gf/admin` 的 `reset`（需带 `confirm:"RESET"`）。

### 表结构

`gemfall` 表由 `gfEnsure()` 在每次请求时 `CREATE TABLE IF NOT EXISTS` 自动建，
**不需要单独跑 migration**。字段见 worker.js。

化名首次确定也占用当月机会，此后按北京时间自然月重置一次更名机会；月份单独记在
`gemfall_alias_month`，不向事故敏感的 `gemfall` 主表追加列。六位同行均达到最高曜衔时，
服务端把终身资格记为现有 `badges` 字段中的 `g11`，公开榜单据此显示静态虹彩矿名。

### 部署

和以前一样：把 Cloudflare token 放到 `/tmp/cf_tok`，然后

```bash
python3 leaderboard/deploy.py
```

token 需要 `Workers Scripts:Edit` + `D1:Edit`，账号 `020412…`。**用完记得吊销。**

部署后冒烟：

```bash
curl -s https://myskme-leaderboard.wzc1020.workers.dev/ | head -c 200          # 应含 v:4 与 games
curl -s 'https://myskme-leaderboard.wzc1020.workers.dev/gf/board?scope=world'  # 应返回 ok:true 空榜
```

### 部署记录

**2026-07-29 已部署上线**，Worker 现为 **v:4**（`games:["wordduel","gemfall"]`）。
冒烟验证全过：`/gf/board` 空榜正常、上榜/读榜/小队口令均通、
伪造分数被钳到上限（9 亿 → 12.7 万）、星数超通关数×3 被压回、保留词化名被拒、
`reset` 无 confirm 被拒；词灵榜的 4 行数据与门派榜、名人堂均未受影响。

**顺带补上了 2026-07-15 遗留的安全欠账**：commit `beab070` 轮换管理口令时标注了
「后端 LB_ADMIN_HASH 待另行轮换」但一直没做，而 `deploy.py` 里写死的正是旧口令。
现已改为从 `console/index.html` 的 `PW_HASH` 动态读取（以后轮换自动同步、脚本无明文），
本次部署已把后端口令同步为当前值 —— 线上实测：**旧口令被拒、新口令在 `/admin` 与
`/gf/admin` 两处均通**。

> ⚠ 词灵榜上仍有 **4 行 demo 数据**（噬词者·林 / 驭灵师·墨 / 鹿女·海 / 班级·阿狼），
> 其中三个用的是已下线的角色名。给学生用之前建议在控制台「排行榜审核」里清掉。

**部署前**：游戏里的矿脉榜会显示「连不上矿脉榜 —— 不影响你继续挖」，
本体功能完全不受影响，化名也已存在本机、联网后自动补交。

---

## 是猴就上100层 · 世界楼榜

猴子榜与词灵榜、矿脉榜完全隔离，使用独立的 `monkey_players` 与 `monkey_runs` 表；表由请求时的
`monkeyEnsure()` 幂等创建，不改既有迁移。公开读榜不接收原始设备编号，只接受首次登记后返回的
64 位匿名 `playerToken`，并且只公开化名、两位辨识码与榜单数值。

| 路由 | 方法 | 说明 |
|---|---|---|
| `/monkey/board?scope=weekly\|alltime\|effort&limit=&playerToken=` | GET | 本周高度、生涯高度、不白摔三榜；带令牌时返回本人和附近名次 |
| `/monkey/submit` | POST | `{deviceUUID, alias, run:{runId,height,score,bananas}}`；返回精确 `acceptedRunId` 与匿名令牌 |
| `/monkey/admin` | POST | 管理员 list / hide / unhide / delete，继续使用 `LB_ADMIN_HASH` |

本周榜按北京时间周一零点换周；生涯榜按最高高度；不白摔榜依次按正式局数、累计米数、最高高度。
每个 `runId` 与匿名玩家哈希组合成唯一标记，同一局断线重传只更新化名，不重复增加局数或米数。
客户端会先落本机队列，收到完全相同的 `acceptedRunId` 后才删除；回到在线状态自动补交。
服务端另设每日 240 次技术上限和数值关系门槛，防止失控重试与明显脏数据。
