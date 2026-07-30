# 灵石远征 · iOS Capacitor 壳

这个目录把网页正式版装进 WKWebView 原生容器。它只生成自己的 `www/` 副本，
不会修改 `match/index.html`，因此网页版与 iOS 版可以并行迭代。

当前模板基于 Capacitor 8 稳定系列：

- `@capacitor/core` / `cli` / `ios`：8.4.0
- `@capacitor/haptics`：8.0.2

版本依据为 Capacitor 官方仓库与官方插件仓库。升级大版本前先看迁移说明，不要直接追
9.x alpha。

## 初始化

需要 macOS、Node.js、Xcode 与有效的 Apple 开发者账号。

```bash
cd match/ports/ios-capacitor
npm install
npm run sync:web
npx cap add ios
npx cap sync ios
npx cap open ios
```

`npm run sync:web` 会复制：

- `match/index.html`
- `match/manifest.json`
- `match/art/`
- `match/audio/`
- `match/icons/`

然后只在副本里加入 `native-bridge.js`，隐藏“作品总目”和跨作品外链，并把网页震动请求
桥接给 iOS Haptics。正式网页源文件不变。

## 每次网页更新后

```bash
npm run sync:web
npx cap sync ios
```

不要手改 `www/`；下一次同步会重建它。

## Xcode 检查清单

1. Bundle Identifier 使用 `com.myskme.gemfall`，若账号下已占用再统一改名。
2. Deployment Target 按当前 Capacitor 8 的要求设置。
3. Portrait only；iPad 若开放横屏，需要重新做整页布局检查。
4. App Icon 必须补 1024×1024 无透明通道的最终母版。现有 512 图标只能作为测试源。
5. 启动图优先使用原生 LaunchScreen 的深黑底与居中图标；网页 PWA 竖版启动图不等同于
   App Store 原生 LaunchScreen 资产。
6. 真机验证离线启动、音频首次触摸解锁、静音键、后台恢复、安全区、存档与触感。
7. 发布版关闭调试日志，确认所有外链在 App 内不可见。

## 审核边界

本壳承载的是完整离线游戏，不是跳转网页的书签；但 App Store 是否通过仍取决于当期审核。
提交材料要说明 64 关、限时局、聚会赛、机关、同伴技能、本地存档和离线能力，避免只展示
一个 WebView 截图。

## 官方参考

- [Capacitor 文档](https://capacitorjs.com/docs)
- [Capacitor 官方仓库](https://github.com/ionic-team/capacitor)
- [Capacitor 官方插件仓库](https://github.com/ionic-team/capacitor-plugins)
