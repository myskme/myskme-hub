// 民意传真科 · 今日对决的「每日配对」判定（唯一实现）
//
// 页面（vote/index.html）与报表（deploy/vote/report.mjs）都 import 这一份：
// 两边各写一份配对算法，迟早漂——漂了的后果是「页面投的是 A vs B，
// 报表却按 A vs C 结算」，票全被当垃圾丢掉。所以只许有这一份。
//
// 计票端（worker）拿不到这份代码也不需要：它对议题零知识，只按格式收票；
// 「今天到底该是谁对谁」由报表在结算时用本文件重算并校验，
// 不合本期配对的票会被报表如实丢弃并计入异常——防伪造靠算得出，不靠服务端记名单。
//
// 判定为什么用日期做种子：同一天里任何人、任何时区的服务器算出来的配对
// 必须一致，且不依赖任何网络请求。北京日（UTC+8）是全生态统一的口径。

// 北京日期键：YYYYMMDD。传 nowMs 进来而不是内部取 Date.now()，方便测试喂任意时刻。
export function beijingDayKey(nowMs) {
  const d = new Date(nowMs + 8 * 3600000);
  return String(d.getUTCFullYear())
    + String(d.getUTCMonth() + 1).padStart(2, '0')
    + String(d.getUTCDate()).padStart(2, '0');
}

// 第几期：以 2026-08-22（民意传真科开箱日）为第 1 期。
export function duelIssueNo(dayKey) {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(dayKey));
  if (!m) return 0;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Math.round((t - Date.UTC(2026, 7, 22)) / 86400000) + 1;
}

export function duelPollId(dayKey) { return 'daily-duel-' + dayKey; }

// 可复现伪随机：mulberry32。不能用 Math.random——两端各随机一次就不是同一场对决了。
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 当日对决双方：从角色 id 名单里定两位。名单先排序——调用方传来的顺序
// 不可靠（polls.json 的顺序改一次，历史配对就全变了），排序后才是稳定判据。
export function pairForDay(dayKey, optionIds) {
  const ids = [...optionIds].sort();
  if (ids.length < 2) return null;
  const rnd = mulberry32(Number(dayKey) >>> 0);
  const i = Math.floor(rnd() * ids.length);
  let j = Math.floor(rnd() * (ids.length - 1));
  if (j >= i) j += 1;
  return [ids[i], ids[j]];
}

// 当日问题：换着花样问，问题要对 39 位角色通用（光明学徒、黑域、中立都得问得通）。
export const DUEL_QUESTIONS = [
  '谁更适合当一天的驯猴办代理主任？',
  '深夜赶作业，你更想让谁来送一杯奶茶？',
  '组队远征只剩最后一个名额，你带谁？',
  '谁来讲今晚的睡前故事更好听？',
  '期末复习周，谁当你的同桌更靠谱？',
  '谁更可能把传真机修好——或者修得更坏？',
  '食堂只剩最后一份糖醋排骨，你愿意让给谁？',
  '谁当裁判，比赛会更精彩？',
  '你更想收到谁寄来的手写明信片？',
  '谁的日记更值得改编成电影？',
  '停电的晚自习，谁在场你更安心？',
  '谁去谈判桌上替大家争取双倍课间，更有胜算？',
  '猜谜大会，你押谁夺冠？',
  '谁染上绕口令停不下来的毛病会更好笑？',
  '谁开的小卖部你会天天光顾？',
  '运动会开幕式，谁举旗更有排面？',
  '你更想听谁讲一节公开课？',
  '郊游让谁当向导，更不容易迷路——或者迷得更精彩？',
  '传真科招募兼职接线员，你推荐谁？',
  '谁的生日会你一定不想错过？',
  '大扫除分工，谁跟你一组效率更高？',
  '谁更可能在图书馆里发现秘密通道？',
  '跨年晚会的压轴节目，交给谁？',
  '如果只能救一个人的手机电量，你救谁的？',
];
export function questionForDay(dayKey) {
  const rnd = mulberry32(((Number(dayKey) >>> 0) ^ 0x9e3779b9) >>> 0);
  return DUEL_QUESTIONS[Math.floor(rnd() * DUEL_QUESTIONS.length)];
}
