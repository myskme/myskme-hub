# 灵石远征 · 跨端更新记录

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
