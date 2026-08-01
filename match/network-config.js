/* 灵石远征 · 网络入口配置
   当前线上保持旧 Worker，不改变已有玩家。香港主站与 /api 反向代理上线后：
     1. 把 sameOriginApi 改成 true；或
     2. 把 https://api.<你的域名> 放进 apiBases。
   游戏本体不再需要跟着域名迁移反复修改。 */
(function (root) {
  'use strict';
  const existing = root.MYSKME_GEMFALL_NETWORK || {};
  root.MYSKME_GEMFALL_NETWORK = Object.assign({
    apiBases: [],
    sameOriginApi: false,
    sameOriginPath: '/api',
    legacyFallback: 'https://myskme-leaderboard.wzc1020.workers.dev',
    probeTimeoutMs: 4500,
    endpointHintMs: 30 * 60 * 1000,
    serviceWorker: true,
  }, existing);
})(window);
