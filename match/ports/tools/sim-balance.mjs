#!/usr/bin/env node

import { loadGemfall } from './headless-runtime.mjs';

/*
 * 重要：这里的贪心机器人只会拿 findMove() 返回的第一步，不用灵器、不主动放大招，
 * 也不会为炼成特殊灵石规划后续。因此绝对通关率和绝对充能值不能当玩家数据；
 * 有意义的是各关之间的相对形状，以及六位同伴有没有明显掉队。
 */

const DEFAULT_LEVELS = [1, 8, 16, 24, 32, 40, 48, 56, 64];
const DEFAULT_CHARGE_LEVELS = Array.from({ length: 64 }, (_unused, index) => index + 1);

function parsePositiveInt(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} 必须是正整数`);
  return parsed;
}

function parseLevels(value) {
  const levels = String(value)
    .split(',')
    .map(item => Number.parseInt(item.trim(), 10))
    .filter(Number.isInteger);
  if (levels.length === 0 || levels.some(level => level < 1 || level > 100)) {
    throw new Error('--levels 需要逗号分隔的 1–100 关卡号');
  }
  return [...new Set(levels)];
}

function parseArgs(argv) {
  const options = {
    runs: 30,
    chargeRuns: 64,
    moves: null,
    chargeMoves: 10,
    levels: DEFAULT_LEVELS,
    chargeLevels: DEFAULT_CHARGE_LEVELS,
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--runs') {
      options.runs = parsePositiveInt(next, '--runs');
      index++;
    } else if (arg === '--charge-runs') {
      options.chargeRuns = parsePositiveInt(next, '--charge-runs');
      index++;
    } else if (arg === '--moves') {
      options.moves = parsePositiveInt(next, '--moves');
      index++;
    } else if (arg === '--charge-moves') {
      options.chargeMoves = parsePositiveInt(next, '--charge-moves');
      index++;
    } else if (arg === '--levels') {
      options.levels = parseLevels(next);
      index++;
    } else if (arg === '--charge-levels') {
      options.chargeLevels = parseLevels(next);
      index++;
    } else if (arg === '--quick') {
      options.runs = 6;
      options.chargeRuns = 12;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`用法：
  node match/ports/tools/sim-balance.mjs [选项]

选项：
  --runs N                 每个关卡跑 N 局（默认 30）
  --charge-runs N          每位同伴跑 N 局（默认 64）
  --moves N                限制通关率模拟的最大手数（默认用关卡完整步数）
  --charge-moves N         充能标准化贪心局手数（默认 10）
  --levels 1,8,16          指定通关率关卡
  --charge-levels 7,15,23  指定充能采样关卡
  --quick                  快速烟测（6 局 / 12 局）
`);
      process.exit(0);
    } else {
      throw new Error(`不认识的参数：${arg}`);
    }
  }
  return options;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function fixed(value, digits = 2) {
  return Number(value).toFixed(digits);
}

function installBalanceBridge(runtime) {
  runtime.run(`
    (() => {
      const originalClearCells = clearCells;
      const originalAllyCharge = allyCharge;
      let activeStats = null;

      clearCells = function(...args) {
        const result = originalClearCells(...args);
        if (activeStats) {
          activeStats.gems += result.gems;
          activeStats.specialsCleared += result.specials;
          for (const key in result.colors)
            activeStats.colors[key] = (activeStats.colors[key] || 0) + result.colors[key];
        }
        return result;
      };

      allyCharge = function(amount) {
        if (activeStats && Number.isFinite(amount) && amount > 0) activeStats.charge += amount;
        return originalAllyCharge(amount);
      };

      const goalProgress = () => {
        if (!GS.goals.length) return 0;
        return GS.goals.reduce((sum, goal) =>
          sum + Math.min(1, goal.need > 0 ? goal.got / goal.need : 1), 0) / GS.goals.length;
      };

      window.__headlessBalance = {
        companions: COMPANIONS.map(companion => ({
          id: companion.id,
          name: companion.name,
          title: companion.title,
          need: companion.need,
          color: companion.col,
        })),

        async playLevel(levelNumber, runNumber, companionId, moveBudget) {
          const level = levelDef(levelNumber);
          const companion = compById(companionId || 'wolf');
          const stats = { gems: 0, colors: {}, specialsCleared: 0, charge: 0 };
          activeStats = stats;

          GS.mode = 'adv';
          GS.L = level;
          GS.party = false;
          GS.weekly = false;
          GS.rushOn = false;
          GS.over = false;
          GS.busy = true;
          GS.won = false;
          GS.paused = false;
          GS.epoch = (GS.epoch || 0) + 1;
          GS.chainMax = 0;
          GS.specials = 0;
          GS.score = 0;
          GS.compDef = companion;
          GS.charge = 0;
          GS.boss = level.boss || null;
          GS.hp = level.bossHP || 0;
          GS.hpMax = level.bossHP || 0;
          GS.bossTick = 0;

          /* 六位同伴必须走同一批初盘与补落随机流，否则比较的是六套运气，不是充能公式。 */
          buildBoard(level, 'balance-board-' + levelNumber + '-' + runNumber);
          GS.goals = level.goals.map(goal => Object.assign({}, goal, { got: 0 }));
          /* 与 2026-07-31 实测保持同口径：直接驱动纯逻辑引擎。
             不走 openLevel/trySwap，因而不带开局被动、灵器、大招、Boss 反击和结算烟花。
             充能批次由调用方固定手数；通关率批次默认使用关卡完整步数。
             这正是“绝对值不是玩家数据”的原因，也是六人横向比较能保持可解释的前提。 */
          GS.moves = moveBudget == null ? level.moves : Math.min(level.moves, moveBudget);
          ENG.rng = rngOf('balance-play-' + levelNumber + '-' + runNumber);
          GS.busy = false;

          const initialMoves = GS.moves;
          let guard = Math.max(80, initialMoves * 4);
          while (GS.moves > 0 && !goalsMet() && guard-- > 0) {
            let move = findMove();
            if (!move) {
              if (!shuffleBoard()) buildBoard(GS.L, 'balance-rebuild-' + levelNumber + '-' + runNumber + '-' + guard);
              move = findMove();
              if (!move) break;
            }
            swapPieces(move[0], move[1]);
            ENG.lastMove = [move[0], move[1]];
            GS.moves--;
            await settleBoard(0);
            ENG.lastMove = null;
            if (!anyMove() && !shuffleBoard())
              buildBoard(GS.L, 'balance-rebuild-' + levelNumber + '-' + runNumber + '-' + guard);
          }

          const won = goalsMet();
          const result = {
            level: levelNumber,
            won,
            progress: goalProgress(),
            movesUsed: initialMoves - GS.moves,
            movesLeft: GS.moves,
            totalColors: level.colors,
            gems: stats.gems,
            colors: Object.assign({}, stats.colors),
            specialsCleared: stats.specialsCleared,
            charge: stats.charge,
            chargeEquivalent: stats.charge / companion.need,
            chainMax: GS.chainMax,
          };

          activeStats = null;
          ENG.rng = null;
          GS.over = true;
          GS.busy = true;
          return result;
        },

        restore() {
          clearCells = originalClearCells;
          allyCharge = originalAllyCharge;
          activeStats = null;
        },
      };
    })();
  `, 'gemfall-balance-bridge.mjs');
  return runtime.window.__headlessBalance;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const runtime = await loadGemfall({ randomSeed: 'gemfall-balance-cli-v1' });
  const balance = installBalanceBridge(runtime);

  console.log('灵石远征 · 无头平衡模拟');
  console.log('注意：贪心机器人只走 findMove() 第一解，不用灵器、不主动放大招，也不规划特殊灵石。');
  console.log('绝对值不是玩家数据；只看关卡间相对形状与六位同伴是否齐平。');
  console.log('');
  const levelMoveLabel = options.moves == null ? '使用各关完整步数' : `每局最多 ${options.moves} 手`;
  console.log(`纯逻辑口径：不含开局被动、灵器、大招、Boss 反击与结算烟花。`);
  console.log(`关卡通关率：${options.levels.join(', ')}；每关 ${options.runs} 局；${levelMoveLabel}`);

  const levelRows = [];
  for (const level of options.levels) {
    const games = [];
    for (let runNumber = 1; runNumber <= options.runs; runNumber++) {
      games.push(await balance.playLevel(level, runNumber, 'wolf', options.moves));
    }
    const wins = games.filter(game => game.won);
    const failures = games.filter(game => !game.won);
    levelRows.push({
      level,
      wins: wins.length,
      passRate: wins.length / games.length,
      failureProgress: failures.length ? mean(failures.map(game => game.progress)) : 1,
      gems: mean(games.map(game => game.gems)),
      moves: mean(games.map(game => game.movesUsed)),
    });
  }

  console.log('关卡  通关         通关率   失败局平均目标完成度   平均消除   平均用步');
  for (const row of levelRows) {
    console.log(
      `${String(row.level).padStart(4)}  ` +
      `${`${row.wins}/${options.runs}`.padStart(9)}  ` +
      `${percent(row.passRate).padStart(7)}   ` +
      `${percent(row.failureProgress).padStart(18)}   ` +
      `${fixed(row.gems, 1).padStart(8)}   ` +
      `${fixed(row.moves, 1).padStart(8)}`,
    );
  }

  console.log('');
  const chargeLevelLabel = options.chargeLevels.length === 64
    && options.chargeLevels.every((level, index) => level === index + 1)
    ? '1–64 全关卡'
    : options.chargeLevels.join(', ');
  console.log(`同伴充能：采样关卡 ${chargeLevelLabel}；每位 ${options.chargeRuns} 局；每局标准化 ${options.chargeMoves} 手`);
  console.log('“等效大招/局” = 本局累计充能 ÷ 该同伴充能门槛；模拟器不会真的施放大招。');

  const companionRows = [];
  const allChargeGames = [];
  for (const companion of balance.companions) {
    const games = [];
    for (let runNumber = 1; runNumber <= options.chargeRuns; runNumber++) {
      const level = options.chargeLevels[(runNumber - 1) % options.chargeLevels.length];
      games.push(await balance.playLevel(level, runNumber, companion.id, options.chargeMoves));
    }
    allChargeGames.push(...games);
    companionRows.push({
      ...companion,
      equivalent: mean(games.map(game => game.chargeEquivalent)),
      charge: mean(games.map(game => game.charge)),
      gems: mean(games.map(game => game.gems)),
    });
  }

  console.log('同伴       门槛   平均充能   等效大招/局   平均消除');
  for (const row of companionRows) {
    console.log(
      `${`${row.name}·${row.title}`.padEnd(10)} ` +
      `${String(row.need).padStart(4)}   ` +
      `${fixed(row.charge, 2).padStart(8)}   ` +
      `${fixed(row.equivalent, 3).padStart(11)}   ` +
      `${fixed(row.gems, 1).padStart(8)}`,
    );
  }

  const totalGems = mean(allChargeGames.map(game => game.gems));
  const perColor = mean(allChargeGames.flatMap(game => {
    const values = [];
    for (let color = 0; color < game.totalColors; color++) values.push(game.colors[color] || 0);
    return values;
  }));
  const equivalents = companionRows.map(row => row.equivalent);
  const rawCharges = companionRows.map(row => row.charge);
  const spread = Math.max(...equivalents) - Math.min(...equivalents);
  const spreadRatio = spread / Math.max(...equivalents);
  const rawSpreadRatio = (Math.max(...rawCharges) - Math.min(...rawCharges)) / Math.max(...rawCharges);

  console.log('');
  console.log(`量级核对：每局总消除 ${fixed(totalGems, 1)} 颗；单个在场颜色 ${fixed(perColor, 1)} 颗。`);
  console.log(`六位同伴原始充能速度极差 ${percent(rawSpreadRatio)}（页面自检锁定的是这一项，门槛 <15%）。`);
  console.log(`六位同伴等效大招范围 ${fixed(Math.min(...equivalents), 3)}–${fixed(Math.max(...equivalents), 3)}，极差 ${percent(spreadRatio)}。`);
  console.log('参考基线：总消除 35–49 颗/局、单色 6–11 颗/局、六人 0.63–0.67 次/局。');
  if (Math.min(...equivalents) < 0.63 || Math.max(...equivalents) > 0.67) {
    console.log('口径提示：当前六位 need 为 34–46，按各自门槛折算会比“原始充能速度”更分散；此处如实同时报告。');
  }

  balance.restore();
}

run().catch(error => {
  console.error(`平衡模拟失败：${error.stack || error.message}`);
  process.exitCode = 1;
});
