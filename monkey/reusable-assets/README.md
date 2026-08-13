# 可复用美术资源 · 是猴就上100层

**本目录整个是生成物，不要手改。** 由 `monkey/tools/extract-assets.mjs` 从 `monkey/index.html`
导出，下一次生成会整个覆盖。构建期会跑 `--check`，导出没跟上就直接发布失败。

要改造型：改 `monkey/index.html` 里的同名 `<symbol>`，再跑一次导出器。

## 资源清单

| 文件 | symbol | 画布 | 在世界观里是谁 |
| --- | --- | --- | --- |
| `monkey-rise.svg` | `art-monkey-rise` | 100 × 116 | 猴先生 · 上升姿势（主角，三姿之一） |
| `monkey-fall.svg` | `art-monkey-fall` | 100 × 116 | 猴先生 · 坠落姿势 |
| `monkey-land.svg` | `art-monkey-land` | 100 × 116 | 猴先生 · 落地姿势 |
| `fish.svg` | `art-fish` | 120 × 120 | 鱼小姐 · 绿鲤鱼成精（canon 角色，配色不得离开青绿系） |
| `donkey.svg` | `art-donkey` | 120 × 120 | 驴 · 沉默的鉴定者（canon 角色） |
| `egg.svg` | `art-egg` | 110 × 120 | 蛋 · 房租稽查科常驻（canon 角色） |
| `snake.svg` | `art-snake` | 120 × 100 | 蛇 · 意见很多（canon 角色） |
| `fertilizer.svg` | `art-fertilizer` | 120 × 120 | 黑化肥 · 场景道具 |
| `banana.svg` | `art-banana` | 54 × 54 | 香蕉 · 收集物 |
| `crate.svg` | `art-crate` | 90 × 90 | 木箱 · 场景道具 |
| `carp-hat.svg` | `art-carp-hat` | 100 × 116 | 红鲤鱼帽 · 猴先生假扮红鲤鱼的道具（梗，非 canon 角色） |

另有 `../../assets/cover-monkey-upstairs.svg`（1280 × 720 封面，由猴先生与鱼小姐合成）。
每个文件的 SHA-256 见 `asset-manifest.json`，用来判断某份拷贝是不是当前正本导出的。

## 奶茶图鉴素材

以下杯子由正本 `TEAS` 数据与 `teaCupSvg()` 逐杯现算，不在导出器里维护第二套配方或杯型。

| 文件 | 名称 | 档位 | 液体 | 珍珠 |
| --- | --- | --- | --- | --- |
| `teas/water.svg` | 白开水（免费） | 常驻 | `#eef3f2` | `#cfd9d6` |
| `teas/light.svg` | 三分糖 · 奶绿 | 常驻 | `#cfe3c0` | `#7f9c6a` |
| `teas/seven.svg` | 七分糖 · 奶茶 | 常驻 | `#d3a877` | `#6e4d33` |
| `teas/full.svg` | 全糖 · 再来一杯 | 常驻 | `#c88c52` | `#5b3d27` |
| `teas/banana.svg` | 香蕉本位厚乳 | 常驻 | `#f3d78b` | `#c99a3e` |
| `teas/fax.svg` | 传真拿铁（正文略） | 常驻 | `#cdbfa6` | `#8d8069` |
| `teas/rent.svg` | 房租厚烧 | 常驻 | `#e3b7a2` | `#a4705c` |
| `teas/stamp.svg` | 审讫红丝绒 | 常驻 | `#d96a58` | `#8e3529` |
| `teas/clip.svg` | 回形针水果茶 | 常驻 | `#f0a978` | `#c46a3c` |
| `teas/magnet.svg` | 磁卡珍珠 | 常驻 | `#b98a63` | `#3b2a1d` |
| `teas/rocket.svg` | 电梯欠条冰咖 | 限定 | `#7a6553` | `#2f2419` |
| `teas/wide.svg` | 宽容卷尺奶盖 | 限定 | `#efe0c4` | `#b9a077` |
| `teas/fertilizer.svg` | 黑化肥特调 | 限定 | `#7f8a6a` | `#3f4634` |
| `teas/tongue.svg` | 绕口令四季春 | 限定 | `#d9e3b0` | `#8ba05c` |
| `teas/observation.svg` | 观景台海盐 | 隐藏 | `#cfe6e6` | `#7fa8a8` |
| `teas/construction.svg` | 加盖工程部 · 水泥灰拿铁 | 隐藏 | `#a9a79c` | `#6b6a62` |
| `teas/rescue.svg` | 鱼小姐推荐 · 青提乌龙 | 隐藏 | `#8fcf9e` | `#3f8a58` |
| `teas/carp.svg` | 红鲤鱼冰萃（仿的） | 隐藏 | `#e0452c` | `#8d2417` |
| `teas/donkey.svg` | 驴认证 · 纯茶不加料 | 隐藏 | `#a58d72` | `#6b5844` |
| `teas/ghost.svg` | 谈话人特饮（无人认领） | 限定 | `#b9a3d8` | `#5f4b86` |

## 画风参数

- 描边：`#2f5148`，所有角色统一用这一种描边色，不要每个角色换一种
- 线宽：主轮廓 3，细节 2 至 2.6，四肢与尾巴 6 至 7；端点与拐角一律 `round`
- 填色：平涂，无渐变、无阴影、无滤镜
- 腮红：`#ee9f9a`；眼睛高光是纯白小圆点，偏左上

## 调色板

- `paper` #faf3e2
- `ink` #28211a
- `outline` #2f5148
- `teal` #1f9e8e
- `fish` #3fab84
- `fishFin` #6cd0af
- `banana` #f5b731
- `red` #e0452c
- `carpHat` #e0452c
- `carpHatFin` #f2836a
- `cream` #fff5d1
- `blush` #ee9f9a

## 二次创作前必须知道的三条

1. 鱼小姐是绿鲤鱼成精，canon 上不存在金鲤鱼。她的配色不得离开青绿系；构建与线上验收都有门禁挡着。
2. 红鲤鱼不是 canon 角色。carp-hat 只是猴先生假扮用的道具，必须是红的——做成青绿就变成鱼小姐本人，梗就没了。
3. 一切 UI 与文案不使用 emoji 及 emoji 味符号（装饰星、带圈数字、箭头字符都算）。
