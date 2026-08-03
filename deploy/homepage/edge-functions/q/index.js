/* /q/ 不带兑换码时回题库书架。与 [[default]].js 同一个去向常量，改的时候两处一起改。 */

const SHELF = 'https://myskme.com/banks/';

export default function onRequest() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: SHELF,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-MYSKME-Shortlink': 'q',
    },
  });
}
