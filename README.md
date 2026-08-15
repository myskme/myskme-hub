# MYSKME · 作品总目

狼先生与他的学生们（*Make Yourself Special & Kind*）课堂作品的聚合入口页 —— 单文件、离线、可投屏，**扫码即玩**。

**正式入口：** https://myskme.com/

**旧入口 / 灾备：** https://myskme.github.io/myskme-hub/

## 收录作品
| 作品 | 地址 |
|---|---|
| 是猴就上100层 · 荒诞休闲 | https://monkey.myskme.com/ |
| 灵石远征 · GEMFALL | https://play.myskme.com/ |
| 星徒地牢 | https://myskme.github.io/myskme-star-dungeon/ |
| MYSKME 积分板 | https://myskme.github.io/myskme-scoreboard/ |
| 三国军师争霸积分器 | https://myskme.github.io/three-kingdoms-classroom-scoreboard/ |
| MYSKME 大乱斗 | https://myskme.github.io/myskme-brawl/ |
| 远征录 · 笼中剑 | https://myskme.github.io/myskme-expedition-web/ |
| 星灵远征 · 电子宠物 | https://myskme.github.io/myskme-starling/ |
| 世界编年史 II | https://myskme.github.io/myskme-chronicle/ |
| MYSKME 题库训练场 | https://myskme.github.io/myskme-quiz/ |
| MYSKME自鸣棋 · 43 单位策略肉鸽 | https://zimingqi.myskme.com/ |

## 学习工具（本仓库托管 · EdgeOne + GitHub Pages 灾备）
中考四板块（词汇语法 / 阅读完形 / 写作 / 听力）全数字化，纯静态、扫码即用：

| 工具 | 地址 |
|---|---|
| 猴与鱼 · 灵光塔（课堂工具 + 独立单人游戏） | https://myskme.com/classroom/ |
| 题库书架 | https://myskme.com/banks/ |
| 优秀作文墙 | https://myskme.com/wall/ |
| 作文训练场 | https://myskme.com/write/ |
| 听力训练场 | https://myskme.com/listen/ |
| 每日一题 | https://myskme.com/daily/ |
| 打印中心 | https://myskme.com/print/ |

> 出题工坊（`maker/`）与控制台（`console/`）为王老师后台，需管理员密码，未从主页公开链接。

## 题库自助发布
`banks/src/<兑换码>.json` → 推送即触发 GitHub Action（`build_banks.py` 校验 + 构建）→ 书架 / 词灵对决 / 打印中心 / 每日一题 自动上架。兑换码即卷号，JSON 契约见 `schema/`。也可用 [Pages CMS](https://app.pagescms.org) 的「题库」集合在网页里直接填（配置见 `.pages.yml`）。

## 特性
- 单文件 `index.html`，离线可用；二维码在浏览器端实时生成（内置 [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)，MIT）。
- 一屏式作品启动台：页面本身不滚动；手机使用「详情舞台 + 四格分页 + 底部分区」，iPad / 安卓平板和桌面使用「分类栏 + 作品格 + 详情舞台」，手机横屏自动进入紧凑分栏。
- 精选 / 游戏 / 学习 / 世界四个入口，支持全局搜索、分页与键盘方向键；每次进入主域都回到精选第一屏，固定把灵石远征、自鸣棋、猴先生与星徒地牢放在前面，最近打开最多只补一个位置，不再挤走代表作。
- 点作品格只切换详情，不会误跳；在详情舞台中再明确选择启动、扫码、复制或相关支线入口。
- 唯一浅色品牌界面采用象牙矿石、黑曜石与克制金属金；打印、分享和更多工具统一收进顶部操作区。
- 打印 / 分享：打印强制浅色二维码总目；支持系统分享、复制全部链接和导出竖版海报。
- 管理员模式位于顶部「更多工具」，可直接编辑当前作品文字 / 网址、增删排序，并「导出 index.html」得到可重新部署的文件。

## 重新生成
```bash
python3 build_hub.py   # 读取内置数据 + qrcode-generator.js，生成 index.html
node deploy/homepage/verify-layout-contract.mjs  # 校验固定顺序、手机/平板断点、安全区与加载优先级
```

## 移动界面约定

- 游戏、启动台和高频操作工具采用固定视口外壳，页面本身不滚动；短屏先减少装饰、压缩次要信息，再考虑局部滚动。
- 榜单、图鉴、设置等长内容只在明确的面板或弹层内部滚动，并始终提供无需滚到底的关闭入口。
- 作文墙、题库、长文章与长表单属于阅读型内容，保留自然页面滚动，不强行缩成一屏。
- 所有模式至少验收 iPhone `390×844`、安卓手机 `412×915`、iPad `768×1024`、平板横屏 `1024×768` 与桌面，同时检查安全区域、横向溢出、触控尺寸和动态视口。

完整分类和判定依据见 [`docs/MYSKME-移动界面与滚动规范.md`](docs/MYSKME-移动界面与滚动规范.md)。

正式域名的可重复发布流程、缓存策略与验收清单见 `deploy/homepage/README.md`。
