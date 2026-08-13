import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// 把游戏正本里的 SVG symbol 导出成可以单独拿走用的矢量文件，并生成一份带哈希的总账。
//
// 为什么要有这一层：游戏美术住在 index.html 里（单文件是这个作品的硬约束），
// 但美术资产要能复利——出周边、做别的作品、喂给下一次二创、给世界观图鉴当立绘。
// 所以这里做的不是「另存一份」，而是**把正本当唯一源，机器导出镜像**：
//   - 想改造型，永远只改 index.html，然后重跑本脚本；
//   - reusable-assets/ 里的一切（含 README）都是生成物，手改会被下次生成覆盖；
//   - 构建期会跑 `--check`，导出没跟上就直接发布失败，镜像不可能悄悄过期。
//
// 用法：node monkey/tools/extract-assets.mjs           重新导出
//      node monkey/tools/extract-assets.mjs --check    只校验有没有过期（构建门禁用的就是这条）

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const repoRoot = path.resolve(projectRoot, '..');
const sourcePath = path.join(projectRoot, 'index.html');
const outputRoot = path.join(projectRoot, 'reusable-assets');
const checkOnly = process.argv.includes('--check');
const source = await readFile(sourcePath, 'utf8');
const symbols = new Map();

for (const match of source.matchAll(/<symbol id="([^"]+)" viewBox="([^"]+)">([\s\S]*?)<\/symbol>/g)) {
  symbols.set(match[1], { id: match[1], viewBox: match[2], markup: match[0], body: match[3] });
}

function sourceMatch(pattern, label) {
  const match = source.match(pattern);
  if (!match) throw new Error('找不到正本数据：' + label);
  return match[1];
}

// 奶茶不能在导出器里维护第二张表，也不能手抄二十段 SVG。
// 直接把正本里的 TEAS 与 teaCupSvg 放进隔离上下文，让正本函数逐杯现画；test 函数只保留在
// 临时上下文里，不进入生成物。这样增删、改名、改色和改杯型都只需要改 index.html。
const teaArraySource = sourceMatch(/const TEAS=(\[[\s\S]*?\n\]);\nconst POSTER_RANKS=/, 'TEAS');
const teaCupFunctionSource = sourceMatch(/(function teaCupSvg\(tea,h=52\)\{[\s\S]*?\n\})\nfunction renderTeaScreen/, 'teaCupSvg');
const teaRuntime = { result: null };
vm.runInNewContext(
  `const TEAS=${teaArraySource};\n${teaCupFunctionSource}\nresult={`
    + `teas:TEAS.map(({test,...tea})=>tea),cups:TEAS.map(tea=>teaCupSvg(tea,260))};`,
  teaRuntime,
  { timeout: 1000, filename: 'monkey-tea-assets.vm.js' },
);
const teas = teaRuntime.result?.teas || [];
const teaCups = teaRuntime.result?.cups || [];
if (!teas.length || teas.length !== teaCups.length) throw new Error('TEAS 数据与杯子导出数量不一致');
if (new Set(teas.map(tea => tea.id)).size !== teas.length) throw new Error('TEAS 存在重复 id，无法安全导出');
if (teas.some(tea => !/^[a-z0-9-]+$/.test(tea.id) || !tea.name || !tea.tier || !tea.liquid || !tea.pearl)) {
  throw new Error('TEAS 缺少可复用素材所需字段');
}

// 世界窗景也只认正本里的 CULTURE_MOTIFS 与 motifSvgMarkup()。导出器不维护第二套画面，
// 这样游戏里换一根线，素材库与哈希总账会在同一次构建里跟着变化。
const motifArraySource = sourceMatch(/const CULTURE_MOTIFS=(\[[\s\S]*?\n\]);\nfunction motifSvgMarkup/, 'CULTURE_MOTIFS');
const motifFunctionSource = sourceMatch(/(function motifSvgMarkup\(motif\)\{[\s\S]*?\n\})\nconst SURPRISES=/, 'motifSvgMarkup');
const motifRuntime = { result: null };
vm.runInNewContext(
  `const CULTURE_MOTIFS=${motifArraySource};\n${motifFunctionSource}\nresult={`
    + 'motifs:CULTURE_MOTIFS,art:CULTURE_MOTIFS.map(motif=>motifSvgMarkup(motif))};',
  motifRuntime,
  { timeout: 1000, filename: 'monkey-world-window-assets.vm.js' },
);
const motifs = motifRuntime.result?.motifs || [];
const motifArt = motifRuntime.result?.art || [];
if (motifs.length !== 8 || motifArt.length !== motifs.length || new Set(motifs.map(motif => motif.id)).size !== motifs.length) {
  throw new Error('世界窗景必须从正本现算出八种唯一素材');
}
if (motifs.some(motif => !/^[a-z0-9-]+$/.test(motif.id) || !motif.name || !motif.line || !motif.kind || !motif.sky || !motif.ink || !motif.accent)) {
  throw new Error('CULTURE_MOTIFS 缺少可复用素材所需字段');
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
}

function reusableTeaSvg(tea, markup) {
  return markup
    .replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(tea.name)}" `)
    .replace(' aria-hidden="true"', '') + '\n';
}

function reusableMotifSvg(motif, markup) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844" role="img" aria-label="${escapeXml(motif.name)}">`,
    markup,
    '</svg>', '',
  ].join('\n');
}

// role 只是给下一个使用者看的：这张图在世界观里是谁、能不能改。
const exportsList = [
  ['monkey-rise.svg', 'art-monkey-rise', '猴先生 · 上升姿势（主角，三姿之一）'],
  ['monkey-fall.svg', 'art-monkey-fall', '猴先生 · 坠落姿势'],
  ['monkey-land.svg', 'art-monkey-land', '猴先生 · 落地姿势'],
  // 曾叫 fish-gold.svg；鱼小姐 0812 按 canon 改回青绿，文件名不再带颜色，免得下次换色又变成骗人的名字
  ['fish.svg', 'art-fish', '鱼小姐 · 绿鲤鱼成精（canon 角色，配色不得离开青绿系）'],
  ['donkey.svg', 'art-donkey', '驴 · 沉默的鉴定者（canon 角色）'],
  ['egg.svg', 'art-egg', '蛋 · 房租稽查科常驻（canon 角色）'],
  ['snake.svg', 'art-snake', '蛇 · 意见很多（canon 角色）'],
  ['fertilizer.svg', 'art-fertilizer', '黑化肥 · 场景道具'],
  ['banana.svg', 'art-banana', '香蕉 · 收集物'],
  ['crate.svg', 'art-crate', '木箱 · 场景道具'],
  // 红鲤鱼不是 canon 角色，这顶帽子永远只是「仿的」，驴会当场说破
  ['carp-hat.svg', 'art-carp-hat', '红鲤鱼帽 · 猴先生假扮红鲤鱼的道具（梗，非 canon 角色）'],
];

function dependencies(id, found = new Set()) {
  if (found.has(id)) return found;
  const symbol = symbols.get(id);
  if (!symbol) throw new Error('找不到 SVG symbol：' + id);
  found.add(id);
  for (const match of symbol.body.matchAll(/href="#([^"]+)"/g)) dependencies(match[1], found);
  return found;
}

function standalone(id) {
  const symbol = symbols.get(id);
  const [, , width, height] = symbol.viewBox.trim().split(/\s+/).map(Number);
  const defs = [...dependencies(id)].map(dep => symbols.get(dep).markup).join('\n');
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + symbol.viewBox + '" role="img" aria-label="' + id + '">',
    '<defs>', defs, '</defs>',
    '<use href="#' + id + '" width="' + width + '" height="' + height + '"/>',
    '</svg>', '',
  ].join('\n');
}

function cover() {
  const deps = new Set([...dependencies('art-monkey-rise'), ...dependencies('art-fish')]);
  const defs = [...deps].map(dep => symbols.get(dep).markup).join('\n');
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" role="img" aria-label="是猴就上100层封面">',
    '<rect width="1280" height="720" rx="48" fill="#faf3e2"/>',
    '<path d="M0 540 Q250 470 470 560 T910 520 T1280 545 V720 H0Z" fill="#dff3ef"/>',
    '<g opacity=".28" fill="#28211a"><circle cx="75" cy="86" r="5"/><circle cx="170" cy="145" r="4"/><circle cx="1130" cy="110" r="5"/><circle cx="1030" cy="204" r="4"/></g>',
    '<defs>', defs, '</defs>',
    '<use href="#art-monkey-rise" x="210" y="96" width="425" height="493"/>',
    '<use href="#art-fish" x="790" y="164" width="402" height="402"/>',
    '<g stroke="#28211a" stroke-width="9" stroke-linejoin="round"><rect x="105" y="610" width="430" height="38" rx="18" fill="#f5b731"/><rect x="710" y="570" width="420" height="38" rx="18" fill="#e3ad32"/></g>',
    '</svg>', '',
  ].join('\n');
}

// 画风参数不是我编的，是从正本里现数出来的——文档里写死一套迟早跟代码对不上。
function drawingStyle() {
  const strokes = [...source.matchAll(/<symbol id="art-[^"]+"[\s\S]*?<\/symbol>/g)]
    .join('\n').matchAll(/stroke="(#[0-9a-fA-F]{3,8})"/g);
  const tally = new Map();
  for (const [, color] of strokes) tally.set(color, (tally.get(color) || 0) + 1);
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  return {
    outline: ranked[0]?.[0] || '#2f5148',
    outlineNote: '所有角色统一用这一种描边色，不要每个角色换一种',
    strokeWidth: '主轮廓 3，细节 2 至 2.6，四肢与尾巴 6 至 7',
    linecap: 'round',
    linejoin: 'round',
    fill: '平涂，无渐变、无阴影、无滤镜',
    blush: '#ee9f9a',
    highlight: '眼睛高光是纯白小圆点，位置偏左上',
  };
}

const outputs = new Map(exportsList.map(([file, id]) => [path.join(outputRoot, file), standalone(id)]));
outputs.set(path.join(repoRoot, 'assets', 'cover-monkey-upstairs.svg'), cover());
for (let index = 0; index < teas.length; index++) {
  outputs.set(path.join(outputRoot, 'teas', teas[index].id + '.svg'), reusableTeaSvg(teas[index], teaCups[index]));
}
for (let index = 0; index < motifs.length; index++) {
  outputs.set(path.join(outputRoot, 'world-windows', motifs[index].id + '.svg'), reusableMotifSvg(motifs[index], motifArt[index]));
}

const palette = {
  paper: '#faf3e2', ink: '#28211a', outline: '#2f5148', teal: '#1f9e8e',
  fish: '#3fab84', fishFin: '#6cd0af', banana: '#f5b731', red: '#e0452c',
  carpHat: '#e0452c', carpHatFin: '#f2836a', cream: '#fff5d1', blush: '#ee9f9a',
};
const canon = [
  '鱼小姐是绿鲤鱼成精，canon 上不存在金鲤鱼。她的配色不得离开青绿系；构建与线上验收都有门禁挡着。',
  '红鲤鱼不是 canon 角色。carp-hat 只是猴先生假扮用的道具，必须是红的——做成青绿就变成鱼小姐本人，梗就没了。',
  '一切 UI 与文案不使用 emoji 及 emoji 味符号（装饰星、带圈数字、箭头字符都算）。',
];

const manifestAssets = [];
for (const [file, id, role] of exportsList) {
  const body = outputs.get(path.join(outputRoot, file));
  const [, , width, height] = symbols.get(id).viewBox.trim().split(/\s+/).map(Number);
  manifestAssets.push({
    file, symbol: id, role, viewBox: symbols.get(id).viewBox, width, height,
    sha256: createHash('sha256').update(body).digest('hex'),
  });
}
const manifestTeas = teas.map(tea => {
  const file = path.posix.join('teas', tea.id + '.svg');
  const body = outputs.get(path.join(outputRoot, file));
  return {
    file, source: 'TEAS', id: tea.id, name: tea.name, tier: tea.tier,
    liquid: tea.liquid, pearl: tea.pearl, hint: tea.hint, note: tea.note,
    secret: !!tea.secret, viewBox: '0 0 40 52', width: 200, height: 260,
    sha256: createHash('sha256').update(body).digest('hex'),
  };
});
const manifestMotifs = motifs.map(motif => {
  const file = path.posix.join('world-windows', motif.id + '.svg');
  const body = outputs.get(path.join(outputRoot, file));
  return {
    file, source: 'CULTURE_MOTIFS', id: motif.id, name: motif.name, line: motif.line, kind: motif.kind,
    sky: motif.sky, ink: motif.ink, accent: motif.accent, viewBox: '0 0 390 844', width: 390, height: 844,
    sha256: createHash('sha256').update(body).digest('hex'),
  };
});
const manifest = JSON.stringify({
  schema: 4,
  source: '../index.html',
  generator: 'monkey/tools/extract-assets.mjs',
  license: 'MYSKME original reusable asset',
  usage: '直接 <img src> 或内联；矢量无损缩放。要改造型请改 ../index.html 里的同名 symbol 再重跑导出器，不要手改这里。',
  palette,
  style: drawingStyle(),
  canon,
  assets: manifestAssets,
  teas: manifestTeas,
  worldWindows: manifestMotifs,
}, null, 2) + '\n';
outputs.set(path.join(outputRoot, 'asset-manifest.json'), manifest);

const style = drawingStyle();
const readme = [
  '# 可复用美术资源 · 是猴就上100层',
  '',
  '**本目录整个是生成物，不要手改。** 由 `monkey/tools/extract-assets.mjs` 从 `monkey/index.html`',
  '导出，下一次生成会整个覆盖。构建期会跑 `--check`，导出没跟上就直接发布失败。',
  '',
  '要改造型：改 `monkey/index.html` 里的同名 `<symbol>`，再跑一次导出器。',
  '',
  '## 资源清单',
  '',
  '| 文件 | symbol | 画布 | 在世界观里是谁 |',
  '| --- | --- | --- | --- |',
  ...manifestAssets.map(a => `| \`${a.file}\` | \`${a.symbol}\` | ${a.width} × ${a.height} | ${a.role} |`),
  '',
  '另有 `../../assets/cover-monkey-upstairs.svg`（1280 × 720 封面，由猴先生与鱼小姐合成）。',
  '每个文件的 SHA-256 见 `asset-manifest.json`，用来判断某份拷贝是不是当前正本导出的。',
  '',
  '## 奶茶图鉴素材',
  '',
  '以下杯子由正本 `TEAS` 数据与 `teaCupSvg()` 逐杯现算，不在导出器里维护第二套配方或杯型。',
  '',
  '| 文件 | 名称 | 档位 | 液体 | 珍珠 |',
  '| --- | --- | --- | --- | --- |',
  ...manifestTeas.map(tea => `| \`${tea.file}\` | ${tea.name} | ${tea.tier} | \`${tea.liquid}\` | \`${tea.pearl}\` |`),
  '',
  '## 世界窗景素材',
  '',
  '以下八种窗景由正本 `CULTURE_MOTIFS` 数据与 `motifSvgMarkup()` 逐幅现算。游戏内、分享海报与素材总账共用同一组名称和颜色。',
  '',
  '| 文件 | 名称 | 视觉结构 | 天空色 | 线条色 |',
  '| --- | --- | --- | --- | --- |',
  ...manifestMotifs.map(motif => `| \`${motif.file}\` | ${motif.name} | \`${motif.kind}\` | \`${motif.sky}\` | \`${motif.ink}\` |`),
  '',
  '## 画风参数',
  '',
  `- 描边：\`${style.outline}\`，${style.outlineNote}`,
  `- 线宽：${style.strokeWidth}；端点与拐角一律 \`round\``,
  `- 填色：${style.fill}`,
  `- 腮红：\`${palette.blush}\`；眼睛高光是纯白小圆点，偏左上`,
  '',
  '## 调色板',
  '',
  ...Object.entries(palette).map(([k, v]) => `- \`${k}\` ${v}`),
  '',
  '## 二次创作前必须知道的三条',
  '',
  ...canon.map((line, i) => `${i + 1}. ${line}`),
  '',
].join('\n');
outputs.set(path.join(outputRoot, 'README.md'), readme);

await mkdir(outputRoot, { recursive: true });
const stale = [];
for (const [target, expected] of outputs) {
  if (checkOnly) {
    let actual = '';
    try { actual = await readFile(target, 'utf8'); } catch {}
    if (actual !== expected) stale.push(path.relative(repoRoot, target));
  } else {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, expected);
  }
}
if (stale.length) {
  throw new Error('可复用资源未同步（改了 index.html 的美术但没重跑导出器）：\n  ' + stale.join('\n  ')
    + '\n修法：node monkey/tools/extract-assets.mjs');
}
console.log((checkOnly ? 'PASS 已同步：' : '已导出：') + outputs.size + ' 个可复用资源');
