# 灵石远征 · 跨端更新记录

## 0.3.3 · 2026-08-02 · EdgeOne 同源榜单代理正式上线

- 经明确授权，新增 `edge-functions/api/[[default]].js`，将品牌入口
  `play.myskme.com/api/gf/*` 固定转发到原 Cloudflare Worker；仅放行榜单读取和成绩
  提交，不记录请求体，不构成开放代理；上游请求头采用严格白名单，不携带 Cookie、
  Authorization 或浏览器来源信息。
- `network-config.js` 已切到品牌 API，网页、GitHub Pages 与 iOS 壳不再直接依赖
  `workers.dev`；`legacyFallback` 关闭，弱网失败继续由原有本机待上传队列处理。
- 现有 D1 继续是唯一权威库，不迁移、不双写。旧内测榜无需转换也得以保留；未来若重置，
  应作为新赛季维护操作处理，不与本次网络切换耦合。
- EdgeOne 最终生产部署 `dpldjpmepm2b` 成功，81 个运行文件、22.36MB、构建 25 秒；
  函数编译与配置校验通过。部署包 SHA-256 为
  `5fc45db2040c7846d22332dc4bfa4f82630519a5ece0e5a49b234a1a78e9f2ed`。
- 国内链路实测：`/api/` 200；世界榜读取 200 并返回原 D1 数据；无效设备提交由原
  Worker 返回预期 400 且未落库；非白名单路径 404；所有 API 响应 `no-store`。
- 新增 `test-edgeone-proxy.mjs`（10 项）和 CI 步骤，验证固定上游、方法/路径白名单、
  POST 原文、CORS、禁缓存与 502 降级；无头加载器补齐真实 `network-config.js` 执行顺序。
- 新增 `build-edgeone-package.mjs`，可重复生成含静态资源、配置和 Edge Functions 的
  根目录 ZIP；CI 会构建并执行 ZIP 完整性检查。

## 0.3.2 · 2026-08-02 · play.myskme.com DNS 与 HTTPS 正式上线

- DNSPod 已完成域名归属 TXT 与 `play` CNAME；CNAME 准确指向
  `play.myskme.com.pages.dnsoe6.com`，EdgeOne 状态为“已生效”。
- EdgeOne 免费 RSA 2048 证书已自动申请、部署并启用自动续签；强制 HTTPS 使用
  `301`，HSTS 与 OCSP 装订暂不启用。
- 公网验收通过：HTTP 301、HTTPS 首页 200、PWA 与 Service Worker 200；HTML/配置
  不缓存，插画和图标缓存 1 天。桌面端与 `390×844` 手机竖屏首屏正常，手机无横向
  溢出，浏览器控制台错误为 0。
- 已知偏差：当前中国大陆网络直连原 `workers.dev` 榜单接口仍在 30 秒后超时。
  静态站国内访问已改善，但榜单读取与成绩上传的国内链路未因此解决。
- 本次仍未增加代理或新数据目的地。启用 EdgeOne 同源代理、腾讯云后端或迁移数据库前，
  需先获得玩家数据经新服务转发的明确授权，并继续保持单一权威库、禁止双写。

## 0.3.1 · 2026-08-02 · myskme.com 与 EdgeOne Makers 首发部署

- EdgeOne Makers 项目 `myskme-gemfall` 已部署到全球可用区（不含中国
  大陆），无需 ICP 备案；DNS 继续由 DNSPod 免费版托管。
- 已在 EdgeOne 创建 `play.myskme.com` 自定义域名；该阶段 DNSPod 最终保存触发
  腾讯云账号微信 MFA，后续完成情况见 0.3.2。
- 新增 `edgeone.json`，对 HTML/配置/Service Worker 使用 `no-cache`，美术、
  音频与图标缓存 1 天。
- 本版只迁移网页静态资源；排行榜仍由浏览器直连现有
  `myskme-leaderboard.wzc1020.workers.dev` 和同一份 D1，没有新增代理、
  没有双写，也没有改变玩家数据的传输目的地。
- GitHub Pages 仍作为灾备地址；域名上线后要回滚时，只需在 DNSPod 暂停
  `play` 记录，不影响原网址、存档或榜单。

## 0.3.0 · 2026-08-01 · C 端弱网与 PWA 离线加固

### 网页网络层

- 新增 `match/network-config.js`，把排行榜地址从游戏逻辑中抽成部署配置；支持香港
  同源 `/api`、自有 API 域名和旧 Worker 灾备。
- 普通成绩 POST 改用 `text/plain;charset=UTF-8`，不再为 JSON 额外发送 CORS
  OPTIONS 预检；请求体和后端解析逻辑不变。
- 多入口只在断网、网关错误、404/405 或非 JSON 时切换，真实业务 4xx 原样返回；最近
  成功入口本机记 30 分钟。
- 上传诊断会逐个报告候选入口及读取耗时。

### 离线与自动验证

- 新增生成式 `match/sw.js`：预缓存 HTML、配置、manifest、4 个核心图标和 56 张
  WebP，共 63 项、约 2.77MB；音乐按使用缓存，13MB 启动图不缓存。
- 新增 `build-service-worker.mjs`，以资源内容哈希生成缓存版本；CI 重建后检查差异。
- 新增 `test-network-layer.mjs`，验证旧入口兼容、故障切换、4xx 不绕过、免预检提交与
  `/gf/submit` 协议。
- 本地真实浏览器先在线完成缓存，再停止 HTTP 服务并刷新，仍完整进入大厅，控制台零错误。

### 跨端与部署

- iOS 网页同步器新增复制 `network-config.js`；原生壳不注册网页 Service Worker。
- 微信小游戏玩法代码零改动。
- 新增 `match/NETWORK-DEPLOYMENT.md`，记录香港静态主站、同源代理、后续 API/数据库
  迁移、缓存头、回滚与三网验收规则。
- 当前默认配置仍使用已有 `workers.dev`，域名和香港服务上线前不会中断现有排行榜。

## 0.2.1 · 2026-07-31 · 无头验证与平衡模拟 CI

本版只增加验证工具、GitHub Actions 与本记录，**不修改游戏本体、玩法代码或美术**。

### 新增工具

- `node match/ports/tools/run-selftest.mjs`
  - 用 `node:vm` 执行 `match/index.html` 的完整内联脚本；
  - 以最小 DOM / Canvas / 存储 / 音频 / 动画垫片启动页面；
  - 逐条打印 `window.__selftest()` 的 48 项结果，任何失败或数量变化均返回非零状态。
- `node match/ports/tools/sim-balance.mjs`
  - 复用同一无头加载器，直接驱动 `buildBoard` / `findMove` / `swapPieces` /
    `settleBoard`；
  - 通关率默认使用各关完整步数；同伴批次默认按 10 手标准化贪心局，报告代表关
    通关率、失败目标完成度，以及六位同伴的原始充能和按各自门槛折算的等效大招次数；
  - 贪心机器人不用灵器、不主动放大招、不做特殊灵石规划，绝对值**不是玩家数据**，
    只用来比较关卡相对形状和六人是否掉队。
- `normalize-resource-catalog.mjs` 只在 CI 重新生成总账后恢复 `generatedAt`，
  避免时间戳制造假差异；素材清单、字节数、哈希、尺寸、分类或平台有变化时，
  精确 `git diff` 仍会失败。

### 自动验证

`.github/workflows/gemfall-verify.yml` 在任意分支 push 且命中以下路径时触发：
`match/index.html`、`match/art/**`、`match/ports/**` 或 workflow 自身。

CI 依次执行：48 项网页无头自检、资源总账重建与差异检查、微信美术同步与差异检查、
微信引擎测试、跨端资源/哈希/包体预算验证。工作流权限为 `contents: read`，
**不会提交、推送或改写分支**。

### 本地环境事实

王老师当前那台 Mac 的登录 shell **没有安装 node**，因此无法直接运行这些 `.mjs`。
本机本地复核仍只能使用 Python 等价脚本；有 Node 的机器与 GitHub Actions
应以本节列出的 Node 命令作为正式验证口径。

## 0.2.0 · 2026-07-31 · 玩法与留存一轮（`5be03d8`…`3568da3`）

**只动 `match/index.html`**，素材、`ports/`、资源总账均零改动，
所以微信与 iOS 的资源同步不受影响；但**两端都需要重新同步网页副本**
（iOS `npm run sync:web`，微信 v0 是独立引擎、不受影响）。

### 新增

- **今日三桩**：每日三条目标，按日期种子定死、不可刷新；**输了也算数**；
  三桩齐得 1 个典藏匣。落点复用矿灯卡（领完后原本整块消失、首页空 134px）。
- **本周矿脉**：全服同一颗周种子，**首挖记榜**、之后重开当练习场。
  入口在矿脉榜弹层（大厅在 360×640 已顶到缩放下限 0.75，塞不下第五个主按钮）。
- **矿脉拓片**：Wordle 式无剧透纯文本战报，几何符号 ■▨◆□（**不是 emoji**，
  这几个字形跨端一致）。剪贴板被拦时摊开让人长按自选。
- **备用灯油**：连续满 10 天得 1 罐、最多 2 罐，只挡「正好断一天」。
- **失败余烬**：失败按完成度给灵力；完成度 ≥80% 走「就差一点」专用文案。
- **同伴随身被动** 六条（见下）。
- **灵器封顶** 9 件/种，溢出折灵力 120/件。
- **矿脉榜自助诊断**：三段连通性各自计时，可复制。

### 修掉的真 bug

| 问题 | 影响 |
|---|---|
| **梓的主色是第六色，64 关里只有 7 关是 6 色** | 第 32 关解锁的同伴，其余 57 关一颗充能都收不到，大招是个摆设 |
| 同伴充能只算主色 | 实测一局只消 35–49 颗、单色 6–11 颗，而 need 34–46 —— 一局根本充不满 |
| 弱网 400 被当永久拒绝 | 被截断的 POST 回 `400 bad json`，原代码 `stop=true`，整个会话不再上传 |
| 没起名的玩家无提示 | 上传要求先有化名，但界面从不说，玩家以为「上传不了」 |
| `startWeekly` 调用不存在的 `renderHUD` | 一进本周矿脉就崩（正确的是 `updHUD`） |

### 跨端注意

- `GS.weekly` 是新旗标，**三处开局入口都要复位**，否则串模式。
  以后再加模式旗标，照这个规矩办。
- 充能值现在是**小数**（任何消除按 0.4 计），任何显示处都要取整。
- 微信 v0 尚未移植同伴/灵器/收藏册，本轮改动与它无交集。

## 0.1.1 · 2026-07-31 · 网页接入 17 张终美化素材

提交 `aa14818`，分支 `agent/gemfall-final-art-cross-platform`。
**只动 `match/index.html` 一个文件**，素材与跨端目录一个字节未改。

- 新增 17 个 ART 键，全部走既有 `art()/applyArt()` 静默回落
- 新增通用横幅类 `.obanner`，六处共用（结算/讨伐/聚会赛/矿脉榜/无尽/编年史）
- `CARDS` n=12–19 的 `a` 字段由 `ch_*` 改为 `vista_*`；**`n` 与顺序未动**，
  存档主键与赠印编码不受影响
- 开匣新增卡背翻转，纯表现层；`openBox()` 的原子结算一行未改

### 对跨端的影响（重要）

- **资源总账无需重新生成**。`build-resource-catalog.mjs` 只清点
  `match/art`、`match/audio`、`match/icons`、`assets/*`，**不读 `index.html`**。
  本次未动素材，`resource-catalog.json` 因此无变化——
  之前"index.html 变化会导致总账更新"的说法是错的，别再照抄。
- 五个 `.mjs` 里**只有 `ios-capacitor/scripts/sync-web.mjs` 读 `index.html`**，
  而它只写进被 gitignore 的 `www/`，没有可提交产物。
- iOS 副本需要重新 `npm run sync:web` 才会带上本次网页改动。
- 微信 v0 是独立引擎，不受影响。

### 环境事实

**本机（王老师的 Mac）没有安装 node**，登录 shell 里也没有。
本次的完整性校验是用 Python 等价复现 `verify-ports.mjs` 的每一条检查跑的，
结果：资源 76 项、微信美术 56 张、目录 2,071,264 B（预算 4,194,304 B）全过。
**有 node 的机器上应再跑一遍原脚本复核。**

## 0.1.0 · 2026-07-30

### 美术封版

- 新增结算/讨伐横幅 3 张：`win`、`lose`、`boss-intro`
- 新增 8 张地脉纵版风物卡
- 新增玩法横幅 3 张：无尽矿脉、聚会赛、矿脉榜
- 新增透明物件 2 张：每日矿灯、星辰宝箱
- 新增典藏卡背 1 张
- `match/art/` 当前共有 56 张 WebP；此前 39 张在本批落图后逐一校验 SHA-256，
  内容未被覆盖

### 资源治理

- 建立 `shared/resource-catalog.json`，记录正式资源的路径、字节数、SHA-256、
  图片尺寸、透明通道、类别与平台分组
- 明确 `match/` 是正式网页与资源的单一事实来源
- 新增可重复执行的资源同步和完整性检查脚本

### iOS

- 新增 Capacitor 8 独立壳模板
- 新增网页副本同步器：构建时复制 `index.html`、`art/`、`audio/`、`icons/`
- 只在 iOS 副本里隐藏“作品总目”和跨作品外链，并接入 Haptics 桥接；网页源文件不变

### 微信小游戏

- 新增无 DOM 的 Canvas 初代版
- 支持 8×8 基础三消、相邻交换、连锁、计分、步数、胜负、点击/滑动、震动与本地最佳分
- 复用完整 `match/art/`，通过脚本同步；现有 6.7MB BGM 不进入主包
- 加入纯 Node 引擎测试和包体预算检查

### 尚未完成

- 微信版尚未移植 64 关、机关层、特殊灵石、同伴大招、聚会赛、榜单和典藏册
- iOS 尚未生成签名后的 Xcode 工程，也未做 App Store 真机审核
- 微信 `appid` 仍为开发工具占位值，发布前必须换成正式小游戏 AppID
