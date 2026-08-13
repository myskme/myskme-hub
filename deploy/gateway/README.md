# 品牌 API 网关

MYSKME 各作品的后端调用都经这里转发到 Cloudflare。**Cloudflare 上的 Worker 与
数据库仍是唯一权威数据源——不迁移、不双写**，网关只做转发。

## 正本在哪

**正本：`deploy/gateway/api/`**（本目录，中立位置，不属于任何一个作品）。

`match/edge-functions/api/` 是《灵石远征》发布包用的**副本**，必须与正本逐字节一致。

为什么要两份：`myskme.com` 与 `play.myskme.com` 是两个独立的 EdgeOne 项目，各自的发布包
里都得物理带着一份边缘函数，没法共享同一个目录。

改网关时**改正本**，然后同步副本：

```bash
rm -rf match/edge-functions/api && cp -R deploy/gateway/api match/edge-functions/api
```

随时可以自己校验：

```bash
node deploy/gateway/check-parity.mjs
```

主页构建会先跑这个检查，两份分叉就直接构建失败——因为「两个域名上的网关行为不一样」
是最难查的一类故障。

## 谁在用它

| 作品 | 调用地址 |
|---|---|
| 自鸣棋 · 星灵远征 · 星徒地牢 · 远征录 | `https://myskme.com/api/game` |
| 词灵对决 | `https://myskme.com/api/quiz/submit` |
| 灵石远征 | `/api/gf/*`（同源，走 `play.myskme.com` 自己那份） |
| 是猴就上100层 | `https://myskme.com/api/monkey/*` |

**灵石远征刻意保持同源**：它本来就住在 `play.myskme.com`，用同源地址是最优解，
改成跨域只会多一层依赖、没有收益。这样一来，灵石远征的手动发布出问题也只影响它自己。

## 路由与排障

`GET /api/` 是健康检查，应返回 `{"ok":true,"service":"myskme-edge-gateway",...}`。

⚠ **裸 `/api/quiz` 和任何带尾斜杠的路径都返回 404，这是正常的**（白名单里没有这些路径，
也没有代码调它们），别当故障排。

网关只转发白名单里的路径，且在服务端固定转发、**不透传客户端 Origin**，所以上游 Worker
的来源校验不受调用页面所在域名影响——作品页面将来搬到任何新域名都不用改后端。
