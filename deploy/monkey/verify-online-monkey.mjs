const attempts = Number.parseInt(process.env.VERIFY_ATTEMPTS || '12', 10);
const delayMs = Number.parseInt(process.env.VERIFY_DELAY_MS || '5000', 10);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function verify() {
  const stamp=Date.now();
  const response = await fetch('https://monkey.myskme.com/?release-check=' + stamp, {
    headers: { 'cache-control': 'no-cache', 'user-agent': 'MYSKME-monkey-release-check/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  const html = await response.text();
  assert(response.status === 200, '首页状态码 ' + response.status);
  assert(html.includes('<title>是猴就上100层 · MYSKME</title>'), '线上标题不匹配');
  assert(html.includes('https://monkey.myskme.com/'), '线上正式域名元数据缺失');
  assert(html.includes('fill="#e3ad32"'), '线上鱼小姐暖金主色不匹配');
  assert(html.includes('20260812.7-monkey-surprise-share-cool'), '线上仍是惊喜海报省电版之前旧版本');
  assert(html.includes('id="monkeyUse"'), '线上缺少完整主猴渲染节点');
  assert(!html.includes("translate(100 0) scale(-1 1)"), '线上仍含会把猴子推出画面的 SVG use 镜像');
  assert(html.includes('function repairPlayerState(now)'), '线上猴子可见性看门狗缺失');
  assert(html.includes('function startMusic()'), '线上自适应音乐引擎缺失');
  assert(html.includes("const TOOL_POOL=['magnet','clip','waiver','rocket','wide']"), '线上帮助道具池不完整');
  assert(html.includes('const MISSIONS=['), '线上轮值任务系统缺失');
  assert(html.includes("const PARTY_KEY='myskme_monkey_party_v1'"), '线上多人比赛保存缺失');
  assert(html.includes('function buildPoster()') && html.includes('function syncViewportMode()'), '线上海报或安卓宽视口修复缺失');
  assert(html.includes('const SURPRISES=[') && html.includes('MUSIC_TICK_MS=70'), '线上惊喜池或省电音频调度缺失');
  const manifestResponse=await fetch('https://monkey.myskme.com/manifest.webmanifest?release-check='+stamp,{signal:AbortSignal.timeout(15000)});
  const manifest=await manifestResponse.json();assert(manifestResponse.status===200&&manifest.name==='是猴就上100层','线上 PWA 清单不匹配');
  const iconResponse=await fetch('https://monkey.myskme.com/icons/monkey-100-192.png?release-check='+stamp,{signal:AbortSignal.timeout(15000)});const icon=await iconResponse.arrayBuffer();assert(iconResponse.status===200&&icon.byteLength>1000,'线上桌面图标缺失');
  const qrResponse=await fetch('https://monkey.myskme.com/vendor/qrcode-generator.js?release-check='+stamp,{signal:AbortSignal.timeout(15000)});const qr=await qrResponse.text();assert(qrResponse.status===200&&qr.includes('QR Code Generator for JavaScript')&&qr.length>50000,'线上本地二维码模块缺失');
  const swResponse=await fetch('https://monkey.myskme.com/sw.js?release-check='+stamp,{signal:AbortSignal.timeout(15000)});const sw=await swResponse.text();assert(swResponse.status===200&&sw.includes('myskme-monkey-20260812-7'),'线上离线缓存脚本不匹配');
  assert(!/<script\s+[^>]*src=["']https?:/i.test(html), '线上页面出现外部脚本');
  assert(!/<link\s+[^>]*rel=["']stylesheet/i.test(html), '线上页面出现外部样式');
}

let lastError;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    console.log('是猴就上100层线上验收：第 ' + attempt + '/' + attempts + ' 次');
    await verify();
    console.log('PASS https://monkey.myskme.com/');
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.error('FAIL ' + error.message);
    if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}
console.error(lastError?.stack || lastError);
process.exit(1);
