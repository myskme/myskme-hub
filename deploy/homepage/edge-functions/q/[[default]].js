/* MYSKME · 题库短链 /q/<兑换码>
   卷子上印品牌短址（myskme.com/q/S2E5），由这里跳到当前真正的题库地址。

   为什么要这一层：纸是永久的，链接不是。题库页面将来可能搬到自有域名、换目录，
   而已经印出去的卷子改不了。有了这一跳，**只要改下面这一个常量，
   所有卷子上的码就继续有效**——以后不必再在「保旧链接」和「往前走」之间做取舍。

   ⚠ 改跳转目标时只改 GAME_BASE / SHELF，不要把新地址散落到别处。

   ⚠ 只用字符串拼接，不碰 URL.searchParams：初版用了 searchParams，
   在 EdgeOne 运行时直接 545（同样的代码在 Node 里五个用例全对）。
   隔壁网关函数从头到尾也只做字符串拼接，照着来最稳。 */

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
  // 兜底：这一跳是学生手里兑换码的唯一入口，宁可回书架也不能甩报错页给他们。
  try {
    const request = context && context.request;
    if (!request) return redirect(SHELF);

    const url = new URL(request.url);
    // /q/S2E5 → S2E5；/q/S2E5/ 或 /q/S2E5/xxx 也只取第一段
    const code = url.pathname.replace(/^\/q\/?/, '').split('/')[0].trim();

    if (!code || !CODE_RE.test(code)) return redirect(SHELF);
    return redirect(GAME_BASE + '?code=' + encodeURIComponent(code));
  } catch (_error) {
    return redirect(SHELF);
  }
}
