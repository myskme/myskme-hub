'use strict';

const CONFIG = require('./config.js');

function createPlatform() {
  if (typeof wx === 'undefined') {
    throw new Error('Wechat Mini Game runtime not found: global wx is missing');
  }

  const canvas = wx.createCanvas();
  const info = typeof wx.getWindowInfo === 'function'
    ? wx.getWindowInfo()
    : wx.getSystemInfoSync();
  const width = info.windowWidth || info.screenWidth;
  const height = info.windowHeight || info.screenHeight;
  const dpr = Math.min(info.pixelRatio || 1, CONFIG.MAX_DPR);
  const safe = info.safeArea || { left: 0, top: 0, right: width, bottom: height, width, height };

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  if (typeof ctx.setTransform === 'function') ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  else ctx.scale(dpr, dpr);

  return {
    name: 'wechat-minigame',
    canvas,
    ctx,
    width,
    height,
    dpr,
    safe: {
      left: safe.left || 0,
      top: safe.top || 0,
      right: safe.right || width,
      bottom: safe.bottom || height,
    },
    store: {
      get(key, fallback) {
        try {
          const value = wx.getStorageSync(key);
          return value === '' || value == null ? fallback : value;
        } catch (_) {
          return fallback;
        }
      },
      set(key, value) {
        try {
          wx.setStorageSync(key, value);
          return true;
        } catch (_) {
          return false;
        }
      },
    },
    now() {
      return Date.now();
    },
    raf(callback) {
      if (typeof canvas.requestAnimationFrame === 'function') {
        return canvas.requestAnimationFrame(callback);
      }
      if (typeof requestAnimationFrame === 'function') {
        return requestAnimationFrame(callback);
      }
      return setTimeout(() => callback(Date.now()), 16);
    },
    createImage() {
      return wx.createImage();
    },
    onTouch(start, move, end) {
      wx.onTouchStart(start);
      wx.onTouchMove(move);
      wx.onTouchEnd(end);
      if (typeof wx.onTouchCancel === 'function') wx.onTouchCancel(end);
    },
    vibrate(kind = 'light') {
      try {
        wx.vibrateShort({ type: kind === 'heavy' ? 'heavy' : 'light' });
      } catch (_) {
        try {
          wx.vibrateShort();
        } catch (_) {}
      }
    },
    onHide(handler) {
      if (typeof wx.onHide === 'function') wx.onHide(handler);
    },
    onShow(handler) {
      if (typeof wx.onShow === 'function') wx.onShow(handler);
    },
  };
}

module.exports = { createPlatform };
