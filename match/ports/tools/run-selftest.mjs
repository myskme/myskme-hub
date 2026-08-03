#!/usr/bin/env node

import { loadGemfall } from './headless-runtime.mjs';

try {
  const runtime = await loadGemfall();
  const result = runtime.window.__selftest();

  for (const line of result.lines) console.log(line);
  console.log('');
  console.log(`自检汇总：${result.total - result.failed}/${result.total} 项通过`);

  /* 这道守卫防的是「自检被偷偷删掉/跳过」，所以看的是**下限**不是等号。
     原本写死 === 48，结果新增自检反而让 CI 变红（50 项全过却 exit 1）——
     把「加测试」变成一件要先改 CI 的麻烦事，久了就没人加了。
     加测试时把 MIN 往上调；**永远不要往下调**，往下调就等于把这道守卫关掉。 */
  const MIN_SELFTESTS = 50;
  if (result.total < MIN_SELFTESTS) {
    console.error(`FAIL 自检数量少于下限：至少 ${MIN_SELFTESTS} 项，实际 ${result.total} 项`);
    console.error('（自检只应增加不应减少。真要删，请连同本文件的 MIN_SELFTESTS 一起说明理由。）');
    process.exitCode = 1;
  } else if (result.failed > 0) {
    console.error(`FAIL 共有 ${result.failed} 项未通过`);
    process.exitCode = 1;
  } else {
    console.log(`PASS 全部 ${result.total} 项通过`);
  }
} catch (error) {
  console.error(`FAIL 无头自检无法运行：${error.stack || error.message}`);
  process.exitCode = 1;
}
