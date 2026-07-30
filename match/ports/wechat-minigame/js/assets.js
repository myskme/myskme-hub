'use strict';

const PATHS = {
  hero: 'assets/art/hero.webp',
  chapter: 'assets/art/chapter-1.webp',
  win: 'assets/art/win.webp',
  lose: 'assets/art/lose.webp',
  lamp: 'assets/art/lamp.webp',
  gem0: 'assets/art/gem-0.webp',
  gem1: 'assets/art/gem-1.webp',
  gem2: 'assets/art/gem-2.webp',
  gem3: 'assets/art/gem-3.webp',
  gem4: 'assets/art/gem-4.webp',
  gem5: 'assets/art/gem-5.webp',
};

class AssetStore {
  constructor(platform) {
    this.platform = platform;
    this.images = {};
    this.failed = [];
  }

  loadOne(key, source) {
    return new Promise((resolve) => {
      const image = this.platform.createImage();
      image.onload = () => {
        this.images[key] = image;
        resolve(true);
      };
      image.onerror = () => {
        this.images[key] = null;
        this.failed.push(source);
        resolve(false);
      };
      image.src = source;
    });
  }

  async loadAll(onProgress) {
    const entries = Object.entries(PATHS);
    let complete = 0;
    for (const [key, source] of entries) {
      await this.loadOne(key, source);
      complete += 1;
      if (onProgress) onProgress(complete / entries.length);
    }
    return this.failed.length === 0;
  }

  get(key) {
    return this.images[key] || null;
  }
}

module.exports = { AssetStore, PATHS };
