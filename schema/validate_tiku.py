#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MYSKME 题库工坊 · 题库校验器
用法：
  python3 validate_tiku.py 卷号.json [更多.json ...]
  python3 validate_tiku.py banks/index.json        # 目录索引也可校验
零依赖，纯标准库。校验规则与线上《词灵对决》导入器逐条对齐：
配对题 [词,义,难度?]；选择题 {q,ops,ans,why,lv?}，ans 为 0 起下标且 < ops 长度。
出库前跑一遍，绿了再发布。"""
import sys, json, re

CODE_RE = re.compile(r"^[A-Za-z0-9_]{2,16}$")
MOD_RE = re.compile(r"^[mM][0-9]+$")
RESERVED = {"type", "media", "passage", "rubric"}  # 保留题型字段，允许但当前导入器忽略


def check_pair(item, where, errs):
    if not (2 <= len(item) <= 3):
        errs.append(f"{where}: 配对题应为 [词,义,难度?]，实际长度 {len(item)}"); return
    if not (isinstance(item[0], str) and item[0].strip()):
        errs.append(f"{where}: 配对题第 1 项(词)需为非空字符串")
    if not (isinstance(item[1], str) and item[1].strip()):
        errs.append(f"{where}: 配对题第 2 项(义)需为非空字符串")
    if len(item) == 3 and not isinstance(item[2], (int, str)):
        errs.append(f"{where}: 配对题难度应为整数或字符串")


def check_mcq(it, where, errs, warns):
    for k in ("q", "ops", "ans", "why"):
        if k not in it:
            errs.append(f"{where}: 选择题缺字段 {k}");
    if errs and errs[-1].startswith(where):
        # 缺关键字段时不再深查，避免连环报错
        if any(k not in it for k in ("ops", "ans")):
            return
    if "q" in it and not (isinstance(it["q"], str) and it["q"].strip()):
        errs.append(f"{where}: q 需为非空字符串")
    ops = it.get("ops")
    if not (isinstance(ops, list) and len(ops) >= 2 and all(isinstance(o, str) for o in ops)):
        errs.append(f"{where}: ops 需为 ≥2 个字符串选项"); ops = None
    ans = it.get("ans")
    if not isinstance(ans, int) or isinstance(ans, bool):
        errs.append(f"{where}: ans 需为整数(0 起下标)")
    elif ops is not None and not (0 <= ans < len(ops)):
        errs.append(f"{where}: ans={ans} 越界，应在 0..{len(ops)-1}")
    if "why" in it and not (isinstance(it["why"], str) and it["why"].strip()):
        errs.append(f"{where}: why(解析) 不能为空")
    if "lv" in it and it["lv"] not in (1, 2):
        errs.append(f"{where}: lv 只能是 1(基础) 或 2(冲刺)")
    if "q" in it and isinstance(it["q"], str) and "___" not in it["q"]:
        warns.append(f"{where}: q 中没有 ___ 空格标记（若非填空题可忽略）")
    for k in it:
        if k in RESERVED:
            warns.append(f"{where}: 含保留字段 “{k}”（当前导入器忽略，留作未来题型）")


def validate_bank(obj, errs, warns):
    counts = {"pair": 0, "mcq": 0}
    for k in ("name", "code", "mods"):
        if k not in obj:
            errs.append(f"根级缺字段 {k}")
    if isinstance(obj.get("name"), str) and not obj["name"].strip():
        errs.append("name 不能为空")
    code = obj.get("code")
    if isinstance(code, str) and not CODE_RE.match(code):
        errs.append(f"code=“{code}” 不符合兑换码规则（字母数字下划线，2–16 位，如 S1E7）")
    mods = obj.get("mods")
    if not isinstance(mods, dict) or not mods:
        errs.append("mods 需为非空对象"); return counts
    for mk, arr in mods.items():
        if not MOD_RE.match(mk):
            errs.append(f"模块键 “{mk}” 非法，应形如 m1/m2…")
        if not isinstance(arr, list) or not arr:
            errs.append(f"模块 {mk} 需为非空数组"); continue
        for i, item in enumerate(arr):
            where = f"{mk}[{i}]"
            if isinstance(item, list):
                check_pair(item, where, errs); counts["pair"] += 1
            elif isinstance(item, dict):
                check_mcq(item, where, errs, warns); counts["mcq"] += 1
            else:
                errs.append(f"{where}: 题目应为数组(配对)或对象(选择)")
    return counts


def validate_index(arr, errs, warns):
    for i, e in enumerate(arr):
        w = f"index[{i}]"
        for k in ("code", "name"):
            if k not in e:
                errs.append(f"{w}: 索引项缺 {k}")
        if "count" in e and not isinstance(e["count"], int):
            errs.append(f"{w}: count 需为整数")


def run(path):
    errs, warns = [], []
    try:
        obj = json.load(open(path, encoding="utf-8"))
    except Exception as e:
        print(f"✗ {path}  JSON 解析失败：{e}"); return False
    cat = obj.get("catalog") if isinstance(obj, dict) else None
    is_index = isinstance(cat, list) or (isinstance(obj, list) and obj and isinstance(obj[0], dict) and "code" in obj[0] and "mods" not in obj[0])
    if is_index:
        arr = cat if isinstance(cat, list) else obj
        validate_index(arr, errs, warns)
        summary = f"目录 {len(arr)} 条"
    else:
        c = validate_bank(obj, errs, warns)
        summary = f"{obj.get('code','?')} · 配对 {c['pair']} / 选择 {c['mcq']}（共 {c['pair']+c['mcq']} 题）"
    ok = not errs
    print(("✓ " if ok else "✗ ") + f"{path}  {summary}")
    for e in errs:
        print("   错误 · " + e)
    for w in warns:
        print("   提示 · " + w)
    return ok


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(2)
    results = [run(p) for p in sys.argv[1:]]
    sys.exit(0 if all(results) else 1)
