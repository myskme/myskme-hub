# MYSKME · 作品总目

狼先生与他的学生们（*Make Yourself Special & Kind*）课堂作品的聚合入口页 —— 单文件、离线、可投屏，**扫码即玩**。

**线上地址：** https://myskme.github.io/myskme-hub/

## 收录作品
| 作品 | 地址 |
|---|---|
| MYSKME 积分板 | https://myskme.github.io/myskme-scoreboard/ |
| 三国军师争霸积分器 | https://myskme.github.io/three-kingdoms-classroom-scoreboard/ |
| MYSKME 大乱斗 | https://myskme.github.io/myskme-brawl/ |
| 远征录 · 笼中剑 | https://myskme-expedition.netlify.app |
| 世界编年史 II | https://myskme-volvme-ii.netlify.app |
| MYSKME 题库训练场 | https://myskme-games.netlify.app/ |

## 特性
- 单文件 `index.html`，离线可用；二维码在浏览器端实时生成（内置 [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)，MIT）。
- 浅色 / 深色主题，**默认跟随系统**，右下角可手动切换。
- 打印 / 分享：打印强制浅色底，二维码可扫；一键系统分享或复制链接。
- 管理员模式（右下角 ✎）可在浏览器里直接改文字 / 网址 / 增删作品，并「导出 index.html」得到可重新部署的文件。

## 重新生成
```bash
python3 build_hub.py   # 读取内置数据 + qrcode-generator.js，生成 index.html
```
