# -*- coding: utf-8 -*-
"""生成 MYSKME 作品总目（单文件 / 离线 / 黑金编年史风）。
内置 qrcode-generator(JS) 实现浏览器端二维码，密码管理员模式可改内容。
QR 默认值与 segno 校验过的矩阵一致（见 structural_verify.py / qr_ref.json）。"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))  # 脚本所在目录（仓库根），任何机器可跑
OUT = os.path.join(HERE, "index.html")
LIB = open(os.path.join(HERE, "qrcode-generator.js"), encoding="utf-8").read()

# ---------- 已收起的作品（2026-07-11 王老师指示：大乱斗 / 三国不常用、仅自己用，从主页收起）----------
# 数据完整保留于此，需要恢复就把对应 item 加回下面 sections 的 items 数组即可：
#   卷一 · {"key": "brawl", "glyph": "斗", "cat": "game", "rarity": "SR", "cover": "assets/cover-brawl.webp", "tag": "积分对战 · 塔防", "title": "MYSKME 大乱斗", "en": "MYSKME BRAWL", "desc": "课堂积分对战 + 黑域塔防 · 六系角色养成 · 可分享炫耀战报卡。", "url": "https://myskme.github.io/myskme-brawl/"}
#   卷二 · {"key": "threek", "glyph": "国", "cat": "tool", "rarity": "R", "cover": "assets/cover-threek.webp", "tag": "课堂游戏", "title": "三国军师争霸", "en": "THREE KINGDOMS", "desc": "三国主题课堂积分器 · 军师争霸 / 合作模式 · 锦囊谋略 · 投屏即用。", "url": "https://myskme.github.io/three-kingdoms-classroom-scoreboard/"}
# ---------- 默认内容（管理员模式编辑后存 localStorage / 导出可覆盖此处） ----------
DEFAULT_DATA = {
    "kicker": "THE MYSKME CHRONICLES · 王老师 MR. WANG",
    "titlePre": "MYSKME",
    "titleEm": "作品启动台",
    "motto": "Make Yourself Special & Kind — 狼先生与他的学生们的远征编年",
    "hint": "一屏选作品，一键出发。娱乐、学习与世界观都在同一座 MYSKME 入口中。",
    "hubUrl": "https://myskme.com/",
    "sections": [
        {"label": "娱乐", "anchor": "vol-1", "vol": "壹", "era": "第一纪 · 游戏与世界观",
         "epigraph": "剑与星辰，茶与远方 —— 走进狼先生学院的世界。", "icon": "sword", "items": [
            {"key": "star-dungeon", "glyph": "牢", "cat": "game", "rarity": "UR", "cover": "assets/cover-star-dungeon.jpg",
             "tag": "课堂肉鸽 · 策略地牢", "title": "星徒地牢", "en": "STAR DUNGEON",
             "desc": "3–4 人最佳的课堂像素战术地牢 · 5–6 题集中判分，再由全队布局行动 · 机关、计谋、二周目与云端排行，手机可装到主屏。",
             "url": "https://myskme.github.io/myskme-star-dungeon/", "featured": True},
            {"key": "expedition", "glyph": "征", "cat": "game", "rarity": "UR", "cover": "assets/cover-expedition.webp",
             "tag": "动作肉鸽 · RPG", "title": "远征录 · 笼中剑", "en": "EXPEDITION · CAGED BLADE",
             "desc": "学院谷地动作肉鸽 · 四章远征直抵区域首领 · 技能连招 · 金叶结晶攒装备 —— 狼先生宇宙的旗舰。",
             "url": "https://myskme.github.io/myskme-expedition-web/", "featured": True},
            {"key": "starling", "glyph": "灵", "cat": "game", "rarity": "SSR", "cover": "assets/cover-starling.webp",
             "tag": "电子宠物 · 养成", "title": "星灵远征", "en": "STARLING",
             "desc": "余光之种孵出的小兽 · 蛋到觉醒五形态 · 你不在时它替你远征，寄回一封封寓言信。",
             "url": "https://myskme.github.io/myskme-starling/"},
            {"key": "gemfall", "glyph": "消", "cat": "game", "rarity": "SSR", "cover": "assets/cover-gemfall.webp",
             "tag": "消消乐 · 远征 / 十二层首领战", "title": "灵石远征", "en": "GEMFALL",
             "desc": "64 关远征与无尽矿脉 · 90 秒双榜 · 十二层首领战的生命、战魂与肉鸽构筑 · 2–6 人聚会赛。六位同行各有灵技，成绩可生成带正版二维码的分享图。",
             "url": "https://play.myskme.com/", "featured": True},
            {"key": "monkey-upstairs", "glyph": "猴", "cat": "game", "rarity": "SSR", "cover": "assets/cover-monkey-upstairs.svg",
             "tag": "荒诞休闲 · 百层挑战", "title": "是猴就上100层", "en": "MONKEY UP 100",
             "desc": "左右两键冲上 100 层 · 全程物理可达的随机楼道 · 十六个称号与二十款奶茶图鉴 · 绕口令办与百层倒班随机营业。可随时暂停，可安装到桌面，结算生成带游戏二维码的随机成绩海报。",
             "url": "https://monkey.myskme.com/", "featured": True},
            {"key": "zimingqi", "glyph": "棋", "cat": "game", "rarity": "SSR", "cover": "assets/cover-zimingqi-20260810.webp",
             "coverSmall": "assets/cover-zimingqi-20260810-640.webp", "coverLegacy": "assets/cover-zimingqi.webp",
             "tag": "肉鸽自走棋", "title": "自鸣棋", "en": "SELF-CHIME CHESS",
             "desc": "单人十关 · 无尽回廊 · 多人轮次 · 43 位可玩单位与四象羁绊。备战席、四象星图、高清战报与真人云榜已合流，弱网时成绩先留在本机，联网后自动补传。",
             "url": "https://zimingqi.myskme.com/", "featured": True},
            {"key": "volvme", "glyph": "史", "cat": "lore", "rarity": "SSR", "cover": "assets/image2-priority-20260712/cover-volvme-1280.webp",
             "coverSmall": "assets/image2-priority-20260712/cover-volvme-640.webp",
             "coverLegacy": "assets/cover-volvme.webp",
             "tag": "世界观 · 叙事", "title": "世界编年史 II", "en": "VOLVME II",
             "desc": "狼先生与他的学生们 · 八章正典故事线，从立学之初到八月十五仲夏夜之战。正典角色页已同步新徒普通／SP 收藏卡，另有《无月》剧情图册、地点、信物与名场面。",
             "url": "https://myskme.github.io/myskme-chronicle/",
             "url2": "https://myskme.github.io/myskme-chronicle/wuyue.html", "url2label": "剧情图册·无月",
             "url3": "https://myskme.github.io/myskme-chronicle/locations.html", "url3label": "正典地点",
             "url4": "https://myskme.github.io/myskme-chronicle/relics.html", "url4label": "正典信物",
             "url5": "https://myskme.github.io/myskme-chronicle/moments.html", "url5label": "正典名场面",
             "url6": "https://myskme.github.io/myskme-chronicle/characters.html", "url6label": "正典角色"},
        ]},
        {"label": "学习", "anchor": "vol-2", "vol": "贰", "era": "第二纪 · 中考修行与课堂器物",
         "epigraph": "把中考听说读写，做成可玩、可练、可打卡的器物。", "icon": "book", "items": [
            {"key": "quiz", "glyph": "题", "cat": "tool", "rarity": "UR", "cover": "assets/cover-quiz.webp",
             "tag": "题库训练 · 两种玩法", "title": "题库训练场", "en": "QUIZ TRAINER",
             "desc": "『词灵对决』自己刷：输兑换码，做过的卷变游戏；『无名之原』课堂肉鸽跟老师一起玩。",
             "url": "https://myskme.github.io/myskme-quiz/", "featured": True},
            {"key": "listen", "glyph": "听", "cat": "tool", "rarity": "R", "cover": "assets/cover-listen.webp",
             "tag": "中考 · 听力", "title": "听力训练场", "en": "LISTENING",
             "desc": "中考听力精练 · 多语音朗读 · 逐句跟读 · 浏览器直接播放，免下载。",
             "url": "https://myskme.com/listen/"},
            {"key": "write", "glyph": "写", "cat": "tool", "rarity": "R", "cover": "assets/cover-write.webp",
             "tag": "中考 · 写作", "title": "作文训练场", "en": "WRITING",
             "desc": "中考写作分步训练 · 范文 · 句式脚手架 · 自评清单。",
             "url": "https://myskme.com/write/"},
            {"key": "daily", "glyph": "日", "cat": "tool", "rarity": "R", "cover": "assets/cover-daily.webp",
             "tag": "每日打卡", "title": "每日一题", "en": "DAILY QUIZ",
             "desc": "全网同题 · 每天一换 · 答题即揭示解析 · 连胜打卡。",
             "url": "https://myskme.com/daily/"},
            {"key": "banks", "glyph": "库", "cat": "tool", "rarity": "SR", "cover": "assets/cover-banks.webp",
             "tag": "题库 · 词灵对决", "title": "题库书架", "en": "QUESTION BANKS",
             "desc": "词灵对决的书架 · 全部题库亮在架上点开即玩 · 时态 / 完形 / 阅读 / 陷阱专项 + 剧集卷。",
             "url": "https://myskme.com/banks/"},
            {"key": "wall", "glyph": "范", "cat": "tool", "rarity": "SR", "cover": "assets/image2-priority-20260712/cover-wall-1280.webp",
             "coverSmall": "assets/image2-priority-20260712/cover-wall-640.webp",
             "coverLegacy": "assets/cover-wall.webp",
             "tag": "荣誉 · 优秀作文", "title": "荣誉殿堂 · 优秀作文墙", "en": "WALL OF FAME",
             "desc": "优秀英语作文公开展示墙 · 手写真迹 · 王老师点评。打开即可浏览。",
             "url": "https://myskme.com/wall/"},
            {"key": "scoreboard", "glyph": "榜", "cat": "tool", "rarity": "SR", "cover": "assets/image2-priority-20260712/cover-scoreboard-1280.webp",
             "coverSmall": "assets/image2-priority-20260712/cover-scoreboard-640.webp",
             "coverLegacy": "assets/cover-scoreboard.webp",
             "tag": "课堂 · 积分榜", "title": "记分编年史", "en": "SCOREBOARD",
             "desc": "英语课堂积分 · 排行榜 · 团队赛 · 赛季管理 —— 老师投屏上课用，免安装、断网也能记。",
             "url": "https://myskme.github.io/myskme-scoreboard/"},
            {"key": "print", "glyph": "印", "cat": "tool", "rarity": "N", "cover": "assets/cover-print.webp",
             "tag": "打印 / PDF", "title": "打印中心", "en": "PRINT CENTER",
             "desc": "从题库一键生成 选择卷 / 答案版 / 词表 / 默写版，A4 存 PDF。答案版需口令。",
             "url": "https://myskme.com/print/"},
        ]},
    ],
}

# 预览截图：shots.json 由 capture_shots.sh 生成（key -> data URI）；缺失则回退到字形徽章
SHOTS = {}
_sp = os.path.join(HERE, "shots.json")
# 2026-07-04：改用策展式 cover（黑金封面），不再自动注入 shots.json 截图。
# 旧的自动截图（作文墙/记分/三国等）与新封面/字形徽风格不统一，故停用，改由 cover 字段统一。
SHOTS = {}  # 停用截图自动注入

# 管理口令以 sha256 存储，明文不入源码（与 maker/almanac/forge/console 同范式）。
# 值 = sha256(管理口令)。改口令：printf '%s' '新口令' | shasum -a 256，把输出填这里。
PASSWORD_HASH = "4f25090d6fd1faaafc8e801097c637011e95ce24832554056a258726f15e6585"

CSS = r"""
:root{
  --bg:#0a0a0c; --bg2:#111114; --bg3:#16161a; --bg4:#1c1c22;
  --ink:#f0e6d2; --ink2:#a8a090; --ink3:#6a6458; --ink4:#3a382f;
  --gold:#c9a64a; --gold2:#e8c768; --gold3:#7a6320;
  --red:#a83030; --red2:#d56060;
  --line:rgba(201,166,74,.22); --line2:rgba(201,166,74,.09);
  --glow-gold:0 0 24px rgba(201,166,74,.4);
  --glow-red:0 0 24px rgba(168,48,48,.5);
  --serif:"Noto Serif SC","Source Han Serif SC","Songti SC","STSong","SimSun",serif;
  --page-grad:radial-gradient(1200px 700px at 50% -8%,rgba(201,166,74,.10),transparent 60%),radial-gradient(900px 900px at 100% 100%,rgba(90,60,20,.10),transparent 60%);
  --noise-op:.28; --noise-blend:overlay;
  --vignette:radial-gradient(ellipse at 50% 40%,transparent 55%,rgba(0,0,0,.55));
  --feat-bg:linear-gradient(160deg,#1a1610,var(--bg2));
  --card-bg:linear-gradient(160deg,var(--bg3),var(--bg2));
  --card-hover-shadow:0 18px 50px rgba(0,0,0,.5),inset 0 0 40px rgba(201,166,74,.05);
  --plate-shadow:0 4px 16px rgba(0,0,0,.4);
  --bar-bg:linear-gradient(180deg,#15110a,rgba(20,16,10,.97));
  --nav-bg:linear-gradient(180deg,rgba(9,8,11,.95),rgba(9,8,11,.8));
}
/* ---- 唯一品牌主题：象牙矿石、黑曜石与克制金属金 ---- */
:root[data-theme="light"]{
  --bg:#e8e7e3; --bg2:#f1f0ec; --bg3:#fbfaf7; --bg4:#deddd8;
  --ink:#191a1c; --ink2:#4e5053; --ink3:#74736f; --ink4:#b7b4ac;
  --gold:#9b761e; --gold2:#6c5010; --gold3:#c3a45d;
  --red:#8f2d27; --red2:#6f211c;
  --line:rgba(25,26,28,.16); --line2:rgba(25,26,28,.075);
  --glow-gold:0 8px 24px rgba(117,86,18,.16);
  --glow-red:0 6px 18px rgba(128,38,30,.16);
  --page-grad:radial-gradient(900px 540px at 74% 8%,rgba(187,154,80,.14),transparent 64%),linear-gradient(135deg,#f3f2ee 0%,#e8e7e3 56%,#dededa 100%);
  --noise-op:0; --noise-blend:normal;
  --vignette:radial-gradient(ellipse at 50% 38%,transparent 62%,rgba(45,43,38,.07));
  --feat-bg:linear-gradient(150deg,#ffffff,#f0efeb);
  --card-bg:linear-gradient(150deg,#fcfbf8,#efeeea);
  --card-hover-shadow:0 16px 38px rgba(31,29,25,.13),inset 0 1px 0 rgba(255,255,255,.9);
  --plate-shadow:0 8px 24px rgba(33,30,24,.12);
  --bar-bg:rgba(248,247,243,.96);
  --nav-bg:rgba(246,245,241,.94);
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
.sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;
  overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important;}
.icon{display:inline-block;width:1.1em;height:1.1em;vertical-align:-.18em;fill:none;stroke:currentColor;
  stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:0 0 auto;}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--serif);
  line-height:1.7;overflow-x:hidden;
  background-image:var(--page-grad);
  background-attachment:fixed;transition:background-color .35s ease,color .35s ease;}
body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:1;
  opacity:var(--noise-op);mix-blend-mode:var(--noise-blend);
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)'/%3E%3C/svg%3E");}
body::after{content:'';position:fixed;inset:0;pointer-events:none;z-index:1;
  background:var(--vignette);}
html{scroll-behavior:smooth;scroll-padding-top:76px;}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto;}}
.wrap{position:relative;z-index:2;max-width:1220px;margin:0 auto;padding:0 clamp(16px,5vw,48px) 80px;}

/* ---------- 卷目录 · sticky 顶栏 ---------- */
.volnav{position:sticky;top:0;z-index:35;
  background:var(--nav-bg,linear-gradient(180deg,rgba(9,8,11,.95),rgba(9,8,11,.8))); /* 浅色主题下原硬编码深底会压出不可读白字 */
  -webkit-backdrop-filter:blur(12px) saturate(1.2);backdrop-filter:blur(12px) saturate(1.2);
  border-bottom:1px solid var(--line);}
.volnav-inner{max-width:1220px;margin:0 auto;width:100%;
  display:flex;align-items:center;gap:4px;padding:9px clamp(16px,5vw,48px);overflow-x:auto;scrollbar-width:none;}
.volnav-inner::-webkit-scrollbar{display:none;}
.volnav-brand{font-family:var(--serif);font-size:14px;letter-spacing:.24em;color:var(--gold2);
  white-space:nowrap;margin-right:14px;padding-right:14px;border-right:1px solid var(--line2);flex:0 0 auto;}
.volnav-brand b{font-weight:400;}
a.volnav-brand{text-decoration:none;}a.volnav-brand:hover{color:var(--gold);}
.vlink{font-family:var(--serif);font-size:13.5px;letter-spacing:.14em;color:var(--ink3);text-decoration:none;
  white-space:nowrap;padding:11px 13px;border-radius:2px;position:relative;transition:color .3s;flex:0 0 auto;}
.vlink:hover{color:var(--ink);}
.vlink.on{color:var(--gold2);}
.vlink.on::after{content:'';position:absolute;left:13px;right:13px;bottom:1px;height:1px;background:var(--gold);box-shadow:var(--glow-gold);}
.vlink .vl-num{color:var(--gold3);font-size:11px;margin-right:5px;}
.volnav-spacer{flex:1;}
.volnav-tools{display:flex;gap:6px;flex:0 0 auto;}

/* ---------- 英雄区 · 编年史卷首 ---------- */
.hero{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:clamp(20px,4vw,56px);
  align-items:center;min-height:clamp(300px,46vh,430px);padding:clamp(26px,4vw,48px) 0 clamp(18px,3vw,28px);}
.hero-art{position:relative;align-self:stretch;display:flex;align-items:flex-end;justify-content:center;min-height:280px;}
.hero-figure{position:relative;width:100%;max-width:420px;aspect-ratio:1/1.12;}
.hero-figure img{width:100%;height:100%;object-fit:contain;object-position:bottom center;
  filter:drop-shadow(0 20px 50px rgba(0,0,0,.6));animation:heroRise 1.4s .2s cubic-bezier(.16,1,.3,1) both;}
.hero-figure .hero-halo{position:absolute;inset:6% 10% 0;z-index:-1;border-radius:50%;
  background:radial-gradient(ellipse at 50% 42%,rgba(201,166,74,.22),transparent 66%);filter:blur(6px);}
/* 缺立绘时：金环「狼」字大徽 */
.hero-crestbig{display:none;position:relative;width:clamp(180px,26vw,270px);height:clamp(180px,26vw,270px);
  align-items:center;justify-content:center;animation:heroRise 1.4s .2s cubic-bezier(.16,1,.3,1) both;}
.hero-crestbig::before{content:'';position:absolute;inset:0;border-radius:50%;
  border:1px solid var(--gold3);box-shadow:inset 0 0 60px rgba(201,166,74,.14),var(--glow-gold);}
.hero-crestbig::after{content:'';position:absolute;inset:8%;border-radius:50%;border:1px solid var(--line);}
.hero-crestbig span{font-family:var(--serif);font-size:clamp(88px,15vw,150px);font-weight:300;color:var(--gold);
  text-shadow:0 0 44px rgba(201,166,74,.5);}
.hero-figure.nofig{display:flex;align-items:center;justify-content:center;aspect-ratio:auto;min-height:280px;}
.hero-figure.nofig .hero-crestbig{display:flex;}
.hero-figure.nofig .hero-halo{display:none;}
@media (max-width:560px){ /* 小屏 hero 瘦身:原首屏≈550px 只见英雄区,一张作品卡都看不到;选择器加 .hero 前缀提特异性,防被后面 820 断点同名规则按源顺序覆盖 */
  .hero .hero-figure img{max-width:150px;}
  .hero .motto{font-size:13px;}
  .hero .epilogue{font-size:12px;}
  .hero .meta-row .stat b{font-size:20px;}
}
@media (max-width:820px){
  .hero{grid-template-columns:1fr;text-align:center;min-height:auto;gap:6px;padding:32px 0 22px;}
  .hero-art{order:-1;min-height:180px;align-items:center;}
  .hero-figure{max-width:210px;}
  .kicker{justify-content:center;}
  .meta-row{justify-content:center;}
  .epilogue{margin:18px auto 0;border-left:0;padding-left:0;}
  .stat{align-items:center;}
  .rule{flex-wrap:wrap;}
}
.hero-body{position:relative;}
.kicker{font-size:12px;letter-spacing:.36em;color:var(--gold);text-transform:uppercase;display:flex;align-items:center;gap:12px;
  opacity:0;animation:fade 1s .1s both;}
.kicker .crest{flex:0 0 auto;width:30px;height:30px;border:1px solid var(--gold3);border-radius:50%;
  display:flex;align-items:center;justify-content:center;font-size:15px;color:var(--gold2);letter-spacing:0;text-transform:none;box-shadow:inset 0 0 14px rgba(201,166,74,.2);}
/* 下限 44px 会让「MYSKME 编年史」在窄屏折成「MYSKME 编 / 年史」——把词劈开了。
   降到 32px 后 375px 宽的手机上仍能整词成行；上限与增长率不变,大屏观感照旧。 */
.title-hero{font-size:clamp(32px,8.5vw,104px);font-weight:700;letter-spacing:.02em;line-height:1.02;margin:.2em 0 .16em;
  font-family:var(--serif);animation:titleIn 1.4s cubic-bezier(.16,1,.3,1) both;}
.title-hero span{display:inline-block;}
.title-hero em{font-style:normal;font-weight:700;
  background:linear-gradient(176deg,#f6e39a 0%,var(--gold2) 40%,var(--gold) 64%,var(--gold3) 100%);
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;}
@supports not ((-webkit-background-clip:text) or (background-clip:text)){.title-hero em{color:var(--gold);-webkit-text-fill-color:var(--gold);}}
.motto{color:var(--ink2);letter-spacing:.1em;font-size:clamp(13px,2vw,16px);max-width:36em;opacity:0;animation:fade 1.1s .5s both;}
.epilogue{margin:20px 0 0;padding-left:16px;border-left:2px solid var(--gold3);color:var(--ink2);
  font-size:clamp(13px,1.9vw,15px);letter-spacing:.05em;font-style:italic;line-height:1.9;max-width:34em;opacity:0;animation:fade 1.1s .68s both;}
.meta-row{display:flex;gap:clamp(20px,4vw,40px);flex-wrap:wrap;margin-top:26px;opacity:0;animation:fade 1.1s .82s both;}
.stat{display:flex;flex-direction:column;gap:3px;}
.stat b{font-family:var(--serif);font-size:30px;color:var(--gold2);font-weight:500;line-height:1;
  text-shadow:0 0 20px rgba(201,166,74,.3);}
.stat span{font-size:11px;letter-spacing:.2em;color:var(--ink3);}
.usehint{margin-top:26px;color:var(--ink3);font-size:12.5px;letter-spacing:.06em;line-height:1.8;max-width:40em;opacity:0;animation:fade 1.1s 1s both;}
/* hero 底部星图分隔，暗示往下是同一世界的篇章 */
.starmap{position:relative;z-index:2;height:42px;margin:0 auto clamp(14px,2.5vw,26px);opacity:.5;
  -webkit-mask:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);mask:linear-gradient(90deg,transparent,#000 12%,#000 88%,transparent);}
.starmap svg{width:100%;height:100%;display:block;}

/* ---------- 卷首 · 章题 ---------- */
.rule{display:flex;align-items:flex-start;gap:18px;margin:0 0 clamp(24px,4vw,36px);padding-top:8px;}
.chap-vol{flex:0 0 auto;font-family:var(--serif);font-size:clamp(34px,6vw,60px);font-weight:300;line-height:.9;
  color:var(--gold3);opacity:.85;text-shadow:0 0 30px rgba(201,166,74,.2);}
.chap-text{flex:1;min-width:0;}
.chap-title{font-family:var(--serif);font-size:clamp(22px,4vw,34px);font-weight:400;letter-spacing:.14em;color:var(--gold2);
  display:flex;align-items:center;gap:12px;}
.chap-title .chap-ico{flex:0 0 auto;color:var(--gold);opacity:.9;}
.chap-title .chap-ico svg{display:block;width:26px;height:26px;}
.chap-era{margin-top:6px;font-size:12px;letter-spacing:.24em;color:var(--gold);opacity:.8;text-transform:uppercase;}
.chap-epi{margin-top:8px;font-size:13.5px;letter-spacing:.04em;color:var(--ink3);font-style:italic;line-height:1.7;}
.chap-line{flex:0 0 auto;align-self:center;}
.rule-caret{font-family:var(--sans,var(--serif));font-size:11px;letter-spacing:.12em;color:var(--gold2);white-space:nowrap;
  border:1px solid var(--line);padding:4px 12px;transition:border-color .25s,box-shadow .25s,color .25s;cursor:pointer;align-self:flex-start;}
.rule-toggle:hover .rule-caret{border-color:var(--gold);color:var(--gold);box-shadow:var(--glow-gold);}
.rule-caret::after{content:'收起 ▴';}
.rule-toggle.collapsed .rule-caret::after{content:'展开 ▾';}
section[data-collapsed="1"] .grid{display:none!important;}
.fs-actions{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;}
.fs-actions .btn{font-size:12.5px;padding:7px 14px;}
section{margin-top:clamp(30px,5vw,54px);scroll-margin-top:76px;}
.grid{display:grid;gap:clamp(13px,1.7vw,18px);grid-template-columns:repeat(auto-fill,minmax(248px,1fr));grid-auto-rows:1fr;}
.card.featured{grid-column:span 1;}

.ornate{position:relative;}
.ornate::before,.ornate::after{content:'';position:absolute;width:14px;height:14px;
  border:1px solid var(--gold);transition:all .35s cubic-bezier(.16,1,.3,1);z-index:3;opacity:.65;}
.ornate::before{top:-1px;left:-1px;border-right:0;border-bottom:0;}
.ornate::after{bottom:-1px;right:-1px;border-left:0;border-top:0;}
.ornate:hover::before,.ornate:hover::after{width:26px;height:26px;opacity:1;}

.card{background:var(--card-bg);border:1px solid var(--line);isolation:isolate;
  padding:20px 20px 18px;display:flex;flex-direction:column;gap:14px;position:relative;
  transition:transform .45s cubic-bezier(.16,1,.3,1),border-color .35s,box-shadow .45s,background .35s;
  opacity:0;transform:translateY(24px);}
.card.in{opacity:1;transform:translateY(0);transition-delay:calc(var(--i) * 60ms);}
.card:hover{transform:translateY(-6px);border-color:var(--gold);box-shadow:var(--card-hover-shadow);}
.card.featured{border-color:var(--gold3);background:var(--feat-bg);box-shadow:inset 0 0 34px rgba(201,166,74,.07);}
@media (min-width:1101px){
  .card.finale{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);
    grid-template-areas:"thumb thumb" "body foot";align-items:stretch;column-gap:22px;}
  .card.finale .thumb{grid-area:thumb;aspect-ratio:16/5;min-width:0;width:calc(100% + 40px);max-width:calc(100% + 40px);}
  .card.finale .card-body{grid-area:body;padding-right:20px;border-right:1px solid var(--line2);}
  .card.finale .card-foot{grid-area:foot;padding-top:0;border-top:0;align-self:stretch;}
  .card.finale .card-admin{grid-column:1/-1;}
}
/* 稀有度左描边点缀（同游戏卡稀有度色码，学生一眼对得上） */
.card.rar-UR{--rc:#ffb13c}.card.rar-SSR{--rc:#c77dff}.card.rar-SR{--rc:#5aa9ff}.card.rar-R{--rc:#9fb0c0}.card.rar-N{--rc:#c2925a}
.card[class*="rar-"]{border-left:2px solid color-mix(in srgb,var(--rc,var(--gold)) 55%,var(--line));}
.card[class*="rar-"]:hover{border-left-color:var(--rc,var(--gold));}
/* 封面左上角：分类徽（游戏=剑 / 世界=史 / 工具=书） */
.cat-icon{position:absolute;top:9px;left:9px;z-index:4;height:30px;border:1px solid rgba(232,199,104,.28);
  background:rgba(10,9,12,.66);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);color:var(--gold2);
  display:flex;align-items:center;justify-content:center;gap:6px;padding:0 9px;transition:border-color .3s,color .3s,background .3s;}
.cat-icon svg{width:16px;height:16px;display:block;}
.cat-icon small{font-size:9px;line-height:1;letter-spacing:.12em;color:inherit;white-space:nowrap;}
.card:hover .cat-icon{border-color:var(--gold);color:var(--gold);}
/* 封面右上角：稀有度角标 */
.rarity-badge{position:absolute;top:9px;right:9px;z-index:4;font-size:10px;font-weight:700;letter-spacing:.14em;
  padding:3px 8px;color:#0c0a08;background:var(--rc,var(--gold));border-radius:1px;box-shadow:0 2px 8px rgba(0,0,0,.4);}
.card.rar-N .rarity-badge{color:var(--ink);background:transparent;border:1px solid var(--rc);box-shadow:none;}

/* 预览截图（hero）：满宽出血到卡片边缘，缺图回退字形 */
.thumb{margin:-20px -20px 0;position:relative;display:block;aspect-ratio:16/7;overflow:hidden;
  background:var(--bg4);border-bottom:1px solid var(--line);text-decoration:none;cursor:pointer;}
.thumb img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block;
  filter:saturate(1.05);transition:transform .55s cubic-bezier(.16,1,.3,1),filter .4s;}
.thumb::before{content:'';position:absolute;inset:0;z-index:2;pointer-events:none;
  background:linear-gradient(180deg,rgba(3,4,8,.03) 45%,rgba(3,4,8,.48) 100%);}
.card:hover .thumb img{transform:scale(1.05);filter:saturate(1.1) brightness(1.05);}
.thumb::after{content:'↗ 打开';position:absolute;bottom:10px;right:10px;font-size:11px;letter-spacing:.1em;
  color:var(--gold2);background:rgba(10,10,12,.66);border:1px solid var(--line);padding:3px 9px;
  opacity:0;transform:translateY(4px);transition:opacity .3s,transform .3s;pointer-events:none;z-index:3;}
.card:hover .thumb::after{opacity:1;transform:translateY(0);}
.thumb-fallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(201,166,74,.14),transparent 70%);}
.thumb-fallback span{font-size:62px;font-weight:300;color:var(--gold);text-shadow:0 0 24px rgba(201,166,74,.35);transition:transform .5s cubic-bezier(.16,1,.3,1);}
.card:hover .thumb-fallback span{transform:scale(1.08);}
.card-body{display:flex;flex-direction:column;gap:9px;flex:1;}

.card-head{display:flex;gap:15px;align-items:center;}
.badge{flex:0 0 64px;width:64px;height:64px;border:1px solid var(--line);position:relative;
  display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(201,166,74,.14),transparent 70%);}
.badge::before{content:'';position:absolute;inset:5px;border:1px solid var(--gold3);opacity:.4;transition:transform .8s cubic-bezier(.16,1,.3,1),opacity .4s;}
.badge-glyph{font-size:32px;font-weight:300;color:var(--gold);text-shadow:0 0 22px rgba(201,166,74,.4);transition:transform .6s,text-shadow .4s;}
.card:hover .badge::before{opacity:.85;transform:rotate(45deg) scale(1.08);}
.card:hover .badge-glyph{transform:scale(1.12);text-shadow:0 0 34px rgba(201,166,74,.65);}

.card-heading{display:flex;align-items:center;gap:12px;min-width:0;}
.work-mark{flex:0 0 48px;width:48px;height:48px;display:flex;align-items:center;justify-content:center;position:relative;
  color:var(--gold2);border:1px solid var(--line);background:radial-gradient(circle at 50% 42%,rgba(201,166,74,.16),rgba(201,166,74,.025) 70%);
  box-shadow:inset 0 0 18px rgba(201,166,74,.04);transition:color .3s,border-color .3s,transform .45s cubic-bezier(.16,1,.3,1),box-shadow .3s;}
.work-mark::after{content:'';position:absolute;inset:9px;border:1px solid var(--line2);transform:rotate(45deg);transition:transform .6s cubic-bezier(.16,1,.3,1),border-color .3s;}
.work-mark svg{width:24px;height:24px;position:relative;z-index:1;}
.card:hover .work-mark{color:var(--gold);border-color:var(--gold3);transform:translateY(-2px);box-shadow:inset 0 0 24px rgba(201,166,74,.11),var(--glow-gold);}
.card:hover .work-mark::after{border-color:var(--gold3);transform:rotate(135deg);}
.card-titles{min-width:0;flex:1;display:flex;flex-direction:column;gap:4px;}
.tag{align-self:flex-start;font-size:11px;letter-spacing:.2em;color:var(--gold);border:1px solid var(--line);padding:2px 9px;}
.feat-tag{color:#141008;background:var(--gold);border-color:var(--gold);font-weight:700;}
.card-titles{flex-direction:row !important;flex-wrap:wrap;align-items:center;column-gap:8px;}
.card-titles h3,.card-titles .en{flex-basis:100%;}
.card-body h3{margin:0;font-size:21px;font-weight:500;letter-spacing:.06em;line-height:1.35;}
.card-body h3 a{color:var(--ink);text-decoration:none;transition:color .3s,text-shadow .3s;}
.card:hover .card-body h3 a{color:var(--gold2);text-shadow:0 0 18px rgba(201,166,74,.4);}
.en{font-size:12px;letter-spacing:.24em;color:var(--ink3);text-transform:uppercase;}
.card-desc{margin:0;color:var(--ink2);font-size:14.5px;line-height:1.7;flex:1;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}

.card-foot{display:flex;flex-direction:column;gap:11px;padding-top:13px;border-top:1px solid var(--line2);}
.qr-plate{display:none;flex-direction:column;align-items:center;gap:6px;padding:8px;align-self:center;
  background:#f3e9cf;border:1px solid var(--gold3);box-shadow:var(--plate-shadow);
  transition:transform .4s cubic-bezier(.16,1,.3,1),box-shadow .4s;}
.qr-plate.show{display:flex;animation:fade .35s both;}
.qr-plate:hover{transform:scale(1.05);box-shadow:0 6px 22px rgba(0,0,0,.55),var(--glow-gold);}
.qr-box{width:86px;height:86px;}
.qr{width:86px;height:86px;display:block;}
.qr-hint{font-size:10px;letter-spacing:.18em;color:#7a6320;font-weight:700;display:flex;align-items:center;gap:4px;}
.qr-hint .icon{width:12px;height:12px;stroke-width:1.9;}
.card-actions{flex:1;min-width:0;display:flex;flex-direction:column;gap:11px;}
.url{display:none;}
body.admin .url{display:block;font-size:12px;color:var(--ink3);word-break:break-all;letter-spacing:.02em;font-family:ui-monospace,Menlo,monospace;}
.btn-row{display:flex;gap:9px;flex-wrap:wrap;}
.btn{font-family:var(--serif);font-size:13px;letter-spacing:.1em;padding:8px 14px;min-height:42px;cursor:pointer;
  border:1px solid var(--line);background:transparent;color:var(--ink);text-decoration:none;
  transition:transform .2s,border-color .3s,background .3s,color .3s,box-shadow .3s;
  display:inline-flex;align-items:center;justify-content:center;gap:7px;}
.btn:hover{border-color:var(--gold);color:var(--gold2);box-shadow:var(--glow-gold);}
.btn:active{transform:scale(.96);}
.btn-go{background:linear-gradient(180deg,rgba(201,166,74,.18),rgba(201,166,74,.06));border-color:var(--gold3);}
.btn-go:hover{background:linear-gradient(180deg,rgba(201,166,74,.3),rgba(201,166,74,.12));}
.btn-go2{border-color:var(--gold3);color:var(--gold2);}
.btn-go2:hover{background:rgba(201,166,74,.10);}
a:focus-visible,button:focus-visible,input:focus-visible,[contenteditable="true"]:focus-visible{
  outline:2px solid var(--gold2);outline-offset:3px;box-shadow:0 0 0 5px rgba(201,166,74,.14);}

/* ---------- 管理员模式 ---------- */
.card-admin{display:none;gap:6px;flex-wrap:wrap;margin-top:6px;padding-top:12px;border-top:1px dashed var(--line2);}
body.admin .card-admin{display:flex;}
.card-admin button{font-family:var(--serif);font-size:12px;letter-spacing:.05em;padding:5px 10px;cursor:pointer;
  background:var(--bg4);color:var(--ink2);border:1px solid var(--line);transition:all .2s;}
.card-admin button:hover{border-color:var(--gold);color:var(--gold2);}
.card-admin button.danger:hover{border-color:var(--red);color:var(--red2);}
.add-work{display:none;}
body.admin .add-work{display:flex;align-items:center;justify-content:center;min-height:130px;background:transparent;
  border:1px dashed var(--line);color:var(--ink3);font-family:var(--serif);font-size:15px;letter-spacing:.12em;cursor:pointer;transition:all .3s;}
body.admin .add-work:hover{border-color:var(--gold);color:var(--gold2);box-shadow:inset 0 0 30px rgba(201,166,74,.05);}
[contenteditable="true"]{outline:1px dashed var(--gold3);outline-offset:3px;border-radius:2px;transition:outline-color .2s,background .2s;cursor:text;}
[contenteditable="true"]:focus{outline:1px solid var(--gold);background:rgba(201,166,74,.07);}
body.admin .title-link{cursor:text;}

.admin-fab{position:fixed;left:16px;bottom:16px;z-index:40;width:44px;height:44px;border:1px solid var(--line);
  background:var(--bg3);color:var(--ink3);cursor:pointer;font-size:16px;opacity:.45;
  transition:all .3s;display:flex;align-items:center;justify-content:center;}
.admin-fab .icon{width:19px;height:19px;}
.admin-fab:hover{opacity:1;border-color:var(--gold);color:var(--gold2);box-shadow:var(--glow-gold);}
body.admin .admin-fab{display:none;}

.admin-bar{position:sticky;top:0;z-index:45;display:none;align-items:center;gap:12px;flex-wrap:wrap;
  padding:11px clamp(14px,4vw,30px);background:var(--bar-bg);
  border-bottom:1px solid var(--gold3);box-shadow:0 6px 24px rgba(0,0,0,.28);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);}
body.admin .admin-bar{display:flex;}
.admin-bar .ab-title{color:var(--gold2);letter-spacing:.16em;font-size:14px;margin-right:auto;}
.admin-bar .ab-title b{color:var(--ink3);font-weight:400;font-size:12px;letter-spacing:.06em;}
.admin-bar button{font-family:var(--serif);font-size:13px;letter-spacing:.08em;padding:7px 15px;cursor:pointer;
  background:transparent;border:1px solid var(--line);color:var(--ink);transition:all .2s;}
.admin-bar button:hover{border-color:var(--gold);color:var(--gold2);box-shadow:var(--glow-gold);}
.admin-bar button.danger:hover{border-color:var(--red);color:var(--red2);box-shadow:var(--glow-red);}

.pw-mask{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;
  background:rgba(0,0,0,.72);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);}
.pw-mask.show{display:flex;}
.pw-box{position:relative;background:linear-gradient(160deg,var(--bg3),var(--bg2));border:1px solid var(--gold3);
  padding:30px;width:min(370px,90vw);box-shadow:0 20px 60px rgba(0,0,0,.6),var(--glow-gold);}
.pw-box h4{margin:0 0 6px;font-weight:500;letter-spacing:.12em;color:var(--ink);font-size:18px;}
.pw-box p{margin:0 0 16px;color:var(--ink3);font-size:13px;letter-spacing:.05em;line-height:1.6;}
.pw-box input{width:100%;background:var(--bg);border:1px solid var(--line);color:var(--ink);
  padding:11px 14px;font-family:ui-monospace,Menlo,monospace;letter-spacing:.18em;outline:none;transition:border-color .2s;}
.pw-box input:focus{border-color:var(--gold);}
.pw-box.err{animation:shake .35s;}
.pw-box.err input{border-color:var(--red);}
.pw-row{display:flex;gap:10px;margin-top:18px;justify-content:flex-end;}
.pw-row button{font-family:var(--serif);font-size:14px;letter-spacing:.1em;padding:9px 18px;cursor:pointer;
  background:transparent;border:1px solid var(--line);color:var(--ink);transition:all .2s;}
.pw-row button:hover{border-color:var(--gold);color:var(--gold2);}
.pw-row .primary{background:linear-gradient(180deg,rgba(201,166,74,.2),rgba(201,166,74,.07));border-color:var(--gold3);}

.toast{position:fixed;left:50%;bottom:48px;transform:translateX(-50%) translateY(20px);
  background:var(--bg4);border:1px solid var(--gold);color:var(--gold2);padding:11px 26px;letter-spacing:.14em;
  font-size:14px;z-index:70;opacity:0;pointer-events:none;box-shadow:var(--glow-gold);transition:opacity .3s,transform .3s;max-width:88vw;}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0);}

footer{margin-top:64px;padding-top:30px;border-top:1px solid var(--line2);text-align:center;color:var(--ink3);font-size:13px;letter-spacing:.12em;line-height:2;}
footer b{color:var(--ink2);font-weight:400;}
.foot-share{display:flex;align-items:center;justify-content:center;gap:18px;margin-bottom:26px;flex-wrap:wrap;}
.share-plate{flex:0 0 auto;}
.share-plate .qr-box,.share-plate .qr{width:86px;height:86px;}
.foot-share-text{text-align:left;}
.fs-title{color:var(--ink2);font-size:14px;letter-spacing:.12em;margin-bottom:5px;}
.fs-url{color:var(--ink3);font-size:12px;font-family:ui-monospace,Menlo,monospace;word-break:break-all;}
.foot-links{margin-bottom:18px;font-size:13.5px;letter-spacing:.08em;}
.foot-links a{color:var(--gold2);text-decoration:none;transition:text-shadow .3s;}
.foot-links a:hover{text-shadow:var(--glow-gold);}
.foot-links span{color:var(--ink3);margin:0 8px;}

@keyframes titleIn{0%{opacity:0;letter-spacing:.42em;transform:translateY(18px);filter:blur(6px);}100%{opacity:1;letter-spacing:.16em;transform:translateY(0);filter:blur(0);}}
@keyframes fade{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}

@media (max-width:760px){
  .card-desc{-webkit-line-clamp:3;} /* 2行会把最长几张主推卡的后半句卖点截掉 */
  .grid{grid-template-columns:1fr;}
  .card-foot{flex-direction:column;align-items:stretch;}
  .qr-plate{align-self:center;}
  .card-actions{align-items:center;text-align:center;}
  .url{text-align:center;}
  .admin-bar .ab-title{width:100%;margin-bottom:4px;}
  .ctrl{right:10px;bottom:10px;gap:6px;flex-direction:column;}
  .toast{bottom:78px;max-width:82vw;}
}
@media (min-width:761px) and (max-width:1100px){
  .grid{grid-template-columns:repeat(2,minmax(0,1fr));}
}
@media (prefers-reduced-motion:reduce){
  *{animation-duration:.01ms!important;transition-duration:.01ms!important;}
  .card{opacity:1;transform:none;}
}

/* ---------- 右下角控制台：主题切换 / 打印 / 分享 ---------- */
.ctrl{position:fixed;right:16px;bottom:16px;z-index:42;display:flex;gap:10px;}
.ctrl-btn{width:44px;height:44px;border:1px solid var(--line);background:var(--bg3);color:var(--ink2);
  cursor:pointer;font-size:16px;opacity:.6;transition:all .3s;display:flex;align-items:center;justify-content:center;
  font-family:var(--serif);}
.ctrl-btn .icon{width:19px;height:19px;}
.ctrl-btn:hover{opacity:1;border-color:var(--gold);color:var(--gold2);box-shadow:var(--glow-gold);transform:translateY(-2px);}
.ctrl-btn:active{transform:scale(.95);}

/* ---------- 打印 / 另存 PDF：强制浅色羊皮纸底，隐藏所有交互件 ---------- */
@media print{
  :root{
    --bg:#fbf7ee!important;--bg2:#f4ecda!important;--bg3:#fffdf8!important;--bg4:#efe7d2!important;
    --ink:#241d12!important;--ink2:#48402f!important;--ink3:#6a5f49!important;
    --gold:#7a5d12!important;--gold2:#5c4710!important;--gold3:#b3954c!important;
    --line:rgba(90,70,20,.45)!important;--line2:rgba(90,70,20,.2)!important;
    --glow-gold:none!important;--page-grad:none!important;--vignette:none!important;
    --card-bg:#fffdf8!important;--feat-bg:#fff8e8!important;--card-hover-shadow:none!important;--plate-shadow:none!important;
  }
  html,body{background:#fbf7ee!important;color:#241d12!important;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;}
  body::before,body::after{display:none!important;}
  /* 一页汇总：隐藏图片/简介/按钮等，只留 标题 + 二维码 + 链接，紧凑排成一页 */
  .admin-bar,.admin-fab,.ctrl,.toast,.pw-mask,.card-admin,.add-work,.btn-row,.thumb,.work-mark,
  .tag,.en,.card-desc,.qr-hint,.kicker,.meta-row,.usehint,.foot-share,
  .volnav,.hero-art,.starmap,.chap-era,.chap-epi,.cat-icon,.rarity-badge,.rule-caret{display:none!important;}
  .hero{display:block!important;min-height:0!important;padding:0!important;}
  .rule{margin-bottom:2mm!important;}
  .chap-vol{font-size:16pt!important;}
  .chap-title{font-size:13pt!important;}
  .wrap{padding:8mm 9mm!important;max-width:none!important;}
  header{margin:0 0 5mm!important;}
  .title-hero{font-size:21pt!important;margin:0 0 1.5mm!important;letter-spacing:.08em!important;animation:none!important;}
  .title-hero em{text-shadow:none!important;}
  .motto{font-size:9.5pt!important;margin:0!important;opacity:1!important;animation:none!important;}
  section{margin:0 0 4mm!important;}
  .rule{margin:0 0 3mm!important;}
  .rule span{font-size:9pt!important;letter-spacing:.22em!important;text-shadow:none!important;}
  .rule-caret{display:none!important;}
  section[data-collapsed="1"] .grid{display:grid!important;}
  .grid{grid-template-columns:1fr 1fr!important;gap:4mm!important;}
  .card{opacity:1!important;transform:none!important;background:#fffdf8!important;border:1px solid var(--gold3)!important;
    box-shadow:none!important;break-inside:avoid;page-break-inside:avoid;gap:2mm!important;padding:3mm 3.5mm!important;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .card:hover{transform:none!important;box-shadow:none!important;}
  .ornate::before,.ornate::after{display:none!important;}
  .card-body{display:block!important;flex:0 0 auto!important;}
  .card-body h3{font-size:11.5pt!important;margin:0!important;line-height:1.25!important;}
  .card-body h3 a{text-shadow:none!important;}
  .card-foot{padding-top:2mm!important;gap:3mm!important;border-top:1px solid var(--line2)!important;align-items:center!important;}
  .qr-plate{box-shadow:none!important;border:1px solid var(--gold3)!important;padding:1.2mm!important;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .qr-box,.qr{width:24mm!important;height:24mm!important;}
  .card-actions{flex:1!important;gap:1mm!important;}
  .url{color:#48402f!important;font-size:8pt!important;text-align:left!important;}
  footer{margin:5mm 0 0!important;padding-top:3mm!important;font-size:8pt!important;}
  a{text-decoration:none!important;}
  @page{size:A4;margin:10mm;}
}
"""

# ---------- 2026-08 一屏式作品启动台 ----------
# 保留上方旧样式，确保导出旧存档与打印能力不丢失；以下规则接管正常浏览器界面。
CSS += r"""
:root{
  --shell-gap:clamp(10px,1.2vw,18px);
  --shell-radius:18px;
  --shell-top:74px;
  --panel:color-mix(in srgb,var(--bg3) 90%,transparent);
  --panel-soft:color-mix(in srgb,var(--bg2) 76%,transparent);
  --focus:0 0 0 2px var(--bg),0 0 0 4px var(--gold);
  --ui-sans:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Microsoft YaHei",sans-serif;
}
html,body{height:100%;min-height:100%;overflow:hidden;overscroll-behavior:none;}
html{scroll-behavior:auto;scroll-padding-top:0;}
body{line-height:1.45;background-attachment:fixed;}
body::before{opacity:.58;mix-blend-mode:normal;background:
  linear-gradient(90deg,transparent 49.8%,var(--line2) 50%,transparent 50.2%),
  linear-gradient(0deg,transparent 49.8%,var(--line2) 50%,transparent 50.2%);
  background-size:72px 72px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.7),transparent 76%);}
body::after{background:radial-gradient(900px 620px at 72% 18%,rgba(201,166,74,.08),transparent 68%),var(--vignette);}

.launchpad-shell{position:relative;z-index:2;height:100vh;height:100svh;height:100dvh;min-height:0;display:grid;
  grid-template-rows:var(--shell-top) minmax(0,1fr);padding:max(0px,env(safe-area-inset-top)) max(var(--shell-gap),env(safe-area-inset-right)) max(var(--shell-gap),env(safe-area-inset-bottom)) max(var(--shell-gap),env(safe-area-inset-left));}
.app-topbar{height:var(--shell-top);display:flex;align-items:center;gap:16px;padding:10px 2px;min-width:0;}
.brand-lockup{display:flex;align-items:center;gap:12px;min-width:0;text-decoration:none;color:var(--ink);}
.brand-seal{width:46px;height:46px;border-radius:14px;border:1px solid var(--line);padding:4px;
  background:linear-gradient(145deg,var(--bg4),var(--bg2));box-shadow:inset 0 0 0 1px var(--line2),var(--plate-shadow);object-fit:cover;}
.brand-copy{display:flex;flex-direction:column;min-width:0;}
.brand-copy b{font-size:19px;line-height:1.15;letter-spacing:.16em;font-weight:650;color:var(--gold2);}
.brand-copy span{font-size:10px;letter-spacing:.18em;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:38vw;}
.topbar-motto{margin-left:auto;min-width:0;color:var(--ink2);font-size:12px;letter-spacing:.06em;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right;}
.topbar-count{display:flex;align-items:baseline;gap:5px;padding:7px 10px;border-left:1px solid var(--line2);white-space:nowrap;}
.topbar-count b{font-size:18px;font-weight:500;color:var(--gold2);}.topbar-count span{font-size:10px;color:var(--ink3);letter-spacing:.1em;}
.top-controls{display:flex;align-items:center;gap:7px;flex:0 0 auto;}
.top-controls .ctrl-btn,.tools-menu summary,.admin-fab{position:static;width:40px;height:40px;margin:0;border-radius:12px;
  border:1px solid var(--line);background:var(--panel);color:var(--ink2);opacity:1;display:flex;align-items:center;justify-content:center;
  cursor:pointer;box-shadow:none;transition:border-color .2s,color .2s,background .2s,transform .2s;}
.top-controls .ctrl-btn:hover,.tools-menu summary:hover,.admin-fab:hover{border-color:var(--gold3);color:var(--gold2);background:var(--bg4);transform:translateY(-1px);box-shadow:none;}
.top-controls .ctrl-btn:focus-visible,.tools-menu summary:focus-visible,.admin-fab:focus-visible{outline:none;box-shadow:var(--focus);}
.top-controls .icon,.tools-menu .icon,.admin-fab .icon{width:18px;height:18px;}
.tools-menu{position:relative;}.tools-menu summary{list-style:none;}.tools-menu summary::-webkit-details-marker{display:none;}
.tools-pop{position:absolute;right:0;top:48px;width:230px;padding:10px;border:1px solid var(--line);border-radius:14px;
  background:color-mix(in srgb,var(--bg3) 96%,transparent);box-shadow:0 22px 60px rgba(0,0,0,.45);z-index:90;display:grid;gap:6px;}
.tools-pop button{width:100%;min-height:44px;display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid transparent;border-radius:9px;
  background:transparent;color:var(--ink2);font:inherit;font-size:12px;letter-spacing:.06em;cursor:pointer;text-align:left;}
.tools-pop button:hover{background:var(--bg4);border-color:var(--line);color:var(--gold2);}.tools-pop .admin-fab{width:100%;height:42px;justify-content:flex-start;}

.launchpad-workspace{min-height:0;display:grid;grid-template-columns:88px minmax(390px,.82fr) minmax(480px,1.18fr);
  gap:var(--shell-gap);max-width:1720px;width:100%;margin:0 auto;}
.category-rail,.library-panel,.project-stage{min-width:0;min-height:0;border:1px solid var(--line);border-radius:var(--shell-radius);
  background:var(--panel-soft);box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 18px 54px rgba(0,0,0,.18);overflow:hidden;}
.category-rail{padding:12px 8px;display:flex;flex-direction:column;align-items:stretch;gap:7px;}
.category-rail>div{width:100%;height:100%;display:flex;flex-direction:column;align-items:stretch;gap:inherit;}
.rail-brand{width:42px;height:42px;margin:0 auto 6px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--line);
  color:var(--gold2);font-size:13px;letter-spacing:0;background:var(--bg3);}
.nav-button{appearance:none;border:1px solid transparent;border-radius:12px;background:transparent;color:var(--ink3);font-family:var(--serif);
  min-height:66px;padding:8px 4px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;cursor:pointer;position:relative;}
.nav-button .icon{width:20px;height:20px;}.nav-button span{font-size:11px;letter-spacing:.08em;}
.nav-button:hover{color:var(--ink);background:color-mix(in srgb,var(--bg4) 70%,transparent);}
.nav-button.on{color:var(--gold2);border-color:var(--line);background:linear-gradient(150deg,rgba(201,166,74,.13),transparent);}
.nav-button.on::before{content:'';position:absolute;left:-9px;width:3px;height:24px;border-radius:3px;background:var(--gold);box-shadow:var(--glow-gold);}
.nav-button:focus-visible{outline:none;box-shadow:var(--focus);}

.library-panel{display:grid;grid-template-rows:auto minmax(0,1fr) auto;padding:14px;gap:12px;background:var(--panel);}
.library-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px 10px;align-items:center;}
.library-heading{min-width:0;}.library-eyebrow{display:block;color:var(--gold);font-size:9px;letter-spacing:.2em;margin-bottom:3px;}
.library-heading h1{margin:0;font-size:20px;font-weight:520;letter-spacing:.08em;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.library-heading p{margin:4px 0 0;color:var(--ink3);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.search-box{grid-column:1/-1;height:38px;display:flex;align-items:center;gap:8px;border:1px solid var(--line2);border-radius:10px;
  padding:0 11px;background:color-mix(in srgb,var(--bg2) 74%,transparent);color:var(--ink3);}
.search-box:focus-within{border-color:var(--gold3);box-shadow:0 0 0 2px rgba(201,166,74,.08);}.search-box .icon{width:15px;height:15px;}
.search-box input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:var(--ink);font:inherit;font-size:12px;letter-spacing:.04em;}
.search-box input::placeholder{color:var(--ink3);}
.view-count{font-size:11px;color:var(--ink3);white-space:nowrap;}.view-count b{font-size:16px;color:var(--gold2);font-weight:500;margin-right:3px;}

.app-grid{min-height:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(4,minmax(0,1fr));gap:9px;}
.app-grid.grid-compact{grid-template-rows:repeat(2,minmax(0,1fr));}
.app-tile{min-width:0;min-height:0;position:relative;border:1px solid var(--line2);border-radius:13px;overflow:hidden;
  background:linear-gradient(145deg,color-mix(in srgb,var(--bg3) 94%,transparent),color-mix(in srgb,var(--bg2) 86%,transparent));
  transition:border-color .2s,background .2s,transform .2s;}
.app-tile:hover{border-color:var(--gold3);transform:translateY(-1px);}.app-tile.selected{border-color:var(--gold);background:linear-gradient(145deg,rgba(201,166,74,.16),var(--bg2));}
.tile-button{appearance:none;border:0;background:transparent;color:inherit;font:inherit;width:100%;height:100%;padding:9px;cursor:pointer;
  display:grid;grid-template-columns:minmax(54px,34%) minmax(0,1fr);gap:10px;align-items:center;text-align:left;}
.tile-button:focus-visible{outline:none;box-shadow:inset var(--focus);}
.tile-cover{width:100%;max-height:100%;aspect-ratio:1/1;border-radius:9px;overflow:hidden;border:1px solid var(--line2);background:var(--bg4);position:relative;}
.tile-cover img{width:100%;height:100%;display:block;object-fit:cover;filter:saturate(.92) contrast(1.03);}
.tile-fallback{width:100%;height:100%;display:grid;place-items:center;color:var(--gold2);font-size:24px;background:radial-gradient(circle,rgba(201,166,74,.16),transparent 70%);}
.tile-copy{min-width:0;display:flex;flex-direction:column;gap:3px;}.tile-kicker{font-size:8.5px;letter-spacing:.13em;color:var(--gold);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.tile-copy strong{font-size:14px;font-weight:520;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.tile-copy small{font-size:8.5px;letter-spacing:.08em;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.tile-state{position:absolute;right:7px;top:7px;width:7px;height:7px;border:1px solid var(--gold3);border-radius:50%;background:var(--bg3);}
.app-tile.selected .tile-state{background:var(--gold);box-shadow:0 0 12px rgba(201,166,74,.65);}
.empty-grid{grid-column:1/-1;grid-row:1/-1;display:grid;place-items:center;text-align:center;color:var(--ink3);font-size:13px;letter-spacing:.08em;border:1px dashed var(--line);border-radius:13px;}

.library-foot{height:44px;display:flex;align-items:center;justify-content:space-between;gap:8px;}
.pager{display:flex;align-items:center;gap:7px;}.page-button{width:44px;height:44px;border-radius:11px;border:1px solid var(--line2);background:var(--bg3);color:var(--ink2);display:grid;place-items:center;cursor:pointer;}
.page-button:hover:not(:disabled){border-color:var(--gold3);color:var(--gold2);}.page-button:disabled{opacity:.28;cursor:default;}.page-button .icon{width:15px;height:15px;}
.page-label{font-size:10px;color:var(--ink3);min-width:46px;text-align:center;letter-spacing:.08em;}
.shortcut-hint{font-size:9px;color:var(--ink3);letter-spacing:.08em;white-space:nowrap;}.shortcut-hint kbd{border:1px solid var(--line);border-radius:5px;padding:2px 5px;background:var(--bg3);font:inherit;color:var(--ink2);}
.admin-add{display:none;border:1px dashed var(--gold3);border-radius:9px;background:transparent;color:var(--gold2);height:30px;padding:0 10px;font:inherit;font-size:10px;cursor:pointer;}
body.admin .admin-add{display:block;}

.project-stage{position:relative;background:var(--bg2);}
.stage-card{position:relative;width:100%;height:100%;overflow:hidden;display:grid;grid-template-rows:minmax(210px,48%) minmax(0,1fr);}
.stage-visual{position:relative;overflow:hidden;background:var(--bg4);isolation:isolate;}
.stage-visual::after{content:'';position:absolute;inset:0;background:linear-gradient(to bottom,transparent 34%,var(--bg2) 100%),linear-gradient(100deg,rgba(0,0,0,.25),transparent 55%);z-index:1;}
.stage-visual img{width:100%;height:100%;display:block;object-fit:cover;filter:saturate(.94) contrast(1.04);transform:scale(1.015);}
.stage-visual .tile-fallback{font-size:80px;}.stage-badges{position:absolute;left:18px;top:16px;z-index:3;display:flex;gap:7px;flex-wrap:wrap;}
.stage-badge{padding:5px 8px;border-radius:999px;border:1px solid rgba(240,230,210,.28);background:rgba(10,10,12,.66);color:#f0e6d2;font-size:9px;letter-spacing:.11em;}
.stage-badge.rarity{color:#f3d67d;border-color:rgba(232,199,104,.52);}
.stage-index{position:absolute;right:18px;top:16px;z-index:3;color:rgba(255,255,255,.74);font-size:10px;letter-spacing:.16em;text-shadow:0 2px 10px #000;}
.stage-content{min-height:0;padding:clamp(16px,2vw,26px);display:flex;flex-direction:column;gap:10px;position:relative;background:
  radial-gradient(560px 260px at 0 0,rgba(201,166,74,.09),transparent 70%),var(--bg2);}
.stage-titleline{display:flex;align-items:flex-start;gap:12px;}.stage-mark{width:42px;height:42px;border-radius:11px;border:1px solid var(--line);display:grid;place-items:center;color:var(--gold2);flex:0 0 auto;background:var(--bg3);}
.stage-mark svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.55;stroke-linecap:round;stroke-linejoin:round;}
.stage-titles{min-width:0;}.stage-titles h2{font-size:clamp(23px,2.4vw,38px);line-height:1.12;letter-spacing:.07em;font-weight:520;margin:0;color:var(--ink);}
.stage-en{display:block;margin-top:5px;color:var(--gold);font-size:9px;letter-spacing:.2em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.stage-desc{margin:0;color:var(--ink2);font-size:13px;line-height:1.72;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;max-width:68ch;}
.stage-actions{margin-top:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}.stage-actions .btn{min-height:44px;border-radius:10px;}
.stage-actions .btn-primary{background:linear-gradient(135deg,var(--gold2),var(--gold));border-color:transparent;color:#191207;font-weight:700;min-width:128px;justify-content:center;}
.stage-actions .btn-primary:hover{color:#080603;box-shadow:0 10px 28px rgba(201,166,74,.2);}.stage-actions .btn-icon{width:44px;padding:0;justify-content:center;}
.stage-actions .btn-icon span{display:none;}.stage-links{display:flex;gap:6px;flex-wrap:wrap;max-height:31px;overflow:hidden;}
.stage-links a{font-size:10px;color:var(--ink2);text-decoration:none;padding:6px 8px;border:1px solid var(--line2);border-radius:8px;white-space:nowrap;}
.stage-links a:hover{border-color:var(--gold3);color:var(--gold2);}
.stage-qr{position:absolute;right:18px;bottom:18px;z-index:8;display:none;align-items:center;gap:10px;padding:10px;border:1px solid var(--gold3);border-radius:13px;
  background:var(--bg3);box-shadow:0 18px 50px rgba(0,0,0,.5);}.stage-qr.show{display:flex;animation:fade .2s both;}.stage-qr .qr-box,.stage-qr .qr{width:104px;height:104px;}
.stage-qr-copy{display:flex;flex-direction:column;gap:4px;max-width:150px;}.stage-qr-copy b{font-size:12px;color:var(--gold2);}.stage-qr-copy span{font-size:10px;color:var(--ink3);line-height:1.5;}
.stage-qr-close{position:absolute;right:5px;top:5px;width:40px;height:40px;display:grid;place-items:center;border:0;border-radius:10px;background:transparent;color:var(--ink3);cursor:pointer;}
.stage-qr-close:hover{background:var(--bg4);color:var(--gold2)}.stage-qr-close:focus-visible{outline:none;box-shadow:var(--focus)}.stage-qr-close .icon{width:17px;height:17px}
.card-admin.stage-admin{display:none;margin-top:0;padding-top:9px;}.stage-admin button{border-radius:7px;}body.admin .stage-admin{display:flex;}

.mobile-tabs{display:none;}.print-catalog{display:none;}
.admin-bar{position:fixed;inset:0 0 auto 0;height:52px;overflow-x:auto;overflow-y:hidden;flex-wrap:nowrap;padding:7px 12px;z-index:120;}
.admin-bar .ab-title{white-space:nowrap;}.admin-bar button{white-space:nowrap;flex:0 0 auto;}
body.admin .launchpad-shell{padding-top:calc(52px + env(safe-area-inset-top));height:100dvh;}

/* 浅色不是纸张阅读器，而是一座安静的游戏展馆：现代 UI 承载，宋体只留给作品名。 */
.launchpad-shell,.tools-pop,.toast{font-family:var(--ui-sans);}
.brand-copy b,.library-heading h1,.tile-copy strong,.stage-titles h2,.stage-qr-copy b{font-family:var(--serif);}
:root[data-theme="light"]{--panel:rgba(252,251,248,.94);--panel-soft:rgba(246,245,241,.9);--focus:0 0 0 2px #f3f2ee,0 0 0 4px #9b761e;}
:root[data-theme="light"] body::before{opacity:.52;background:
  linear-gradient(90deg,transparent 49.7%,rgba(29,30,32,.055) 50%,transparent 50.3%),
  linear-gradient(0deg,transparent 49.7%,rgba(29,30,32,.055) 50%,transparent 50.3%);
  background-size:96px 96px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.52),transparent 78%);}
:root[data-theme="light"] body::after{background:radial-gradient(860px 560px at 76% 12%,rgba(176,139,54,.11),transparent 67%),var(--vignette);}
:root[data-theme="light"] .brand-seal{background:#fff;border-color:rgba(27,28,30,.14);box-shadow:inset 0 0 0 1px rgba(255,255,255,.85),0 7px 20px rgba(32,29,23,.12);}
:root[data-theme="light"] .brand-copy b{color:#272217;}:root[data-theme="light"] .brand-copy b::after{content:'';display:inline-block;width:5px;height:5px;margin-left:10px;border-radius:50%;background:var(--gold);vertical-align:.18em;}
:root[data-theme="light"] .top-controls .ctrl-btn,:root[data-theme="light"] .tools-menu summary,:root[data-theme="light"] .admin-fab{background:rgba(255,255,255,.82);border-color:rgba(27,28,30,.14);color:#393a3d;box-shadow:0 6px 18px rgba(34,31,25,.08),inset 0 1px 0 rgba(255,255,255,.9);}
:root[data-theme="light"] .top-controls .ctrl-btn:hover,:root[data-theme="light"] .tools-menu summary:hover,:root[data-theme="light"] .admin-fab:hover{background:#fff;border-color:rgba(155,118,30,.5);color:var(--gold2);box-shadow:0 9px 22px rgba(34,31,25,.11);}
:root[data-theme="light"] .tools-pop{background:rgba(252,251,248,.98);border-color:rgba(27,28,30,.14);box-shadow:0 24px 60px rgba(32,29,23,.18);}
:root[data-theme="light"] .category-rail,:root[data-theme="light"] .library-panel,:root[data-theme="light"] .project-stage{border-color:rgba(27,28,30,.13);box-shadow:0 18px 48px rgba(35,32,26,.09),inset 0 1px 0 rgba(255,255,255,.92);}
:root[data-theme="light"] .category-rail{background:rgba(247,246,242,.92);}
:root[data-theme="light"] .library-panel{background:rgba(252,251,248,.95);}
:root[data-theme="light"] .project-stage{background:#f8f7f4;}
:root[data-theme="light"] .rail-brand{background:#1c1d1f;border-color:#1c1d1f;color:#e5c46d;box-shadow:0 8px 22px rgba(25,25,25,.16);}
:root[data-theme="light"] .nav-button{font-family:var(--ui-sans);color:#6e6d69;}
:root[data-theme="light"] .nav-button:hover{background:rgba(255,255,255,.72);color:#242528;}
:root[data-theme="light"] .nav-button.on{color:#1d1e20;border-color:rgba(27,28,30,.13);background:#fff;box-shadow:0 8px 20px rgba(36,33,26,.08);}
:root[data-theme="light"] .nav-button.on::before{background:var(--gold);box-shadow:none;}
:root[data-theme="light"] .search-box{background:#f0efeb;border-color:rgba(27,28,30,.1);box-shadow:inset 0 1px 2px rgba(30,29,27,.035);}
:root[data-theme="light"] .search-box:focus-within{background:#fff;border-color:rgba(155,118,30,.55);box-shadow:0 0 0 3px rgba(155,118,30,.1);}
:root[data-theme="light"] .app-tile{background:linear-gradient(145deg,rgba(255,255,255,.94),rgba(240,239,235,.9));border-color:rgba(27,28,30,.09);}
:root[data-theme="light"] .app-tile:hover{border-color:rgba(155,118,30,.42);box-shadow:0 10px 24px rgba(34,31,25,.08);}
:root[data-theme="light"] .app-tile.selected{border-color:rgba(155,118,30,.72);background:#fff;box-shadow:inset 3px 0 0 var(--gold),0 12px 28px rgba(44,37,22,.1);}
:root[data-theme="light"] .tile-cover{background:#e3e2de;border-color:rgba(27,28,30,.1);box-shadow:0 5px 14px rgba(31,29,25,.1);}
:root[data-theme="light"] .tile-copy strong{color:#202124;}:root[data-theme="light"] .tile-kicker{color:#7c5c14;}:root[data-theme="light"] .tile-copy small{color:#777570;}
:root[data-theme="light"] .page-button{background:#fff;border-color:rgba(27,28,30,.11);color:#3f4043;box-shadow:0 5px 14px rgba(34,31,25,.06);}
:root[data-theme="light"] .stage-content{background:linear-gradient(180deg,#f2f1ed 0%,#fbfaf7 42%);border-top:1px solid rgba(27,28,30,.09);}
:root[data-theme="light"] .stage-mark{background:#fff;border-color:rgba(27,28,30,.12);color:var(--gold2);box-shadow:0 7px 18px rgba(34,31,25,.08);}
:root[data-theme="light"] .stage-actions .btn{background:#fff;border-color:rgba(27,28,30,.13);color:#313235;box-shadow:0 6px 16px rgba(34,31,25,.07);}
:root[data-theme="light"] .stage-actions .btn-primary{background:linear-gradient(135deg,#242529,#141517);border-color:#141517;color:#f8f5ec;box-shadow:0 11px 26px rgba(20,21,23,.2),inset 0 1px 0 rgba(255,255,255,.12);}
:root[data-theme="light"] .stage-actions .btn-primary:hover{background:#050607;color:#fff;border-color:#050607;box-shadow:0 14px 30px rgba(20,21,23,.24);}
:root[data-theme="light"] .stage-qr{background:#fbfaf7;border-color:rgba(155,118,30,.55);box-shadow:0 22px 54px rgba(31,29,25,.2);}
:root[data-theme="light"] .mobile-tabs{background:rgba(250,249,246,.96);border-color:rgba(27,28,30,.13);box-shadow:0 12px 32px rgba(35,32,26,.14);}

@media (max-width:1180px){
  :root{--shell-gap:8px;}
  .launchpad-workspace{grid-template-columns:68px minmax(230px,.72fr) minmax(0,1.28fr);}
  .category-rail{padding:9px 6px;}.rail-brand{width:40px;height:40px;}.nav-button{min-height:62px;}
  .library-panel{padding:10px;gap:8px;}.app-grid{grid-template-rows:repeat(3,minmax(0,1fr));}.stage-card{grid-template-rows:minmax(190px,52%) minmax(0,1fr);}
  .topbar-motto{display:none;}.top-controls .ctrl-btn,.tools-menu summary{width:44px;height:44px;}.tile-button{grid-template-columns:minmax(48px,31%) minmax(0,1fr);}
  .stage-content{padding:clamp(14px,2vw,20px);}.stage-titles h2{font-size:clamp(23px,3.2vw,32px);}
}
@media (min-width:700px) and (max-width:900px){
  .app-grid{grid-template-columns:1fr;grid-template-rows:repeat(6,minmax(0,1fr));gap:7px;}
  .app-grid.grid-compact{grid-template-rows:repeat(4,minmax(0,1fr));}
  .tile-button{grid-template-columns:54px minmax(0,1fr);padding:7px;gap:8px;}.tile-cover{height:54px;width:54px;}
  .tile-kicker{font-size:7.5px;}.tile-copy strong{font-size:12.5px;}.tile-copy small{font-size:7.5px;}
  .library-heading h1{font-size:17px;}.library-heading p{font-size:9px;}.search-box{height:44px;}
  .stage-card{grid-template-rows:minmax(260px,58%) minmax(0,1fr);}
  .shortcut-hint{display:none;}.stage-desc{-webkit-line-clamp:4;}.stage-links{max-height:29px;overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none;}
  .stage-links::-webkit-scrollbar{display:none;}
}
@media (max-width:699px){
  :root{--shell-top:60px;--shell-gap:9px;}
  .launchpad-shell{padding:max(0px,env(safe-area-inset-top)) max(9px,env(safe-area-inset-right)) calc(68px + env(safe-area-inset-bottom)) max(9px,env(safe-area-inset-left));}
  .app-topbar{gap:9px;padding:6px 0;}.brand-seal{width:40px;height:40px;border-radius:12px;}.brand-copy b{font-size:16px;}.brand-copy span{font-size:8px;max-width:36vw;}
  .topbar-count{display:none;}.top-controls{margin-left:auto;gap:5px;}.top-controls .ctrl-btn,.tools-menu summary{width:44px;height:44px;border-radius:12px;}
  #printBtn{display:none;}
  .launchpad-workspace{display:grid;grid-template-columns:1fr;grid-template-rows:minmax(0,.92fr) minmax(0,1.08fr);gap:9px;}
  .category-rail{display:none;}.project-stage{grid-row:1;border-radius:15px;}.library-panel{grid-row:2;border-radius:15px;padding:10px;gap:7px;}
  .stage-card{grid-template-rows:100%;display:block;}.stage-visual{position:absolute;inset:0;}.stage-visual::after{background:linear-gradient(to top,var(--bg2) 3%,rgba(17,17,20,.86) 43%,rgba(10,10,12,.2) 88%),linear-gradient(90deg,rgba(0,0,0,.35),transparent 70%);}
  .stage-content{height:100%;z-index:2;background:transparent;padding:14px;gap:6px;justify-content:flex-end;pointer-events:none;}
  .stage-content>*{pointer-events:auto;}.stage-titleline{gap:9px;}.stage-mark{width:34px;height:34px;border-radius:9px;background:rgba(10,10,12,.62);}.stage-mark svg{width:18px;height:18px;}
  .stage-titles h2{font-size:23px;text-shadow:0 2px 14px #000;color:#f0e6d2;}.stage-en{font-size:8px;color:#e8c768;}.stage-desc{font-size:11px;line-height:1.45;-webkit-line-clamp:2;color:#d7cdbb;text-shadow:0 1px 8px #000;}
  .stage-badges{left:12px;top:11px;}.stage-index{right:12px;top:13px;}.stage-actions{margin-top:2px;gap:6px;flex-wrap:nowrap;}.stage-actions .btn{min-height:44px;padding:9px 12px;font-size:11px;background:rgba(10,10,12,.76);color:#f0e6d2;border-color:rgba(232,199,104,.34);}
  .stage-actions .btn-primary{min-width:105px;background:linear-gradient(135deg,#e8c768,#c9a64a);color:#191207;border:0;}.stage-links{display:flex;flex-wrap:nowrap;overflow-x:auto;max-height:29px;scrollbar-width:none;}.stage-links::-webkit-scrollbar{display:none;}
  .stage-qr{right:10px;bottom:10px;left:10px;justify-content:center;background:rgba(17,17,20,.97);}.stage-qr .qr-box,.stage-qr .qr{width:96px;height:96px;}
  .library-head{grid-template-columns:minmax(0,1fr) auto auto;gap:6px;}.library-eyebrow,.library-heading p{display:none;}.library-heading h1{font-size:15px;}.view-count{font-size:9px;}.view-count b{font-size:13px;}
  .search-box{grid-column:auto;width:min(138px,35vw);height:44px;padding:0 9px;justify-content:flex-start;}.search-box input{width:100%;padding:0;opacity:1;font-size:10px;}
  .app-grid{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:7px;}.tile-button{padding:7px;grid-template-columns:minmax(44px,34%) minmax(0,1fr);gap:7px;}
  .tile-kicker{font-size:7.5px;}.tile-copy strong{font-size:12.5px;}.tile-copy small{font-size:7px;}.tile-state{right:5px;top:5px;}
  .library-foot{height:44px;}.page-button{width:44px;height:44px;}.shortcut-hint{display:none;}.admin-add{height:44px;}
  .mobile-tabs{position:fixed;z-index:50;left:max(9px,env(safe-area-inset-left));right:max(9px,env(safe-area-inset-right));bottom:max(7px,env(safe-area-inset-bottom));height:58px;display:grid;grid-template-columns:repeat(4,1fr);gap:5px;
    padding:5px;border:1px solid var(--line);border-radius:17px;background:color-mix(in srgb,var(--bg3) 96%,transparent);box-shadow:0 12px 40px rgba(0,0,0,.38);}
  .mobile-tabs .nav-button{min-height:0;height:46px;padding:3px;gap:2px;border-radius:10px;}.mobile-tabs .nav-button .icon{width:17px;height:17px;}.mobile-tabs .nav-button span{font-size:8px;}.mobile-tabs .nav-button.on::before{display:none;}
  .tools-pop{position:fixed;left:9px;right:9px;top:60px;width:auto;}
  .toast{bottom:76px;}.admin-bar{height:48px;}.admin-bar .ab-title{display:none;}body.admin .launchpad-shell{padding-top:calc(48px + env(safe-area-inset-top));}
  :root[data-theme="light"] .project-stage{background:#101114;border-color:rgba(155,118,30,.48);box-shadow:0 18px 40px rgba(31,29,25,.16);}
  :root[data-theme="light"] .stage-visual::after{background:linear-gradient(to top,rgba(13,14,16,.98) 3%,rgba(14,15,17,.82) 43%,rgba(9,10,12,.16) 88%),linear-gradient(90deg,rgba(0,0,0,.32),transparent 70%);}
  :root[data-theme="light"] .stage-content{background:transparent;border-top:0;}
  :root[data-theme="light"] .stage-mark{background:rgba(13,14,16,.72);border-color:rgba(218,181,85,.42);color:#e5bf58;box-shadow:none;}
  :root[data-theme="light"] .stage-actions .btn{background:rgba(13,14,16,.8);border-color:rgba(218,181,85,.32);color:#f3eee3;box-shadow:none;}
  :root[data-theme="light"] .stage-actions .btn-primary{background:linear-gradient(135deg,#e7c45e,#c99c32);border-color:transparent;color:#17130a;box-shadow:0 9px 22px rgba(0,0,0,.24);}
}
@media (max-height:680px) and (max-width:699px){
  :root{--shell-top:52px;}.brand-copy span{display:none;}.brand-seal{width:36px;height:36px;}.top-controls .ctrl-btn,.tools-menu summary{width:40px;height:40px;}
  .launchpad-workspace{grid-template-rows:minmax(0,.82fr) minmax(0,1.18fr);}.stage-desc{display:none;}.stage-badges{display:none;}.tile-copy small{display:none;}
}
@media (max-height:520px) and (min-width:700px) and (max-width:1000px){
  :root{--shell-top:52px;}
  .launchpad-workspace{grid-template-columns:56px minmax(250px,.8fr) minmax(0,1.2fr);}.category-rail{padding:5px 4px;gap:3px;}.rail-brand{display:none;}.nav-button{min-height:49px;gap:2px;padding:3px;}.nav-button span{font-size:8px;}.nav-button .icon{width:17px;height:17px;}
  .library-head{grid-template-columns:minmax(0,1fr) auto;}.library-heading p,.library-eyebrow{display:none;}.library-heading h1{font-size:14px;}
  .search-box{display:flex;grid-column:1/-1;width:100%;height:44px;}
  .app-grid{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));}.app-grid.grid-compact{grid-template-rows:repeat(2,minmax(0,1fr));}
  .tile-button{grid-template-columns:42px minmax(0,1fr);padding:6px;gap:6px;}.tile-cover{width:42px;height:42px;}.tile-kicker,.tile-copy small{display:none;}.tile-copy strong{font-size:11px;}
  .stage-card{grid-template-rows:100%;display:block;}.stage-visual{position:absolute;inset:0;}.stage-visual::after{background:linear-gradient(to top,var(--bg2),rgba(17,17,20,.8) 58%,rgba(10,10,12,.12));}
  .stage-content{height:100%;z-index:2;background:transparent;justify-content:flex-end;padding:12px;gap:5px;}.stage-titles h2{font-size:21px;color:#f0e6d2;text-shadow:0 2px 14px #000;}.stage-en{color:#e8c768;}.stage-desc,.stage-badges,.stage-links,.url{display:none;}.stage-actions{margin-top:3px;flex-wrap:nowrap;}.stage-actions .btn{background:rgba(10,10,12,.78);color:#f0e6d2;}.stage-actions .btn-primary{background:linear-gradient(135deg,#e8c768,#c9a64a);color:#191207;}
  :root[data-theme="light"] .project-stage{background:#101114;border-color:rgba(155,118,30,.48);}
  :root[data-theme="light"] .stage-visual::after{background:linear-gradient(to top,rgba(13,14,16,.97),rgba(14,15,17,.8) 58%,rgba(9,10,12,.1));}
  :root[data-theme="light"] .stage-content{background:transparent;border-top:0;}
  :root[data-theme="light"] .stage-mark{background:rgba(13,14,16,.72);border-color:rgba(218,181,85,.42);color:#e5bf58;box-shadow:none;}
  :root[data-theme="light"] .stage-actions .btn{background:rgba(13,14,16,.8);border-color:rgba(218,181,85,.32);color:#f3eee3;box-shadow:none;}
  :root[data-theme="light"] .stage-actions .btn-primary{background:linear-gradient(135deg,#e7c45e,#c99c32);border-color:transparent;color:#17130a;box-shadow:0 9px 22px rgba(0,0,0,.24);}
}
@media (max-width:350px){.brand-copy span{display:none;}.brand-copy b{font-size:14px;}.top-controls #shareBtn{display:none;}.launchpad-shell{padding-left:6px;padding-right:6px;}.mobile-tabs{left:6px;right:6px;}}

@media print{
  html,body{height:auto!important;overflow:visible!important;}.launchpad-shell,.admin-bar,.pw-mask,.toast{display:none!important;}
  .print-catalog{display:block!important;padding:8mm 9mm;color:#241d12;background:#fbf7ee;font-family:var(--serif);}
  .print-catalog h1{font-size:20pt;margin:0 0 2mm;}.print-catalog>p{font-size:9pt;margin:0 0 6mm;color:#5d513d;}
  .print-grid{display:grid;grid-template-columns:1fr 1fr;gap:4mm;}.print-item{display:grid;grid-template-columns:25mm 1fr;gap:4mm;align-items:center;border:1px solid #b3954c;padding:3mm;break-inside:avoid;}
  .print-item .qr,.print-item .qr-box{width:25mm;height:25mm;}.print-item h2{font-size:11pt;margin:0 0 1mm;}.print-item p{font-size:7pt;margin:0;color:#5d513d;word-break:break-all;}
  @page{size:A4;margin:10mm;}
}
"""

APP_JS = r"""
var LS='myskme-hub-data', SS='myskme-admin', PW_HASH='%%PWHASH%%';
function sha256hex(s){return crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)).then(function(b){return Array.prototype.map.call(new Uint8Array(b),function(x){return x.toString(16).padStart(2,'0');}).join('');}).catch(function(){return '';});}
(function(){
  var content=document.getElementById('content');
  var header=document.querySelector('header');
  var toastEl=document.getElementById('toast');
  var REDUCE=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 旧管理员存档只保存当时的数据。按稳定 key 回填后来新增的视觉资源，
  // 保留用户改过的文案、网址、排序与自建作品，不要求清空 localStorage。
  var DEFAULT_ITEM_BY_KEY={};
  (DEFAULT_DATA.sections||[]).forEach(function(sec){(sec.items||[]).forEach(function(it){if(it.key)DEFAULT_ITEM_BY_KEY[it.key]=it;});});
  var DATA=load(); var saveTimer, toastTimer;

  function clone(o){return JSON.parse(JSON.stringify(o));}
  function mergeVisualDefaults(data){
    var LEGACY_DEFAULT_DESC={
      gemfall:[
        '学院谷地地底的灵石矿脉 · 64 关远征 + 无尽矿脉 + 90 秒限时 · 2–6 人聚会赛 · 六位同伴助战、疾风爆裂万象组合技，老少皆宜，扫码即玩。'
      ],
      'monkey-upstairs':[
        '左右两键冲上 100 层 · 2–6 人同机公平赛 · 同轮同楼 · 本机坠楼榜 · 绕口令办与百层倒班随机营业，还能添加到桌面反复挑战。',
        '左右两键冲上 100 层 · 全程物理可达的随机楼道 · 2–6 人同机公平赛 · 绕口令办与百层倒班随机营业。可安装到桌面，结算生成带游戏二维码的随机成绩海报。'
      ],
      zimingqi:[
        '课堂肉鸽自走棋 · 单人闯关直面叶王 + 无尽回廊爬层 + 课堂多人对战 · 37 位正典学员，扫码即玩。',
        '课堂肉鸽自走棋 · 单人闯关直面叶王 + 无尽回廊爬层 + 课堂多人对战 · 41 位正典学员，扫码即玩。',
        '单人十关 · 无尽回廊 · 课堂多人 · 43 位可玩单位（41 位正典学员）—— 子鱼与 VOL.3 五名新徒已入棋，立绘同步终版。'
      ],
      volvme:[
        '狼先生与他的学生们 · 八章正典故事线，从立学之初到八月十五仲夏夜之战 —— 一切远征的源头。另有《无月》剧情图册：五部二十九篇，一篇一张脸，配收藏卡读。'
      ]
    };
    // 0810 作品搬家：自鸣棋正门从 github.io 改到 zimingqi.myskme.com。
    // 主 url 不在上面那批「只补缺失」的回填里(url2..url6 才是)，老访客的管理员存档里
    // 存着旧地址，光改 DEFAULT_DATA 他们永远刷不出新域名——卷子上的二维码也就白搬了。
    // 故照 LEGACY_DEFAULT_DESC 的同款做法：只把「历史上的官方默认地址」升级到最新，
    // 管理员亲手改过的网址一律不动。以后再搬别的作品，往这里加一条即可。
    var LEGACY_DEFAULT_URL={
      zimingqi:['https://myskme.github.io/myskme-zimingqi/']
    };
    var present={};
    (data.sections||[]).forEach(function(sec){(sec.items||[]).forEach(function(it){
      if(it.key)present[it.key]=true;
      var d=it.key&&DEFAULT_ITEM_BY_KEY[it.key]; if(!d)return;
      if(d.cover&&(!it.cover||(d.coverLegacy&&it.cover===d.coverLegacy)))it.cover=d.cover;
      if(!it.coverSmall&&d.coverSmall)it.coverSmall=d.coverSmall;
      if(!it.icon&&d.icon)it.icon=d.icon;
      if(it.featured==null&&d.featured!=null)it.featured=d.featured;
      // 仅把历史官方默认文案升级到最新口径；管理员亲手改过的介绍保持不动。
      var legacyDesc=it.key&&LEGACY_DEFAULT_DESC[it.key];
      if(legacyDesc&&legacyDesc.indexOf(it.desc)>-1)it.desc=d.desc;
      var legacyUrl=it.key&&LEGACY_DEFAULT_URL[it.key];
      if(legacyUrl&&d.url&&legacyUrl.indexOf(it.url)>-1)it.url=d.url;
      // 次链接也要回填：0718 给「世界编年史」加的「剧情图册·无月」原本只有清空过
      // localStorage 的人看得见——老访客(尤其是王老师自己这台)存档里没有 url2,
      // 永远刷不出来。只补缺失的,不覆盖用户改过的。
      if(!it.url2&&d.url2)it.url2=d.url2;
      if(!it.url2label&&d.url2label)it.url2label=d.url2label;
      // 0723 又给「世界编年史」加了第三链接「正典地点」——老访客同理要回填,否则永远刷不出来
      if(!it.url3&&d.url3)it.url3=d.url3;
      if(!it.url3label&&d.url3label)it.url3label=d.url3label;
      if(!it.url4&&d.url4)it.url4=d.url4;
      if(!it.url4label&&d.url4label)it.url4label=d.url4label;
      if(!it.url5&&d.url5)it.url5=d.url5;
      if(!it.url5label&&d.url5label)it.url5label=d.url5label;
      if(!it.url6&&d.url6)it.url6=d.url6;
      if(!it.url6label&&d.url6label)it.url6label=d.url6label;
    });});
    // 0726 新增「星徒地牢」。老访客的管理员存档里没有这张卡；
    // 只在完全缺失时补到娱乐卷首，不覆盖文案、不改变其他自定义作品。
    var entertainment=data.sections&&data.sections[0];
    var starDungeon=DEFAULT_ITEM_BY_KEY['star-dungeon'];
    if(entertainment&&starDungeon&&!present['star-dungeon']){
      entertainment.items=entertainment.items||[];
      entertainment.items.unshift(clone(starDungeon));
    }
    // 0812 新增荒诞休闲系列第一作。和星徒地牢同理，老访客的管理员存档也要补卡；
    // 只补完全缺失的官方项，不覆盖任何用户自定义内容。
    var monkeyUpstairs=DEFAULT_ITEM_BY_KEY['monkey-upstairs'];
    if(entertainment&&monkeyUpstairs&&!present['monkey-upstairs']){
      entertainment.items=entertainment.items||[];
      entertainment.items.splice(Math.min(4,entertainment.items.length),0,clone(monkeyUpstairs));
    }
    return data;
  }
  function load(){try{var s=localStorage.getItem(LS);if(s)return mergeVisualDefaults(JSON.parse(s));}catch(e){}return mergeVisualDefaults(clone(DEFAULT_DATA));}
  function save(){try{localStorage.setItem(LS,JSON.stringify(DATA));}catch(e){}}
  function dsave(){clearTimeout(saveTimer);saveTimer=setTimeout(save,400);}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function isAdmin(){return document.body.classList.contains('admin');}

  function qrSVG(url){
    var qr=qrcode(0,'Q'); qr.addData(url||'');
    try{qr.make();}catch(e){return '<svg class="qr" viewBox="0 0 25 25" xmlns="http://www.w3.org/2000/svg"><rect width="25" height="25" fill="#f3e9cf"/></svg>';}
    var n=qr.getModuleCount(),b=4,size=n+2*b,d='';
    for(var r=0;r<n;r++)for(var c=0;c<n;c++)if(qr.isDark(r,c))d+='M'+(c+b)+' '+(r+b)+'h1v1h-1z';
    return '<svg class="qr" viewBox="0 0 '+size+' '+size+'" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" role="img" aria-label="二维码"><rect width="'+size+'" height="'+size+'" fill="#f3e9cf"/><path d="'+d+'" fill="#16100a"/></svg>';
  }

  var CAT_PATH={
    game:'<path d="M12 2l3 3v9l-3 3-3-3V5z"/><path d="M9 17h6M12 17v4"/>',
    lore:'<path d="M5 4h11v13a3 3 0 003 3H8a3 3 0 01-3-3V4z"/><path d="M16 4a3 3 0 013 3a1 1 0 01-1 1h-2"/>',
    tool:'<path d="M4 4h7v15H6a2 2 0 01-2-2V4zM20 4h-7v15h5a2 2 0 002-2V4z"/>'};
  var ITEM_PATH={
    'star-dungeon':'<path d="M5 20V7l7-4 7 4v13"/><path d="M8 20v-7h8v7M9 8h6M12 10v3"/><path d="M4 20h16"/>',
    expedition:'<path d="M14.5 3.5l6 6L11 19l-4 1 1-4z"/><path d="M13 5l6 6M9 15l-4-4M5 19l-2 2"/>',
    starling:'<path d="M12 3c-3.8 3.7-6 8-6 12a6 6 0 0012 0c0-4-2.2-8.3-6-12z"/><path d="M12 8l1.2 2.4 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4z"/>',
    'monkey-upstairs':'<circle cx="12" cy="10" r="6"/><circle cx="5" cy="9" r="2.6"/><circle cx="19" cy="9" r="2.6"/><path d="M9 10h.1M15 10h.1M9.5 14q2.5 2 5 0"/><path d="M4 21h16M7 18h10M10 15h4"/>',
    zimingqi:'<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 9h16M4 15h16M9 4v16M15 4v16"/><circle cx="12" cy="12" r="2.2"/>',
    brawl:'<path d="M5 4l15 15M19 4L4 19"/><path d="M7 16l-3 3 1 1 3-3M16 7l3-3 1 1-3 3"/><path d="M12 7l2-3 2 3M7 12l-3 2 3 2"/>',
    volvme:'<path d="M6 4h11v14H7a3 3 0 01-3-3V6a2 2 0 012-2z"/><path d="M8 8h6M8 12h4"/><path d="M17 4a3 3 0 013 3v11h-3"/>',
    quiz:'<path d="M12 3l5 5-5 13L7 8z"/><path d="M7 8h10M9 13h6"/><circle cx="4" cy="7" r="1"/><circle cx="20" cy="15" r="1"/>',
    banks:'<path d="M4 5h16v14H4zM8 5v14M13 5v14M4 10h16"/><path d="M16 7h2M16 13h2M6 7v1M10 12v4"/>',
    listen:'<path d="M4 14v-2a8 8 0 0116 0v2"/><path d="M4 14a2 2 0 012-2h1v7H6a2 2 0 01-2-2zM20 14a2 2 0 00-2-2h-1v7h1a2 2 0 002-2z"/><path d="M9 15l1.3-2 1.5 4 1.4-5 1.8 3"/>',
    write:'<path d="M19 3c-5 .7-9.2 4.6-10.5 10.2L6 18l4.8-2.4C16.4 14 19.8 8.3 19 3z"/><path d="M5 20l8-8M10 16h7v4H8"/>',
    daily:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 9h16"/><path d="M12 12l.9 1.8 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1L9 14.1l2.1-.3z"/>',
    wall:'<rect x="4" y="4" width="16" height="13" rx="1"/><path d="M8 8h8M8 11h6"/><path d="M9 17l-1 4 4-2 4 2-1-4"/><circle cx="12" cy="16" r="2.5"/>',
    scoreboard:'<path d="M5 4h14v16H5z"/><path d="M8 8h5M8 12h8M8 16h6"/><path d="M16 5l.8 1.6 1.7.3-1.2 1.2.3 1.8-1.6-.9-1.6.9.3-1.8-1.2-1.2 1.7-.3z"/>',
    threek:'<path d="M4 18c3-8 7-13 16-14-1 8-6 12-14 15z"/><path d="M6 17l12-11M9 15l-1-6M12 12l1-6M15 9l3 1"/><path d="M4 21l3-3"/>',
    print:'<path d="M7 8V3h10v5M7 17H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2"/><path d="M7 14h10v7H7z"/><circle cx="17.5" cy="11.5" r=".7"/>'};
  var UI_PATH={
    external:'<path d="M14 5h5v5M10 14l9-9"/><path d="M19 13v6H5V5h6"/>',
    copy:'<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h3"/>',
    scan:'<path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4"/><path d="M9 9h6v6H9z"/>',
    print:'<path d="M7 8V3h10v5M7 17H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2"/><path d="M7 14h10v7H7z"/>',
    share:'<circle cx="18" cy="5" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="19" r="2"/><path d="M8 11l8-5M8 13l8 5"/>',
    edit:'<path d="M4 20l4.5-1 10-10a2.1 2.1 0 00-3-3l-10 10z"/><path d="M14.5 7.5l3 3M4 20h6"/>',
    links:'<path d="M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1"/><path d="M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1"/>',
    poster:'<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M7 16l3-3 2 2 3-4 2 3M8 7h5"/>',
    home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
    game:'<path d="M8 8h8a5 5 0 014.7 6.7l-1.1 3a2 2 0 01-3.3.8L14 16h-4l-2.3 2.5a2 2 0 01-3.3-.8l-1.1-3A5 5 0 018 8z"/><path d="M7 12h4M9 10v4"/><circle cx="16" cy="11.5" r=".7"/><circle cx="18" cy="13.5" r=".7"/>',
    book:'<path d="M4 5a3 3 0 013-2h5v17H7a3 3 0 00-3 2z"/><path d="M20 5a3 3 0 00-3-2h-5v17h5a3 3 0 013 2z"/>',
    world:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
    prev:'<path d="M15 5l-7 7 7 7"/>',
    next:'<path d="M9 5l7 7-7 7"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    close:'<path d="M6 6l12 12M18 6L6 18"/>'};
  var CAT_NAME={game:'游戏',lore:'世界观',tool:'学习工具'};
  function iconSVG(path,extra){return '<svg class="icon'+(extra?' '+extra:'')+'" viewBox="0 0 24 24" aria-hidden="true">'+path+'</svg>';}
  function uiIcon(name){return iconSVG(UI_PATH[name]||UI_PATH.external);}
  function catIcon(cat){var d=CAT_PATH[cat]||CAT_PATH.tool;
    return '<span class="cat-icon" title="'+(CAT_NAME[cat]||'作品')+'" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg><small>'+esc(CAT_NAME[cat]||'作品')+'</small></span>';}
  function workMark(it){var d=ITEM_PATH[it.icon||it.key]||CAT_PATH[it.cat]||CAT_PATH.tool;
    return '<span class="work-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg></span>';}
  var VIEW_STORE='myskme-hub-view-v3',RECENT_STORE='myskme-hub-recent-v2';
  var HOME_PRIORITY=['gemfall','zimingqi','monkey-upstairs','star-dungeon'];
  var viewKey='home',viewPage=0,selectedKey='',query='';
  // 每次重新进入主域都回到精选第一屏，避免上次停留的深层分类让代表作藏起来。
  var VIEW_DEFS={
    home:{label:'精选',eyebrow:'MYSKME NOW',desc:'代表作固定在前，最近打开只补一个位置',icon:'home'},
    games:{label:'游戏',eyebrow:'PLAY',desc:'远征、养成与策略世界',icon:'game'},
    learn:{label:'学习',eyebrow:'LEARN',desc:'中考修行与课堂器物',icon:'book'},
    world:{label:'世界',eyebrow:'LORE',desc:'正典、角色与远征源头',icon:'world'}
  };

  function allEntries(){var out=[];(DATA.sections||[]).forEach(function(sec,si){(sec.items||[]).forEach(function(it,ii){out.push({it:it,si:si,ii:ii});});});return out;}
  function entryByKey(key){var found=null;allEntries().some(function(e){if((e.it.key||'')===key){found=e;return true;}return false;});return found;}
  function recentKeys(){try{return JSON.parse(localStorage.getItem(RECENT_STORE)||'[]');}catch(e){return [];}}
  function saveView(){try{localStorage.setItem(VIEW_STORE,JSON.stringify({view:viewKey,page:viewPage,selected:selectedKey}));}catch(e){}}
  function recordRecent(key){if(!key)return;var r=recentKeys().filter(function(k){return k!==key;});r.unshift(key);try{localStorage.setItem(RECENT_STORE,JSON.stringify(r.slice(0,8)));}catch(e){}}
  function entriesForView(){
    var all=allEntries(),q=query.trim().toLowerCase();
    if(q)return all.filter(function(e){var it=e.it,s=[it.title,it.en,it.tag,it.desc,it.glyph].join(' ').toLowerCase();return s.indexOf(q)>=0;});
    if(viewKey==='games'){
      var games=all.filter(function(e){return e.it.cat==='game';}),gameOrder=[],gameSeen={};
      HOME_PRIORITY.forEach(function(k){games.some(function(e){if(e.it.key===k){gameSeen[k]=1;gameOrder.push(e);return true;}return false;});});
      games.forEach(function(e){var k=e.it.key||('x'+e.si+'-'+e.ii);if(!gameSeen[k])gameOrder.push(e);});
      return gameOrder;
    }
    if(viewKey==='learn')return all.filter(function(e){return e.si===1;});
    if(viewKey==='world')return all.filter(function(e){return e.it.cat==='lore'||['expedition','starling','zimingqi'].indexOf(e.it.key)>=0;});
    var order=[],seen={};
    HOME_PRIORITY.forEach(function(k){var e=entryByKey(k);if(e&&!seen[k]){seen[k]=1;order.push(e);}});
    recentKeys().some(function(k){var e=entryByKey(k);if(e&&!seen[k]){seen[k]=1;order.push(e);return true;}return false;});
    all.filter(function(e){return !!e.it.featured;}).forEach(function(e){var k=e.it.key||('x'+e.si+'-'+e.ii);if(!seen[k]){seen[k]=1;order.push(e);}});
    all.forEach(function(e){var k=e.it.key||('x'+e.si+'-'+e.ii);if(!seen[k]){seen[k]=1;order.push(e);}});
    return order;
  }
  function pageSize(){return matchMedia('(max-width:699px)').matches||matchMedia('(max-height:520px) and (min-width:700px) and (max-width:1000px)').matches?4:(matchMedia('(max-width:1180px)').matches?6:8);}
  function targetAttr(url){return (url||'').indexOf('https://myskme.com/')===0?'':' target="_blank" rel="noopener"';}
  function itemCover(it,cls,eager){
    var cover=it.cover||'',small=it.coverSmall||'',srcset=small?' srcset="'+esc(small)+' 640w, '+esc(cover)+' 1280w"':'';
    if(!cover)return '<div class="tile-fallback">'+esc(it.glyph||'作')+'</div>';
    var sizes=eager?' sizes="(max-width:699px) 100vw, (max-width:1180px) 56vw, 46vw"':' sizes="(max-width:699px) 28vw, (max-width:900px) 92px, (max-width:1180px) 17vw, 12vw"';
    return '<img class="'+(cls||'')+'" src="'+esc(cover)+'"'+srcset+sizes+' alt="" loading="'+(eager?'eager':'lazy')+'" fetchpriority="'+(eager?'high':'low')+'" decoding="async" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\'"><div class="tile-fallback" style="display:none">'+esc(it.glyph||'作')+'</div>';
  }
  function tileHTML(entry){var it=entry.it,key=it.key||('x'+entry.si+'-'+entry.ii),sel=key===selectedKey;
    return '<article class="app-tile'+(sel?' selected':'')+'" data-key="'+esc(key)+'">'
      +'<button class="tile-button" data-select="'+esc(key)+'" aria-pressed="'+(sel?'true':'false')+'" aria-label="查看 '+esc(it.title)+'">'
      +'<span class="tile-cover">'+itemCover(it,'',false)+'</span><span class="tile-copy"><span class="tile-kicker">'+esc(it.tag||CAT_NAME[it.cat]||'MYSKME')+'</span>'
      +'<strong>'+esc(it.title)+'</strong><small>'+esc(it.en||'MYSKME ORIGINAL')+'</small></span><span class="tile-state"></span></button></article>';
  }
  function secondaryLinks(it,key){var h='';for(var i=2;i<=6;i++){var u=it['url'+i],lab=it['url'+i+'label'];if(u)h+='<a href="'+esc(u)+'"'+targetAttr(u)+' data-launch="'+esc(key)+'">'+uiIcon('external')+esc(lab||'更多入口')+'</a>';}
    return h?'<div class="stage-links" aria-label="相关入口">'+h+'</div>':'';}
  function stageHTML(entry,absoluteIndex,total){
    if(!entry)return '<div class="empty-grid">没有找到匹配的作品</div>';
    var it=entry.it,key=it.key||('x'+entry.si+'-'+entry.ii),rar=esc(it.rarity||'N');
    var path=ITEM_PATH[it.icon||it.key]||CAT_PATH[it.cat]||CAT_PATH.tool;
    return '<article class="stage-card card" data-sec="'+entry.si+'" data-idx="'+entry.ii+'">'
      +'<div class="stage-visual">'+itemCover(it,'stage-cover',true)+'<div class="stage-badges"><span class="stage-badge" data-bind="tag">'+esc(it.tag||CAT_NAME[it.cat]||'原创作品')+'</span><span class="stage-badge rarity">'+rar+'</span></div>'
      +'<span class="stage-index">'+String(absoluteIndex+1).padStart(2,'0')+' / '+String(total).padStart(2,'0')+'</span></div>'
      +'<div class="stage-content"><div class="stage-titleline"><span class="stage-mark"><svg viewBox="0 0 24 24">'+path+'</svg></span><div class="stage-titles">'
      +'<h2 data-bind="title">'+esc(it.title)+'</h2><span class="stage-en" data-bind="en">'+esc(it.en||'MYSKME ORIGINAL')+'</span></div></div>'
      +'<p class="stage-desc" data-bind="desc">'+esc(it.desc||'')+'</p>'+secondaryLinks(it,key)
      +'<div class="stage-actions"><a class="btn btn-go btn-primary" href="'+esc(it.url)+'"'+targetAttr(it.url)+' data-launch="'+esc(key)+'">'+uiIcon('external')+'<span>启动作品</span></a>'
      +'<button class="btn btn-qr btn-icon" title="显示二维码">'+uiIcon('scan')+'<span>扫码</span></button>'
      +'<button class="btn btn-copy btn-icon" data-url="'+esc(it.url)+'" title="复制链接">'+uiIcon('copy')+'<span>复制</span></button></div>'
      +'<span class="url" data-bind="url">'+esc(it.url)+'</span>'
      +'<div class="qr-plate stage-qr" role="dialog" aria-label="作品二维码"><button class="stage-qr-close" aria-label="关闭二维码">'+uiIcon('close')+'</button><div class="qr-box">'+qrSVG(it.url)+'</div><div class="stage-qr-copy"><b>扫码直接出发</b><span>手机浏览器打开，无需下载或安装。</span></div></div>'
      +'<div class="card-admin stage-admin"><button data-op="up">上移</button><button data-op="down">下移</button><button data-op="move">换区</button><button data-op="feat">主推</button><button data-op="del" class="danger">删除</button></div>'
      +'</div></article>';
  }
  function printItemHTML(e){return '<article class="print-item"><div class="qr-box">'+qrSVG(e.it.url)+'</div><div><h2>'+esc(e.it.title)+'</h2><p>'+esc(e.it.url)+'</p></div></article>';}
  function buildNav(){
    var h='',defs=['home','games','learn','world'];defs.forEach(function(k){var d=VIEW_DEFS[k];h+='<button class="nav-button'+(viewKey===k&&!query?' on':'')+'" data-view="'+k+'" aria-pressed="'+(viewKey===k&&!query?'true':'false')+'">'+uiIcon(d.icon)+'<span>'+d.label+'</span></button>';});
    var rail=document.getElementById('volnav-inner'),mobile=document.getElementById('mobileNav');if(rail)rail.innerHTML='<div class="rail-brand" aria-hidden="true">MY</div>'+h;if(mobile)mobile.innerHTML=h;
  }
  function render(){
    var entries=entriesForView(),size=pageSize(),pages=Math.max(1,Math.ceil(entries.length/size));viewPage=Math.max(0,Math.min(viewPage,pages-1));
    var selectedAt=entries.findIndex(function(e){return (e.it.key||('x'+e.si+'-'+e.ii))===selectedKey;});
    if(selectedAt<0){selectedKey=entries[0]?(entries[0].it.key||('x'+entries[0].si+'-'+entries[0].ii)):'';selectedAt=entries.length?0:-1;}
    if(selectedAt>=0)viewPage=Math.floor(selectedAt/size);
    var start=viewPage*size,slice=entries.slice(start,start+size),html='';slice.forEach(function(e){html+=tileHTML(e);});if(!html)html='<div class="empty-grid">没有找到匹配的作品<br>换个关键词试试</div>';content.innerHTML=html;content.classList.toggle('grid-compact',slice.length<=4);
    var selected=selectedAt>=0?entries[selectedAt]:(entries[0]||null),absoluteIndex=Math.max(0,selectedAt);var stage=document.getElementById('projectStage');if(stage)stage.innerHTML=stageHTML(selected,absoluteIndex,entries.length);
    var def=query?{label:'搜索结果',eyebrow:'SEARCH',desc:'按名称、类型或内容查找'}:(VIEW_DEFS[viewKey]||VIEW_DEFS.home);
    var title=document.getElementById('viewTitle'),eye=document.getElementById('viewEyebrow'),desc=document.getElementById('viewDesc'),cnt=document.getElementById('viewCount');
    if(title)title.textContent=def.label;if(eye)eye.textContent=def.eyebrow;if(desc)desc.textContent=def.desc;if(cnt)cnt.innerHTML='<b>'+entries.length+'</b>项';
    var label=document.getElementById('pageLabel');if(label)label.textContent=(viewPage+1)+' / '+pages;var prev=document.getElementById('pagePrev'),next=document.getElementById('pageNext');if(prev)prev.disabled=viewPage<=0;if(next)next.disabled=viewPage>=pages-1;
    var pc=document.getElementById('printCatalog');if(pc)pc.innerHTML='<h1>MYSKME · 作品总目</h1><p>Make Yourself Special &amp; Kind · 扫码即玩</p><div class="print-grid">'+allEntries().map(printItemHTML).join('')+'</div>';
    buildNav();updateCounts();applyAdmin();reveal();saveView();
  }
  function setView(k){if(!VIEW_DEFS[k])return;viewKey=k;query='';viewPage=0;var q=document.getElementById('hubSearch');if(q)q.value='';selectedKey='';render();}
  function setPage(delta){var entries=entriesForView(),size=pageSize(),pages=Math.max(1,Math.ceil(entries.length/size));viewPage=Math.max(0,Math.min(viewPage+delta,pages-1));var first=entries[viewPage*size];if(first)selectedKey=first.it.key||('x'+first.si+'-'+first.ii);render();}
  function selectEntry(key){if(!entryByKey(key))return;selectedKey=key;render();}

  function renderHeader(){
    document.querySelectorAll('[data-h]').forEach(function(el){
      var k=el.getAttribute('data-h'); if(DATA[k]!=null) el.textContent=DATA[k];
    });
  }

  function reveal(){
    document.querySelectorAll('.stage-card,.app-tile').forEach(function(c){c.classList.add('in');});
  }

  function setNum(id,v){var e=document.getElementById(id);if(e)e.textContent=v;}
  function updateCounts(){
    var secs=DATA.sections||[],total=0,i;
    for(i=0;i<secs.length;i++)total+=(secs[i].items&&secs[i].items.length)||0;
    setNum('stat-total',total);
    setNum('stat-a',(secs[0]&&secs[0].items&&secs[0].items.length)||0);
    setNum('stat-b',(secs[1]&&secs[1].items&&secs[1].items.length)||0);
  }
  function statsAnim(){
    document.querySelectorAll('.stat b').forEach(function(el){
      var t=+el.textContent||0,s=null;
      if(REDUCE){el.textContent=t;return;}
      function step(ts){if(!s)s=ts;var p=Math.min((ts-s)/800,1);el.textContent=Math.round(p*t);if(p<1)requestAnimationFrame(step);}
      requestAnimationFrame(step);
    });
  }

  function applyAdmin(){
    var on=isAdmin();
    document.querySelectorAll('[data-bind],[data-h],[data-seclabel]').forEach(function(el){
      if(on){el.setAttribute('contenteditable','true');el.setAttribute('spellcheck','false');}
      else{el.removeAttribute('contenteditable');}
    });
  }

  // ---- 文本编辑：直接读 DOM 写回 DATA，url 改动即时重算二维码 ----
  function onEdit(e){
    var el=e.target, txt=el.textContent;
    if(el.hasAttribute('data-h')){DATA[el.getAttribute('data-h')]=txt;dsave();return;}
    if(el.hasAttribute('data-seclabel')){DATA.sections[+el.getAttribute('data-seclabel')].label=txt;dsave();return;}
    var card=el.closest&&el.closest('.card'); if(!card)return;
    var si=+card.getAttribute('data-sec'), ii=+card.getAttribute('data-idx');
    var key=el.getAttribute('data-bind'); if(!key)return;
    var it=DATA.sections[si].items[ii]; if(!it)return;
    it[key]=txt;
    if(key==='url'){
      var box=card.querySelector('.qr-box'); if(box)box.innerHTML=qrSVG(txt);
      var go=card.querySelector('.btn-go'); if(go)go.href=txt;
      var tl=card.querySelector('.title-link'); if(tl)tl.href=txt;
      var th=card.querySelector('a.thumb'); if(th)th.href=txt;
      var cp=card.querySelector('.btn-copy'); if(cp)cp.setAttribute('data-url',txt);
    }
    if(key==='title'||key==='en'||key==='tag'){
      var chosen=Array.prototype.find.call(content.querySelectorAll('[data-select]'),function(b){return b.getAttribute('data-select')===selectedKey;});
      if(chosen){var preview=chosen.querySelector(key==='title'?'strong':key==='en'?'small':'.tile-kicker');if(preview)preview.textContent=txt;}
    }
    dsave();
  }
  function onKey(e){if(e.key==='Enter'&&e.target.isContentEditable){e.preventDefault();e.target.blur();}}
  function onPaste(e){if(!e.target.isContentEditable)return;e.preventDefault();
    var t=(e.clipboardData||window.clipboardData).getData('text');document.execCommand('insertText',false,t);}

  // ---- 结构操作 ----
  function doOp(btn){
    var card=btn.closest('.card'); var si=+card.getAttribute('data-sec'), ii=+card.getAttribute('data-idx');
    var arr=DATA.sections[si].items, op=btn.getAttribute('data-op');
    if(op==='up'&&ii>0){var t=arr[ii-1];arr[ii-1]=arr[ii];arr[ii]=t;}
    else if(op==='down'&&ii<arr.length-1){var t2=arr[ii+1];arr[ii+1]=arr[ii];arr[ii]=t2;}
    else if(op==='move'){var other=si^1;if(DATA.sections[other]){DATA.sections[other].items.push(arr.splice(ii,1)[0]);}}
    else if(op==='feat'){arr[ii].featured=!arr[ii].featured;}
    else if(op==='del'){if(!confirm('删除「'+(arr[ii].title||'此作品')+'」？'))return;arr.splice(ii,1);}
    save();render();
  }
  function addWork(si){
    if(!DATA.sections[si])return;
    var key='custom-'+Date.now();
    DATA.sections[si].items.push({key:key,glyph:'新',cat:si===0?'game':'tool',rarity:'N',tag:'新入口',title:'新作品',en:'NEW WORK',desc:'在这里写一句作品介绍。',url:'https://'});
    selectedKey=key;viewKey=si===0?'games':'learn';viewPage=Math.max(0,Math.ceil(DATA.sections[si].items.length/pageSize())-1);
    save();render();
    var t=document.querySelector('#projectStage [data-bind="title"]');if(t)setTimeout(function(){t.focus();},80);
  }

  function copyLink(btn){
    var u=btn.getAttribute('data-url');
    function done(){toast('已复制 '+u.replace(/^https?:\/\//,'').replace(/\/$/,''));}
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(u).then(done,function(){fallback(u);done();});}
    else{fallback(u);done();}
  }
  function fallback(u){var ta=document.createElement('textarea');ta.value=u;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}catch(e){}ta.remove();}

  function toast(msg){toastEl.textContent=msg;toastEl.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(function(){toastEl.classList.remove('show');},1900);}

  // ---- 管理员开关 + 密码 ----
  var mask=document.getElementById('pwMask'), pwBox=document.getElementById('pwBox'),
      pwInput=document.getElementById('pwInput');
  function openPw(){mask.classList.add('show');pwBox.classList.remove('err');pwInput.value='';setTimeout(function(){pwInput.focus();},60);}
  function closePw(){mask.classList.remove('show');}
  function tryPw(){
    sha256hex((pwInput.value||'').trim()).then(function(h){
      if(h===PW_HASH){closePw();setAdmin(true);toast('已进入管理员模式');}
      else{pwBox.classList.remove('err');void pwBox.offsetWidth;pwBox.classList.add('err');pwInput.select();}
    });
  }
  function setAdmin(on){
    document.body.classList.toggle('admin',on);
    if(on)sessionStorage.setItem(SS,'1'); else sessionStorage.removeItem(SS);
    applyAdmin();
    if(on)reveal();
  }

  // ---- 导出（重新生成可部署的 index.html）----
  function download(name,text,type){
    var blob=new Blob([text],{type:type||'text/plain;charset=utf-8'});
    var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;
    document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href);},2000);
  }
  function exportHTML(){
    save();
    var jsonStr=JSON.stringify(DATA,null,2);
    fetch(location.pathname+location.search,{cache:'no-store'}).then(function(r){return r.text();}).then(function(html){
      if(html.indexOf('/*DATA_START*/')<0)throw 0;
      html=html.replace(/\/\*DATA_START\*\/[\s\S]*?\/\*DATA_END\*\//,'/*DATA_START*/\nvar DEFAULT_DATA = '+jsonStr+';\n/*DATA_END*/');
      download('index.html',html,'text/html;charset=utf-8');
      toast('已导出 index.html，可直接重新部署');
    }).catch(function(){
      download('myskme-hub-content.json',jsonStr,'application/json');
      toast('已导出内容 JSON（页面源码不可读，改导 JSON）');
    });
  }

  // ---- 一键复制全部链接 ----
  function countItems(){var n=0;DATA.sections.forEach(function(s){n+=(s.items||[]).length;});return n;}
  function allLinksText(){
    var lines=['MYSKME · 作品总目 — 狼先生与他的学生们'];
    DATA.sections.forEach(function(sec){(sec.items||[]).forEach(function(it){lines.push(it.title+'  '+it.url);});});
    if(DATA.hubUrl)lines.push('— 总目 '+DATA.hubUrl);
    return lines.join('\n');
  }
  function copyAll(){
    var t=allLinksText();
    function ok(){toast('已复制全部链接（'+countItems()+' 条）');}
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(ok,function(){fallback(t);ok();});}
    else{fallback(t);ok();}
  }

  // ---- 竖版海报导出（1080×1920，含全部二维码）----
  function drawQRon(ctx,url,x,y,size){
    var qr=qrcode(0,'Q');qr.addData(url||'');try{qr.make();}catch(e){return;}
    var n=qr.getModuleCount(),b=4,total=n+2*b,cell=size/total;
    ctx.fillStyle='#f3e9cf';ctx.fillRect(x,y,size,size);
    ctx.fillStyle='#16100a';
    for(var r=0;r<n;r++)for(var c=0;c<n;c++)if(qr.isDark(r,c))ctx.fillRect(x+(c+b)*cell,y+(r+b)*cell,Math.ceil(cell),Math.ceil(cell));
  }
  function fitText(ctx,s,maxw){s=String(s||'');if(ctx.measureText(s).width<=maxw)return s;
    while(s.length>1&&ctx.measureText(s+'…').width>maxw)s=s.slice(0,-1);return s+'…';}
  function buildPoster(){
    var W=1080,H=1920,cv=document.createElement('canvas');cv.width=W;cv.height=H;
    var ctx=cv.getContext('2d');
    // 浅色羊皮纸底：省墨、好打印、好分享
    ctx.fillStyle='#f5efe2';ctx.fillRect(0,0,W,H);
    var g=ctx.createRadialGradient(W/2,-60,80,W/2,260,940);
    g.addColorStop(0,'rgba(201,166,74,.16)');g.addColorStop(1,'rgba(201,166,74,0)');ctx.fillStyle=g;ctx.fillRect(0,0,W,720);
    ctx.strokeStyle='rgba(150,120,50,.55)';ctx.lineWidth=2;ctx.strokeRect(30,30,W-60,H-60);
    ctx.textAlign='center';ctx.textBaseline='alphabetic';
    ctx.fillStyle='#8a6d1e';ctx.font='600 26px "Songti SC","Noto Serif SC",serif';ctx.fillText('MYSKME · 王老师 MR. WANG',W/2,124);
    ctx.fillStyle='#2a2218';ctx.font='300 74px "Songti SC","Noto Serif SC",serif';ctx.fillText('狼先生与他的学生们',W/2,214);
    ctx.fillStyle='#6a5f47';ctx.font='400 27px "Songti SC",serif';ctx.fillText('Make Yourself Special & Kind · 作品总目',W/2,266);
    var items=[];DATA.sections.forEach(function(s){(s.items||[]).forEach(function(it){items.push(it);});});
    items=items.filter(function(it){return !/\/wall\//.test(it.url||'');}).slice(0,6);
    var top=350,gx=60,gap=30,footerH=320,cw=(W-2*gx-gap)/2,rows=Math.ceil(items.length/2);
    var areaH=H-top-footerH,ch=(areaH-(rows-1)*gap)/rows;
    items.forEach(function(it,i){
      var col=i%2,row=Math.floor(i/2),x=gx+col*(cw+gap),y=top+row*(ch+gap);
      ctx.fillStyle='#fffdf6';ctx.fillRect(x,y,cw,ch);
      ctx.strokeStyle='rgba(150,120,50,.4)';ctx.lineWidth=1.5;ctx.strokeRect(x,y,cw,ch);
      ctx.textAlign='center';ctx.fillStyle='#2a2218';ctx.font='500 29px "Songti SC",serif';
      ctx.fillText(fitText(ctx,it.title,cw-44),x+cw/2,y+50);
      var qs=Math.max(160,Math.min(232,cw-130,ch-150));
      drawQRon(ctx,it.url,x+(cw-qs)/2,y+70,qs);
      ctx.fillStyle='#7a6f55';ctx.font='400 17px ui-monospace,Menlo,monospace';
      ctx.fillText(fitText(ctx,it.url.replace(/^https?:\/\//,''),cw-34),x+cw/2,y+ch-22);
    });
    // 页脚带：作品总目自身的二维码（扫一下进全部）
    var fy=H-footerH+20;
    ctx.strokeStyle='rgba(150,120,50,.4)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(60,fy);ctx.lineTo(W-60,fy);ctx.stroke();
    var hq=176,hx=84,hy=fy+34;
    ctx.strokeStyle='rgba(150,120,50,.6)';ctx.lineWidth=2;ctx.strokeRect(hx-6,hy-6,hq+12,hq+12);
    drawQRon(ctx,DATA.hubUrl||location.href,hx,hy,hq);
    var tx=hx+hq+44;ctx.textAlign='left';
    ctx.fillStyle='#8a6d1e';ctx.font='600 33px "Songti SC",serif';ctx.fillText('扫码打开 · 作品总目',tx,hy+46);
    ctx.fillStyle='#5a4f38';ctx.font='400 22px ui-monospace,Menlo,monospace';ctx.fillText((DATA.hubUrl||'').replace(/^https?:\/\//,'').replace(/\/$/,''),tx,hy+88);
    ctx.fillStyle='#6a5f47';ctx.font='400 23px "Songti SC",serif';ctx.fillText('娱乐与学习 · 中考修行 · 一站直达',tx,hy+132);
    ctx.textAlign='center';ctx.fillStyle='#8a6d1e';ctx.font='600 22px serif';ctx.fillText('MYSKME — Make Yourself Special & Kind',W/2,H-46);
    cv.toBlob(function(blob){if(!blob){toast('海报导出失败');return;}
      var u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='MYSKME-作品总目-海报.png';
      document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u);},3000);
      toast('已导出浅色竖版海报 1080×1920');},'image/png');
  }

  // ---- 事件绑定 ----
  function closeStageQr(){document.querySelectorAll('.stage-qr.show').forEach(function(el){el.classList.remove('show');});}
  function closeTools(){var tools=document.querySelector('.tools-menu');if(tools)tools.open=false;}
  content.addEventListener('input',onEdit);
  header.addEventListener('input',onEdit);
  content.addEventListener('keydown',onKey,true);
  header.addEventListener('keydown',onKey,true);
  content.addEventListener('paste',onPaste);
  header.addEventListener('paste',onPaste);

  document.addEventListener('click',function(e){
    var qx=e.target.closest('.stage-qr-close');if(qx){var plate=qx.closest('.stage-qr');if(plate)plate.classList.remove('show');return;}
    var nav=e.target.closest('[data-view]');if(nav){setView(nav.getAttribute('data-view'));return;}
    var tile=e.target.closest('[data-select]');if(tile){selectEntry(tile.getAttribute('data-select'));return;}
    if(e.target.closest('#pagePrev')){setPage(-1);return;}if(e.target.closest('#pageNext')){setPage(1);return;}
    if(e.target.closest('#adminAdd')){addWork(viewKey==='learn'?1:0);return;}
    var op=e.target.closest('[data-op]'); if(op){doOp(op);return;}
    var add=e.target.closest('[data-addsec]'); if(add){addWork(+add.getAttribute('data-addsec'));return;}
    var cp=e.target.closest('.btn-copy'); if(cp){copyLink(cp);return;}
    var qb=e.target.closest('.btn-qr'); if(qb){var qc=qb.closest('.card'),qp=qc&&qc.querySelector('.qr-plate'),was=qp&&qp.classList.contains('show');closeStageQr();if(qp&&!was){qp.classList.add('show');var qclose=qp.querySelector('.stage-qr-close');if(qclose)setTimeout(function(){qclose.focus();},0);}return;}
    var launch=e.target.closest('[data-launch]');if(launch){recordRecent(launch.getAttribute('data-launch'));if(isAdmin())e.preventDefault();return;}
    if(isAdmin()){var a=e.target.closest('a');if(a)e.preventDefault();}  // 编辑时不跳转
  });

  var searchInput=document.getElementById('hubSearch');
  if(searchInput)searchInput.addEventListener('input',function(){query=this.value||'';viewPage=0;selectedKey='';render();if(document.activeElement!==this)this.focus();});
  document.addEventListener('click',function(e){
    var tools=document.querySelector('.tools-menu');if(tools&&tools.open&&!tools.contains(e.target))tools.open=false;
    if(!e.target.closest('.stage-qr')&&!e.target.closest('.btn-qr'))closeStageQr();
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='/'&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&document.activeElement!==searchInput){e.preventDefault();searchInput&&searchInput.focus();return;}
    if(e.key==='Escape'){
      if(document.querySelector('.stage-qr.show')){e.preventDefault();closeStageQr();return;}
      var tools=document.querySelector('.tools-menu');if(tools&&tools.open){e.preventDefault();tools.open=false;return;}
      if(query){query='';if(searchInput)searchInput.value='';render();return;}
    }
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.key)<0||/INPUT|TEXTAREA/.test((document.activeElement&&document.activeElement.tagName)||''))return;
    var buttons=Array.prototype.slice.call(content.querySelectorAll('[data-select]'));if(!buttons.length)return;
    var current=buttons.findIndex(function(b){return b.getAttribute('data-select')===selectedKey;}),cols=2,step=(e.key==='ArrowUp'?-cols:e.key==='ArrowDown'?cols:e.key==='ArrowLeft'?-1:1);
    var next=Math.max(0,Math.min((current<0?0:current)+step,buttons.length-1));if(next!==current){e.preventDefault();selectEntry(buttons[next].getAttribute('data-select'));setTimeout(function(){var b=content.querySelector('[data-select="'+selectedKey+'"]');b&&b.focus();},0);}
  });
  var resizeTimer;window.addEventListener('resize',function(){clearTimeout(resizeTimer);resizeTimer=setTimeout(render,120);});

  document.getElementById('adminFab').addEventListener('click',function(){closeTools();openPw();});
  document.getElementById('pwOk').addEventListener('click',tryPw);
  document.getElementById('pwCancel').addEventListener('click',closePw);
  pwInput.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();tryPw();}if(e.key==='Escape')closePw();});
  mask.addEventListener('click',function(e){if(e.target===mask)closePw();});
  document.getElementById('abExport').addEventListener('click',exportHTML);
  var abc=document.getElementById('abConsole');
  if(abc)abc.addEventListener('click',function(){window.open('console/','_blank','noopener');});
  var abm=document.getElementById('abMaker');
  if(abm)abm.addEventListener('click',function(){window.open('maker/','_blank','noopener');});
  var abf=document.getElementById('abForge');
  if(abf)abf.addEventListener('click',function(){window.open('forge/','_blank','noopener');});
  document.getElementById('abReset').addEventListener('click',function(){
    if(!confirm('重置为默认内容？将清除本机所有改动。'))return;
    try{localStorage.removeItem(LS);}catch(e){}DATA=clone(DEFAULT_DATA);renderHeader();render();toast('已重置为默认内容');
  });
  document.getElementById('abExit').addEventListener('click',function(){setAdmin(false);toast('已退出管理员模式');});

  // ---- 打印 / 分享 ----
  function doShare(){var u=location.href,t=document.title;
    if(navigator.share){navigator.share({title:t,text:'MYSKME · 作品总目',url:u}).catch(function(){});}
    else{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(u).then(null,function(){fallback(u);});}else fallback(u);toast('已复制本页链接');}}

  document.getElementById('printBtn').addEventListener('click',function(){window.print();});
  document.getElementById('shareBtn').addEventListener('click',doShare);
  var cab=document.getElementById('copyAllBtn'); if(cab)cab.addEventListener('click',function(){closeTools();copyAll();});
  var pb=document.getElementById('posterBtn'); if(pb)pb.addEventListener('click',function(){closeTools();buildPoster();});

  // ---- 启动 ----
  var adminFab=document.getElementById('adminFab');if(adminFab)adminFab.innerHTML=uiIcon('edit')+'<span>管理员编辑</span>';
  var printCtl=document.getElementById('printBtn');if(printCtl)printCtl.innerHTML=uiIcon('print')+'<span class="sr-only">打印</span>';
  var shareCtl=document.getElementById('shareBtn');if(shareCtl)shareCtl.innerHTML=uiIcon('share')+'<span class="sr-only">分享</span>';
  if(cab)cab.innerHTML=uiIcon('links')+'<span>复制全部链接</span>';
  if(pb)pb.innerHTML=uiIcon('poster')+'<span>导出竖版海报</span>';
  var moreSummary=document.getElementById('moreSummary');if(moreSummary)moreSummary.innerHTML=uiIcon('more');
  var searchIcon=document.getElementById('searchIcon');if(searchIcon)searchIcon.innerHTML=uiIcon('search');
  var pagePrev=document.getElementById('pagePrev');if(pagePrev)pagePrev.innerHTML=uiIcon('prev');
  var pageNext=document.getElementById('pageNext');if(pageNext)pageNext.innerHTML=uiIcon('next');
  var sq=document.getElementById('shareQr'); if(sq)sq.innerHTML='<div class="qr-box">'+qrSVG(DATA.hubUrl||location.href)+'</div>';
  var su=document.getElementById('shareUrl'); if(su)su.textContent=(DATA.hubUrl||'').replace(/^https?:\/\//,'').replace(/\/$/,'');
  renderHeader();
  render();
  statsAnim();
  if(sessionStorage.getItem(SS)==='1')setAdmin(true);
})();
"""

STARMAP_SVG = (
  '<svg viewBox="0 0 1200 60" preserveAspectRatio="none" fill="none">'
  '<path d="M0 34 C180 12 300 50 460 30 S760 8 900 34 1050 46 1200 26" stroke="#c9a64a" stroke-width="1" opacity=".5"/>'
  '<g fill="#e8c768">'
  '<circle cx="120" cy="26" r="2.4"/><circle cx="300" cy="42" r="1.8"/><circle cx="460" cy="30" r="2.8"/>'
  '<circle cx="620" cy="20" r="1.6"/><circle cx="760" cy="30" r="2.2"/><circle cx="900" cy="34" r="2.8"/>'
  '<circle cx="1050" cy="42" r="1.8"/><circle cx="1180" cy="26" r="2.2"/></g>'
  '<g fill="#c9a64a" opacity=".55"><circle cx="220" cy="18" r="1"/><circle cx="540" cy="46" r="1"/>'
  '<circle cx="700" cy="12" r="1"/><circle cx="980" cy="18" r="1"/></g></svg>')

def static_header(d):
    return (
        '  <header class="app-topbar" id="appHeader">\n'
        '    <a class="brand-lockup" href="https://myskme.com/" aria-label="MYSKME 作品启动台首页">\n'
        '      <img class="brand-seal" src="icons/apple-touch-icon.png" alt="">\n'
        '      <span class="brand-copy">\n'
        f'        <b><span data-h="titlePre">{d["titlePre"]}</span> · <span data-h="titleEm">{d["titleEm"]}</span></b>\n'
        f'        <span data-h="kicker">{d["kicker"]}</span>\n'
        '      </span>\n'
        '    </a>\n'
        f'    <div class="topbar-motto" data-h="motto">{d["motto"]}</div>\n'
        '    <div class="topbar-count"><b id="stat-total">0</b><span>原创入口</span></div>\n'
        '    <div class="top-controls">\n'
        '      <button class="ctrl-btn" id="printBtn" title="打印二维码总目" aria-label="打印二维码总目"></button>\n'
        '      <button class="ctrl-btn" id="shareBtn" title="分享本页" aria-label="分享本页"></button>\n'
        '      <details class="tools-menu"><summary id="moreSummary" aria-label="更多工具"></summary><div class="tools-pop">\n'
        '        <button id="copyAllBtn"></button><button id="posterBtn"></button><button class="admin-fab" id="adminFab"></button>\n'
        '      </div></details>\n'
        '    </div>\n'
        '  </header>'
    )

data_json = json.dumps(DEFAULT_DATA, ensure_ascii=False, indent=2)
app = APP_JS.replace("%%PWHASH%%", PASSWORD_HASH)

PAGE = """<!doctype html>
<!--
  本文件由 build_hub.py 自动生成，请勿手改。
  手改会在下次运行生成器时被静默覆盖。
  要改内容：先改 build_hub.py，再重新运行它生成本文件。
  页面里的「导出 index.html」按钮同理，导出物只作备份，不要当作源文件回填仓库。
-->
<html lang="zh-CN" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>狼先生与他的学生们 · 作品总目 | MYSKME</title>
<link rel="canonical" href="https://myskme.com/">
<link rel="manifest" href="manifest.webmanifest">
<link rel="preload" as="image" href="assets/cover-gemfall.webp" fetchpriority="high">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="MYSKME">
<meta name="color-scheme" content="light">
<meta name="theme-color" content="#e8e7e3">
<meta name="description" content="王老师的原创作品启动台：灵石远征 / 自鸣棋 / 是猴就上100层 / 星徒地牢 / 远征录 / 世界编年史——手机与平板直接打开。">
<meta property="og:type" content="website">
<meta property="og:title" content="MYSKME · 作品总目 — 狼先生与他的学生们">
<meta property="og:description" content="灵石远征、自鸣棋、是猴就上100层等 MYSKME 原创作品的统一手机与平板入口。">
<meta property="og:image" content="https://myskme.com/og-cover.png">
<meta property="og:image:alt" content="MYSKME · 狼先生与他的学生们作品总目">
<meta property="og:url" content="https://myskme.com/">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="MYSKME · 作品总目 — 狼先生与他的学生们">
<meta name="twitter:image" content="https://myskme.com/og-cover.png">
<style>%%CSS%%</style>
</head>
<body>
<div class="admin-bar" id="adminBar">
  <span class="ab-title">管理员模式 · <b>直接点文字即可编辑，改动自动保存在本机</b></span>
  <button id="abConsole">控制台</button>
  <button id="abMaker">出题工坊</button>
  <button id="abForge">命题铸炉</button>
  <button id="abExport">导出 index.html</button>
  <button id="abReset" class="danger">重置默认</button>
  <button id="abExit">退出</button>
</div>

<div class="launchpad-shell">
%%HEADER%%
  <main class="launchpad-workspace">
    <nav class="category-rail" id="volnav" aria-label="作品分类">
      <div id="volnav-inner"></div>
    </nav>
    <section class="library-panel" aria-label="作品列表">
      <div class="library-head">
        <div class="library-heading">
          <span class="library-eyebrow" id="viewEyebrow">MYSKME NOW</span>
          <h1 id="viewTitle">精选</h1>
          <p id="viewDesc">主推与最近打开的作品</p>
        </div>
        <div class="view-count" id="viewCount"><b>0</b>项</div>
        <label class="search-box" for="hubSearch" title="搜索全部作品">
          <span id="searchIcon"></span><input id="hubSearch" type="search" autocomplete="off" placeholder="搜索全部作品" aria-label="搜索全部作品">
        </label>
      </div>
      <div class="app-grid" id="content"></div>
      <div class="library-foot">
        <div class="pager"><button class="page-button" id="pagePrev" aria-label="上一页"></button><span class="page-label" id="pageLabel">1 / 1</span><button class="page-button" id="pageNext" aria-label="下一页"></button></div>
        <span class="shortcut-hint"><kbd>/</kbd> 搜索 · 方向键选取</span>
        <button class="admin-add" id="adminAdd">添加作品</button>
      </div>
    </section>
    <aside class="project-stage" id="projectStage" aria-label="当前作品详情" aria-live="polite"></aside>
  </main>
  <nav class="mobile-tabs" id="mobileNav" aria-label="作品分类"></nav>
</div>
<div class="print-catalog" id="printCatalog"></div>

<div class="toast" id="toast"></div>

<div class="pw-mask" id="pwMask">
  <div class="pw-box" id="pwBox">
    <h4>管理员模式</h4>
    <p>输入密码以编辑作品内容。改动仅保存在本机浏览器，导出后重新部署即可更新线上页面。</p>
    <input id="pwInput" type="password" autocomplete="off" placeholder="请输入密码" aria-label="管理员密码">
    <div class="pw-row">
      <button id="pwCancel">取消</button>
      <button id="pwOk" class="primary">进入</button>
    </div>
  </div>
</div>

<script>%%LIB%%</script>
<script>
/*DATA_START*/
var DEFAULT_DATA = %%DATA%%;
/*DATA_END*/
%%APP%%
</script>
</body>
</html>
"""

page = (PAGE
        .replace("%%CSS%%", CSS)
        .replace("%%HEADER%%", static_header(DEFAULT_DATA))
        .replace("%%LIB%%", LIB)
        .replace("%%DATA%%", data_json)
        .replace("%%APP%%", app))

with open(OUT, "w", encoding="utf-8") as f:
    f.write(page)
print("WROTE", OUT, len(page), "bytes; 管理口令走 sha256 哈希门（明文不入源码/日志）")
