/* 灵石远征 · 网络入口配置
   正式入口统一走 play.myskme.com/api：网页为同源请求，GitHub Pages、iOS 等
   跨端包也复用同一个品牌地址。EdgeOne 只转发到现有 Worker，同一份 D1 仍是
   唯一权威数据源；不再让客户端绕过品牌入口直连 workers.dev。 */
(function (root) {
  'use strict';
  const existing = root.MYSKME_GEMFALL_NETWORK || {};
  root.MYSKME_GEMFALL_NETWORK = Object.assign({
    /* 对外分享一律用品牌域名，不用 location.origin：
       网页玩家基本在国内，从 GitHub Pages 打开的人分享出去的
       github.io 链接在群里点不开，等于把传播链掐断在第一环。 */
    shareUrl: 'https://play.myskme.com/',
    apiBases: ['https://play.myskme.com/api'],
    sameOriginApi: true,
    sameOriginPath: '/api',
    legacyFallback: false,
    probeTimeoutMs: 4500,
    endpointHintMs: 30 * 60 * 1000,
    serviceWorker: true,
  }, existing);
})(window);
