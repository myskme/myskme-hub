# -*- coding: utf-8 -*-
"""题库构建：banks/src/*.json（后台可编辑的源）-> banks/*.json（游戏格式）+ banks/index.json（书架目录）。
源里配对题 m1/m2/m3 用对象 {w,m,d}（方便网页后台填），构建时转成游戏要的数组 [词,义,难度]；
选择题 m4/m5 用对象 {q,ops,ans,why,lv} 原样通过。构建会校验，发现问题直接报错不发布。
本脚本既给 GitHub Action 用，也能本地直接 `python3 build_banks.py` 跑。"""
import json, os, glob, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "banks", "src")
OUT = os.path.join(ROOT, "banks")
PAIR_MODS = ("m1", "m2", "m3")

def pair_to_array(p):
    if isinstance(p, list):
        return p  # 已是数组，容错
    a = [p.get("w", ""), p.get("m", "")]
    d = p.get("d")
    if d not in (None, "", 0):
        a.append(d)
    return a

def build_bank(src):
    mods = {}
    for k, items in (src.get("mods") or {}).items():
        items = items or []
        if k in PAIR_MODS:
            mods[k] = [pair_to_array(p) for p in items]
        else:  # m4/m5 选择题
            out = []
            for it in items:
                if isinstance(it, list):  # 容错：已是数组配对，跳过
                    continue
                _a = it.get("ans")
                _ans = int(_a) if isinstance(_a, (int, float)) or (isinstance(_a, str) and _a.strip().lstrip("-").isdigit()) else -1
                o = {"q": it.get("q", ""), "ops": it.get("ops", []), "ans": _ans}
                if it.get("why"):
                    o["why"] = it["why"]
                if it.get("lv"):
                    o["lv"] = int(it["lv"])
                # 阅读/完形：携带短文与题型（词灵对决会渲染短文面板）
                if it.get("passage"):
                    o["passage"] = it["passage"]
                if it.get("type"):
                    o["type"] = it["type"]
                out.append(o)
            mods[k] = out
    bank = {"name": src.get("name", ""), "code": (src.get("code") or "").strip().upper(), "desc": src.get("desc", "")}
    for opt in ("tier", "level", "cat", "pack"):
        if src.get(opt):
            bank[opt] = src[opt]
    bank["mods"] = mods
    return bank

def validate(bank):
    errs = []
    code = bank.get("code") or "?"
    if not bank.get("code"):
        errs.append("缺 code（兑换码/卷号）")
    if not bank.get("name"):
        errs.append(code + " 缺 name")
    for k, items in bank["mods"].items():
        for i, it in enumerate(items):
            tag = "%s.%s[%d]" % (code, k, i)
            if isinstance(it, list):
                if len(it) < 2 or not str(it[0]).strip() or not str(it[1]).strip():
                    errs.append(tag + " 配对缺词或义")
            else:
                if not str(it.get("q", "")).strip():
                    errs.append(tag + " 缺题干")
                ops = it.get("ops") or []
                if len([o for o in ops if str(o).strip()]) < 2:
                    errs.append(tag + " 选项不足 2 个")
                a = it.get("ans")
                if not isinstance(a, int) or a < 0 or a >= len(ops):
                    errs.append(tag + " ans 下标越界")
    return errs

def item_count(bank):
    return sum(len(v) for v in bank["mods"].values())

def main():
    if not os.path.isdir(SRC):
        print("没有 banks/src/ 目录，跳过"); return 0
    srcs = sorted(glob.glob(os.path.join(SRC, "*.json")))
    catalog, all_errs = [], []
    for sp in srcs:
        try:
            src = json.load(open(sp, encoding="utf-8"))
            bank = build_bank(src)
        except Exception as e:
            all_errs.append("%s 解析/构建失败：%s" % (os.path.basename(sp), e)); continue
        errs = validate(bank)
        if errs:
            all_errs += errs; continue
        json.dump(bank, open(os.path.join(OUT, bank["code"] + ".json"), "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2)
        catalog.append({
            "code": bank["code"], "name": bank["name"], "desc": bank.get("desc", ""),
            "date": src.get("date", ""), "cat": src.get("cat", ""), "pack": src.get("pack", ""),
            "level": src.get("level", ""), "tier": src.get("tier", "free"), "count": item_count(bank),
        })
    if all_errs:
        print("❌ 校验未通过，未发布：")
        for e in all_errs:
            print("  -", e)
        return 1
    # 清理已删除题库的产物：banks/src 里没有的，就从书架移除（仅在全部校验通过时）
    keep = {c["code"] for c in catalog}
    for f in glob.glob(os.path.join(OUT, "*.json")):
        base = os.path.splitext(os.path.basename(f))[0]
        if base != "index" and base not in keep:
            os.remove(f); print("  · 已下架旧题库：%s" % os.path.basename(f))
    json.dump({"catalog": catalog}, open(os.path.join(OUT, "index.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)
    print("✓ 构建完成：%d 个题库，已写 banks/<code>.json + banks/index.json" % len(catalog))
    for c in catalog:
        print("   %-8s %s（%d 题，%s）" % (c["code"], c["name"], c["count"], c["tier"]))
    return 0

if __name__ == "__main__":
    sys.exit(main())
