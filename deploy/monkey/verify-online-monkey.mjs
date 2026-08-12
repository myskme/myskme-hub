const attempts = Number.parseInt(process.env.VERIFY_ATTEMPTS || '12', 10);
const delayMs = Number.parseInt(process.env.VERIFY_DELAY_MS || '5000', 10);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function verify() {
  const response = await fetch('https://monkey.myskme.com/?release-check=' + Date.now(), {
    headers: { 'cache-control': 'no-cache', 'user-agent': 'MYSKME-monkey-release-check/1.0' },
    signal: AbortSignal.timeout(15000),
  });
  const html = await response.text();
  assert(response.status === 200, '首页状态码 ' + response.status);
  assert(html.includes('<title>猴先生上楼 · MYSKME</title>'), '线上标题不匹配');
  assert(html.includes('https://monkey.myskme.com/'), '线上正式域名元数据缺失');
  assert(html.includes('fill="#e3ad32"'), '线上鱼小姐暖金主色不匹配');
  assert(!/<script\s+[^>]*src=/i.test(html), '线上页面出现外部脚本');
  assert(!/<link\s+[^>]*rel=["']stylesheet/i.test(html), '线上页面出现外部样式');
}

let lastError;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    console.log('猴先生上楼线上验收：第 ' + attempt + '/' + attempts + ' 次');
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
