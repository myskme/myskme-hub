# 是猴就上100层

MYSKME 荒诞休闲系列第一作。正式入口为 https://monkey.myskme.com/ 。

## 唯一源码

- monkey/index.html 是游戏逻辑与游戏内美术的唯一运行正本。
- 首页继续保持单文件、零第三方依赖、无外部服务请求；直接保存 index.html 仍可离线游玩。
- manifest.webmanifest、sw.js 与 icons/ 提供“添加到桌面”、独立窗口和正式域名离线冷启动，缺失时不影响单文件游玩。
- reusable-assets/ 是由正本自动导出的可复用矢量资源，不允许手工修改。
- tools/extract-assets.mjs 负责导出角色姿势、配角和封面，并生成哈希总账。

## 当前系统

- 声音：Web Audio 原生合成的荒诞办公室爵士，随高度、连跳、部门与危险状态改变编曲；支持“乐＋效 / 仅音效 / 静音”，不下载外部音频。
- 复玩：五种帮助道具、八类轮值任务、档案章与四套开工装备；使用 `myskme_monkey_career_v1` 保存长期档案，旧最高分与排行榜键保持兼容。
- 多人：2–6 人同机轮流挑战，2–4 轮、45 / 75 / 105 秒可选；同轮共用确定性楼层种子，统一空手开局，总分优先、最高层数与连跳破同分。未完成比赛保存在 `myskme_monkey_party_v1`。
- 平台：除绕口令词牌与标点机制外，台阶不再写说明文字，统一用轮廓、材质、色彩、运动和破坏反馈表达规则。
- 安全：测试 URL 参数不写入长期档案；角色可见性看门狗、坠落冻结与完整 SVG 角色钳制继续作为发布门禁。

## 更新

1. 只修改 monkey/index.html。
2. 运行 node monkey/tools/extract-assets.mjs 更新可复用资源。
3. 运行 node monkey/tools/extract-assets.mjs --check 与
   node deploy/monkey/build-edgeone-monkey.mjs /tmp/myskme-monkey.zip。
4. 合并进 main 后，GitHub Actions 自动发布到独立 EdgeOne 项目 monkey（海外区，项目 ID makers-tf8nmwxqv8bq）。

首次上线需要在 EdgeOne 为项目绑定 monkey.myskme.com 并在 DNSPod 添加 CNAME；
此后发布不再需要碰控制台。
