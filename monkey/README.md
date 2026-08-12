# 猴先生上楼

MYSKME 荒诞休闲系列第一作。正式入口为 https://monkey.myskme.com/ 。

## 唯一源码

- monkey/index.html 是游戏与美术的唯一运行正本。
- 游戏继续保持单文件、零依赖、零网络请求；直接保存该文件仍可离线游玩。
- reusable-assets/ 是由正本自动导出的可复用矢量资源，不允许手工修改。
- tools/extract-assets.mjs 负责导出角色姿势、配角和封面，并生成哈希总账。

## 更新

1. 只修改 monkey/index.html。
2. 运行 node monkey/tools/extract-assets.mjs 更新可复用资源。
3. 运行 node monkey/tools/extract-assets.mjs --check 与
   node deploy/monkey/build-edgeone-monkey.mjs /tmp/myskme-monkey.zip。
4. 合并进 main 后，GitHub Actions 自动发布到独立 EdgeOne 项目 myskme-monkey。

首次上线需要在 EdgeOne 为项目绑定 monkey.myskme.com 并在 DNSPod 添加 CNAME；
此后发布不再需要碰控制台。
