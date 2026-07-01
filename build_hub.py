# -*- coding: utf-8 -*-
"""生成 MYSKME 作品总目（单文件 / 离线 / 黑金编年史风）。
内置 qrcode-generator(JS) 实现浏览器端二维码，密码管理员模式可改内容。
QR 默认值与 segno 校验过的矩阵一致（见 structural_verify.py / qr_ref.json）。"""
import json, os

HERE = "/Users/wangzhongcheng/2claudecode"
OUT = os.path.join(HERE, "index.html")
LIB = open(os.path.join(HERE, "qrcode-generator.js"), encoding="utf-8").read()

# ---------- 默认内容（管理员模式编辑后存 localStorage / 导出可覆盖此处） ----------
DEFAULT_DATA = {
    "kicker": "MYSKME · 王老师 Mr. Wang",
    "titlePre": "狼先生与",
    "titleEm": "他的学生们",
    "motto": "Make Yourself Special & Kind · 作品总目",
    "hint": "投屏后 手机扫码即玩，或点击卡片 /「访问」直接打开 — 全部为单文件网页应用，离线可用。",
    "hubUrl": "https://myskme.github.io/myskme-hub/",
    "sections": [
        {"label": "推荐 · 随时开玩", "items": [
            {"key": "quiz", "glyph": "题", "tag": "题库训练 · 内含 2 套", "title": "MYSKME 题库训练场", "en": "Quiz Trainer",
             "desc": "题库训练入口，内含「词灵对决」单词训练 与「无名之原」答题闯关。",
             "url": "https://myskme-games.netlify.app/", "featured": True},
            {"key": "volvme", "glyph": "史", "tag": "叙事 · 世界观", "title": "世界编年史 II", "en": "VOLVME II",
             "desc": "狼先生与他的学生们 · 世界编年史第二卷，剧情与设定档案。",
             "url": "https://myskme-volvme-ii.netlify.app"},
            {"key": "scoreboard", "glyph": "榜", "tag": "积分榜", "title": "MYSKME 积分板", "en": "Classroom Scoreboard",
             "desc": "英语课堂积分 · 排行榜 · 团队赛 · 赛季管理，单文件离线 PWA。",
             "url": "https://myskme.github.io/myskme-scoreboard/"},
            {"key": "expedition", "glyph": "征", "tag": "RPG 冒险", "title": "远征录 · 笼中剑", "en": "Expedition",
             "desc": "学院谷地 RPG · 技能连招 · 探索成长 · 金叶与水晶经济系统。",
             "url": "https://myskme-expedition.netlify.app"},
            {"key": "wall", "glyph": "范", "tag": "荣誉 · 优秀作文", "title": "学院谷地 · 荣誉殿堂", "en": "Wall of Fame",
             "desc": "优秀英语作文展示墙 · 手写真迹 · 王老师点评。班级口令进入。",
             "url": "https://myskme.github.io/myskme-hub/wall/"},
        ]},
        {"label": "课堂专用 · 老师投屏", "collapsible": True, "items": [
            {"key": "threek", "glyph": "国", "tag": "课堂游戏", "title": "三国军师争霸", "en": "Three Kingdoms Scoreboard",
             "desc": "三国主题课堂积分器 · 军师争霸 / 合作模式 · 锦囊谋略 · 投屏即用。",
             "url": "https://myskme.github.io/three-kingdoms-classroom-scoreboard/"},
            {"key": "brawl", "glyph": "斗", "tag": "课堂游戏", "title": "MYSKME 大乱斗", "en": "MYSKME Brawl",
             "desc": "课堂积分 + 黑域塔防 · 六系角色养成 · 可分享炫耀战报卡。",
             "url": "https://myskme.github.io/myskme-brawl/"},
        ]},
    ],
}

# 预览截图：shots.json 由 capture_shots.sh 生成（key -> data URI）；缺失则回退到字形徽章
SHOTS = {}
_sp = os.path.join(HERE, "shots.json")
if os.path.exists(_sp):
    try:
        SHOTS = json.load(open(_sp, encoding="utf-8"))
    except Exception:
        SHOTS = {}
for _sec in DEFAULT_DATA["sections"]:
    for _it in _sec["items"]:
        if _it.get("key") in SHOTS:
            _it["shot"] = SHOTS[_it["key"]]

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
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--serif);
  line-height:1.7;overflow-x:hidden;
  background-image:var(--page-grad);
  background-attachment:fixed;transition:background-color .35s ease,color .35s ease;}
body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:1;
  opacity:var(--noise-op);mix-blend-mode:var(--noise-blend);
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)'/%3E%3C/svg%3E");}
body::after{content:'';position:fixed;inset:0;pointer-events:none;z-index:1;
  background:var(--vignette);}
.wrap{position:relative;z-index:2;max-width:1180px;margin:0 auto;padding:clamp(36px,7vw,84px) clamp(18px,5vw,48px) 80px;}

header{text-align:center;margin-bottom:clamp(40px,7vw,72px);}
.kicker{font-size:13px;letter-spacing:.42em;color:var(--gold);text-transform:uppercase;
  opacity:0;animation:fade 1s .1s both;}
.title-hero{font-size:clamp(34px,6.4vw,72px);font-weight:300;letter-spacing:.16em;margin:.32em 0 .18em;
  animation:titleIn 1.4s cubic-bezier(.16,1,.3,1) both;}
.title-hero em{font-style:normal;color:var(--gold);font-weight:500;text-shadow:var(--glow-gold);}
.motto{color:var(--ink2);letter-spacing:.16em;font-size:clamp(14px,2.2vw,17px);opacity:0;animation:fade 1.1s .5s both;}
.meta-row{display:flex;gap:26px;justify-content:center;flex-wrap:wrap;margin-top:22px;opacity:0;animation:fade 1.1s .8s both;}
.stat{display:flex;flex-direction:column;align-items:center;gap:2px;}
.stat b{font-size:26px;color:var(--gold);font-weight:500;line-height:1;}
.stat span{font-size:12px;letter-spacing:.18em;color:var(--ink3);}
.usehint{margin-top:24px;color:var(--ink3);font-size:13px;letter-spacing:.1em;opacity:0;animation:fade 1.1s 1s both;}

.rule{display:flex;align-items:center;gap:20px;margin:18px 0 30px;}
.rule::before,.rule::after{content:'';height:1px;flex:1;background:linear-gradient(90deg,transparent,var(--line),transparent);}
.rule span{font-size:14px;letter-spacing:.34em;color:var(--gold);white-space:nowrap;text-shadow:0 0 18px rgba(201,166,74,.25);}
.rule-toggle{cursor:pointer;}
.rule .rule-caret{font-size:11px;letter-spacing:.12em;color:var(--gold2);white-space:nowrap;text-shadow:none;
  border:1px solid var(--line);padding:2px 11px;transition:border-color .25s,box-shadow .25s,color .25s;}
.rule-toggle:hover .rule-caret{border-color:var(--gold);color:var(--gold);box-shadow:var(--glow-gold);}
.rule-caret::after{content:'收起 ▴';}
.rule-toggle.collapsed .rule-caret::after{content:'展开 ▾';}
section[data-collapsed="1"] .grid{display:none!important;}
.fs-actions{display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;}
.fs-actions .btn{font-size:12.5px;padding:7px 14px;}
section{margin-top:clamp(36px,6vw,60px);}
.grid{display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));}

.ornate{position:relative;}
.ornate::before,.ornate::after{content:'';position:absolute;width:14px;height:14px;
  border:1px solid var(--gold);transition:all .35s cubic-bezier(.16,1,.3,1);z-index:3;opacity:.65;}
.ornate::before{top:-1px;left:-1px;border-right:0;border-bottom:0;}
.ornate::after{bottom:-1px;right:-1px;border-left:0;border-top:0;}
.ornate:hover::before,.ornate:hover::after{width:26px;height:26px;opacity:1;}

.card{background:var(--card-bg);border:1px solid var(--line);
  padding:24px 24px 22px;display:flex;flex-direction:column;gap:16px;
  transition:transform .45s cubic-bezier(.16,1,.3,1),border-color .35s,box-shadow .45s,background .35s;
  opacity:0;transform:translateY(26px);}
.card.in{opacity:1;transform:translateY(0);transition-delay:calc(var(--i) * 70ms);}
.card:hover{transform:translateY(-5px);border-color:var(--gold);box-shadow:var(--card-hover-shadow);}
.card.featured{border-color:var(--gold3);background:var(--feat-bg);box-shadow:inset 0 0 30px rgba(201,166,74,.06);}

/* 预览截图（hero）：满宽出血到卡片边缘，缺图回退字形 */
.thumb{margin:-24px -24px 0;position:relative;display:block;aspect-ratio:16/10;overflow:hidden;
  background:var(--bg4);border-bottom:1px solid var(--line);text-decoration:none;cursor:pointer;}
.thumb img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block;
  filter:saturate(1.05);transition:transform .55s cubic-bezier(.16,1,.3,1),filter .4s;}
.card:hover .thumb img{transform:scale(1.05);filter:saturate(1.1) brightness(1.05);}
.thumb::after{content:'↗ 打开';position:absolute;top:10px;right:10px;font-size:11px;letter-spacing:.1em;
  color:var(--gold2);background:rgba(10,10,12,.6);border:1px solid var(--line);padding:3px 9px;
  opacity:0;transform:translateY(-4px);transition:opacity .3s,transform .3s;pointer-events:none;}
.card:hover .thumb::after{opacity:1;transform:translateY(0);}
.thumb-fallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(201,166,74,.14),transparent 70%);}
.thumb-fallback span{font-size:62px;font-weight:300;color:var(--gold);text-shadow:0 0 24px rgba(201,166,74,.35);transition:transform .5s cubic-bezier(.16,1,.3,1);}
.card:hover .thumb-fallback span{transform:scale(1.08);}
.card-body{display:flex;flex-direction:column;gap:7px;flex:1;}
.ribbon{position:absolute;top:14px;right:-30px;transform:rotate(45deg);background:var(--gold);
  color:var(--bg);font-size:11px;font-weight:700;letter-spacing:.22em;padding:3px 34px;z-index:4;box-shadow:0 2px 10px rgba(0,0,0,.4);}

.card-head{display:flex;gap:15px;align-items:center;}
.badge{flex:0 0 64px;width:64px;height:64px;border:1px solid var(--line);position:relative;
  display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(201,166,74,.14),transparent 70%);}
.badge::before{content:'';position:absolute;inset:5px;border:1px solid var(--gold3);opacity:.4;transition:transform .8s cubic-bezier(.16,1,.3,1),opacity .4s;}
.badge-glyph{font-size:32px;font-weight:300;color:var(--gold);text-shadow:0 0 22px rgba(201,166,74,.4);transition:transform .6s,text-shadow .4s;}
.card:hover .badge::before{opacity:.85;transform:rotate(45deg) scale(1.08);}
.card:hover .badge-glyph{transform:scale(1.12);text-shadow:0 0 34px rgba(201,166,74,.65);}

.card-titles{min-width:0;flex:1;}
.tag{align-self:flex-start;font-size:11px;letter-spacing:.2em;color:var(--gold);border:1px solid var(--line);padding:2px 9px;}
.card-body h3{margin:0;font-size:21px;font-weight:500;letter-spacing:.06em;line-height:1.35;}
.card-body h3 a{color:var(--ink);text-decoration:none;transition:color .3s,text-shadow .3s;}
.card:hover .card-body h3 a{color:var(--gold2);text-shadow:0 0 18px rgba(201,166,74,.4);}
.en{font-size:12px;letter-spacing:.24em;color:var(--ink3);text-transform:uppercase;}
.card-desc{margin:0;color:var(--ink2);font-size:14.5px;line-height:1.7;flex:1;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}

.card-foot{display:flex;gap:18px;align-items:center;padding-top:16px;border-top:1px solid var(--line2);}
.qr-plate{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px;
  background:#f3e9cf;border:1px solid var(--gold3);box-shadow:var(--plate-shadow);
  transition:transform .4s cubic-bezier(.16,1,.3,1),box-shadow .4s;}
.qr-plate:hover{transform:scale(1.05);box-shadow:0 6px 22px rgba(0,0,0,.55),var(--glow-gold);}
.qr-box{width:108px;height:108px;}
.qr{width:108px;height:108px;display:block;}
.qr-hint{font-size:10px;letter-spacing:.22em;color:#7a6320;font-weight:700;}
.card-actions{flex:1;min-width:0;display:flex;flex-direction:column;gap:11px;}
.url{font-size:12px;color:var(--ink3);word-break:break-all;letter-spacing:.02em;font-family:ui-monospace,Menlo,monospace;}
.btn-row{display:flex;gap:9px;flex-wrap:wrap;}
.btn{font-family:var(--serif);font-size:13px;letter-spacing:.1em;padding:8px 16px;cursor:pointer;
  border:1px solid var(--line);background:transparent;color:var(--ink);text-decoration:none;
  transition:transform .2s,border-color .3s,background .3s,color .3s,box-shadow .3s;}
.btn:hover{border-color:var(--gold);color:var(--gold2);box-shadow:var(--glow-gold);}
.btn:active{transform:scale(.96);}
.btn-go{background:linear-gradient(180deg,rgba(201,166,74,.18),rgba(201,166,74,.06));border-color:var(--gold3);}
.btn-go:hover{background:linear-gradient(180deg,rgba(201,166,74,.3),rgba(201,166,74,.12));}

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

.admin-fab{position:fixed;left:16px;bottom:16px;z-index:40;width:40px;height:40px;border:1px solid var(--line);
  background:var(--bg3);color:var(--ink3);cursor:pointer;font-size:16px;opacity:.45;
  transition:all .3s;display:flex;align-items:center;justify-content:center;}
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
  .toast{bottom:78px;max-width:82vw;}
}
@media (prefers-reduced-motion:reduce){
  *{animation-duration:.01ms!important;transition-duration:.01ms!important;}
  .card{opacity:1;transform:none;}
}

/* ---------- 右下角控制台：主题切换 / 打印 / 分享 ---------- */
.ctrl{position:fixed;right:16px;bottom:16px;z-index:42;display:flex;gap:10px;}
.ctrl-btn{width:40px;height:40px;border:1px solid var(--line);background:var(--bg3);color:var(--ink2);
  cursor:pointer;font-size:16px;opacity:.6;transition:all .3s;display:flex;align-items:center;justify-content:center;
  font-family:var(--serif);}
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
  .admin-bar,.admin-fab,.ctrl,.toast,.pw-mask,.card-admin,.add-work,.btn-row,.thumb,
  .tag,.en,.card-desc,.qr-hint,.kicker,.meta-row,.usehint,.ribbon,.foot-share{display:none!important;}
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
  var DATA=load(); var saveTimer, toastTimer;

  function clone(o){return JSON.parse(JSON.stringify(o));}
  function load(){try{var s=localStorage.getItem(LS);if(s)return JSON.parse(s);}catch(e){}return clone(DEFAULT_DATA);}
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

  function cardHTML(it,si,ii){
    var inner=it.shot
      ? '<img loading="lazy" alt="" src="'+esc(it.shot)+'">'
      : '<div class="thumb-fallback"><span data-bind="glyph">'+esc(it.glyph)+'</span></div>';
    var thumb='<a class="thumb" href="'+esc(it.url)+'" target="_blank" rel="noopener">'+inner+'</a>';
    return '<article class="card ornate'+(it.featured?' featured':'')+'" style="--i:'+ii+'" data-sec="'+si+'" data-idx="'+ii+'">'
      +(it.featured?'<span class="ribbon">HUB</span>':'')
      +thumb
      +'<div class="card-body"><span class="tag" data-bind="tag">'+esc(it.tag)+'</span>'
        +'<h3><a class="title-link" href="'+esc(it.url)+'" target="_blank" rel="noopener" data-bind="title">'+esc(it.title)+'</a></h3>'
        +'<span class="en" data-bind="en">'+esc(it.en)+'</span>'
        +'<p class="card-desc" data-bind="desc">'+esc(it.desc)+'</p></div>'
      +'<div class="card-foot"><div class="qr-plate" title="手机扫码打开"><div class="qr-box">'+qrSVG(it.url)+'</div><span class="qr-hint">扫码即玩</span></div>'
        +'<div class="card-actions"><span class="url" data-bind="url">'+esc(it.url)+'</span>'
        +'<div class="btn-row"><a class="btn btn-go" href="'+esc(it.url)+'" target="_blank" rel="noopener">访问 ↗</a>'
        +'<button class="btn btn-copy" data-url="'+esc(it.url)+'">复制链接</button></div></div></div>'
      +'<div class="card-admin">'
        +'<button data-op="up" title="上移">↑ 上移</button><button data-op="down" title="下移">↓ 下移</button>'
        +'<button data-op="move" title="移到另一区">⇄ 换区</button>'
        +'<button data-op="feat" title="HUB 角标开关">★ 角标</button>'
        +'<button data-op="del" class="danger" title="删除此作品">删除</button>'
      +'</div></article>';
  }

  function render(){
    var html='';
    DATA.sections.forEach(function(sec,si){
      var collapsible=!!sec.collapsible, collapsed=false;
      if(collapsible){collapsed=true;try{var s=localStorage.getItem('myskme-sec'+si);if(s!==null)collapsed=(s==='1');}catch(e){}}
      var rule = collapsible
        ? '<div class="rule rule-toggle'+(collapsed?' collapsed':'')+'" data-sec-toggle="'+si+'"><span data-seclabel="'+si+'">'+esc(sec.label)+'</span><span class="rule-caret"></span></div>'
        : '<div class="rule"><span data-seclabel="'+si+'">'+esc(sec.label)+'</span></div>';
      html+='<section data-section="'+si+'"'+(collapsed?' data-collapsed="1"':'')+'>'+rule+'<div class="grid">';
      sec.items.forEach(function(it,ii){html+=cardHTML(it,si,ii);});
      html+='<button class="add-work" data-addsec="'+si+'">＋ 添加作品</button></div></section>';
    });
    content.innerHTML=html;
    updateCounts();
    applyAdmin();
    reveal();
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
    var a=DATA.sections[0]?DATA.sections[0].items.length:0;
    var b=DATA.sections[1]?DATA.sections[1].items.length:0;
    setNum('stat-total',a+b);setNum('stat-a',a);setNum('stat-b',b);
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
    ctx.fillStyle='#6a5f47';ctx.font='400 23px "Songti SC",serif';ctx.fillText('六大作品 + 作文墙 + 题库 · 一站直达',tx,hy+132);
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
  document.getElementById('abReset').addEventListener('click',function(){
    if(!confirm('重置为默认内容？将清除本机所有改动。'))return;
    try{localStorage.removeItem(LS);}catch(e){}DATA=clone(DEFAULT_DATA);renderHeader();render();toast('已重置为默认内容');
  });
  document.getElementById('abExit').addEventListener('click',function(){setAdmin(false);toast('已退出管理员模式');});

  // ---- 主题：跟随系统 / 浅色 / 深色 ----
  var TLS='myskme-theme', tOrder=['auto','light','dark'],
      tName={auto:'跟随系统',light:'浅色',dark:'深色'}, tIcon={auto:'◐',light:'☀',dark:'☾'};
  var mq=window.matchMedia?matchMedia('(prefers-color-scheme: dark)'):null;
  function getPref(){try{return localStorage.getItem(TLS)||'auto';}catch(e){return 'auto';}}
  function resolveTheme(p){return p==='auto'?((mq&&mq.matches)?'dark':'light'):p;}
  function applyTheme(p){var e=document.documentElement;
    e.setAttribute('data-theme',resolveTheme(p));e.setAttribute('data-themepref',p);
    var b=document.getElementById('themeBtn');if(b){b.textContent=tIcon[p];b.title='主题：'+tName[p]+'（点按切换）';}}
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
  applyTheme(getPref());
  var sq=document.getElementById('shareQr'); if(sq)sq.innerHTML='<div class="qr-box">'+qrSVG(DATA.hubUrl||location.href)+'</div>';
  var su=document.getElementById('shareUrl'); if(su)su.textContent=(DATA.hubUrl||'').replace(/^https?:\/\//,'').replace(/\/$/,'');
  renderHeader();
  render();
  statsAnim();
  if(sessionStorage.getItem(SS)==='1')setAdmin(true);
})();
"""

def static_header(d):
    return (
        '  <header>\n'
        f'    <div class="kicker" data-h="kicker">{d["kicker"]}</div>\n'
        f'    <h1 class="title-hero"><span data-h="titlePre">{d["titlePre"]}</span><em data-h="titleEm">{d["titleEm"]}</em></h1>\n'
        f'    <p class="motto" data-h="motto">{d["motto"]}</p>\n'
        '    <div class="meta-row">\n'
        '      <div class="stat"><b id="stat-total">0</b><span>件作品</span></div>\n'
        '      <div class="stat"><b id="stat-a">0</b><span>推荐随玩</span></div>\n'
        '      <div class="stat"><b id="stat-b">0</b><span>课堂专用</span></div>\n'
        '    </div>\n'
        f'    <p class="usehint" data-h="hint">{d["hint"]}</p>\n'
        '  </header>'
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
<meta name="description" content="MYSKME · 王老师 作品总目，扫码即玩：积分板、三国军师争霸、大乱斗、远征录、世界编年史、题库训练场。">
<meta property="og:type" content="website">
<meta property="og:title" content="MYSKME · 作品总目 — 狼先生与他的学生们">
<meta property="og:description" content="王老师的六大课堂英语作品 · 优秀作文墙 · 题库训练 —— 扫码即玩。">
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
  <button id="abExport">导出 index.html</button>
  <button id="abReset" class="danger">重置默认</button>
  <button id="abExit">退出</button>
</div>

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
      <span>·</span>
      <a href="https://myskme.github.io/myskme-hub/maker/" target="_blank" rel="noopener">出题工坊</a>
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
