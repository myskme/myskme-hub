import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const output = path.resolve(here, '../shared/resource-catalog.json');

const roots = [
  'match/art',
  'match/audio',
  'match/icons',
];
const singles = [
  'assets/cover-gemfall.webp',
  'assets/og-gemfall.png',
];

function readPngMeta(buffer) {
  if (buffer.length < 26 || buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  const colorType = buffer[25];
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    alpha: colorType === 4 || colorType === 6,
  };
}

function readWebpMeta(buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' ||
      buffer.toString('ascii', 8, 12) !== 'WEBP') return null;

  let offset = 12;
  let width = null;
  let height = null;
  let alpha = buffer.includes(Buffer.from('ALPH'));

  while (offset + 8 <= buffer.length) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (type === 'VP8X' && data + 10 <= buffer.length) {
      alpha ||= Boolean(buffer[data] & 0x10);
      width = 1 + buffer.readUIntLE(data + 4, 3);
      height = 1 + buffer.readUIntLE(data + 7, 3);
      break;
    }
    if (type === 'VP8 ' && data + 10 <= buffer.length &&
        buffer[data + 3] === 0x9d && buffer[data + 4] === 0x01 && buffer[data + 5] === 0x2a) {
      width = buffer.readUInt16LE(data + 6) & 0x3fff;
      height = buffer.readUInt16LE(data + 8) & 0x3fff;
      break;
    }
    if (type === 'VP8L' && data + 5 <= buffer.length && buffer[data] === 0x2f) {
      const bits = buffer.readUInt32LE(data + 1);
      width = 1 + (bits & 0x3fff);
      height = 1 + ((bits >> 14) & 0x3fff);
      alpha = true;
      break;
    }
    offset = data + length + (length % 2);
  }
  return width && height ? { width, height, alpha } : null;
}

function categoryFor(file) {
  const name = path.basename(file);
  if (file.startsWith('match/audio/')) return name.startsWith('LICENSE') ? 'license' : 'audio';
  if (file.startsWith('match/icons/')) return name.startsWith('splash-') ? 'splash' : 'icon';
  if (file.startsWith('assets/')) return name.startsWith('og-') ? 'social-card' : 'cover';
  if (/^ally-/.test(name)) return 'ally';
  if (/^boss-/.test(name)) return 'boss';
  if (/^gem-/.test(name)) return 'gem';
  if (/^ob-/.test(name)) return 'obstacle';
  if (/^chapter-/.test(name)) return 'chapter';
  if (/^card-/.test(name)) return 'collection-card';
  if (/^box-/.test(name)) return 'collection-box';
  if (['win.webp', 'lose.webp'].includes(name)) return 'result-banner';
  if (['party-banner.webp', 'lb-banner.webp'].includes(name)) return 'mode-banner';
  if (['lamp.webp', 'chest.webp'].includes(name)) return 'retention-object';
  if (name === 'hero.webp') return 'hero';
  if (name === 'cat.webp') return 'easter-egg';
  return 'art';
}

function platformsFor(file, category) {
  if (category === 'audio' || category === 'license') return ['web', 'ios'];
  if (file.startsWith('match/icons/')) return ['web', 'ios'];
  if (file.startsWith('assets/')) return ['web', 'catalog'];
  return ['web', 'ios', 'wechat'];
}

async function collectFiles() {
  const files = [...singles];
  for (const root of roots) {
    const names = await readdir(path.join(repoRoot, root));
    for (const name of names) files.push(path.posix.join(root, name));
  }
  return files.sort();
}

const files = await collectFiles();
const assets = [];

for (const relative of files) {
  const absolute = path.join(repoRoot, relative);
  const info = await stat(absolute);
  if (!info.isFile()) continue;
  const buffer = await readFile(absolute);
  const ext = path.extname(relative).toLowerCase();
  const image = ext === '.png' ? readPngMeta(buffer) : ext === '.webp' ? readWebpMeta(buffer) : null;
  const category = categoryFor(relative);
  assets.push({
    path: relative,
    bytes: info.size,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    ...(image || {}),
    category,
    platforms: platformsFor(relative, category),
  });
}

const totals = assets.reduce((out, asset) => {
  out.files += 1;
  out.bytes += asset.bytes;
  out.byCategory[asset.category] = (out.byCategory[asset.category] || 0) + 1;
  return out;
}, { files: 0, bytes: 0, byCategory: {} });

const catalog = {
  schemaVersion: 1,
  project: 'MYSKME · 灵石远征 · GEMFALL',
  generatedAt: new Date().toISOString(),
  sourceOfTruth: ['match/art', 'match/audio', 'match/icons', 'assets/cover-gemfall.webp', 'assets/og-gemfall.png'],
  totals,
  assets,
};

await writeFile(output, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Wrote ${path.relative(repoRoot, output)} (${totals.files} files, ${totals.bytes} bytes)`);
