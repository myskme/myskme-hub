# MYSKME · C 端网络与品牌网关部署手册

本手册对应网页版《灵石远征 · GEMFALL》。目标是：不依赖中国大陆 ICP 备案，先让普通
用户通过稳定的 MYSKME 链接打开游戏；网络不稳时照常玩，成绩留在本机，恢复后自动补交。

## 已经落地的能力

- `https://play.myskme.com/` 已成为 EdgeOne Makers 正式网页入口；GitHub Pages
  继续作为灾备。网页、GitHub Pages 与后续 iOS 壳统一使用
  `https://play.myskme.com/api` 品牌入口，不再由客户端直连 `workers.dev`。
- 普通成绩提交使用 `text/plain;charset=UTF-8`，属于 CORS simple request，不先发
  `OPTIONS`；后端仍用 `req.json()` 解析同一份 JSON。
- 排行榜支持多个 API 候选入口。只在断网、502+、404/405 或返回非 JSON 时切换；真实
  的化名违规等 4xx 不换入口绕过。
- 最近成功入口在本机记 30 分钟，弱网时不会每次都把所有入口重新探一遍。
- Service Worker 预缓存游戏 HTML、配置、manifest、4 个核心图标与全部 56 张 WebP。
  当前共 63 项、约 2.77MB。音乐按首次播放缓存，九张 iOS 启动图不缓存，避免首次访问
  在后台额外下载约 19MB。
- 导航采用网络优先、离线回落；图片与音乐采用缓存优先；排行榜请求和所有非 GET 请求
  永远不进缓存。

## 2026-08-02 EdgeOne Makers 首发实施记录

- 域名：`myskme.com`，个人名义注册 3 年，DNSPod 免费版托管。
- 静态项目：`myskme-gemfall`，EdgeOne Makers 项目 ID
  `makers-qjmcskwgq0q6`。
- 加速区域：全球可用区（不含中国大陆），不使用需备案的大陆节点。
- 首次直传包：79 个运行文件、22.36MB；构建与部署 22 秒，配置校验通过。
- 稳定项目域名：`myskme-gemfall-z3maxc4l.edgeone.dev`。该测试域名在中国
  网络会按平台规则返回 401，正式传播只使用自定义域名。
- 已创建并启用自定义域名 `play.myskme.com`。域名归属验证使用 DNSPod TXT：
  `edgeonereclaim.play` → `reclaim-tnq57o0yksn9tqvl69201j5dldlfrvse`。
- DNSPod CNAME 已由 EdgeOne 一键添加：`play` →
  `play.myskme.com.pages.dnsoe6.com`。EdgeOne 与 DNSPod 控制台均显示已生效，
  DNSPod 权威解析器 `119.29.29.29` 已返回该准确目标。
- EdgeOne 免费证书已自动申请并部署，证书为 RSA 2048、自动续签；当前证书主体
  `play.myskme.com`，TrustAsia 签发，控制台到期时间为
  `2026-10-30 07:59:59`（北京时间）。
- 已开启强制 HTTPS，重定向方式为 `301`。HSTS 与 OCSP 装订暂不启用；前者避免
  初期运维时浏览器长期锁定，后者留待后续性能实测再决定。
- 已在获得明确数据路由授权后启用 EdgeOne 同源榜单代理。代理只允许
  `GET /gf/board` 与 `POST /gf/submit`，固定转发到原 Cloudflare Worker；不记录
  请求体、不迁移数据库、不双写，仍只有一份 D1 权威数据。上游请求头使用严格白名单，
  不转发 Cookie、Authorization、Origin、Referer 或 Host。
- 当前生产部署 ID：`dp7gexyniafl`；81 个运行文件、22.36MB，构建 23 秒，
  `edgeone.json` 校验和 Edge Functions 编译均通过。部署包 SHA-256 为
  `c2353da467e9c2a25f21deafffb1aeaf3781aa5ef3d70a99d551d0d335499008`。

## 2026-08-02 多作品品牌网关

在不迁移、不双写任何数据库的前提下，`play.myskme.com/api` 已扩展为固定命名空间：

| 品牌入口 | 固定上游 | 作品与用途 |
|---|---|---|
| `/api/gf/*` | `myskme-leaderboard` | 《灵石远征》矿脉榜 |
| `/api/quiz/*` | `myskme-leaderboard` | 词灵对决、题库书架、教师审核 |
| `/api/game` | `myskme-game-api` | 《远征录》《星徒地牢》《星灵远征》《自鸣棋》 |
| `/api/publish` | `myskme-publish` | 课堂记分编年史发布通道（前端切换需单独确认真实姓名数据授权） |

- 网关仍只向固定上游转发，不接受 URL 参数指定目标，不构成开放代理。
- `game` 上游沿用旧 Worker 的来源校验，由网关写入固定
  `Origin: https://myskme.github.io`；客户端提交的 Origin、Cookie、Authorization、
  Referer 与 Host 一律不透传。
- 线上验收：`gf`、`quiz` 读取均为 200；`game` GET 与只读 `dmtop` POST 均为 200；
  `publish` 错误密码返回预期 401，未写入数据。

### 2026-08-02 线上验收结果

- `http://play.myskme.com/` 返回 `301`，目标为
  `https://play.myskme.com/`；HTTPS 首页返回 `200`。
- `network-config.js`、`manifest.json`、`sw.js` 均返回 `200` 与
  `Cache-Control: no-cache`；首页使用 `max-age=0,must-revalidate`。
- `art/hero.webp` 与 `icons/app-icon-512.png` 均返回 `200`，缓存为
  `public, max-age=86400`。
- 线上首屏在桌面端与 `390×844` 手机竖屏实际加载；手机视口
  `scrollWidth = 390`，无横向溢出，浏览器控制台错误为 0。
- 当前中国大陆网络直连 `workers.dev` 的只读请求曾在 30 秒后超时；改走
  `https://play.myskme.com/api/gf/board?scope=world&limit=5` 后返回 `200`、原 D1
  的真实榜单与 `X-MYSKME-Proxy: edgeone`。
- `/api/` 健康检查返回 `200`；无效设备提交穿透到原 Worker 后返回预期 `400 no device`，
  未写入 D1；非白名单代理路径返回 `404`。所有 `/api/*` 响应均为 `no-store`。

### 分享链路（2026-08-03）

- 对外分享一律走 `network-config.js` 的 `shareUrl`（`https://play.myskme.com/`），
  **不用 `location.origin`**：网页玩家基本在国内，从 GitHub Pages 打开的人
  分享出去的 github.io 链接在群里点不开，传播链会断在第一环。
  本周矿脉拓片已切换；以后新增任何分享出口都读这个字段。
- `og:url` / `og:image` 指向 `play.myskme.com`；og 图为
  `match/icons/og.png`（1200×630，即 assets/og-gemfall.png 的同域副本，
  已入素材总账）。icons/ 整目录本来就在直传包里，
  ⚠ 但 **og 卡片要等下一次 EdgeOne 直传后才有图**——发布前线上是 404。

### EdgeOne 直传发布

直传时将 `match/` 中的以下内容放在 ZIP 根目录，不要再套一层 `match/`：

```text
index.html
manifest.json
network-config.js
sw.js
edgeone.json
edge-functions/
art/
audio/
icons/
```

EdgeOne 项目必须继续选「全球可用区（不含中国大陆）」。新版发布前先运行本文
末尾的验证命令，且确认 `sw.js` 已随资源变化重生。

推荐用可重复打包脚本生成 ZIP，避免漏掉函数或多套一层目录：

```bash
node match/ports/tools/build-edgeone-package.mjs /private/tmp/gemfall-edgeone.zip
```

## 推荐域名结构

购买品牌主域名后建议固定以下入口，具体服务商以后可以换：

| 地址 | 用途 | 是否给用户传播 |
|---|---|---|
| `play.<主域名>` | 网页游戏与 PWA | 是，二维码和链接都用它 |
| `api.<主域名>` | iOS、微信与非同源客户端 API | 否 |
| `go.<主域名>` | 将来的智能短链接 | 是 |
| `myskme.github.io/...` | 开发预览与灾备 | 否 |
| `*.workers.dev` | 旧后端灾备 | 否 |

域名本身不负责加速。`play` 应指向香港静态托管，`api` 应指向香港 API 或稳定的反向代理。

## 已实施：EdgeOne 同源代理，API 仍复用现有 Worker

玩家化名、设备标识与成绩会先经过 EdgeOne，再由固定上游转发到原 Worker。该数据路径
已于 2026-08-02 获得明确授权；数据库不搬迁，旧榜无需转换，D1 继续作为唯一权威库。

1. 将仓库中的 `match/` 原样部署为站点根目录，不能打平 `art/`、`audio/`、`icons/`。
2. 为 `play.<主域名>` 配置 HTTPS。
3. `match/edge-functions/api/[[default]].js` 将 `/api/gf/*` 映射到
   `https://myskme-leaderboard.wzc1020.workers.dev/gf/*`。
4. 确认以下地址返回 JSON：
   - `https://play.<主域名>/api/`
   - `https://play.<主域名>/api/gf/board?scope=world&limit=5`
5. `match/network-config.js` 固定以 `https://play.myskme.com/api` 为第一入口，
   `sameOriginApi: true`，且 `legacyFallback: false`。
6. 重新生成 Service Worker：

   ```bash
   node match/ports/tools/build-service-worker.mjs
   ```

如果以后离开 EdgeOne，下面的 Nginx 配置可作为等价替代（尾部 `/` 负责去掉
`/api/` 前缀），当前线上没有使用它：

```nginx
location /api/ {
    proxy_pass https://myskme-leaderboard.wzc1020.workers.dev/;
    proxy_ssl_server_name on;
    proxy_set_header Host myskme-leaderboard.wzc1020.workers.dev;
    proxy_connect_timeout 4s;
    proxy_read_timeout 15s;
}
```

此阶段数据库仍只有 D1 一份，不会出现两个榜。浏览器到香港主站是同源请求；香港代理再去
Worker。以后把代理的上游换成香港 API，网页地址不变。

## 第二阶段：香港 API 与数据库

只有第一阶段实测仍无法满足上传稳定性时再做。新服务必须完整保持以下协议：

- `GET /`
- `GET /gf/board?scope=world&limit=50`
- `GET /gf/board?scope=class&limit=50&pw=...`
- `POST /gf/submit`
- 返回字段与 `leaderboard/worker.js` 当前实现一致。

### 数据一致性硬规则

`network-config.js` 里的多个入口只能是**同一份权威数据库的多个入口**，不能把香港数据库
和旧 D1 当成两个可随意双写的主库。客户端超时并不能判断前一请求是否已被服务端接收；若
两个入口各写各的，榜单必然分裂。

迁移时只能选择以下一种：

1. 香港 API 与旧 Worker 都访问同一权威数据库；或
2. 维护期间停止写入，导入 D1 数据，香港 API 切成唯一写入口，再把
   `legacyFallback` 设为 `false`；或
3. 旧 Worker 只做代理，最终仍写入香港权威库。

当前 `gemfall` 表使用 `MAX` 合并单调递增的最佳成绩，重复请求不会倒退，但这并不能代替
跨数据库同步。

## 网络配置

正式配置只改 `match/network-config.js`。

### 当前正式配置

```js
apiBases: ['https://play.myskme.com/api'],
sameOriginApi: true,
sameOriginPath: '/api',
legacyFallback: false,
```

### iOS/微信等非同源客户端

当前 iOS 壳同样读取 `network-config.js`，通过绝对地址
`https://play.myskme.com/api` 跨源访问；代理显式返回 CORS 响应头。微信小游戏正式版
仍需在微信后台把最终 API 域名加入合法域名列表。

若 `api.<主域名>` 只是同一权威后端的另一个入口，可以保留旧 Worker 作为网络灾备；若已
换成独立香港数据库，必须按上一节完成迁移后再决定是否保留。

### 一键回滚

EdgeOne 函数出问题且必须紧急回退时，可临时恢复以下值并重新生成 `sw.js`；该方案在
当前中国大陆网络可能超时，只作为故障隔离手段：

```js
apiBases: [],
sameOriginApi: false,
legacyFallback: 'https://myskme-leaderboard.wzc1020.workers.dev',
```

游戏会回到本次改动前的后端地址；玩家本机存档与待上传成绩不受影响。

## 缓存头建议

这些文件不要使用 `immutable`，因为现有美术文件会原名更新：

| 文件 | 建议 |
|---|---|
| `index.html`、`network-config.js`、`sw.js` | `Cache-Control: no-cache` |
| `manifest.json` | `Cache-Control: no-cache` |
| `art/**`、`audio/**`、`icons/**` | `Cache-Control: public, max-age=86400` |
| `/api/**` | `Cache-Control: no-store` |

Service Worker 内容哈希会随 HTML、配置、核心图标或美术变化自动换缓存名。修改上述资源后
必须运行生成器；CI 会重跑生成器并用 `git diff` 阻止漏更新。

## 正式切换前验收

1. 手机无痕窗口首次打开 `play.<主域名>`，首屏可立即操作。
2. 移动、联通、电信各测至少一次首页、榜单读取和成绩提交。
3. 浏览器网络面板中普通成绩 POST 前没有 OPTIONS。
4. 打开一次后切飞行模式，强制关闭再重开仍能进入大厅和关卡。
5. 离线完成一局时大厅显示“待上传”，恢复网络后自动变成“已同步”。
6. “上传不了？点这里诊断”能列出所有候选入口和每段耗时。
7. 新旧入口读取到同一名次与同一条最高成绩。
8. GitHub Pages 灾备地址仍可打开，且通过 `play.myskme.com/api` 访问同一 D1。

## 跨端边界

- iOS Capacitor 同步器会复制 `network-config.js`；原生壳使用打包网页，不注册网页
  Service Worker。
- 微信小游戏 v0 是独立 Canvas 运行时，本轮没有把 DOM、PWA 或网页缓存代码混进去。
- 微信正式版以后只复用 `/gf/*` 协议与美术，不直接复制网页网络实现；请求合法域名、平台
  备案与具体类目按提交时的微信后台要求单独处理。

## 相关验证命令

```bash
node match/ports/tools/run-selftest.mjs
node match/ports/tools/test-network-layer.mjs
node match/ports/tools/test-edgeone-proxy.mjs
node match/ports/tools/build-service-worker.mjs
node --check match/sw.js
node match/ports/tools/verify-ports.mjs
node match/ports/tools/build-edgeone-package.mjs /private/tmp/gemfall-edgeone.zip
```
