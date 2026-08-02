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
作文墙和打印中心，不包含管理员控制台、源码工具或《灵石远征》运行目录。

## EdgeOne 与域名

1. 新建独立 Makers 项目，建议命名 `myskme-homepage`，上传上述 ZIP。
2. 添加 `myskme.com` 和 `www.myskme.com` 两个自定义域名。
3. 按控制台给出的目标值在 DNSPod 添加记录；主域使用 DNSPod/EdgeOne 支持的根域接入方式，
   不要把 `play.myskme.com` 的 CNAME 目标照抄给主域。
4. 为两个域名启用自动 HTTPS 和 HTTP → HTTPS。
5. `myskme.com` 为 canonical；`www.myskme.com` 可在 EdgeOne 域名规则中 301 到主域。

## 验收

- `https://myskme.com/` 返回 200，标题为“狼先生与他的学生们 · 作品总目”。
- `https://www.myskme.com/` 301 到 `https://myskme.com/`，或返回同一内容且 canonical 指向主域。
- `https://myskme.com/og-cover.png`、`/assets/hero-wolf.webp` 返回 200。
- `/banks/`、`/listen/`、`/write/`、`/daily/`、`/wall/`、`/print/` 均可打开。
- 总目中的《灵石远征》指向 `https://play.myskme.com/`。
- 手机 390×844、iPad 768×1024 与桌面端无横向溢出，控制台无脚本错误。
