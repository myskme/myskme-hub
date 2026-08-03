# myskme.com · MYSKME 品牌主页发布

`myskme.com` 是作品总目与品牌门面；`play.myskme.com` 继续只承载《灵石远征》
和统一品牌 API。两个站点使用独立 EdgeOne Makers 项目，避免发布其中一个时覆盖另一个。

## 构建

先从仓库根目录重新生成总目，再构建可重复发布包：

```bash
python3 build_hub.py
node deploy/homepage/build-edgeone-homepage.mjs /private/tmp/myskme-homepage.zip
```

发布包只包含总主页、分享封面、公共封面资源以及题库书架、听力、写作、每日一题、
作文墙和打印中心，**外加品牌 API 网关的边缘函数**，不包含管理员控制台、源码工具或
《灵石远征》运行目录。

## 品牌 API 网关

**正本在 `deploy/gateway/api/`**（中立位置，不属于任何一个作品），构建时从那里复制进发布包。
`match/edge-functions/api/` 是《灵石远征》发布包用的副本，两份必须逐字节一致——构建会先跑
`deploy/gateway/check-parity.mjs` 校验，分叉直接构建失败。详见 `deploy/gateway/README.md`。

**为什么要让主页也带一份**：网关是全生态六个作品的后端命脉，原本只挂在
`play.myskme.com` 上，而《灵石远征》是手动发布、没有门禁也没有自动验收——等于最要紧的
东西用着最弱的一道防线。搬进主页这条管线后，它同样受「改动只构建、上线人工确认、
上线后自动验收」保护。

**迁移分三步走，每一步都不造成中断（2026-08-03 全部完成）**：

1. ✅ 主页发布包带上网关并上线。两个站点各有一份完全相同的网关，客户端仍指向
   `play.myskme.com/api/*`，线上行为零变化。
2. ✅ 五个作品把接口地址改成 `https://myskme.com/api/*`（自鸣棋 / 星灵远征 / 星徒地牢 /
   远征录 / 词灵对决）。**《灵石远征》刻意不切**——它就住在 `play.myskme.com`，同源是最优解。
3. ✅ 网关源码移到中立位置 `deploy/gateway/`，加两份副本的一致性校验。
   原计划里的「下线 play 侧入口」**取消**：《灵石远征》还要用同源网关，下线没有收益。

至此，《灵石远征》的手动发布**只能影响它自己**，其余五个作品的后端连通改由
`myskme.com` 这条有门禁、有验收的管线保障。

⚠ 若发布后验收报「网关健康检查状态码 404」，通常是该 EdgeOne 项目没有启用边缘函数。
这时 `play.myskme.com` 上的网关仍在服务，**《灵石远征》不会中断**，按提示排查即可。

## GitHub 半自动发布

工作流：`.github/workflows/deploy-homepage.yml`。

- 合并到 `main` 且主页运行资源发生变化时，GitHub Actions 自动重新生成主页、确认
  `index.html` 没有漏提交、构建并校验 EdgeOne ZIP，再把 ZIP 与 SHA-256 保存为 14 天制品。
- 普通 `push` **只构建，不发布**，因此试验性提交不会直接覆盖 `myskme.com`。
- 正式发布时进入 GitHub 仓库的 Actions，选择“`MYSKME 主页 · 构建与人工发布`”，
  点击“Run workflow”，分支必须选择 `main`，目标选择 `production`。
- 生产任务会重新使用同一次运行刚构建的 ZIP，调用 EdgeOne Makers CLI 发布，随后自动验收
  主域、`www` 301、Manifest、主页图标哈希、**品牌 API 网关健康检查与预检 CORS**，
  以及 `play.myskme.com`。

首次启用需要完成两项仓库设置：

1. 在 EdgeOne Makers 控制台创建有有效期的 API Token。
2. 在 GitHub 仓库 Actions Secret 中保存为 `EDGEONE_API_TOKEN`；不要把 Token 写进文件、
   PR、日志或命令示例。生产任务使用 Environment `myskme-homepage-production`，可在
   GitHub 设置中为它增加 required reviewers，形成第二道人工批准。

CLI 固定为 `edgeone@1.6.19`，并使用官方推荐的新命名空间：

```bash
edgeone makers deploy myskme-homepage.zip \
  -n myskme-homepage -e production -t "$EDGEONE_API_TOKEN"
```

如果 Token 失效，自动构建仍会正常工作，只有人工生产发布会明确失败并提示重新配置。

本地或 CI 部署后可单独复验线上状态：

```bash
node deploy/homepage/verify-online-homepage.mjs
```

## EdgeOne 与域名

1. 新建独立 Makers 项目，建议命名 `myskme-homepage`，上传上述 ZIP。
2. 添加 `myskme.com` 和 `www.myskme.com` 两个自定义域名。
3. 按控制台给出的目标值在 DNSPod 添加记录；主域使用 DNSPod/EdgeOne 支持的根域接入方式，
   不要把 `play.myskme.com` 的 CNAME 目标照抄给主域。
4. 为两个域名启用自动 HTTPS 和 HTTP → HTTPS。
5. `myskme.com` 为 canonical；发布包的 `edgeone.json` 使用 EdgeOne 官方
   `$wwwhost` → `$host` 反向重定向，将 `www.myskme.com` 以 301 跳到主域。

## 验收

- `https://myskme.com/` 返回 200，标题为“狼先生与他的学生们 · 作品总目”。
- `https://www.myskme.com/` 301 到 `https://myskme.com/`，或返回同一内容且 canonical 指向主域。
- `https://myskme.com/og-cover.png`、`/assets/hero-wolf.webp` 返回 200。
- `/banks/`、`/listen/`、`/write/`、`/daily/`、`/wall/`、`/print/` 均可打开。
- 总目中的《灵石远征》指向 `https://play.myskme.com/`。
- 手机 390×844、iPad 768×1024 与桌面端无横向溢出，控制台无脚本错误。
