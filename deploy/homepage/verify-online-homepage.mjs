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
    assert(html.includes('https://myskme.com/classroom/'), '主页缺少课堂答题器正式入口');
  });

  await check('课堂答题器返回 200 且离线门禁就位', async () => {
    const response = await get(`https://myskme.com/classroom/?${cacheBust}`);
    const html = await response.text();
    assert(response.status === 200, `课堂答题器状态码 ${response.status}`);
    assert(html.includes('<title>驯猴办 · 课堂点名器</title>'), '课堂答题器标题不匹配');
    assert(html.includes("default-src 'none'"), '课堂答题器缺少零联网 CSP');
    assert(html.includes('QA 总结'), '课堂答题器缺少自检入口');
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

  await check('品牌 API 网关在 myskme.com 上就位', async () => {
    const response = await get('https://myskme.com/api/');
    assert(response.status === 200,
      `网关健康检查状态码 ${response.status}；若为 404，通常是该 EdgeOne 项目没有启用边缘函数，`
      + '此时 play.myskme.com 上的旧网关仍在服务，作品不会中断');
    const body = await response.json();
    assert(body.ok === true && body.service === 'myskme-edge-gateway',
      `网关健康检查内容不符：${JSON.stringify(body)}`);
  });

  await check('网关预检带 CORS 且缓存一天', async () => {
    // OPTIONS 预检是浏览器跨域前自己就会发的那一发，不写入任何榜单数据。
    // 缺了 Max-Age，弱网下每次提交成绩都要多跑一次询问——这是搬网关前的老毛病。
    const response = await fetch('https://myskme.com/api/quiz/submit', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://myskme.com',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
      signal: AbortSignal.timeout(15000),
    });
    assert(response.status === 204, `预检状态码 ${response.status}`);
    assert(response.headers.get('access-control-allow-origin') === '*',
      `预检 Allow-Origin 为 ${response.headers.get('access-control-allow-origin') || '空'}`);
    assert(response.headers.get('access-control-max-age') === '86400',
      `预检 Max-Age 为 ${response.headers.get('access-control-max-age') || '空'}`);
  });

  await check('题库等公开 JSON 允许跨域读取', async () => {
    // 各作品页面还在 myskme.github.io 上，要拉 myskme.com 的题库书架就是跨域请求。
    // 少了这个头，浏览器会静默拦掉——学生那边表现为书架空白，且控制台之外看不出原因。
    // ⚠ 这里**不能加防缓存查询串**：EdgeOne 的自定义响应头规则按原始路径匹配，
    // 带查询串会绕开规则，头就不会下发（实测带查询串 0 个 Allow-Origin、不带 1 个），
    // 于是检查会误判成配置没生效。/banks/*.json 本来就配了 no-cache，不需要查询串。
    // 同一个坑上面 Manifest 那条检查也踩过，注释里已有记载。
    const response = await get('https://myskme.com/banks/index.json');
    assert(response.status === 200, `题库目录状态码 ${response.status}`);
    assert(response.headers.get('access-control-allow-origin') === '*',
      `题库目录 Allow-Origin 为 ${response.headers.get('access-control-allow-origin') || '空'}`);
  });

  await check('题库短链 /q/<兑换码> 正确跳转', async () => {
    // 卷子上印的是品牌短址，这一跳断了等于学生手里的码全部作废——必须每次发布都确认。
    const response = await get('https://myskme.com/q/S2E5');
    assert(response.status === 302, `短链状态码 ${response.status}`);
    const location = response.headers.get('location') || '';
    assert(location.includes('word-duel.html'), `短链去向异常：${location || '空'}`);
    assert(location.includes('code=S2E5'), `短链没带上兑换码：${location}`);
  });

  await check('题库短链不带码时回书架', async () => {
    const response = await get('https://myskme.com/q/');
    assert(response.status === 302, `无码短链状态码 ${response.status}`);
    assert((response.headers.get('location') || '').includes('/banks/'),
      `无码短链去向异常：${response.headers.get('location') || '空'}`);
  });

  await check('网关源码不会被当静态文件公开', async () => {
    // EdgeOne 把 edge-functions/ 当特殊目录、不作静态内容下发。这里固化成常驻检查：
    // 一旦哪天能读到源码，上游 Worker 地址（含邮箱前缀）就会重新暴露在公网上。
    const response = await get(`https://myskme.com/edge-functions/api/index.js?${cacheBust}`);
    assert(response.status === 404,
      `边缘函数源码返回 ${response.status}，应为 404；能读到源码意味着上游 Worker 地址已公开，需立即处理`);
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
