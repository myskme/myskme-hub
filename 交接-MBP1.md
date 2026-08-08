# MacBook Pro 1 接力交接单

> 2026-08-06 写于 MacBook Pro 2。此后 **MBP2 不再跑 codex**（系统 macOS 12.7.6 太旧，
> 旧版 codex 已确定跑不动）；codex 任务与日常开发一律移到 MBP1。
> 本文档随 git 同步，**不含任何密钥** —— 密钥要手动拷，见第 2 节。

## 1. 当前状态（2026-08-08，全部已上线）

- **《灵石远征 GEMFALL》减法阶段**：单文件 `match/index.html`（约 543KB），
  正门 play.myskme.com（EdgeOne，国内可达），github.io 是同一份。
- 2026-08-07 三轮减法：统一「曜石墨金」主题，删浅色切换与 45 秒模式；社交只留两阵营，
  不下发成员、人数，旧门派／帮会退役；工坊收成固定三层八件。
- 排行榜只留我的位置、榜首与相邻名次（最多显示 6 人），不再平铺 50 行，
  周赛入口回归挑战页；典藏改成搜索 + 已收／未收筛选，求卡帖、赠印、矿工号与第二份库存
  整体退役，旧重复份按品阶一次性回铸星屑。退役榜单横幅及微信副本，主资源共 55 张。
- 2026-08-08 解卡与聚会台：加入「引路晶」——同一前沿关完整失利 4 次后每章至多苏醒一枚，
  背包上限 1；只开下一关，原关仍是未通且不发星、分数、奖励，借道关不计榜单深度，补通后恢复。
  聚会赛保留镜盘／灵契两种内核，赛长改成 2–4 轮、每轮 5–30 步，轮间可统一重写下一轮步数；
  同页聚会台含随机先手与不强制落子的 15／30／45／60 秒思考钟，局中／交接／轮间／终局均可
  保存 1080×1350 JPEG 战绩图或立即结算。人物仍全开放、同场不重复。
- 2026-08-08 行囊与闯关榜：大厅新增常驻「行囊」，引路晶从 0／4 共鸣到持有状态都可随时查看；
  同一前沿关每次完整失利都会明确提示进度。行囊只归拢三件灵器、备用灯油、典藏匣和星屑，
  没有再造平行货币。六位同行头像进入大厅，可直接切换已解锁同行。
- 公开主榜改成「远征榜／闯关」：真实通关数优先，同关再比星数与单关最佳；借道未补通不计入。
  闯关榜不合并配速员，旧世界矿力接口与内部资历仍保留给旧客户端、阵营和工坊兼容。
- 视觉升级为「晴岩琉彩」：明亮蓝紫岩层、暖金、湖蓝和少量珊瑚色统一大厅、棋盘、按钮和弹层；
  没有新增位图，继续移除 `backdrop-filter` 与全部 CSS 无限循环动画，reduced-motion 总让路。主资源仍 54 张。
- 浏览器 390×844 实机视口已验大厅、行囊、闯关榜、聚会台、交接、棋盘与实时战绩层；
  `window.__selftest()` 为 **132/132**。
- **CI 两道门全自动**：合并 main = 发版（Pages + EdgeOne 直传 + 冒烟）。
  `gemfall-verify.yml` 里含 `node leaderboard/pacer.test.mjs`（配速员 13 条不变量）。
- 排行榜后端 = Cloudflare Worker + D1（`leaderboard/worker.js`），
  **改 worker 后一条命令部署：`python3 leaderboard/deploy.py`**。

## 2. 必须手动拷到 MBP1 的文件（gitignore 挡着，git 里没有）

| 文件 | 作用 |
|---|---|
| `~/.cf_tok` | Cloudflare 长期令牌（deploy.py 读它） |
| `leaderboard/deploy.py` | 部署脚本本体（勿入公库，故意 gitignore） |
| `leaderboard/.lb_db_id` | D1 数据库 ID |
| `leaderboard/.lb_salt` | 管理口令盐 |

拷法随意（隔空投送/U 盘）。拷完 `chmod 600 ~/.cf_tok`。
验证：`python3 leaderboard/deploy.py` 末行出 `deploy: OK` 即通。
⚠ 若 MBP1 上 curl api.cloudflare.com 被 1010 拦截，不是令牌坏了，
是 urllib 的 UA 被 Cloudflare 挡 —— deploy.py 里已带 UA 处理，直接跑脚本别手写 curl。

（其余 gitignore 里的 netlify_*.py / games_deploy.py 等是别的作品线的部署脚本，
用到 ⑤周报/⑥回链 时才需要，同样手动拷。）

## 3. MBP1 与 MBP2 的差别（写给下一个会话的 Claude）

- **MBP2 没有 node** → 才有 `match/ports/tools/build_service_worker.py`（Python 孪生）。
  MBP1 若有 node，直接用正本 `build-service-worker.mjs`；没有就继续用 Python 版。
  两者输出逐字节一致，CI 会验。
- **改 `match/index.html` 后必须重新生成 sw.js**，否则装过 PWA 的玩家一直吃旧代码。
  这是本项目踩过不止一次的坑。
- 网关有正副本：正本 `deploy/gateway/api/`，副本 `match/edge-functions/api/`，
  改完必须 cp 同步，CI 有 parity 检查。新加 `/gf/*` 路由两边都要加白名单。

## 4. codex 工作流（今后只在 MBP1）

- codex 的历史口令与交接单**全在仓库里**，git pull 即得：
  - `match/给-codex-的美术协作交接单.md` —— 美术协作的总交接
  - `match/codex-口令.md` / `-增量.md` / `-典藏册.md` / `-终美化.md`
  - `match/灵石远征-34张插画提示词口令.md`
  - `match/资产与复用.md`
- 素材落点：插画 `match/art/`（webp），图标 `match/icons/`。
  **新增/删除 art 下的文件后**要重新生成 sw.js 与 resource-catalog.json（CI 会抓漏）。
- ⚠ `applyArt` 会内联覆盖 background-size，凡要 contain 的元素必须 `data-fit="contain"`。
- ⚠ 全站禁 emoji，图标一律线稿 SVG（`ICONS` 库 40 个可复用）。

## 5. 下一步任务（按优先级）

1. ~~门派满员的客户端提示~~ —— 已随自由文本门派整体退役，不再需要客户端接入。
2. ~~`/gf/month` 国内网关~~ —— 已了结：本交接单那次推送触发了直传，
   2026-08-06 实测 `play.myskme.com/api/gf/month` 返回 200。
3. **化名正则放宽**：服务端化名校验对 30 个真实名字拒了 20 个，放宽要部署 worker，
   **待王老师拍板**后一条 deploy.py 上线。
4. （远期）**pacerAt 断点续算**：它是 O(天数)，约两年后会顶到 Workers CPU 上限，
   正解是把每月状态存进 D1。`pacer.test.mjs` 有性能守卫盯着。

## 6. 动手前必读

- 仓库根 `CLAUDE.md`（若有）与 `match/玩法与留存-实测记录.md`
- **改配速员任何字段前**：`leaderboard/pacer.test.mjs` 顶部注释（13 条不变量，
  其中 base 是反解出来的、矿力对 base 不单调、矿灯渐近线不能抬，都有血泪）
- 改矿力公式：客户端 `pwLines` 与服务端 `gfDepth/gfSkill/gfGrind` 必须逐字一致
