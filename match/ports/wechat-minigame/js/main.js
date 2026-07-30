'use strict';

const CONFIG = require('./config.js');
const { createPlatform } = require('./platform.js');
const { AssetStore } = require('./assets.js');
const { GameEngine } = require('./engine.js');
const { Renderer } = require('./renderer.js');

function firstTouch(event) {
  const list = event.changedTouches || event.touches || [];
  const touch = list[0];
  if (!touch) return null;
  return {
    x: touch.clientX == null ? touch.pageX : touch.clientX,
    y: touch.clientY == null ? touch.pageY : touch.clientY,
  };
}

function loadSave(platform) {
  const value = platform.store.get(CONFIG.STORAGE_KEY, {});
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) || {};
    } catch (_) {
      return {};
    }
  }
  return value && typeof value === 'object' ? value : {};
}

async function boot() {
  const platform = createPlatform();
  const assets = new AssetStore(platform);
  const renderer = new Renderer(platform, assets);
  const save = Object.assign({ best: 0, completed: 0, plays: 0 }, loadSave(platform));
  let engine = new GameEngine();
  let screen = 'loading';
  let selected = null;
  let touchStart = null;
  let notice = '';
  let noticeTimer = null;

  const persist = () => platform.store.set(CONFIG.STORAGE_KEY, save);

  const render = () => {
    if (screen === 'loading') renderer.drawLoading(0);
    else if (screen === 'menu') renderer.drawMenu(save);
    else if (screen === 'game') renderer.drawGame(engine.snapshot(), selected, notice);
    else if (screen === 'result') renderer.drawResult(engine.snapshot(), save);
  };

  const showNotice = (message) => {
    notice = message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      notice = '';
      render();
    }, 900);
  };

  const startGame = () => {
    engine = new GameEngine();
    selected = null;
    notice = '';
    screen = 'game';
    save.plays += 1;
    persist();
    platform.vibrate('light');
    render();
  };

  const finishIfNeeded = () => {
    if (!engine.finished) return false;
    save.best = Math.max(Number(save.best || 0), engine.score);
    if (engine.finished === 'win') save.completed += 1;
    persist();
    screen = 'result';
    selected = null;
    platform.vibrate(engine.finished === 'win' ? 'heavy' : 'light');
    render();
    return true;
  };

  const attemptSwap = (a, b) => {
    const result = engine.swap(a, b);
    if (!result.ok) {
      selected = b;
      platform.vibrate('light');
      showNotice('这一步没有形成三连');
      render();
      return;
    }

    selected = null;
    platform.vibrate(result.chains.length >= 2 ? 'heavy' : 'light');
    if (result.chains.length >= 2) showNotice(`${result.chains.length} 重连锁 · +${result.score}`);
    else notice = `+${result.score}`;
    if (!finishIfNeeded()) render();
  };

  const handleGameGesture = (start, end) => {
    const startCell = renderer.cellAt(start.x, start.y);
    if (!startCell) return;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.max(Math.abs(dx), Math.abs(dy));
    if (distance >= 14) {
      const target = {
        row: startCell.row + (Math.abs(dy) > Math.abs(dx) ? Math.sign(dy) : 0),
        column: startCell.column + (Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0),
      };
      if (engine.inside(target.row, target.column)) attemptSwap(startCell, target);
      return;
    }

    const cell = renderer.cellAt(end.x, end.y);
    if (!cell) return;
    if (!selected) {
      selected = cell;
      render();
      return;
    }
    if (selected.row === cell.row && selected.column === cell.column) {
      selected = null;
      render();
      return;
    }
    if (engine.adjacent(selected, cell)) attemptSwap(selected, cell);
    else {
      selected = cell;
      render();
    }
  };

  platform.onTouch(
    (event) => {
      touchStart = firstTouch(event);
    },
    () => {},
    (event) => {
      const end = firstTouch(event);
      const start = touchStart;
      touchStart = null;
      if (!start || !end) return;

      if (screen === 'game') {
        const region = renderer.regionAt(end.x, end.y);
        if (region && region.id === 'menu') {
          screen = 'menu';
          selected = null;
          render();
          return;
        }
        handleGameGesture(start, end);
        return;
      }

      const region = renderer.regionAt(end.x, end.y);
      if (!region) return;
      if (region.id === 'start' || region.id === 'retry') startGame();
      else if (region.id === 'menu') {
        screen = 'menu';
        render();
      }
    },
  );

  platform.onHide(persist);
  platform.onShow(render);

  renderer.drawLoading(0.04);
  await assets.loadAll((progress) => renderer.drawLoading(progress));
  screen = 'menu';
  render();

  if (assets.failed.length && typeof console !== 'undefined') {
    console.warn('GEMFALL optional assets failed:', assets.failed);
  }
}

module.exports = { boot };
