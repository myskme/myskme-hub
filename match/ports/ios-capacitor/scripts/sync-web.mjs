import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const iosRoot = path.resolve(here, '..');
const repoRoot = path.resolve(here, '../../../..');
const source = path.join(repoRoot, 'match');
const target = path.join(iosRoot, 'www');

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });

await Promise.all([
  cp(path.join(source, 'art'), path.join(target, 'art'), { recursive: true }),
  cp(path.join(source, 'audio'), path.join(target, 'audio'), { recursive: true }),
  cp(path.join(source, 'icons'), path.join(target, 'icons'), { recursive: true }),
  cp(path.join(source, 'manifest.json'), path.join(target, 'manifest.json')),
  cp(path.join(iosRoot, 'native-bridge.js'), path.join(target, 'native-bridge.js')),
]);

const indexPath = path.join(source, 'index.html');
let html = await readFile(indexPath, 'utf8');

const nativeStyle = [
  '<!-- GEMFALL_NATIVE_PATCH_START -->',
  '<style>',
  '#chip-home,.lore-link{display:none!important}',
  '</style>',
  '<!-- GEMFALL_NATIVE_PATCH_END -->',
].join('\n');

if (!html.includes('GEMFALL_NATIVE_PATCH_START')) {
  html = html.replace('</head>', `${nativeStyle}\n</head>`);
}
if (!html.includes('src="./native-bridge.js"')) {
  html = html.replace('</body>', '<script src="./native-bridge.js"></script>\n</body>');
}

await writeFile(path.join(target, 'index.html'), html);

const copied = [
  'index.html',
  'manifest.json',
  'native-bridge.js',
  'art/',
  'audio/',
  'icons/',
];
console.log(`Synced ${copied.join(', ')} to ${path.relative(repoRoot, target)}`);
