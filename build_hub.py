# -*- coding: utf-8 -*-
"""生成 MYSKME 作品总目（单文件 / 离线 / 黑金编年史风）。
内置 qrcode-generator(JS) 实现浏览器端二维码，密码管理员模式可改内容。
QR 默认值与 segno 校验过的矩阵一致（见 structural_verify.py / qr_ref.json）。"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))  # 脚本所在目录（仓库根），任何机器可跑
OUT = os.path.join(HERE, "index.html")
LIB = open(os.path.join(HERE, "qrcode-generator.js"), encoding="utf-8").read()

# ---------- 默认内容（管理员模式编辑后存 localStorage / 导出可覆盖此处） ----------
DEFAULT_DATA = {
    "kicker": "THE MYSKME CHRONICLES · 王老师 MR. WANG",
    "titlePre": "MYSKME",
    "titleEm": "编年史",
    "motto": "Make Yourself Special & Kind — 狼先生与他的学生们的远征编年",
    "hint": "往下翻阅两卷 —— 每一件都可扫码即玩、离线可用、投屏可讲。",
    "hubUrl": "https://myskme.github.io/myskme-hub/",
    "sections": [
        {"label": "卷一 · 远征录", "anchor": "vol-1", "vol": "壹", "era": "第一纪 · 白昼推开冒险之门",
         "epigraph": "剑与星辰，茶与远方 —— 走进狼先生学院的世界。", "icon": "sword", "items": [
            {"key": "expedition", "glyph": "征", "cat": "game", "rarity": "UR", "cover": "assets/cover-expedition.webp",
             "tag": "动作肉鸽 · RPG", "title": "远征录 · 笼中剑", "en": "EXPEDITION · CAGED BLADE",
             "desc": "学院谷地动作肉鸽 · 技能连招 · 探索成长 · 金叶与水晶经济 —— 狼先生宇宙的旗舰远征。",
             "url": "https://myskme-expedition.netlify.app", "featured": True},
            {"key": "starling", "glyph": "灵", "cat": "game", "rarity": "SSR", "cover": "assets/cover-starling.webp",
             "tag": "电子宠物 · 养成", "title": "星灵远征", "en": "STARLING",
             "desc": "余光之种孵出的小兽 · 蛋到觉醒五形态 · 你不在时它替你远征，寄回一封封寓言信。",
             "url": "https://myskme.github.io/myskme-starling/"},
            {"key": "zimingqi", "glyph": "棋", "cat": "game", "rarity": "SR", "cover": "assets/cover-zimingqi.webp",
             "tag": "肉鸽自走棋", "title": "自鸣棋", "en": "SELF-CHIME CHESS",
             "desc": "课堂肉鸽自走棋 · 多人对战 + 单人十关试炼（叶王终战 / 每日同题） · 单文件离线，扫码 / 投屏即用。",
             "url": "https://myskme.github.io/myskme-zimingqi/"},
            {"key": "brawl", "glyph": "斗", "cat": "game", "rarity": "SR", "cover": "assets/cover-brawl.webp",
             "tag": "积分对战 · 塔防", "title": "MYSKME 大乱斗", "en": "MYSKME BRAWL",
             "desc": "课堂积分对战 + 黑域塔防 · 六系角色养成 · 可分享炫耀战报卡。",
             "url": "https://myskme.github.io/myskme-brawl/"},
            {"key": "volvme", "glyph": "史", "cat": "lore", "rarity": "SSR", "cover": "assets/cover-volvme.webp",
             "tag": "世界观 · 叙事", "title": "世界编年史 II", "en": "VOLVME II",
             "desc": "狼先生与他的学生们 · 正典叙事与设定档案第二卷 —— 一切远征的源头。",
             "url": "https://myskme-volvme-ii.netlify.app"},
        ]},
        {"label": "卷二 · 学堂器物志", "anchor": "vol-2", "vol": "贰", "era": "第二纪 · 夜里以茶与尺执教",
         "epigraph": "把中考四板块，做成可玩、可讲、可投屏的器物。", "icon": "book", "items": [
            {"key": "quiz", "glyph": "题", "cat": "tool", "rarity": "UR", "cover": "assets/cover-quiz.webp",
             "tag": "题库训练 · 内含 2 套", "title": "题库训练场", "en": "QUIZ TRAINER",
             "desc": "题库训练总入口 · 内含「词灵对决」单词训练 与「无名之原」答题闯关。做过的卷就是粮。",
             "url": "https://myskme-games.netlify.app/", "featured": True},
            {"key": "banks", "glyph": "库", "cat": "tool", "rarity": "SR", "cover": "assets/cover-banks.webp",
             "tag": "题库 · 词灵对决", "title": "题库书架", "en": "QUESTION BANKS",
             "desc": "中考题库总目 · 兑换码即卷号 · 点开即玩「词灵对决」，含时态 / 完形 / 阅读 / 语法陷阱专项。",
             "url": "https://myskme.github.io/myskme-hub/banks/"},
            {"key": "listen", "glyph": "听", "cat": "tool", "rarity": "R", "cover": "assets/cover-listen.webp",
             "tag": "中考 · 听力", "title": "听力训练场", "en": "LISTENING",
             "desc": "中考听力精练 · 多语音朗读 · 逐句跟读 · 浏览器直接播放，免下载。",
             "url": "https://myskme.github.io/myskme-hub/listen/"},
            {"key": "write", "glyph": "写", "cat": "tool", "rarity": "R", "cover": "assets/cover-write.webp",
             "tag": "中考 · 写作", "title": "作文训练场", "en": "WRITING",
             "desc": "中考写作分步训练 · 范文 · 句式脚手架 · 自评清单。",
             "url": "https://myskme.github.io/myskme-hub/write/"},
            {"key": "daily", "glyph": "日", "cat": "tool", "rarity": "R", "cover": "assets/cover-daily.webp",
             "tag": "每日打卡", "title": "每日一题", "en": "DAILY QUIZ",
             "desc": "全网同题 · 每天一换 · 答题即揭示解析 · 连胜打卡。",
             "url": "https://myskme.github.io/myskme-hub/daily/"},
            {"key": "wall", "glyph": "范", "cat": "tool", "rarity": "SR", "cover": "assets/cover-wall.webp",
             "tag": "荣誉 · 优秀作文", "title": "荣誉殿堂 · 优秀作文墙", "en": "WALL OF FAME",
             "desc": "优秀英语作文展示墙 · 手写真迹 · 王老师点评。班级口令进入。",
             "url": "https://myskme.github.io/myskme-hub/wall/"},
            {"key": "scoreboard", "glyph": "榜", "cat": "tool", "rarity": "SR", "cover": "assets/cover-scoreboard.webp",
             "tag": "课堂 · 积分榜", "title": "记分编年史", "en": "SCOREBOARD",
             "desc": "英语课堂积分 · 排行榜 · 团队赛 · 赛季管理，单文件离线 PWA。",
             "url": "https://myskme.github.io/myskme-scoreboard/"},
            {"key": "threek", "glyph": "国", "cat": "tool", "rarity": "R", "cover": "assets/cover-threek.webp",
             "tag": "课堂游戏", "title": "三国军师争霸", "en": "THREE KINGDOMS",
             "desc": "三国主题课堂积分器 · 军师争霸 / 合作模式 · 锦囊谋略 · 投屏即用。",
             "url": "https://myskme.github.io/three-kingdoms-classroom-scoreboard/"},
            {"key": "print", "glyph": "印", "cat": "tool", "rarity": "N", "cover": "assets/cover-print.webp",
             "tag": "打印 / PDF", "title": "打印中心", "en": "PRINT CENTER",
             "desc": "从题库一键生成 选择卷 / 答案版 / 词表 / 默写版，A4 存 PDF。答案版需口令。",
             "url": "https://myskme.github.io/myskme-hub/print/"},
        ]},
    ],
}

# 预览截图：shots.json 由 capture_shots.sh 生成（key -> data URI）；缺失则回退到字形徽章
SHOTS = {}
_sp = os.path.join(HERE, "shots.json")
# 2026-07-04：改用策展式 cover（黑金封面），不再自动注入 shots.json 截图。
# 旧的自动截图（作文墙/记分/三国等）与新封面/字形徽风格不统一，故停用，改由 cover 字段统一。
SHOTS = {}  # 停用截图自动注入

PASSWORD = "mrwolf4358"

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
}
/* ---- 浅色（羊皮纸）主题：data-theme 由脚本按 跟随系统/浅/深 解析后写入 ---- */
:root[data-theme="light"]{
  --bg:#ece2cc; --bg2:#e4d8bc; --bg3:#f8f2e4; --bg4:#e0d3b3;
  --ink:#2a2218; --ink2:#574b37; --ink3:#635943; --ink4:#b6a988;
  --gold:#7e6014; --gold2:#5f470e; --gold3:#b89a52;
  --red:#9a271d; --red2:#7a1c14;
  --line:rgba(120,90,20,.30); --line2:rgba(120,90,20,.13);
  --glow-gold:0 4px 16px rgba(120,90,20,.18);
  --glow-red:0 4px 16px rgba(150,40,30,.2);
  --page-grad:radial-gradient(1200px 700px at 50% -8%,rgba(190,160,80,.18),transparent 60%),radial-gradient(900px 760px at 100% 100%,rgba(150,120,60,.12),transparent 60%);
  --noise-op:.16; --noise-blend:multiply;
  --vignette:radial-gradient(ellipse at 50% 40%,transparent 60%,rgba(120,90,30,.12));
  --feat-bg:linear-gradient(160deg,#fbf4e2,#f2e8d2);
  --card-bg:linear-gradient(160deg,var(--bg3),#f1e9d6);
  --card-hover-shadow:0 14px 36px rgba(120,90,30,.20),inset 0 0 40px rgba(201,166,74,.06);
  --plate-shadow:0 4px 14px rgba(120,90,30,.25);
  --bar-bg:linear-gradient(180deg,#f2e8d2,rgba(242,232,210,.97));
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
  background:linear-gradient(180deg,rgba(9,8,11,.95),rgba(9,8,11,.8));
  -webkit-backdrop-filter:blur(12px) saturate(1.2);backdrop-filter:blur(12px) saturate(1.2);
  border-bottom:1px solid var(--line);}
.volnav-inner{max-width:1220px;margin:0 auto;width:100%;
  display:flex;align-items:center;gap:4px;padding:9px clamp(16px,5vw,48px);overflow-x:auto;scrollbar-width:none;}
.volnav-inner::-webkit-scrollbar{display:none;}
.volnav-brand{font-family:var(--serif);font-size:14px;letter-spacing:.24em;color:var(--gold2);
  white-space:nowrap;margin-right:14px;padding-right:14px;border-right:1px solid var(--line2);flex:0 0 auto;}
.volnav-brand b{font-weight:400;}
.vlink{font-family:var(--serif);font-size:13.5px;letter-spacing:.14em;color:var(--ink3);text-decoration:none;
  white-space:nowrap;padding:6px 13px;border-radius:2px;position:relative;transition:color .3s;flex:0 0 auto;}
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
.title-hero{font-size:clamp(44px,8.5vw,104px);font-weight:700;letter-spacing:.02em;line-height:1.02;margin:.2em 0 .16em;
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
.card.featured .thumb{aspect-ratio:16/7;}
.card.featured .card-body h3{font-size:21px;}
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
.ribbon{position:absolute;top:14px;right:-30px;transform:rotate(45deg);background:var(--gold);
  color:var(--bg);font-size:11px;font-weight:700;letter-spacing:.22em;padding:3px 34px;z-index:4;box-shadow:0 2px 10px rgba(0,0,0,.4);}

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
  .grid{grid-template-columns:1fr;}
  .card-foot{flex-direction:column;align-items:stretch;}
  .qr-plate{align-self:center;}
  .card-actions{align-items:center;text-align:center;}
  .url{text-align:center;}
  .ribbon{font-size:10px;padding:3px 30px;}
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
  .tag,.en,.card-desc,.qr-hint,.kicker,.meta-row,.usehint,.ribbon,.foot-share,
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

APP_JS = r"""
var LS='myskme-hub-data', SS='myskme-admin', PW='%%PW%%';
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
    (data.sections||[]).forEach(function(sec){(sec.items||[]).forEach(function(it){
      var d=it.key&&DEFAULT_ITEM_BY_KEY[it.key]; if(!d)return;
      if(!it.cover&&d.cover)it.cover=d.cover;
      if(!it.icon&&d.icon)it.icon=d.icon;
    });});
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
    expedition:'<path d="M14.5 3.5l6 6L11 19l-4 1 1-4z"/><path d="M13 5l6 6M9 15l-4-4M5 19l-2 2"/>',
    starling:'<path d="M12 3c-3.8 3.7-6 8-6 12a6 6 0 0012 0c0-4-2.2-8.3-6-12z"/><path d="M12 8l1.2 2.4 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4z"/>',
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
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon:'<path d="M20 15.5A8.5 8.5 0 118.5 4 7 7 0 0020 15.5z"/>',
    auto:'<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 010 16z"/>',
    edit:'<path d="M4 20l4.5-1 10-10a2.1 2.1 0 00-3-3l-10 10z"/><path d="M14.5 7.5l3 3M4 20h6"/>',
    links:'<path d="M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1"/><path d="M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1"/>',
    poster:'<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M7 16l3-3 2 2 3-4 2 3M8 7h5"/>'};
  var CAT_NAME={game:'游戏',lore:'世界观',tool:'学习工具'};
  function iconSVG(path,extra){return '<svg class="icon'+(extra?' '+extra:'')+'" viewBox="0 0 24 24" aria-hidden="true">'+path+'</svg>';}
  function uiIcon(name){return iconSVG(UI_PATH[name]||UI_PATH.external);}
  function catIcon(cat){var d=CAT_PATH[cat]||CAT_PATH.tool;
    return '<span class="cat-icon" title="'+(CAT_NAME[cat]||'作品')+'" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg><small>'+esc(CAT_NAME[cat]||'作品')+'</small></span>';}
  function workMark(it){var d=ITEM_PATH[it.icon||it.key]||CAT_PATH[it.cat]||CAT_PATH.tool;
    return '<span class="work-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg></span>';}
  function cardHTML(it,si,ii){
    var cover=it.cover||'';
    var fb='<div class="thumb-fallback"'+(cover?' style="display:none"':'')+'><span data-bind="glyph">'+esc(it.glyph)+'</span></div>';
    var img=cover?'<img class="cover-img" loading="lazy" decoding="async" width="1280" height="800" alt="" src="'+esc(cover)+'" onerror="this.style.display=\'none\';var f=this.parentNode.querySelector(&quot;.thumb-fallback&quot;);if(f)f.style.display=\'flex\'">':'';
    var rar=esc(it.rarity||'N');
    var badges=catIcon(it.cat)+'<span class="rarity-badge" aria-hidden="true">'+rar+'</span>';
    var thumb='<a class="thumb" href="'+esc(it.url)+'" target="_blank" rel="noopener" aria-label="打开 '+esc(it.title)+'">'+badges+img+fb+'</a>';
    return '<article class="card ornate rar-'+rar+(it.featured?' featured':'')+(it.key==='print'?' finale':'')+'" style="--i:'+ii+'" data-sec="'+si+'" data-idx="'+ii+'">'
      +thumb
      +'<div class="card-body"><div class="card-heading">'+workMark(it)+'<div class="card-titles"><span class="tag" data-bind="tag">'+esc(it.tag)+'</span>'
        +'<h3><a class="title-link" href="'+esc(it.url)+'" target="_blank" rel="noopener" data-bind="title">'+esc(it.title)+'</a></h3>'
        +'<span class="en" data-bind="en">'+esc(it.en)+'</span></div></div>'
        +'<p class="card-desc" data-bind="desc">'+esc(it.desc)+'</p></div>'
      +'<div class="card-foot">'
        +'<div class="btn-row"><a class="btn btn-go" href="'+esc(it.url)+'" target="_blank" rel="noopener">'+uiIcon('external')+'<span>访问</span></a>'
        +'<button class="btn btn-qr">'+uiIcon('scan')+'<span>扫码</span></button>'
        +'<button class="btn btn-copy" data-url="'+esc(it.url)+'">'+uiIcon('copy')+'<span>复制</span></button></div>'
        +'<span class="url" data-bind="url">'+esc(it.url)+'</span>'
        +'<div class="qr-plate" title="手机扫码打开"><div class="qr-box">'+qrSVG(it.url)+'</div><span class="qr-hint">'+uiIcon('scan')+'扫码即玩 · 投屏给学生扫</span></div></div>'
      +'<div class="card-admin">'
        +'<button data-op="up" title="上移">↑ 上移</button><button data-op="down" title="下移">↓ 下移</button>'
        +'<button data-op="move" title="移到另一区">⇄ 换区</button>'
        +'<button data-op="feat" title="HUB 角标开关">★ 角标</button>'
        +'<button data-op="del" class="danger" title="删除此作品">删除</button>'
      +'</div></article>';
  }

  function chapHead(sec,si,collapsible,collapsed){
    var ico=sec.icon?('<span class="chap-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'+(CAT_PATH[sec.icon==='sword'?'game':sec.icon==='book'?'tool':sec.icon]||CAT_PATH.lore)+'</svg></span>'):'';
    var era=sec.era?'<div class="chap-era">'+esc(sec.era)+'</div>':'';
    var epi=sec.epigraph?'<div class="chap-epi">'+esc(sec.epigraph)+'</div>':'';
    var caret=collapsible?'<span class="rule-caret"></span>':'';
    return '<div class="rule'+(collapsible?' rule-toggle'+(collapsed?' collapsed':''):'')+'"'+(collapsible?' data-sec-toggle="'+si+'"':'')+'>'
      +(sec.vol?'<div class="chap-vol">'+esc(sec.vol)+'</div>':'')
      +'<div class="chap-text"><div class="chap-title">'+ico+'<span data-seclabel="'+si+'">'+esc(sec.label)+'</span></div>'+era+epi+'</div>'
      +caret+'</div>';
  }
  function buildNav(){
    var nav=document.getElementById('volnav-inner'); if(!nav)return;
    var h='<span class="volnav-brand">✦ <b>MYSKME 编年史</b></span>';
    DATA.sections.forEach(function(sec,si){
      var anc=sec.anchor||('vol-'+(si+1));
      h+='<a class="vlink" href="#'+anc+'" data-nav="'+anc+'">'+(sec.vol?'<span class="vl-num">'+esc(sec.vol)+'</span>':'')+esc((sec.label||'').replace(/^卷[一二三四五六七八九十]+\s*·\s*/,''))+'</a>';
    });
    h+='<span class="volnav-spacer"></span>';
    nav.innerHTML=h;
  }
  var _secObs=null;
  function observeSections(){
    if(_secObs)_secObs.disconnect();
    var links={};document.querySelectorAll('.vlink').forEach(function(a){links[a.getAttribute('data-nav')]=a;});
    _secObs=new IntersectionObserver(function(es){
      es.forEach(function(e){if(e.isIntersecting){
        var id=e.target.getAttribute('id');
        Object.keys(links).forEach(function(k){links[k].classList.toggle('on',k===id);});
      }});
    },{rootMargin:'-45% 0px -50% 0px'});
    document.querySelectorAll('section[id]').forEach(function(s){_secObs.observe(s);});
  }
  function render(){
    var html='';
    DATA.sections.forEach(function(sec,si){
      var collapsible=!!sec.collapsible, collapsed=false;
      if(collapsible){collapsed=true;try{var s=localStorage.getItem('myskme-sec'+si);if(s!==null)collapsed=(s==='1');}catch(e){}}
      var anc=sec.anchor||('vol-'+(si+1));
      html+='<section id="'+anc+'" data-section="'+si+'"'+(collapsed?' data-collapsed="1"':'')+'>'+chapHead(sec,si,collapsible,collapsed)+'<div class="grid">';
      sec.items.forEach(function(it,ii){html+=cardHTML(it,si,ii);});
      html+='<button class="add-work" data-addsec="'+si+'">＋ 添加作品</button></div></section>';
    });
    content.innerHTML=html;
    buildNav();
    updateCounts();
    applyAdmin();
    reveal();
    observeSections();
  }
  function toggleSection(si){
    var sec=content.querySelector('section[data-section="'+si+'"]'); if(!sec)return;
    var ruleEl=sec.querySelector('[data-sec-toggle]'), collapsed=sec.getAttribute('data-collapsed')==='1';
    collapsed=!collapsed;
    if(collapsed){sec.setAttribute('data-collapsed','1');ruleEl&&ruleEl.classList.add('collapsed');}
    else{sec.removeAttribute('data-collapsed');ruleEl&&ruleEl.classList.remove('collapsed');
      sec.querySelectorAll('.card').forEach(function(c){c.classList.add('in');});}
    try{localStorage.setItem('myskme-sec'+si,collapsed?'1':'0');}catch(e){}
  }

  function renderHeader(){
    document.querySelectorAll('[data-h]').forEach(function(el){
      var k=el.getAttribute('data-h'); if(DATA[k]!=null) el.textContent=DATA[k];
    });
  }

  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.12});
  function reveal(){
    var cards=content.querySelectorAll('.card');
    if(isAdmin()){cards.forEach(function(c){c.classList.add('in');});return;}
    cards.forEach(function(c){io.observe(c);});
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
    DATA.sections[si].items.push({glyph:'新',tag:'分类',title:'新作品',en:'NEW WORK',desc:'在这里写一句作品介绍……',url:'https://'});
    save();render();
    var secs=content.querySelectorAll('section');
    if(secs[si]){var cards=secs[si].querySelectorAll('.card');var last=cards[cards.length-1];if(last){last.scrollIntoView({behavior:REDUCE?'auto':'smooth',block:'center'});var t=last.querySelector('[data-bind="title"]');if(t)setTimeout(function(){t.focus();},300);}}
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
    if(pwInput.value===PW){closePw();setAdmin(true);toast('已进入管理员模式');}
    else{pwBox.classList.remove('err');void pwBox.offsetWidth;pwBox.classList.add('err');pwInput.select();}
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
    ctx.fillStyle='#6a5f47';ctx.font='400 23px "Songti SC",serif';ctx.fillText('远征与学堂 · 中考四板块 · 一站直达',tx,hy+132);
    ctx.textAlign='center';ctx.fillStyle='#8a6d1e';ctx.font='600 22px serif';ctx.fillText('MYSKME — Make Yourself Special & Kind',W/2,H-46);
    cv.toBlob(function(blob){if(!blob){toast('海报导出失败');return;}
      var u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='MYSKME-作品总目-海报.png';
      document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u);},3000);
      toast('已导出浅色竖版海报 1080×1920');},'image/png');
  }

  // ---- 事件绑定 ----
  content.addEventListener('input',onEdit);
  header.addEventListener('input',onEdit);
  content.addEventListener('keydown',onKey,true);
  header.addEventListener('keydown',onKey,true);
  content.addEventListener('paste',onPaste);
  header.addEventListener('paste',onPaste);

  document.addEventListener('click',function(e){
    var st=e.target.closest('[data-sec-toggle]');
    if(st && !(isAdmin()&&e.target.closest('[data-seclabel]'))){toggleSection(+st.getAttribute('data-sec-toggle'));return;}
    var op=e.target.closest('[data-op]'); if(op){doOp(op);return;}
    var add=e.target.closest('[data-addsec]'); if(add){addWork(+add.getAttribute('data-addsec'));return;}
    var cp=e.target.closest('.btn-copy'); if(cp){copyLink(cp);return;}
    var qb=e.target.closest('.btn-qr'); if(qb){var qc=qb.closest('.card');var qp=qc&&qc.querySelector('.qr-plate');if(qp)qp.classList.toggle('show');return;}
    if(isAdmin()){var a=e.target.closest('a');if(a)e.preventDefault();}  // 编辑时不跳转
  });

  document.getElementById('adminFab').addEventListener('click',openPw);
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

  // ---- 主题：跟随系统 / 浅色 / 深色 ----
  var TLS='myskme-theme', tOrder=['auto','light','dark'],
      tName={auto:'跟随系统',light:'浅色',dark:'深色'}, tIcon={auto:'auto',light:'sun',dark:'moon'};
  var mq=window.matchMedia?matchMedia('(prefers-color-scheme: dark)'):null;
  function getPref(){try{return localStorage.getItem(TLS)||'auto';}catch(e){return 'auto';}}
  function resolveTheme(p){return p==='auto'?((mq&&mq.matches)?'dark':'light'):p;}
  function applyTheme(p){var e=document.documentElement;
    e.setAttribute('data-theme',resolveTheme(p));e.setAttribute('data-themepref',p);
    var b=document.getElementById('themeBtn');if(b){b.innerHTML=uiIcon(tIcon[p])+'<span class="sr-only">切换主题</span>';b.title='主题：'+tName[p]+'（点按切换）';}}
  function cycleTheme(){var nxt=tOrder[(tOrder.indexOf(getPref())+1)%tOrder.length];
    try{localStorage.setItem(TLS,nxt);}catch(e){}applyTheme(nxt);toast('主题：'+tName[nxt]);}
  if(mq){var mqh=function(){if(getPref()==='auto')applyTheme('auto');};
    if(mq.addEventListener)mq.addEventListener('change',mqh);else if(mq.addListener)mq.addListener(mqh);}

  // ---- 打印 / 分享 ----
  function doShare(){var u=location.href,t=document.title;
    if(navigator.share){navigator.share({title:t,text:'MYSKME · 作品总目',url:u}).catch(function(){});}
    else{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(u).then(null,function(){fallback(u);});}else fallback(u);toast('已复制本页链接');}}

  document.getElementById('themeBtn').addEventListener('click',cycleTheme);
  document.getElementById('printBtn').addEventListener('click',function(){window.print();});
  document.getElementById('shareBtn').addEventListener('click',doShare);
  var cab=document.getElementById('copyAllBtn'); if(cab)cab.addEventListener('click',copyAll);
  var pb=document.getElementById('posterBtn'); if(pb)pb.addEventListener('click',buildPoster);

  // ---- 启动 ----
  var adminFab=document.getElementById('adminFab');if(adminFab)adminFab.innerHTML=uiIcon('edit')+'<span class="sr-only">管理员</span>';
  var printCtl=document.getElementById('printBtn');if(printCtl)printCtl.innerHTML=uiIcon('print')+'<span class="sr-only">打印</span>';
  var shareCtl=document.getElementById('shareBtn');if(shareCtl)shareCtl.innerHTML=uiIcon('share')+'<span class="sr-only">分享</span>';
  if(cab)cab.innerHTML=uiIcon('links')+'<span>复制全部链接</span>';
  if(pb)pb.innerHTML=uiIcon('poster')+'<span>导出竖版海报</span>';
  applyTheme(getPref());
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
        '  <header class="hero">\n'
        '    <div class="hero-art">\n'
        '      <div class="hero-figure">\n'
        '        <div class="hero-halo"></div>\n'
        '        <img src="assets/hero-wolf.webp" alt="狼先生" '
        'onerror="this.style.display=&quot;none&quot;;this.closest(&quot;.hero-figure&quot;).classList.add(&quot;nofig&quot;)">\n'
        '        <div class="hero-crestbig" hidden><span>狼</span></div>\n'
        '      </div>\n'
        '    </div>\n'
        '    <div class="hero-body">\n'
        f'      <div class="kicker"><span class="crest">狼</span><span data-h="kicker">{d["kicker"]}</span></div>\n'
        f'      <h1 class="title-hero"><span data-h="titlePre">{d["titlePre"]}</span> <em data-h="titleEm">{d["titleEm"]}</em></h1>\n'
        f'      <p class="motto" data-h="motto">{d["motto"]}</p>\n'
        f'      <p class="epilogue" data-h="hint">{d["hint"]}</p>\n'
        '      <div class="meta-row">\n'
        '        <div class="stat"><b id="stat-total">0</b><span>部作品</span></div>\n'
        '        <div class="stat"><b id="stat-a">0</b><span>卷一 · 远征</span></div>\n'
        '        <div class="stat"><b id="stat-b">0</b><span>卷二 · 学堂</span></div>\n'
        '      </div>\n'
        '    </div>\n'
        '  </header>\n'
        f'  <div class="starmap">{STARMAP_SVG}</div>'
    )

data_json = json.dumps(DEFAULT_DATA, ensure_ascii=False, indent=2)
app = APP_JS.replace("%%PW%%", PASSWORD)

PAGE = """<!doctype html>
<html lang="zh-CN" data-theme="dark" data-themepref="auto">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<script>
/* 预解析主题，避免首屏闪烁：auto 跟随系统，否则用上次选择 */
(function(){try{var p=localStorage.getItem('myskme-theme')||'auto';
var d=p==='auto'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;
var e=document.documentElement;e.setAttribute('data-theme',d);e.setAttribute('data-themepref',p);}catch(err){}})();
</script>
<title>狼先生与他的学生们 · 作品总目 | MYSKME</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20width%3D%2232%22%20height%3D%2232%22%20rx%3D%227%22%20fill%3D%22%2317140f%22/%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2216%22%20r%3D%228%22%20fill%3D%22none%22%20stroke%3D%22%23c9a24d%22%20stroke-width%3D%222%22/%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2216%22%20r%3D%222.6%22%20fill%3D%22%23c9a24d%22/%3E%3C/svg%3E">
<meta name="description" content="MYSKME · 王老师 作品总目，扫码即玩：记分编年史、三国军师争霸、大乱斗、远征录、星灵远征、世界编年史、题库训练场。">
<meta property="og:type" content="website">
<meta property="og:title" content="MYSKME · 作品总目 — 狼先生与他的学生们">
<meta property="og:description" content="王老师的课堂英语作品 · 中考四板块（题库·词灵对决 / 听力 / 写作 / 每日一题）· 优秀作文墙 —— 扫码即玩。">
<meta property="og:image" content="https://myskme.github.io/myskme-hub/og-cover.png">
<meta property="og:url" content="https://myskme.github.io/myskme-hub/">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="MYSKME · 作品总目 — 狼先生与他的学生们">
<meta name="twitter:image" content="https://myskme.github.io/myskme-hub/og-cover.png">
<style>%%CSS%%</style>
</head>
<body>
<div class="admin-bar" id="adminBar">
  <span class="ab-title">管理员模式 · <b>直接点文字即可编辑，改动自动保存在本机</b></span>
  <button id="abConsole">控制台 ↗</button>
  <button id="abMaker">出题工坊 ↗</button>
  <button id="abForge">命题铸炉 ↗</button>
  <button id="abExport">导出 index.html</button>
  <button id="abReset" class="danger">重置默认</button>
  <button id="abExit">退出</button>
</div>

<nav class="volnav" id="volnav"><div class="volnav-inner" id="volnav-inner"></div></nav>

<div class="wrap">
%%HEADER%%
  <div id="content"></div>
  <footer>
    <div class="foot-share">
      <div class="qr-plate share-plate" id="shareQr"></div>
      <div class="foot-share-text">
        <div class="fs-title">扫码打开 · 分享本页</div>
        <div class="fs-url" id="shareUrl"></div>
        <div class="fs-actions">
          <button class="btn" id="copyAllBtn">复制全部链接</button>
          <button class="btn" id="posterBtn">导出竖版海报</button>
        </div>
      </div>
    </div>
    <div class="foot-links">
      <a href="https://myskme.github.io/myskme-hub/banks/" target="_blank" rel="noopener">题库书架</a>
      <span>·</span>
      <a href="https://myskme.github.io/myskme-hub/wall/" target="_blank" rel="noopener">优秀作文墙</a>
      <span>·</span>
      <a href="https://myskme.github.io/myskme-hub/write/" target="_blank" rel="noopener">作文训练场</a>
      <span>·</span>
      <a href="https://myskme.github.io/myskme-hub/daily/" target="_blank" rel="noopener">每日一题</a>
      <span>·</span>
      <a href="https://myskme.github.io/myskme-hub/listen/" target="_blank" rel="noopener">听力训练场</a>
      <span>·</span>
      <a href="https://myskme.github.io/myskme-hub/print/" target="_blank" rel="noopener">打印中心</a>
    </div>
    <div><b>MYSKME</b> — Make Yourself Special &amp; Kind</div>
    <div>单文件离线作品总目 · 二维码浏览器端生成 · 可投屏 / 打印 / 截图分发</div>
  </footer>
</div>

<button class="admin-fab" id="adminFab" title="管理员">✎</button>

<div class="ctrl" id="ctrl">
  <button class="ctrl-btn" id="themeBtn" title="切换主题" aria-label="切换深浅主题">◐</button>
  <button class="ctrl-btn" id="printBtn" title="打印 / 另存 PDF（自动浅色）" aria-label="打印">⎙</button>
  <button class="ctrl-btn" id="shareBtn" title="分享本页链接" aria-label="分享">↗</button>
</div>

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
print("WROTE", OUT, len(page), "bytes; password:", PASSWORD)
