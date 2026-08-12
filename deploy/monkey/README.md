# 猴先生上楼发布

monkey/index.html 是运行正本，myskme-hub 是唯一正式发布仓库。

- 正式域名：https://monkey.myskme.com/
- EdgeOne Makers 项目：myskme-monkey
- 自动发布：.github/workflows/deploy-monkey.yml
- 灾备副本：myskme.github.io 仓库中的 monkey/index.html

合并 monkey/** 或 deploy/monkey/** 到 main 后，工作流会重新导出资源、构建发布包、
发布生产环境并验收正式域名。首次创建项目后，需要在 EdgeOne 控制台绑定
monkey.myskme.com，再按控制台提供的目标在 DNSPod 添加 CNAME。该绑定只做一次。
