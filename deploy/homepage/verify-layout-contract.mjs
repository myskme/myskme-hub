import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const html = await readFile(path.join(root, 'index.html'), 'utf8');

const checks = [
  ['固定精品顺序', "var HOME_PRIORITY=['gemfall','zimingqi','monkey-upstairs','star-dungeon']"],
  ['每次进入主域回到精选第一屏', "var viewKey='home',viewPage=0,selectedKey='',query=''"],
  ['最近使用只补一个位置', 'recentKeys().some(function(k)'],
  ['手机紧凑断点', '@media (max-width:699px)'],
  ['平板分栏断点', '@media (min-width:700px) and (max-width:900px)'],
  ['手机横屏紧凑分栏', '@media (max-height:520px) and (min-width:700px) and (max-width:1000px)'],
  ['动态视口高度', 'height:100svh;height:100dvh'],
  ['刘海与圆角安全区', 'env(safe-area-inset-left)'],
  ['触控翻页尺寸', '.page-button{width:44px;height:44px'],
  ['详情图首屏高优先级', "loading=\"'+(eager?'eager':'lazy')+'\" fetchpriority=\"'+(eager?'high':'low')+'\""],
  ['首张详情图预加载', '<link rel="preload" as="image" href="assets/cover-gemfall.webp" fetchpriority="high">'],
];

const failures = checks.filter(([, token]) => !html.includes(token)).map(([label]) => label);
if (failures.length) {
  console.error(`主页布局契约缺失：${failures.join('、')}`);
  process.exit(1);
}

const priorityAt = html.indexOf("var HOME_PRIORITY=['gemfall','zimingqi','monkey-upstairs','star-dungeon']");
const recentAt = html.indexOf('recentKeys().some(function(k)');
if (priorityAt < 0 || recentAt < priorityAt) {
  console.error('主页排序契约异常：最近使用不能先于固定精品。');
  process.exit(1);
}

console.log(`主页布局契约：${checks.length + 1}/${checks.length + 1} 通过`);
