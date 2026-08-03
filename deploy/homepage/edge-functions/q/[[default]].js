/* MYSKME · 题库短链 /q/<兑换码>
   卷子上印品牌短址（myskme.com/q/S2E5），由这里跳到当前真正的题库地址。

   为什么要这一层：纸是永久的，链接不是。作品页面将来可能搬到自有域名、换目录，
   而已经印出去的卷子改不了。有了这一跳，**只要改下面这一个常量，
   所有卷子上的码就继续有效**——以后不必再在「保旧链接」和「往前走」之间做取舍。

   ⚠ 改跳转目标时只改 GAME_BASE / SHELF，不要把新地址散落到别处。 */

const GAME_BASE = 'https://myskme.github.io/myskme-quiz/word-duel.html';
const SHELF = 'https://myskme.com/banks/';

// 兑换码形如 S2E5 / SP4M / 20260803A。限定字符集，顺便挡掉开放跳转与路径注入。
const CODE_RE = /^[A-Za-z0-9_-]{1,32}$/;

function redirect(location) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-MYSKME-Shortlink': 'q',
    },
  });
}

export default function onRequest(context) {
  const request = context && context.request;
  if (!request) return redirect(SHELF);

  const url = new URL(request.url);
  // /q/S2E5 → S2E5；/q/S2E5/ 或 /q/S2E5/xxx 也只取第一段
  const raw = url.pathname.replace(/^\/q\/?/, '').split('/')[0].trim();

  // 没给码或码不合法：回题库书架让人自己找，而不是甩一个 404 给学生
  if (!raw || !CODE_RE.test(raw)) return redirect(SHELF);

  const target = new URL(GAME_BASE);
  target.searchParams.set('code', raw);
  // 保留卷子上可能额外带的参数（如 ?from=paper），但不允许覆盖 code
  for (const [key, value] of url.searchParams) {
    if (key !== 'code') target.searchParams.set(key, value);
  }

  return redirect(target.toString());
}
