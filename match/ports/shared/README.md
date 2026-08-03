# 可复用资源与平台契约

## 资源目录

`resource-catalog.json` 由 `../tools/build-resource-catalog.mjs` 从正式源目录生成。
每条记录包含：

- `path`：相对仓库根目录的唯一路径
- `bytes` 与 `sha256`：包体预算和防误覆盖依据
- `width`、`height`、`alpha`：图片技术属性
- `category`：角色、灵石、机关、地脉、界面横幅、图标、音频等
- `platforms`：建议进入 web / ios / wechat 的位置

目录文件可以交给构建脚本、素材盘点工具或下一款 MYSKME 游戏直接使用。

## 资源同步原则

- `match/art/`：56 张 WebP，作为插画唯一源目录。
- `match/audio/`：3 首 M4A 与授权文件，只进入 web/iOS。微信包体阶段默认不复制。
- `match/icons/`：PWA 与启动图源；iOS 原生资产目录后续从这里生成。
- `assets/cover-gemfall.webp`、`assets/og-gemfall.png`：作品总目与分享卡，不属于对局运行时。

微信副本位于 `wechat-minigame/assets/art/`。它是生成物，运行同步脚本即可重建。
iOS 的 `www/` 同理，由 `ios-capacitor/scripts/sync-web.mjs` 重建。

## 平台适配契约

新玩法优先保持纯逻辑，不直接调用平台 API。平台能力集中到以下接口：

```js
{
  store: { get(key), set(key, value) },
  vibrate(kind),
  now(),
  raf(callback),
  onTouch(startHandler, moveHandler, endHandler),
  createImage()
}
```

网页正式版目前使用 `PLAT`；微信 v0 使用 `js/platform.js`。后续把正式 64 关内核抽成
共享模块时，先统一这份契约，再迁移控制器，避免把 `document`、`window` 或 `wx`
写进棋盘逻辑。

## 存档边界

| 平台 | 存档键 | 说明 |
|---|---|---|
| Web/iOS WebView | `myskme-match-v1` | 完整正式存档 |
| 微信小游戏 v0 | `myskme-gemfall-wechat-v0` | 只保存基础版最佳分与完成次数 |

两份存档故意不自动互转。等微信版字段覆盖完整正式玩法后，再增加显式迁移器；当前强行共用
会让缺失字段把正式存档降级。

## 音频与授权

三首 BGM 的授权文本必须与音频同时交付，见 `match/audio/LICENSE-音乐授权.txt`。
微信版后续若使用远程 CDN 或分包音频，也必须保留可见的署名与授权入口。
