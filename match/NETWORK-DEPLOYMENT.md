# 灵石远征 · C 端网络与香港部署手册

本手册对应网页版《灵石远征 · GEMFALL》。目标是：不依赖中国大陆 ICP 备案，先让普通
用户通过稳定的 MYSKME 链接打开游戏；网络不稳时照常玩，成绩留在本机，恢复后自动补交。

## 已经落地的能力

- `https://play.myskme.com/` 已成为 EdgeOne Makers 正式网页入口；GitHub Pages
  继续作为灾备。两者目前都仍由浏览器直连既有 Cloudflare Worker 读取和提交排行榜。
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
- 本次不增加榜单代理。排行榜请求仍由浏览器直连原 Cloudflare Worker，
  仍只有一份 D1 权威数据。

### 2026-08-02 线上验收结果

- `http://play.myskme.com/` 返回 `301`，目标为
  `https://play.myskme.com/`；HTTPS 首页返回 `200`。
- `network-config.js`、`manifest.json`、`sw.js` 均返回 `200` 与
  `Cache-Control: no-cache`；首页使用 `max-age=0,must-revalidate`。
- `art/hero.webp` 与 `icons/app-icon-512.png` 均返回 `200`，缓存为
  `public, max-age=86400`。
- 线上首屏在桌面端与 `390×844` 手机竖屏实际加载；手机视口
  `scrollWidth = 390`，无横向溢出，浏览器控制台错误为 0。
- **已知未完成项：**从当前中国大陆网络直连
  `myskme-leaderboard.wzc1020.workers.dev` 的只读榜单请求在 30 秒后超时。
  因此本次已经解决网页与 PWA 静态资源访问，但尚未解决榜单读取与成绩上传的国内链路。
  在得到“允许玩家化名、设备标识与成绩经由新服务转发”的明确数据路由授权前，
  不启用 EdgeOne 同源代理，也不迁移或双写数据库。

### EdgeOne 直传发布

直传时将 `match/` 中的以下内容放在 ZIP 根目录，不要再套一层 `match/`：

```text
index.html
manifest.json
network-config.js
sw.js
edgeone.json
art/
audio/
icons/
```

EdgeOne 项目必须继续选「全球可用区（不含中国大陆）」。新版发布前先运行本文
末尾的验证命令，且确认 `sw.js` 已随资源变化重生。

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

## 后续候选：同源代理，API 仍复用现有 Worker（尚未实施）

这是静态主站上线后的下一候选方案，不同时搬数据库。它会让玩家化名、设备标识与成绩
先经过新的代理服务，属于数据传输路径变化，实施前必须取得明确授权并补充隐私说明。

1. 将仓库中的 `match/` 原样部署为站点根目录，不能打平 `art/`、`audio/`、`icons/`。
2. 为 `play.<主域名>` 配置 HTTPS。
3. 在香港站点把 `/api/*` 反向代理到
   `https://myskme-leaderboard.wzc1020.workers.dev/*`，并去掉前缀 `/api`。
4. 确认以下地址返回 JSON：
   - `https://play.<主域名>/api/`
   - `https://play.<主域名>/api/gf/board?scope=world&limit=5`
5. 在 `match/network-config.js` 把 `sameOriginApi` 改成 `true`。
6. 重新生成 Service Worker：

   ```bash
   node match/ports/tools/build-service-worker.mjs
   ```

一个等价的 Nginx 反向代理示例（尾部 `/` 负责去掉 `/api/` 前缀）：

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

### 推荐：网页同源代理

```js
sameOriginApi: true,
sameOriginPath: '/api',
apiBases: [],
legacyFallback: 'https://myskme-leaderboard.wzc1020.workers.dev',
```

### iOS/微信等非同源客户端

```js
apiBases: ['https://api.<主域名>'],
sameOriginApi: false,
legacyFallback: false,
```

若 `api.<主域名>` 只是同一权威后端的另一个入口，可以保留旧 Worker 作为网络灾备；若已
换成独立香港数据库，必须按上一节完成迁移后再决定是否保留。

### 一键回滚

香港入口出问题时恢复以下默认值并重新生成 `sw.js`：

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
8. GitHub Pages 灾备地址仍可打开，且仍指向旧 Worker。

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
node match/ports/tools/build-service-worker.mjs
node --check match/sw.js
node match/ports/tools/verify-ports.mjs
```
