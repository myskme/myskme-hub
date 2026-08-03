import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const expectedIcon = await readFile(path.join(repoRoot, 'icons/app-icon-512.png'));
const expectedIconHash = createHash('sha256').update(expectedIcon).digest('hex');
const attempts = Number.parseInt(process.env.VERIFY_ATTEMPTS || '6', 10);
const delayMs = Number.parseInt(process.env.VERIFY_DELAY_MS || '5000', 10);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function get(url, redirect = 'manual') {
  const response = await fetch(url, {
    redirect,
    headers: {
      'cache-control': 'no-cache',
      'user-agent': 'MYSKME-homepage-release-check/1.0',
    },
    signal: AbortSignal.timeout(15000),
  });
  return response;
}

async function check(label, task) {
  await task();
  console.log(`PASS ${label}`);
}

async function verify() {
  const cacheBust = `release-check=${Date.now()}`;

  await check('myskme.com 主页返回 200 且身份正确', async () => {
    const response = await get(`https://myskme.com/?${cacheBust}`);
    const html = await response.text();
    assert(response.status === 200, `主页状态码 ${response.status}`);
    assert(html.includes('<title>狼先生与他的学生们 · 作品总目 | MYSKME</title>'), '主页标题不匹配');
    assert(html.includes('https://play.myskme.com/'), '主页缺少《灵石远征》正式入口');
  });

  await check('www 以 301 统一到主域', async () => {
    const response = await get('https://www.myskme.com/');
    assert(response.status === 301, `www 状态码 ${response.status}`);
    assert(response.headers.get('location') === 'https://myskme.com/',
      `www Location 为 ${response.headers.get('location') || '空'}`);
  });

  await check('Manifest 返回正确类型与主页图标', async () => {
    // EdgeOne 的 manifest Content-Type 自定义规则按原始路径匹配；查询串会绕开该规则。
    // 文件本身配置为 no-cache，因此这里保留正式 URL，并继续严格验证响应类型。
    const response = await get('https://myskme.com/manifest.webmanifest');
    const contentType = response.headers.get('content-type') || '';
    const manifest = await response.json();
    assert(response.status === 200, `Manifest 状态码 ${response.status}`);
    assert(contentType.startsWith('application/manifest+json'), `Manifest 类型 ${contentType}`);
    assert(manifest.short_name === 'MYSKME', `Manifest short_name 为 ${manifest.short_name}`);
    assert(Array.isArray(manifest.icons), 'Manifest icons 不是数组');
    assert(manifest.icons.some(icon => icon.src === 'icons/app-icon-512.png'),
      'Manifest 缺少 app-icon-512.png');
  });

  await check('线上 512 图标与仓库成品逐字节一致', async () => {
    const response = await get(`https://myskme.com/icons/app-icon-512.png?${cacheBust}`);
    const actual = Buffer.from(await response.arrayBuffer());
    const actualHash = createHash('sha256').update(actual).digest('hex');
    assert(response.status === 200, `图标状态码 ${response.status}`);
    assert(actualHash === expectedIconHash,
      `图标 SHA-256 不一致：线上 ${actualHash}；仓库 ${expectedIconHash}`);
  });

  await check('play.myskme.com 仍独立在线', async () => {
    const response = await get(`https://play.myskme.com/?${cacheBust}`);
    const html = await response.text();
    assert(response.status === 200, `游戏入口状态码 ${response.status}`);
    assert(html.includes('灵石远征'), '游戏入口标题或正文缺少“灵石远征”');
  });
}

let lastError;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    console.log(`MYSKME 主页线上验收：第 ${attempt}/${attempts} 次`);
    await verify();
    console.log(`PASS 全部线上验收；图标 SHA-256 ${expectedIconHash}`);
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.error(`FAIL 第 ${attempt}/${attempts} 次：${error.message}`);
    if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}

console.error(`线上验收最终失败：${lastError?.stack || lastError}`);
process.exit(1);
