'use strict';

const assert = require('node:assert/strict');
const { GameEngine } = require('../js/engine.js');

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value |= 0;
    value = value + 0x6d2b79f5 | 0;
    let result = Math.imul(value ^ value >>> 15, 1 | value);
    result = result + Math.imul(result ^ result >>> 7, 61 | result) ^ result;
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

for (let seed = 1; seed <= 200; seed += 1) {
  const game = new GameEngine({ rng: mulberry32(seed) });
  assert.equal(game.findMatches().size, 0, `seed ${seed}: initial board has a match`);
  assert.ok(game.findMove(), `seed ${seed}: initial board has no move`);
  assert.equal(game.board.length, 8);
  assert.ok(game.board.every((row) => row.length === 8 && row.every(Number.isInteger)));
}

{
  const game = new GameEngine({ rng: mulberry32(91) });
  const before = game.snapshot();
  const result = game.swap({ row: 0, column: 0 }, { row: 2, column: 0 });
  assert.equal(result.ok, false);
  assert.equal(game.moves, before.moves, 'non-adjacent swap consumed a move');
  assert.deepEqual(game.board, before.board, 'non-adjacent swap changed the board');
}

for (let seed = 300; seed < 360; seed += 1) {
  const game = new GameEngine({ rng: mulberry32(seed) });
  const move = game.findMove();
  const beforeMoves = game.moves;
  const result = game.swap(move[0], move[1]);
  assert.equal(result.ok, true, `seed ${seed}: advertised move was rejected`);
  assert.equal(game.moves, beforeMoves - 1, `seed ${seed}: valid move did not consume exactly one move`);
  assert.ok(result.score > 0, `seed ${seed}: valid move scored nothing`);
  assert.equal(game.findMatches().size, 0, `seed ${seed}: cascade left an unresolved match`);
  assert.ok(game.board.every((row) => row.every(Number.isInteger)), `seed ${seed}: cascade left a hole`);
}

for (let seed = 700; seed < 740; seed += 1) {
  const game = new GameEngine({ rng: mulberry32(seed) });
  let guard = 0;
  while (!game.finished && guard < 30) {
    const move = game.findMove();
    assert.ok(move, `seed ${seed}: playable game became stuck`);
    game.swap(move[0], move[1]);
    guard += 1;
  }
  assert.ok(game.finished === 'win' || game.finished === 'lose', `seed ${seed}: game did not finish`);
  assert.ok(game.moves >= 0, `seed ${seed}: moves went negative`);
}

console.log('PASS wechat engine: 200 builds, 60 swaps, 40 complete autoplay sessions');
