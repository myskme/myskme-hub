import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const exportsList = [
  ['monkey-rise.svg', 'art-monkey-rise'],
  ['monkey-fall.svg', 'art-monkey-fall'],
  ['monkey-land.svg', 'art-monkey-land'],
  ['fish.svg', 'art-fish'],   // 曾叫 fish-gold.svg；鱼小姐 0812 按 canon 改回青绿，文件名不再带颜色，免得下次换色又变成骗人的名字
  ['donkey.svg', 'art-donkey'],
  ['egg.svg', 'art-egg'],
  ['snake.svg', 'art-snake'],
  ['fertilizer.svg', 'art-fertilizer'],
  ['banana.svg', 'art-banana'],
  ['crate.svg', 'art-crate'],
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

const outputs = new Map(exportsList.map(([file, id]) => [path.join(outputRoot, file), standalone(id)]));
outputs.set(path.join(repoRoot, 'assets', 'cover-monkey-upstairs.svg'), cover());
const manifestAssets = [];
for (const [file, id] of exportsList) {
  const body = outputs.get(path.join(outputRoot, file));
  manifestAssets.push({ file, symbol: id, sha256: createHash('sha256').update(body).digest('hex') });
}
const manifest = JSON.stringify({
  schema: 1,
  source: '../index.html',
  license: 'MYSKME original reusable asset',
  palette: { paper: '#faf3e2', ink: '#28211a', teal: '#1f9e8e', fish: '#3fab84', fishFin: '#6cd0af', banana: '#f5b731', red: '#e0452c' },
  assets: manifestAssets,
}, null, 2) + '\n';
outputs.set(path.join(outputRoot, 'asset-manifest.json'), manifest);

await mkdir(outputRoot, { recursive: true });
for (const [target, expected] of outputs) {
  if (checkOnly) {
    let actual = '';
    try { actual = await readFile(target, 'utf8'); } catch {}
    if (actual !== expected) throw new Error('可复用资源未同步：' + path.relative(repoRoot, target));
  } else {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, expected);
  }
}
console.log((checkOnly ? 'PASS 已同步：' : '已导出：') + outputs.size + ' 个可复用资源');
