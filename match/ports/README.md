# 灵石远征 · 跨端工作区

这里是《灵石远征 · GEMFALL》的独立移植层。网页正式版仍以 `match/` 为唯一源项目，
本目录不反向修改 `match/index.html`，也不把微信或 iOS 的平台代码混进网页。

## 目录

| 目录 | 用途 | 当前状态 |
|---|---|---|
| `shared/` | 全量资源目录、哈希、尺寸、平台分组与复用约定 | 可用 |
| `ios-capacitor/` | iOS/Android 的 Capacitor 8 壳与网页副本同步器 | 可初始化 |
| `wechat-minigame/` | 无 DOM 的微信小游戏 Canvas 初代版 | 可在开发者工具导入 |
| `tools/` | 资源目录与跨端完整性检查脚本 | 可执行 |

## 单一事实来源

1. 网页玩法与正式存档：`match/index.html`
2. 正式插画：`match/art/`
3. 正式 BGM 与授权：`match/audio/`
4. PWA/iOS 启动素材：`match/icons/`
5. 跨端派生物：`match/ports/`

不要直接手工维护派生目录里的资源副本。图片更新后运行：

```bash
node match/ports/tools/build-resource-catalog.mjs
node match/ports/wechat-minigame/scripts/sync-assets.mjs
node match/ports/tools/verify-ports.mjs
```

iOS 的 `www/` 也属于派生物，进入 `ios-capacitor/` 后运行 `npm run sync:web` 生成。

## 平台边界

- 网页：完整 64 关、限时局、聚会赛、矿脉榜、典藏册，当前正式版。
- iOS：完整网页玩法的原生容器，数据仍使用本机 WebView 的 `localStorage`。
- 微信小游戏 v0：独立 Canvas 运行时，现阶段是可玩的基础三消竖切；存档键与网页分开，
  不宣称已经移植 64 关、机关、同伴大招、排行榜和典藏册。

## 版本

跨端版本记录见 [CHANGELOG.md](./CHANGELOG.md)。资源的逐文件版本依据
`shared/resource-catalog.json` 中的 SHA-256，不靠文件名猜测。
