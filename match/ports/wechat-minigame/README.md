# 灵石远征 · 微信小游戏 v0

这是与网页隔离的微信小游戏初代版。它使用小游戏原生 Canvas 运行时，不使用 DOM、
WXML 或 WebView，也不会修改 `match/index.html`。

## 已实现

- 8×8 基础三消
- 相邻交换、无效交换回退、自动下落补石、连续连锁
- 点击两格和滑动两种操作
- 20 步目标局、分数、最佳分、胜负结算
- 微信本地存储与轻震动
- 复用 GEMFALL 正式灵石、狼先生、地脉与结算插画
- 刘海安全区、iPhone/iPad 类竖屏比例与 DPR 上限
- 纯逻辑引擎 Node 自检

## 暂未实现

这不是网页正式版的等价移植。以下功能仍留到 v1：

- 64 关与八条地脉
- 特殊灵石与组合技
- 墨封、岩壳、石笼、猫铃与 Boss
- 六位同伴和大招
- 90 秒限时局、聚会赛、矿脉榜、典藏册
- BGM 与完整音效

README 明确写出范围，是为了避免后续把“能打开”误当成“已经移植完成”。

## 导入微信开发者工具

1. 先从仓库根目录同步资源：

   ```bash
   node match/ports/wechat-minigame/scripts/sync-assets.mjs
   ```

2. 微信开发者工具选择“小游戏”，导入 `match/ports/wechat-minigame/`。
3. 本地体验可保留 `touristappid`；上传前把 `project.config.json` 中的 `appid`
   改成正式小游戏 AppID。
4. 真机测试触摸、存档、前后台切换、弱网与 Android/iOS 字体差异。

## 包体策略

本目录按保守的 **4 MiB 主包预算**做自动检查。当前把 56 张 WebP 美术全部同步进来，
仍显著低于预算；现有三首 BGM 合计约 6.7MB，因此 v0 不复制音频。

后续音频路线二选一：

- 做短循环和短音效，压进主包；
- 放进分包或合规 HTTPS 资源域名，进入游戏后按需下载。

不要直接把 `match/audio/` 全量复制进主包。

## 测试

```bash
node match/ports/wechat-minigame/test/engine.test.js
node match/ports/tools/verify-ports.mjs
```

## 官方依据

- [微信小游戏 API 类型定义（微信官方 GitHub 组织）](https://github.com/wechat-miniprogram/minigame-api-typings)
- [微信小游戏开发指南](https://developers.weixin.qq.com/minigame/dev/guide/)
- [腾讯云分包加载说明](https://intl.cloud.tencent.com/zh/document/product/1219/68072)

官方开发文档网页在部分网络环境下可能打不开；发布当天仍应以最新版微信开发者工具的
“代码质量/包体积”报告为最终准绳。
