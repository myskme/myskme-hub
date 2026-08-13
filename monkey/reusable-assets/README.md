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
