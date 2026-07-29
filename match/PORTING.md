# 灵石远征 · 跨平台移植说明

一份给「网页版 / 微信 / iOS」三条路的施工图。写在开工之前，是为了让代码从第一天就站在能移植的位置上。

---

## 结论先说：推荐路线

| 顺序 | 平台 | 做法 | 代码改动 | 成本 |
|---|---|---|---|---|
| ① 现在 | **自己的网站**（GitHub Pages） | 已完成，单文件、离线、扫码即玩 | 无 | 0 |
| ② 其次 | **iOS / Android 上架** | **Capacitor** 包壳（WKWebView / WebView） | **几乎为零** | Apple 开发者账号 $99/年 |
| ③ 最后 | **微信** | 走**小游戏**，不是小程序 | 只有 UI 层要重画 | 主体资质 + 类目审核 |

**为什么是这个顺序**：网页版是唯一能立刻上线、立刻收反馈的形态；iOS 包壳几乎不花工时，属于"顺手就做了"；微信小游戏是三者里唯一有真实工作量的，值得等网页版数据出来再决定要不要投。

---

## 一、代码是怎么分层的

单文件里用注释横幅切成了五段，移植时按段处理即可：

```
[ 平台适配层 · PLATFORM ADAPTER ]   ← 换平台只改这里
[ 纯逻辑引擎 · PORTABLE CORE ]      ← 零 DOM / 零 Canvas，整段照搬
[ 渲染层 · RENDERER ]               ← Canvas 2D，小游戏可直接复用
[ 游戏流程 · CONTROLLER ]           ← 大部分照搬，少量 DOM 调用要换
[ 界面 · SCREENS ] + [ 输入 · INPUT ] ← 小游戏要重写，其它平台不动
```

**纯逻辑引擎**是整个工程最值钱的部分，也是刻意做到零依赖的一段：棋盘、三连判定、特殊灵石炼成、组合技、重力与斜滑、死局判定与重组、关卡生成——全部是纯函数与纯数据，不碰 DOM、不碰 Canvas、不碰任何平台 API。它可以原样丢进任何 JS 运行时（小游戏、Node、React Native、甚至照着翻成 Swift/Kotlin）。

`window.__selftest()` 里的 30 项断言全部只测这一层，所以移植后可以直接跑同一套断言验证引擎没搬坏。

---

## 二、平台适配层要换什么

所有平台差异都收在文件顶部的 `PLAT` 对象里：

```js
const PLAT={
  name:'web',
  store:{ get(k){...}, set(k,v){...} },   // 存档
  vibrate(ms){...},                       // 震动
  now(){...},                             // 时间
  raf(fn){...},                           // 帧循环
  dpr(){...},                             // 像素密度
  canvas(){...},                          // 画布
  sfx:SFX,                                // 音效
};
```

对照表：

| 能力 | 网页 | 微信小游戏 | Capacitor (iOS/Android) |
|---|---|---|---|
| 存档 | `localStorage` | `wx.setStorageSync` / `getStorageSync` | `localStorage` 直接可用 |
| 画布 | `<canvas>` | `wx.createCanvas()` | 直接可用 |
| 帧循环 | `requestAnimationFrame` | 同名可用 | 直接可用 |
| 输入 | Pointer Events | `wx.onTouchStart/Move/End` | 直接可用 |
| 震动 | `navigator.vibrate` | `wx.vibrateShort()` | `@capacitor/haptics` |
| 音效 | WebAudio 实时合成 | 无 WebAudio → 需**预渲染成 mp3** | 直接可用 |
| 界面 | HTML + CSS | **无 DOM** → 要用 Canvas 重画 | 直接可用 |

---

## 三、iOS / Android 上架（推荐第二步）

用 Capacitor 包一层原生壳，网页代码原样跑在 WKWebView 里。

```bash
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/haptics
npx cap init 灵石远征 com.myskme.gemfall --web-dir=www
mkdir -p www && cp match/index.html www/
npx cap add ios
npx cap open ios      # 在 Xcode 里签名、配图标、提交
```

要改的只有三处：

1. **震动**：`PLAT.vibrate` 换成 `Haptics.impact({style:ImpactStyle.Light})`。
2. **状态栏与安全区**：已经用了 `env(safe-area-inset-*)` 与 `viewport-fit=cover`，刘海屏不用再改。
3. **返回链接**：`← 作品总目` 那个链接在 App 里应当隐藏或改成站内跳转（App 内不该把用户丢去浏览器）。

审核注意：这是一款自研原创玩法的游戏，不属于"仅套壳网页"（App Store 审核指南 4.2 拒的是没有原生价值的纯网页书签）。有完整离线玩法、本地存档、震动反馈，属于正常游戏类目。

---

## 四、微信小游戏（第三步，唯一有真实工作量的一条）

### 为什么是小游戏而不是小程序

小程序的渲染模型是 WXML/WXSS（类 DOM），逐帧 Canvas 游戏在里面跑得别扭且性能差。小游戏是专门给 Canvas 游戏用的运行时，`wx.createCanvas()` 拿到的画布，其 2D 上下文 API 与浏览器**同名同参**——`fillRect` / `createLinearGradient` / `arc` / `quadraticCurveTo` 全都一样。也就是说**渲染层（第三段）几乎可以原样跑**。

### 真正要做的工作：把 UI 从 DOM 搬进 Canvas

现在的 HUD、开场卡、结算卡、地脉图、同伴选择、灵器栏都是 HTML+CSS。小游戏里没有 DOM，这部分要重画。

好消息是数据和表现已经分开了：界面读的全是 `GS`（本局状态）和 `SAVE`（存档）里的字段，重画只是换一套绘制方式，不用重新设计逻辑。

**工作量估计**（按熟悉小游戏的开发者计）：
- 适配层改写：半天
- 音效预渲染（把 `SFX` 那套合成音导出成 mp3 素材）：半天
- UI 重画（HUD / 5 个覆盖层 / 地脉图）：3～5 天
- 联调与审核提交：2～3 天

### 素材与包体
主包限制 4MB。本作单文件约 130KB，加上音效素材也远在限额内，不需要分包。

### 资质
小游戏需要主体资质与类目审核。个人主体可以注册，但游戏类目通常需要软著；教育向的休闲游戏相对好过。这一步的时间成本往往大于开发本身，建议提前启动。

---

## 五、移植后怎么验证没搬坏

引擎层带了一套可执行的回归断言，移植后在目标平台的控制台跑：

```js
__selftest()   // 30 项：三连判定 / 特殊灵石炼成 / 组合技 / 重力斜滑 / 死局重组 / 64 关关卡数据一致性
```

全部 PASS 说明引擎搬对了。渲染与交互仍需人工过一遍：

- 8×8 棋盘在最窄机型（iPhone SE，375pt）上不横向溢出
- 拖动与点选两种操作都能触发交换
- 猫铃能落到底行并被判定送达
- 连锁 3 以上出横幅、5 以上震屏
- 深浅两个主题都可读

---

## 六、一个提醒

三个平台共用一份引擎的前提，是**改动始终发生在正确的层**。加新玩法（新机关、新同伴、新关卡）应当只动纯逻辑引擎与数据表；加特效动渲染层；加平台能力动适配层。一旦在引擎里写了 `document.querySelector`，这份跨平台的便宜就没了。

---

MYSKME × 英语王老师
