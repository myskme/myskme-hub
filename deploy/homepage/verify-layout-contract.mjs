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
  ['唯一浅色品牌主题', '<html lang="zh-CN" data-theme="light">'],
  ['浅色系统控件声明', '<meta name="color-scheme" content="light">'],
  ['现代界面字体', '--ui-sans:-apple-system,BlinkMacSystemFont'],
  ['手机详情保留电影感', ':root[data-theme="light"] .project-stage{background:#101114'],
  ['详情图首屏高优先级', "loading=\"'+(eager?'eager':'lazy')+'\" fetchpriority=\"'+(eager?'high':'low')+'\""],
  ['首张详情图预加载', '<link rel="preload" as="image" href="assets/cover-gemfall.webp" fetchpriority="high">'],
  ['课堂答题器主页卡片', '"key": "classroom-clicker"'],
  ['课堂答题器正式入口', 'https://myskme.com/classroom/'],
  ['课堂答题器旧存档回填', 'learning.items.unshift(clone(classroomClicker));'],
];

const failures = checks.filter(([, token]) => !html.includes(token)).map(([label]) => label);
if (failures.length) {
  console.error(`主页布局契约缺失：${failures.join('、')}`);
  process.exit(1);
}

const forbiddenChecks = [
  ['主题切换按钮', 'id="themeBtn"'],
  ['旧主题偏好存储', 'myskme-theme'],
  ['系统深色主题分支', 'prefers-color-scheme: dark'],
  ['旧主题初始化调用', 'applyTheme('],
];
const forbidden = forbiddenChecks.filter(([, token]) => html.includes(token)).map(([label]) => label);
if (forbidden.length) {
  console.error(`主页唯一浅色契约发现旧分支：${forbidden.join('、')}`);
  process.exit(1);
}

const priorityAt = html.indexOf("var HOME_PRIORITY=['gemfall','zimingqi','monkey-upstairs','star-dungeon']");
const recentAt = html.indexOf('recentKeys().some(function(k)');
if (priorityAt < 0 || recentAt < priorityAt) {
  console.error('主页排序契约异常：最近使用不能先于固定精品。');
  process.exit(1);
}

console.log(`主页布局契约：${checks.length + forbiddenChecks.length + 1}/${checks.length + forbiddenChecks.length + 1} 通过`);
