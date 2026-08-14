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
// 认它自己顶格的收尾，不认「后面紧跟着谁」。0814 在中间插了商店的渲染函数，
// 原来那个「\nfunction renderTeaScreen」锚点当场失效——隔壁是谁不是这段代码的性质。
const teaCupFunctionSource = sourceMatch(/(function teaCupSvg\(tea,h=52\)\{[\s\S]*?\n\})/, 'teaCupSvg');
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

// 称号徽章：和奶茶杯完全同一套做法——把正本的 HONORS 与 honorBadgeSvg 放进隔离上下文现画。
// 加一个称号只需要在 index.html 里多写一行数据，素材库会在下一次构建里自己多出一枚。
// 这就是「小成本、可复利」的落点：不另存一份、不维护第二套配方。
const honorArraySource = sourceMatch(/const HONORS=(\[[\s\S]*?\n\]);/, 'HONORS');
const honorGlyphSource = sourceMatch(/(const ICON_GLYPHS=\{[\s\S]*?\n\};)/, 'ICON_GLYPHS');
// honorBadgeSvg 0814 缩成了 iconSvg 的一层薄包装，所以这里要连 iconSvg 一起取。
// 而且它现在是**单行函数**：还按 /[\s\S]*?\n\}/ 去匹会一路吞到下一个换行加右括号，
// 把中间几百行全卷进来。这跟 hueGap 那次一模一样——
// **先看清楚目标是几行，再决定用哪种匹配。**
const iconFunctionSource = sourceMatch(/(function iconSvg\(emblem,tint,size\)\{[\s\S]*?\n\})/, 'iconSvg');
const honorBadgeFunctionSource = sourceMatch(/(function honorBadgeSvg\(honor,size\)\{[^\n]*\})/, 'honorBadgeSvg');
const honorRuntime = { result: null };
vm.runInNewContext(
  `const SURPRISES=[];\nconst HONORS=${honorArraySource};\n${honorGlyphSource}\n${iconFunctionSource}\n${honorBadgeFunctionSource}\nresult={`
    + `honors:HONORS.map(({test,...honor})=>honor),badges:HONORS.map(honor=>honorBadgeSvg(honor,240))};`,
  honorRuntime,
  { timeout: 1000, filename: 'monkey-honor-assets.vm.js' },
);
const honors = honorRuntime.result?.honors || [];
const honorBadges = honorRuntime.result?.badges || [];
if (!honors.length || honors.length !== honorBadges.length) throw new Error('HONORS 数据与徽章导出数量不一致');
if (new Set(honors.map(honor => honor.id)).size !== honors.length) throw new Error('HONORS 存在重复 id，无法安全导出');
if (honors.some(honor => !/^[a-z0-9-]+$/.test(honor.id) || !honor.name || !honor.emblem || !honor.tint)) {
  throw new Error('HONORS 缺少可复用素材所需字段（emblem / tint）');
}

// 十二种建筑立面语言。同样只认正本：把 FACADES 与 facadeMarkup 放进隔离上下文，
// 导出的是一块三开间三层的「样板」——拿去做周边、卡面、说明页都能直接用。
// 图形不含文字，所以将来出海不需要重画。
// 配色也只认正本：色相分级表与分类器都从 index.html 取，导出器不另存一份判据。
// 这样「声明的配色关系」在游戏里、在素材库里、在自检里永远是同一个算法算出来的。
// 注意这几条都要**按行取**：hueGap 与 classifyScheme 都是单行函数，
// 用 /[\s\S]*?\n\}/ 去匹会一路吞到下一个换行加右括号，把中间的 HUE_BANDS 一起卷进来，
// 于是拼出来的源码里 HUE_BANDS 出现两次、直接 SyntaxError。
// 这已经是同一类「范围没圈住」的第四次了：**先看清楚目标是几行，再决定用哪种匹配。**
const paletteToolsSource = [
  sourceMatch(/(function hexToHsl\(hex\)\{[\s\S]*?\n\})/, 'hexToHsl'),
  sourceMatch(/(function hueGap\(a,b\)\{[^\n]*\})/, 'hueGap'),
  sourceMatch(/(const HUE_BANDS=\[[^\n]*\];)/, 'HUE_BANDS'),
  sourceMatch(/(function classifyScheme\(a,b\)\{[^\n]*\})/, 'classifyScheme'),
].join('\n');

const facadeArraySource = sourceMatch(/const FACADES=(\[[\s\S]*?\n\]);\nconst FACADE_BY_DEPT/, 'FACADES');
const facadeConstSource = sourceMatch(/(const FACADE_BAYS=[^\n]*\n)/, 'FACADE 常量');
const facadeFunctionSource = sourceMatch(/(function facadeMarkup\(facade\)\{[\s\S]*?\n\})/, 'facadeMarkup');
const facadeRuntime = { result: null };
vm.runInNewContext(
  `const FACADES=${facadeArraySource};\n${facadeConstSource}\n${facadeFunctionSource}\n`
    + `const SWATCH_ROWS=3;\nresult={facades:FACADES.map(({unit,...facade})=>facade),`
    + `swatches:FACADES.map(facade=>{const left=62,width=(328-62)/FACADE_BAYS,parts=[];`
    + `for(let row=0;row<SWATCH_ROWS;row+=1)for(let bay=0;bay<FACADE_BAYS;bay+=1)`
    + `parts.push(facade.unit(left+bay*width,row*FACADE_STEP,width,FACADE_STEP));return parts.join('');})};`,
  facadeRuntime,
  { timeout: 1000, filename: 'monkey-facade-assets.vm.js' },
);
const facades = facadeRuntime.result?.facades || [];
const facadeSwatches = facadeRuntime.result?.swatches || [];
if (!facades.length || facades.length !== facadeSwatches.length) throw new Error('FACADES 数据与立面样板导出数量不一致');
if (new Set(facades.map(facade => facade.id)).size !== facades.length) throw new Error('FACADES 存在重复 id，无法安全导出');
if (facades.some(facade => !/^[a-z0-9-]+$/.test(facade.id) || !facade.name || !facade.era || !facade.fact || !facade.dept)) {
  throw new Error('FACADES 缺少可复用素材所需字段（name / era / fact / dept）');
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
// 每扇窗景的配色关系由**正本的分类器现算**，不在这里抄一份结论。
const paletteRuntime = { result: null };
vm.runInNewContext(
  `const MOTIFS=${JSON.stringify(motifs)};\n${paletteToolsSource}\nresult=MOTIFS.map(m=>({`
    + `id:m.id,scheme:m.scheme,measured:classifyScheme(m.ink,m.accent),hueGap:hueGap(m.ink,m.accent),`
    + `hsl:{sky:hexToHsl(m.sky),ink:hexToHsl(m.ink),accent:hexToHsl(m.accent)}}));`,
  paletteRuntime,
  { timeout: 1000, filename: 'monkey-palette.vm.js' },
);
const palettes = paletteRuntime.result || [];
// 导出器也守一遍：声明与实算不符就不许出包。游戏里那条自检只在有人跑 ?qa=1 时才拦，
// 而这一条在 CI 的每次构建里都拦——同一个判据，两层各守一段。
for (const entry of palettes) {
  if (entry.scheme !== entry.measured) {
    throw new Error('窗景 ' + entry.id + ' 声明的配色是「' + entry.scheme + '」，实算是「' + entry.measured + '」');
  }
}
const motifArt = motifRuntime.result?.art || [];
if (motifs.length !== 8 || motifArt.length !== motifs.length || new Set(motifs.map(motif => motif.id)).size !== motifs.length) {
  throw new Error('世界窗景必须从正本现算出八种唯一素材');
}
if (motifs.some(motif => !/^[a-z0-9-]+$/.test(motif.id) || !motif.name || !motif.line || !motif.kind || !motif.sky || !motif.ink || !motif.accent)) {
  throw new Error('CULTURE_MOTIFS 缺少可复用素材所需字段');
}

// 十八件行头。导出的是「穿着这件的猴先生」整只，不是孤零零一件配饰——
// 行头的价值在于穿上之后是什么样，一只戴着王冠开着车的猴子才是能直接拿去用的东西。
// 照旧只认正本：WEAR_ART 与猴子的 symbol 都从 index.html 现取。
const shopArraySource = sourceMatch(/const SHOP_ITEMS=(\[[\s\S]*?\n\]);/, 'SHOP_ITEMS');
const wearArtSource = sourceMatch(/(const WEAR_ART=\{[\s\S]*?\n\};)/, 'WEAR_ART');
const shopRuntime = { result: null };
vm.runInNewContext(
  `const SHOP_ITEMS=${shopArraySource};\n${wearArtSource}\nresult={`
    + 'items:SHOP_ITEMS,art:SHOP_ITEMS.map(item=>WEAR_ART[item.id]||\'\')};',
  shopRuntime,
  { timeout: 1000, filename: 'monkey-outfit-assets.vm.js' },
);
const outfits = shopRuntime.result?.items || [];
const outfitArt = shopRuntime.result?.art || [];
if (!outfits.length || outfits.length !== outfitArt.length) throw new Error('SHOP_ITEMS 与穿戴图导出数量不一致');
if (new Set(outfits.map(item => item.id)).size !== outfits.length) throw new Error('SHOP_ITEMS 存在重复 id，无法安全导出');
if (outfitArt.some(markup => !markup)) throw new Error('有行头没有穿戴图，导出会得到一只没穿的猴子');
// 行头是纯外观，数据表里不该出现任何玩法字段。导出器与构建门禁各查一遍：
// 导出器管的是「素材库里的东西描述准不准」，构建门禁管的是「游戏里会不会失衡」。
for (const item of outfits) {
  const extra = Object.keys(item).filter(key => !['id', 'slot', 'tier', 'name', 'line'].includes(key));
  if (extra.length) throw new Error('行头 ' + item.id + ' 带了额外字段：' + extra.join('、') + '（行头必须是纯外观）');
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);
}

function reusableTeaSvg(tea, markup) {
  return markup
    .replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(tea.name)}" `)
    .replace(' aria-hidden="true"', '') + '\n';
}

function reusableHonorSvg(honor, markup) {
  return markup
    .replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(honor.name)}" `)
    .replace(' aria-hidden="true"', '') + '\n';
}

function reusableFacadeSvg(facade, markup) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="60 -6 270 270" role="img" aria-label="${escapeXml(facade.name)}">`,
    `<g fill="none" stroke="#2f5148" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`,
    markup, '</g>', '</svg>', '',
  ].join('\n');
}

function reusableMotifSvg(motif, markup) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844" role="img" aria-label="${escapeXml(motif.name)}">`,
    markup,
    '</svg>', '',
  ].join('\n');
}

function reusableOutfitSvg(item, markup) {
  // 猴子用「落地」那一姿，和货架、海报保持一致（三处同一姿势，看着才像同一只猴）。
  const defs = [...dependencies('art-monkey-land')].map(dep => symbols.get(dep).markup).join('\n');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-9 -6 118 132" role="img" aria-label="${escapeXml(item.name)}">`,
    '<defs>', defs, '</defs>',
    '<use href="#art-monkey-land" width="100" height="116"/>',
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
for (let index = 0; index < facades.length; index++) {
  outputs.set(path.join(outputRoot, 'facades', facades[index].id + '.svg'), reusableFacadeSvg(facades[index], facadeSwatches[index]));
}
for (let index = 0; index < honors.length; index++) {
  outputs.set(path.join(outputRoot, 'honors', honors[index].id + '.svg'), reusableHonorSvg(honors[index], honorBadges[index]));
}
for (let index = 0; index < teas.length; index++) {
  outputs.set(path.join(outputRoot, 'teas', teas[index].id + '.svg'), reusableTeaSvg(teas[index], teaCups[index]));
}
for (let index = 0; index < motifs.length; index++) {
  outputs.set(path.join(outputRoot, 'world-windows', motifs[index].id + '.svg'), reusableMotifSvg(motifs[index], motifArt[index]));
}

for (let index = 0; index < outfits.length; index++) {
  outputs.set(path.join(outputRoot, 'outfits', outfits[index].id + '.svg'), reusableOutfitSvg(outfits[index], outfitArt[index]));
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
const manifestFacades = facades.map(facade => {
  const file = path.posix.join('facades', facade.id + '.svg');
  const body = outputs.get(path.join(outputRoot, file));
  return {
    file, source: 'FACADES', id: facade.id, name: facade.name, era: facade.era,
    department: facade.dept, fact: facade.fact, line: facade.line,
    viewBox: '60 -6 270 270', width: 270, height: 270,
    sha256: createHash('sha256').update(body).digest('hex'),
  };
});
const manifestHonors = honors.map(honor => {
  const file = path.posix.join('honors', honor.id + '.svg');
  const body = outputs.get(path.join(outputRoot, file));
  return {
    file, source: 'HONORS', id: honor.id, name: honor.name, emblem: honor.emblem, tint: honor.tint,
    hint: honor.hint, line: honor.line, secret: !!honor.secret,
    viewBox: '0 0 40 40', width: 240, height: 240,
    sha256: createHash('sha256').update(body).digest('hex'),
  };
});
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
    sky: motif.sky, ink: motif.ink, accent: motif.accent,
    // 调色板连同它的色相关系一起进总账：做周边、卡面、说明页时可以直接照抄这三色，
    // 也照抄它为什么成立。scheme 与 hueGap 都是现算的，不是手写的结论。
    palette: (() => { const p = palettes.find(x => x.id === motif.id) || {};
      return { scheme: p.scheme, hueGap: p.hueGap, hsl: p.hsl }; })(),
    viewBox: '0 0 390 844', width: 390, height: 844,
    sha256: createHash('sha256').update(body).digest('hex'),
  };
});
const manifestOutfits = outfits.map(item => {
  const file = path.posix.join('outfits', item.id + '.svg');
  const body = outputs.get(path.join(outputRoot, file));
  return {
    file, source: 'SHOP_ITEMS', id: item.id, name: item.name, slot: item.slot, tier: item.tier, line: item.line,
    cosmeticOnly: true,
    viewBox: '-9 -6 118 132', width: 118, height: 132,
    sha256: createHash('sha256').update(body).digest('hex'),
  };
});
const manifest = JSON.stringify({
  schema: 7,
  source: '../index.html',
  generator: 'monkey/tools/extract-assets.mjs',
  license: 'MYSKME original reusable asset',
  usage: '直接 <img src> 或内联；矢量无损缩放。要改造型请改 ../index.html 里的同名 symbol 再重跑导出器，不要手改这里。',
  palette,
  style: drawingStyle(),
  canon,
  assets: manifestAssets,
  facades: manifestFacades,
  honors: manifestHonors,
  teas: manifestTeas,
  worldWindows: manifestMotifs,
  outfits: manifestOutfits,
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
