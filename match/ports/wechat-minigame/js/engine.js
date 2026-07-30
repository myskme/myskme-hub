'use strict';

const CONFIG = require('./config.js');

class GameEngine {
  constructor(options = {}) {
    this.size = options.size || CONFIG.SIZE;
    this.colors = options.colors || CONFIG.COLORS;
    this.startMoves = options.moves || CONFIG.START_MOVES;
    this.targetScore = options.target || CONFIG.TARGET_SCORE;
    this.rng = options.rng || Math.random;
    this.board = [];
    this.score = 0;
    this.moves = this.startMoves;
    this.finished = null;
    this.buildBoard();
  }

  randomColor() {
    return Math.floor(this.rng() * this.colors);
  }

  inside(row, column) {
    return row >= 0 && row < this.size && column >= 0 && column < this.size;
  }

  adjacent(a, b) {
    return Math.abs(a.row - b.row) + Math.abs(a.column - b.column) === 1;
  }

  rawSwap(a, b) {
    const value = this.board[a.row][a.column];
    this.board[a.row][a.column] = this.board[b.row][b.column];
    this.board[b.row][b.column] = value;
  }

  createsRunAt(row, column) {
    const color = this.board[row][column];
    if (color == null) return false;

    let count = 1;
    for (let c = column - 1; c >= 0 && this.board[row][c] === color; c -= 1) count += 1;
    for (let c = column + 1; c < this.size && this.board[row][c] === color; c += 1) count += 1;
    if (count >= 3) return true;

    count = 1;
    for (let r = row - 1; r >= 0 && this.board[r][column] === color; r -= 1) count += 1;
    for (let r = row + 1; r < this.size && this.board[r][column] === color; r += 1) count += 1;
    return count >= 3;
  }

  findMatches() {
    const matched = new Set();
    const key = (row, column) => `${row}:${column}`;

    for (let row = 0; row < this.size; row += 1) {
      let start = 0;
      while (start < this.size) {
        const color = this.board[row][start];
        let end = start + 1;
        while (end < this.size && color != null && this.board[row][end] === color) end += 1;
        if (color != null && end - start >= 3) {
          for (let column = start; column < end; column += 1) matched.add(key(row, column));
        }
        start = end;
      }
    }

    for (let column = 0; column < this.size; column += 1) {
      let start = 0;
      while (start < this.size) {
        const color = this.board[start][column];
        let end = start + 1;
        while (end < this.size && color != null && this.board[end][column] === color) end += 1;
        if (color != null && end - start >= 3) {
          for (let row = start; row < end; row += 1) matched.add(key(row, column));
        }
        start = end;
      }
    }
    return matched;
  }

  wouldSwap(a, b) {
    if (!this.inside(a.row, a.column) || !this.inside(b.row, b.column) || !this.adjacent(a, b)) {
      return false;
    }
    this.rawSwap(a, b);
    const valid = this.createsRunAt(a.row, a.column) || this.createsRunAt(b.row, b.column);
    this.rawSwap(a, b);
    return valid;
  }

  findMove() {
    const directions = [[0, 1], [1, 0]];
    for (let row = 0; row < this.size; row += 1) {
      for (let column = 0; column < this.size; column += 1) {
        for (const [dr, dc] of directions) {
          const other = { row: row + dr, column: column + dc };
          const here = { row, column };
          if (this.inside(other.row, other.column) && this.wouldSwap(here, other)) {
            return [here, other];
          }
        }
      }
    }
    return null;
  }

  fillWithoutStartingMatches() {
    this.board = Array.from({ length: this.size }, () => Array(this.size).fill(0));
    for (let row = 0; row < this.size; row += 1) {
      for (let column = 0; column < this.size; column += 1) {
        let color = this.randomColor();
        let guard = 0;
        while (guard < 50 && (
          (column >= 2 && this.board[row][column - 1] === color && this.board[row][column - 2] === color) ||
          (row >= 2 && this.board[row - 1][column] === color && this.board[row - 2][column] === color)
        )) {
          color = this.randomColor();
          guard += 1;
        }
        this.board[row][column] = color;
      }
    }
  }

  buildBoard() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      this.fillWithoutStartingMatches();
      if (this.findMatches().size === 0 && this.findMove()) return true;
    }
    throw new Error('Unable to build a playable board');
  }

  reset() {
    this.score = 0;
    this.moves = this.startMoves;
    this.finished = null;
    this.buildBoard();
  }

  collapse() {
    for (let column = 0; column < this.size; column += 1) {
      const remaining = [];
      for (let row = this.size - 1; row >= 0; row -= 1) {
        const value = this.board[row][column];
        if (value != null) remaining.push(value);
      }
      let index = 0;
      for (let row = this.size - 1; row >= 0; row -= 1) {
        this.board[row][column] = index < remaining.length ? remaining[index++] : this.randomColor();
      }
    }
  }

  reshuffle() {
    const pool = this.board.flat();
    for (let attempt = 0; attempt < 100; attempt += 1) {
      for (let index = pool.length - 1; index > 0; index -= 1) {
        const other = Math.floor(this.rng() * (index + 1));
        [pool[index], pool[other]] = [pool[other], pool[index]];
      }
      for (let row = 0; row < this.size; row += 1) {
        for (let column = 0; column < this.size; column += 1) {
          this.board[row][column] = pool[row * this.size + column];
        }
      }
      if (this.findMatches().size === 0 && this.findMove()) return true;
    }
    return this.buildBoard();
  }

  swap(a, b) {
    if (this.finished || !this.wouldSwap(a, b)) {
      return { ok: false, score: 0, chains: [], finished: this.finished };
    }

    this.rawSwap(a, b);
    this.moves -= 1;
    const chains = [];
    let gained = 0;
    let chain = 1;
    let matches = this.findMatches();

    while (matches.size) {
      const points = matches.size * 100 * chain;
      gained += points;
      this.score += points;
      chains.push({ chain, removed: matches.size, points });
      for (const coordinate of matches) {
        const [row, column] = coordinate.split(':').map(Number);
        this.board[row][column] = null;
      }
      this.collapse();
      matches = this.findMatches();
      chain += 1;
    }

    if (this.score >= this.targetScore) this.finished = 'win';
    else if (this.moves <= 0) this.finished = 'lose';
    else if (!this.findMove()) this.reshuffle();

    return {
      ok: true,
      score: gained,
      chains,
      finished: this.finished,
    };
  }

  snapshot() {
    return {
      board: this.board.map((row) => row.slice()),
      score: this.score,
      moves: this.moves,
      targetScore: this.targetScore,
      finished: this.finished,
    };
  }
}

module.exports = { GameEngine };
