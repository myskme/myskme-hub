'use strict';

const CONFIG = require('./config.js');

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

class Renderer {
  constructor(platform, assets) {
    this.platform = platform;
    this.assets = assets;
    this.ctx = platform.ctx;
    this.width = platform.width;
    this.height = platform.height;
    this.regions = [];
    this.layout = this.computeLayout();
  }

  computeLayout() {
    const safeTop = Math.max(10, this.platform.safe.top || 0);
    const safeBottom = Math.min(this.height - 10, this.platform.safe.bottom || this.height);
    const boardSize = Math.floor(Math.min(this.width - 24, safeBottom - safeTop - 210));
    const boardX = Math.floor((this.width - boardSize) / 2);
    const boardY = safeTop + 126;
    return {
      safeTop,
      safeBottom,
      boardX,
      boardY,
      boardSize,
      cell: boardSize / CONFIG.SIZE,
    };
  }

  clear() {
    this.regions = [];
    this.ctx.clearRect(0, 0, this.width, this.height);
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#111820');
    gradient.addColorStop(0.55, '#0a0a0c');
    gradient.addColorStop(1, '#050506');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);

    const glow = this.ctx.createRadialGradient(
      this.width / 2, this.height * 0.28, 0,
      this.width / 2, this.height * 0.28, this.width * 0.75,
    );
    glow.addColorStop(0, 'rgba(201,166,74,.14)');
    glow.addColorStop(1, 'rgba(201,166,74,0)');
    this.ctx.fillStyle = glow;
    this.ctx.fillRect(0, 0, this.width, this.height * 0.7);
  }

  text(value, x, y, size, color = '#f0e6d2', align = 'center', weight = 'normal') {
    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = 'middle';
    this.ctx.font = `${weight} ${size}px "PingFang SC","Hiragino Sans GB",sans-serif`;
    this.ctx.fillText(value, x, y);
    this.ctx.restore();
  }

  imageContain(image, x, y, width, height, scale = 1) {
    if (!image || !image.width || !image.height) return false;
    const ratio = Math.min(width / image.width, height / image.height) * scale;
    const drawWidth = image.width * ratio;
    const drawHeight = image.height * ratio;
    this.ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
    return true;
  }

  imageCover(image, x, y, width, height) {
    if (!image || !image.width || !image.height) return false;
    const ratio = Math.max(width / image.width, height / image.height);
    const sourceWidth = width / ratio;
    const sourceHeight = height / ratio;
    const sx = (image.width - sourceWidth) / 2;
    const sy = (image.height - sourceHeight) / 2;
    this.ctx.drawImage(image, sx, sy, sourceWidth, sourceHeight, x, y, width, height);
    return true;
  }

  button(id, label, x, y, width, height, primary = true) {
    this.ctx.save();
    roundedRect(this.ctx, x, y, width, height, 7);
    this.ctx.fillStyle = primary ? '#c9a64a' : 'rgba(17,24,32,.94)';
    this.ctx.fill();
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = primary ? '#e8c768' : '#6f5b2c';
    this.ctx.stroke();
    this.text(label, x + width / 2, y + height / 2, 16, primary ? '#0a0a0c' : '#e8c768', 'center', '600');
    this.ctx.restore();
    this.regions.push({ id, x, y, width, height });
  }

  drawOrnaments() {
    const margin = 12;
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(201,166,74,.45)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(margin, margin, this.width - margin * 2, this.height - margin * 2);
    this.ctx.strokeStyle = 'rgba(232,199,104,.18)';
    this.ctx.strokeRect(margin + 4, margin + 4, this.width - (margin + 4) * 2, this.height - (margin + 4) * 2);
    this.ctx.restore();
  }

  drawLoading(progress = 0) {
    this.clear();
    this.drawOrnaments();
    this.imageContain(this.assets.get('lamp'), this.width / 2 - 58, this.height * 0.24, 116, 116);
    this.text('灵石远征', this.width / 2, this.height * 0.44, 28, '#e8c768', 'center', '600');
    this.text('正在点亮矿灯…', this.width / 2, this.height * 0.49, 14, '#a8a090');

    const barWidth = Math.min(240, this.width - 72);
    const x = (this.width - barWidth) / 2;
    const y = this.height * 0.55;
    roundedRect(this.ctx, x, y, barWidth, 6, 3);
    this.ctx.fillStyle = '#1f2830';
    this.ctx.fill();
    roundedRect(this.ctx, x, y, barWidth * Math.max(0.03, progress), 6, 3);
    this.ctx.fillStyle = '#c9a64a';
    this.ctx.fill();
  }

  drawMenu(save) {
    this.clear();
    const bannerHeight = Math.min(210, this.height * 0.28);
    this.ctx.save();
    this.ctx.globalAlpha = 0.46;
    this.imageCover(this.assets.get('chapter'), 0, 0, this.width, bannerHeight);
    this.ctx.restore();

    const shade = this.ctx.createLinearGradient(0, 0, 0, bannerHeight + 60);
    shade.addColorStop(0, 'rgba(10,10,12,.15)');
    shade.addColorStop(1, '#0a0a0c');
    this.ctx.fillStyle = shade;
    this.ctx.fillRect(0, 0, this.width, bannerHeight + 62);

    this.drawOrnaments();
    this.text('MYSKME · GEMFALL', this.width / 2, this.layout.safeTop + 28, 12, '#a8a090');
    this.text('灵 石 远 征', this.width / 2, this.layout.safeTop + 66, 30, '#e8c768', 'center', '600');
    this.text('微信小游戏 · 初代矿脉', this.width / 2, this.layout.safeTop + 98, 13, '#a8a090');

    const heroSize = Math.min(252, this.width * 0.68);
    this.imageContain(
      this.assets.get('hero'),
      (this.width - heroSize) / 2,
      this.layout.safeTop + 112,
      heroSize,
      heroSize,
      0.96,
    );

    const infoY = Math.min(this.height * 0.67, this.layout.safeTop + 370);
    this.text(`20 步 · 目标 ${CONFIG.TARGET_SCORE.toLocaleString()} 灵力`, this.width / 2, infoY, 15, '#f0e6d2');
    this.text(`本机最佳 ${Number(save.best || 0).toLocaleString()}`, this.width / 2, infoY + 30, 13, '#a8a090');
    this.button('start', '提灯下潜', 44, this.layout.safeBottom - 92, this.width - 88, 52, true);
    this.text(`v${CONFIG.VERSION} · 无 DOM Canvas`, this.width / 2, this.layout.safeBottom - 20, 11, '#6f6a61');
  }

  fallbackGem(color, x, y, size) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const radius = size * 0.32;
    const sides = [6, 3, 20, 4, 4, 5][color] || 6;
    const rotation = color === 1 ? -Math.PI / 2 : color === 3 ? Math.PI / 4 : -Math.PI / 2;
    this.ctx.beginPath();
    for (let index = 0; index < sides; index += 1) {
      const angle = rotation + index * Math.PI * 2 / sides;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      if (index === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = CONFIG.COLORS_HEX[color];
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(255,255,255,.45)';
    this.ctx.stroke();
  }

  drawGame(state, selected, notice = '') {
    this.clear();
    const { safeTop, boardX, boardY, boardSize, cell, safeBottom } = this.layout;
    this.drawOrnaments();

    this.text('灵石远征 · 浅脉试炼', 18, safeTop + 20, 13, '#e8c768', 'left', '600');
    this.text(`目标 ${state.targetScore.toLocaleString()}`, this.width - 18, safeTop + 20, 12, '#a8a090', 'right');

    this.text('灵力', 20, safeTop + 54, 11, '#8a8478', 'left');
    this.text(state.score.toLocaleString(), 20, safeTop + 78, 24, '#f0e6d2', 'left', '600');
    this.text('余步', this.width - 20, safeTop + 54, 11, '#8a8478', 'right');
    this.text(String(state.moves), this.width - 20, safeTop + 78, 24, '#e8c768', 'right', '600');

    const progress = Math.min(1, state.score / state.targetScore);
    roundedRect(this.ctx, 20, safeTop + 102, this.width - 40, 5, 3);
    this.ctx.fillStyle = '#1b242c';
    this.ctx.fill();
    roundedRect(this.ctx, 20, safeTop + 102, (this.width - 40) * progress, 5, 3);
    this.ctx.fillStyle = '#c9a64a';
    this.ctx.fill();

    roundedRect(this.ctx, boardX - 5, boardY - 5, boardSize + 10, boardSize + 10, 10);
    this.ctx.fillStyle = 'rgba(5,7,9,.84)';
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(201,166,74,.52)';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    for (let row = 0; row < CONFIG.SIZE; row += 1) {
      for (let column = 0; column < CONFIG.SIZE; column += 1) {
        const x = boardX + column * cell;
        const y = boardY + row * cell;
        roundedRect(this.ctx, x + 2, y + 2, cell - 4, cell - 4, 6);
        this.ctx.fillStyle = (row + column) % 2 ? 'rgba(17,24,32,.85)' : 'rgba(22,30,38,.85)';
        this.ctx.fill();

        const color = state.board[row][column];
        if (!this.imageContain(this.assets.get(`gem${color}`), x + 3, y + 3, cell - 6, cell - 6, 0.92)) {
          this.fallbackGem(color, x, y, cell);
        }

        if (selected && selected.row === row && selected.column === column) {
          roundedRect(this.ctx, x + 1.5, y + 1.5, cell - 3, cell - 3, 7);
          this.ctx.strokeStyle = '#e8c768';
          this.ctx.lineWidth = 2.5;
          this.ctx.stroke();
        }
      }
    }

    this.text(notice || '点选相邻灵石，或直接滑动交换', this.width / 2, Math.min(safeBottom - 48, boardY + boardSize + 30), 12, notice ? '#e8c768' : '#8a8478');
    this.button('menu', '返回矿口', 20, safeBottom - 42, 104, 30, false);
  }

  drawResult(state, save) {
    this.clear();
    this.drawOrnaments();
    const won = state.finished === 'win';
    const banner = this.assets.get(won ? 'win' : 'lose');
    const bannerWidth = this.width - 28;
    const bannerHeight = bannerWidth * 448 / 1024;
    const bannerY = this.layout.safeTop + 30;
    roundedRect(this.ctx, 14, bannerY, bannerWidth, bannerHeight, 8);
    this.ctx.save();
    this.ctx.clip();
    this.imageCover(banner, 14, bannerY, bannerWidth, bannerHeight);
    this.ctx.restore();

    const y = bannerY + bannerHeight + 52;
    this.text(won ? '矿脉 · 已通' : '矿脉 · 待续', this.width / 2, y, 29, won ? '#e8c768' : '#b8b4aa', 'center', '600');
    this.text(`本局灵力 ${state.score.toLocaleString()}`, this.width / 2, y + 48, 18, '#f0e6d2');
    this.text(`本机最佳 ${Number(save.best || 0).toLocaleString()}`, this.width / 2, y + 78, 13, '#a8a090');
    this.text(
      won ? '矿灯还亮着，下一层等正式版继续。' : '矿脉不会跑，换个角度再来一铲。',
      this.width / 2,
      y + 118,
      13,
      '#a8a090',
    );

    this.button('retry', '再挖一局', 42, this.layout.safeBottom - 128, this.width - 84, 48, true);
    this.button('menu', '回到矿口', 42, this.layout.safeBottom - 66, this.width - 84, 42, false);
  }

  cellAt(x, y) {
    const { boardX, boardY, boardSize, cell } = this.layout;
    if (x < boardX || y < boardY || x >= boardX + boardSize || y >= boardY + boardSize) return null;
    return {
      row: Math.floor((y - boardY) / cell),
      column: Math.floor((x - boardX) / cell),
    };
  }

  regionAt(x, y) {
    return this.regions.find((region) => (
      x >= region.x && x <= region.x + region.width &&
      y >= region.y && y <= region.y + region.height
    )) || null;
  }
}

module.exports = { Renderer };
