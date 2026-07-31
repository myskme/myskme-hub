#!/usr/bin/env node

import { loadGemfall } from './headless-runtime.mjs';

try {
  const runtime = await loadGemfall();
  const result = runtime.window.__selftest();

  for (const line of result.lines) console.log(line);
  console.log('');
  console.log(`自检汇总：${result.total - result.failed}/${result.total} 项通过`);

  if (result.total !== 48) {
    console.error(`FAIL 自检数量异常：期望 48 项，实际 ${result.total} 项`);
    process.exitCode = 1;
  } else if (result.failed > 0) {
    console.error(`FAIL 共有 ${result.failed} 项未通过`);
    process.exitCode = 1;
  } else {
    console.log('PASS 全部 48 项通过');
  }
} catch (error) {
  console.error(`FAIL 无头自检无法运行：${error.stack || error.message}`);
  process.exitCode = 1;
}
