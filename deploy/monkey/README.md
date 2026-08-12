# 是猴就上100层发布

monkey/index.html 是运行正本，monkey/manifest.webmanifest、monkey/sw.js 与 monkey/icons/ 是桌面安装渐进增强资源，myskme-hub 是唯一正式发布仓库。

- 正式域名：https://monkey.myskme.com/
- EdgeOne Makers 项目：monkey（全球海外区，不要求 ICP 备案）
- 自动发布：.github/workflows/deploy-monkey.yml
- 灾备副本：myskme.github.io 仓库中的 monkey/index.html

合并 monkey/** 或 deploy/monkey/** 到 main 后，工作流会重新导出资源、检查 PWA 文件、构建发布包、
发布生产环境并验收正式域名。固定发布参数为 `-n monkey -a overseas`，避免误建
需要 ICP 备案的含中国大陆项目。

域名已完成一次性配置：

- `monkey` CNAME → `monkey.myskme.com.pages.dnsoe6.com.`
- `_dnsauth.monkey` CNAME → `monkey.myskme.com.eoacme0.com.`

第二条记录用于 EdgeOne 免费 HTTPS 证书签发与续期，请保留。
