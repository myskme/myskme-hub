import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPO_ROOT = resolve(HERE, '../../..');

function extractInlineScripts(html) {
  const scripts = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match;
  while ((match = re.exec(html))) {
    const attrs = match[1] || '';
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const type = /\btype\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
    if (type && !/^(?:text|application)\/javascript$/i.test(type) && type !== 'module') continue;
    scripts.push(match[2]);
  }
  return scripts;
}

class EventTargetShim {
  constructor() {
    this._listeners = new Map();
  }

  addEventListener(type, handler) {
    if (typeof handler !== 'function') return;
    const handlers = this._listeners.get(type) || new Set();
    handlers.add(handler);
    this._listeners.set(type, handlers);
  }

  removeEventListener(type, handler) {
    this._listeners.get(type)?.delete(handler);
  }

  dispatchEvent(event) {
    const ev = typeof event === 'string' ? { type: event } : event;
    if (!ev?.type) return true;
    ev.target ||= this;
    ev.currentTarget = this;
    for (const handler of this._listeners.get(ev.type) || []) handler.call(this, ev);
    const propertyHandler = this[`on${ev.type}`];
    if (typeof propertyHandler === 'function') propertyHandler.call(this, ev);
    return !ev.defaultPrevented;
  }
}

class ClassListShim {
  constructor(owner) {
    this.owner = owner;
    this.values = new Set();
  }

  add(...names) {
    names.filter(Boolean).forEach(name => this.values.add(String(name)));
  }

  remove(...names) {
    names.forEach(name => this.values.delete(String(name)));
  }

  contains(name) {
    return this.values.has(String(name));
  }

  toggle(name, force) {
    const key = String(name);
    const enabled = force === undefined ? !this.values.has(key) : Boolean(force);
    if (enabled) this.values.add(key);
    else this.values.delete(key);
    return enabled;
  }

  replace(oldName, newName) {
    if (!this.values.delete(String(oldName))) return false;
    this.values.add(String(newName));
    return true;
  }

  toString() {
    return [...this.values].join(' ');
  }
}

function styleShim() {
  const values = Object.create(null);
  values.setProperty = (name, value) => {
    values[name] = String(value);
  };
  values.getPropertyValue = name => values[name] || '';
  values.removeProperty = name => {
    const old = values[name] || '';
    delete values[name];
    return old;
  };
  return values;
}

function canvasContextShim(canvas) {
  const gradient = { addColorStop() {} };
  const target = {
    canvas,
    measureText(text) {
      return { width: String(text ?? '').length * 8 };
    },
    createLinearGradient() {
      return gradient;
    },
    createRadialGradient() {
      return gradient;
    },
    createConicGradient() {
      return gradient;
    },
    createPattern() {
      return {};
    },
    getImageData(_x, _y, width = 1, height = 1) {
      return { data: new Uint8ClampedArray(width * height * 4), width, height };
    },
    createImageData(width = 1, height = 1) {
      return { data: new Uint8ClampedArray(width * height * 4), width, height };
    },
    isPointInPath() {
      return false;
    },
    isPointInStroke() {
      return false;
    },
  };
  return new Proxy(target, {
    get(obj, key) {
      if (key in obj) return obj[key];
      return () => {};
    },
    set(obj, key, value) {
      obj[key] = value;
      return true;
    },
  });
}

class ElementShim extends EventTargetShim {
  constructor(tagName = 'div', ownerDocument = null) {
    super();
    this.tagName = String(tagName).toUpperCase();
    this.nodeName = this.tagName;
    this.nodeType = 1;
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.children = [];
    this.childNodes = this.children;
    this.dataset = Object.create(null);
    this.style = styleShim();
    this.classList = new ClassListShim(this);
    this.attributes = new Map();
    this.id = '';
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.value = '';
    this.title = '';
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.clientWidth = 390;
    this.clientHeight = 390;
    this.offsetWidth = 390;
    this.offsetHeight = 390;
    this.scrollWidth = 390;
    this.scrollHeight = 390;
    this._innerHTML = '';
    this._textContent = '';
    this._queries = new Map();
  }

  get className() {
    return this.classList.toString();
  }

  set className(value) {
    this.classList.values = new Set(String(value || '').split(/\s+/).filter(Boolean));
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = String(value ?? '');
    if (this._innerHTML === '') this.replaceChildren();
  }

  get textContent() {
    return this._textContent;
  }

  set textContent(value) {
    this._textContent = String(value ?? '');
  }

  get firstChild() {
    return this.children[0] || null;
  }

  get lastChild() {
    return this.children.at(-1) || null;
  }

  get isConnected() {
    return true;
  }

  appendChild(child) {
    if (!child) return child;
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  append(...children) {
    children.forEach(child => {
      if (typeof child === 'string') this.appendChild(this.ownerDocument.createTextNode(child));
      else this.appendChild(child);
    });
  }

  prepend(...children) {
    for (const child of children.reverse()) {
      const node = typeof child === 'string' ? this.ownerDocument.createTextNode(child) : child;
      node.parentNode = this;
      this.children.unshift(node);
    }
  }

  insertBefore(child, before) {
    const index = this.children.indexOf(before);
    if (index < 0) return this.appendChild(child);
    child.parentNode = this;
    this.children.splice(index, 0, child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  replaceChildren(...children) {
    this.children.forEach(child => {
      child.parentNode = null;
    });
    this.children.length = 0;
    this.append(...children);
  }

  remove() {
    this.parentNode?.removeChild(this);
  }

  contains(child) {
    if (child === this) return true;
    return this.children.some(item => item.contains?.(child));
  }

  setAttribute(name, value) {
    const key = String(name);
    const text = String(value);
    this.attributes.set(key, text);
    if (key === 'id') this.id = text;
    else if (key === 'class') this.className = text;
    else if (key.startsWith('data-')) {
      const dataKey = key.slice(5).replace(/-([a-z])/g, (_all, letter) => letter.toUpperCase());
      this.dataset[dataKey] = text;
    } else {
      this[key] = text;
    }
  }

  getAttribute(name) {
    return this.attributes.get(String(name)) ?? null;
  }

  hasAttribute(name) {
    return this.attributes.has(String(name));
  }

  removeAttribute(name) {
    this.attributes.delete(String(name));
  }

  querySelector(selector) {
    const key = String(selector);
    if (!this._queries.has(key)) {
      const tag = key === 'canvas' ? 'canvas' : 'div';
      const child = this.ownerDocument.createElement(tag);
      if (key.startsWith('#')) child.id = key.slice(1).split(/\s|[.:[]/, 1)[0];
      this._queries.set(key, child);
      this.appendChild(child);
    }
    return this._queries.get(key);
  }

  querySelectorAll(selector) {
    const found = this.querySelector(selector);
    return found ? [found] : [];
  }

  closest() {
    return this;
  }

  matches() {
    return false;
  }

  click() {
    this.dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {} });
  }

  focus() {}
  blur() {}
  scrollIntoView() {}
  setPointerCapture() {}
  releasePointerCapture() {}

  getBoundingClientRect() {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: this.clientWidth,
      bottom: this.clientHeight,
      width: this.clientWidth,
      height: this.clientHeight,
      toJSON() {
        return this;
      },
    };
  }

  cloneNode(deep = false) {
    const clone = this.ownerDocument.createElement(this.tagName.toLowerCase());
    clone.id = this.id;
    clone.className = this.className;
    clone.dataset = { ...this.dataset };
    clone._innerHTML = this._innerHTML;
    clone._textContent = this._textContent;
    if (deep) this.children.forEach(child => clone.appendChild(child.cloneNode?.(true) || child));
    return clone;
  }
}

class CanvasElementShim extends ElementShim {
  constructor(ownerDocument) {
    super('canvas', ownerDocument);
    this.width = 390;
    this.height = 390;
    this._contexts = new Map();
  }

  getContext(type) {
    if (!this._contexts.has(type)) this._contexts.set(type, canvasContextShim(this));
    return this._contexts.get(type);
  }

  toDataURL() {
    return 'data:image/png;base64,';
  }
}

class TextNodeShim {
  constructor(text, ownerDocument) {
    this.nodeType = 3;
    this.nodeName = '#text';
    this.textContent = String(text);
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
  }

  cloneNode() {
    return new TextNodeShim(this.textContent, this.ownerDocument);
  }
}

class DocumentShim extends EventTargetShim {
  constructor(html) {
    super();
    this.nodeType = 9;
    this.readyState = 'complete';
    this.visibilityState = 'visible';
    this.hidden = false;
    this._byId = new Map();
    this._queries = new Map();
    this.documentElement = new ElementShim('html', this);
    this.head = new ElementShim('head', this);
    this.body = new ElementShim('body', this);
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
    this.fonts = { ready: Promise.resolve(), check: () => true };
    this._indexHtml(html);
  }

  _indexHtml(html) {
    const tagRe = /<([a-z][\w:-]*)\b([^>]*)>/gi;
    let match;
    while ((match = tagRe.exec(html))) {
      const attrs = match[2] || '';
      const id = /\bid\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
      if (!id || this._byId.has(id)) continue;
      const element = this.createElement(match[1]);
      element.id = id;
      const classes = /\bclass\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
      if (classes) element.className = classes;
      for (const data of attrs.matchAll(/\bdata-([\w-]+)\s*=\s*["']([^"']*)["']/gi)) {
        element.setAttribute(`data-${data[1]}`, data[2]);
      }
      this._byId.set(id, element);
      this.body.appendChild(element);
    }
  }

  createElement(tagName) {
    return String(tagName).toLowerCase() === 'canvas'
      ? new CanvasElementShim(this)
      : new ElementShim(tagName, this);
  }

  createElementNS(_namespace, tagName) {
    return this.createElement(tagName);
  }

  createTextNode(text) {
    return new TextNodeShim(text, this);
  }

  createDocumentFragment() {
    return new ElementShim('fragment', this);
  }

  getElementById(id) {
    return this.querySelector(`#${id}`);
  }

  querySelector(selector) {
    const key = String(selector);
    const simpleId = /^#([\w:-]+)$/.exec(key)?.[1];
    if (simpleId) {
      if (!this._byId.has(simpleId)) {
        const element = this.createElement(simpleId === 'board' ? 'canvas' : 'div');
        element.id = simpleId;
        this._byId.set(simpleId, element);
        this.body.appendChild(element);
      }
      return this._byId.get(simpleId);
    }
    if (key === 'body') return this.body;
    if (key === 'html' || key === ':root') return this.documentElement;
    if (!this._queries.has(key)) {
      const element = this.createElement(key.includes('canvas') ? 'canvas' : 'div');
      this._queries.set(key, element);
      this.body.appendChild(element);
    }
    return this._queries.get(key);
  }

  querySelectorAll(selector) {
    const key = String(selector);
    if (key === '.scr' || key === '.ovl') {
      const className = key.slice(1);
      return [...this._byId.values()].filter(element => element.classList.contains(className));
    }
    if (key === '.ovl.on') {
      return [...this._byId.values()].filter(element =>
        element.classList.contains('ovl') && element.classList.contains('on'));
    }
    if (key === '#toolbar .ic[data-ic]') return [];
    const found = this.querySelector(key);
    return found ? [found] : [];
  }

  execCommand() {
    return true;
  }
}

class StorageShim {
  constructor() {
    this.values = new Map();
  }

  get length() {
    return this.values.size;
  }

  key(index) {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key) {
    return this.values.has(String(key)) ? this.values.get(String(key)) : null;
  }

  setItem(key, value) {
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(String(key));
  }

  clear() {
    this.values.clear();
  }
}

class ImageShim extends EventTargetShim {
  constructor() {
    super();
    this.complete = false;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.__ok = false;
    this._src = '';
  }

  set src(value) {
    this._src = String(value);
  }

  get src() {
    return this._src;
  }
}

class AudioContextShim {
  constructor() {
    this.currentTime = 0;
    this.state = 'running';
    this.destination = {};
  }

  resume() {
    return Promise.resolve();
  }

  close() {
    return Promise.resolve();
  }

  createGain() {
    return {
      gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {
        return this;
      },
    };
  }

  createOscillator() {
    return {
      type: 'sine',
      frequency: { value: 440, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {
        return this;
      },
      start() {},
      stop() {},
    };
  }

  createBufferSource() {
    return {
      buffer: null,
      connect() {
        return this;
      },
      start() {},
      stop() {},
    };
  }

  createBiquadFilter() {
    return {
      type: 'lowpass',
      frequency: { value: 0, setValueAtTime() {} },
      Q: { value: 0, setValueAtTime() {} },
      connect() {
        return this;
      },
    };
  }

  createBuffer(channels, length, sampleRate) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: () => new Float32Array(length),
    };
  }
}

function seededRandom(seedText) {
  let state = 2166136261;
  for (const char of String(seedText)) {
    state ^= char.charCodeAt(0);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state |= 0;
    state = state + 0x6d2b79f5 | 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function makeEnvironment(html, consoleLines, randomSeed) {
  const document = new DocumentShim(html);
  const localStorage = new StorageShim();
  const sessionStorage = new StorageShim();
  const eventTarget = new EventTargetShim();
  let timerId = 0;
  const cancelledTimers = new Set();

  const setTimeoutShim = (callback, delay = 0, ...args) => {
    const id = ++timerId;
    // 动画 sleep 在 reduced-motion 下最多 40ms；异步立即完成即可。
    // 1 秒以上的 UI/联网延时不调度，避免 BOOT 的榜单上报拖住 Node 进程。
    if (typeof callback === 'function' && Number(delay) < 1000) {
      queueMicrotask(() => {
        if (!cancelledTimers.has(id)) callback(...args);
      });
    }
    return id;
  };

  const clearTimeoutShim = id => {
    cancelledTimers.add(id);
  };

  const location = {
    href: 'https://localhost/match/',
    origin: 'https://localhost',
    protocol: 'https:',
    hostname: 'localhost',
    host: 'localhost',
    pathname: '/match/',
    search: '',
    hash: '',
    assign() {},
    replace() {},
    reload() {},
    toString() {
      return this.href;
    },
  };

  const navigator = {
    userAgent: 'gemfall-headless-node',
    language: 'zh-CN',
    languages: ['zh-CN'],
    platform: 'node',
    maxTouchPoints: 0,
    onLine: false,
    vibrate: () => false,
    clipboard: { writeText: async () => {} },
  };

  const silentConsole = {
    log: (...args) => consoleLines.push(args.map(String).join(' ')),
    info: (...args) => consoleLines.push(args.map(String).join(' ')),
    warn: (...args) => consoleLines.push(`WARN ${args.map(String).join(' ')}`),
    error: (...args) => consoleLines.push(`ERROR ${args.map(String).join(' ')}`),
  };
  const deterministicMath = Object.create(Math);
  deterministicMath.random = seededRandom(randomSeed || 'gemfall-headless-v1');

  const env = {
    console: silentConsole,
    document,
    localStorage,
    sessionStorage,
    navigator,
    location,
    history: { pushState() {}, replaceState() {}, back() {}, forward() {}, go() {} },
    screen: { width: 390, height: 844, availWidth: 390, availHeight: 844, orientation: { type: 'portrait-primary' } },
    innerWidth: 390,
    innerHeight: 844,
    outerWidth: 390,
    outerHeight: 844,
    devicePixelRatio: 1,
    performance: { now: () => Date.now(), timeOrigin: Date.now() },
    Math: deterministicMath,
    crypto: webcrypto,
    Image: ImageShim,
    Audio: class extends EventTargetShim {
      play() {
        return Promise.resolve();
      }
      pause() {}
    },
    AudioContext: AudioContextShim,
    webkitAudioContext: AudioContextShim,
    Element: ElementShim,
    HTMLElement: ElementShim,
    HTMLCanvasElement: CanvasElementShim,
    Node: ElementShim,
    Event: class {
      constructor(type, init = {}) {
        this.type = type;
        Object.assign(this, init);
      }
      preventDefault() {
        this.defaultPrevented = true;
      }
      stopPropagation() {}
    },
    CustomEvent: class {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
      preventDefault() {
        this.defaultPrevented = true;
      }
      stopPropagation() {}
    },
    requestAnimationFrame: () => ++timerId,
    cancelAnimationFrame: clearTimeoutShim,
    setTimeout: setTimeoutShim,
    clearTimeout: clearTimeoutShim,
    setInterval: () => ++timerId,
    clearInterval: clearTimeoutShim,
    queueMicrotask,
    matchMedia: query => ({
      matches: String(query).includes('prefers-reduced-motion'),
      media: String(query),
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return true;
      },
    }),
    getComputedStyle: element => ({
      getPropertyValue: name => element?.style?.[name] || '',
      width: `${element?.clientWidth || 390}px`,
      height: `${element?.clientHeight || 390}px`,
      fontSize: '16px',
    }),
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    IntersectionObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
    CSS: { supports: () => true, escape: value => String(value) },
    alert() {},
    confirm: () => true,
    prompt: () => '',
    open: () => null,
    scrollTo() {},
    scrollBy() {},
    fetch: async () => ({
      ok: false,
      status: 503,
      headers: new Headers(),
      json: async () => ({ ok: false, offline: true }),
      text: async () => '',
    }),
    addEventListener: eventTarget.addEventListener.bind(eventTarget),
    removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
    dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
    URL,
    URLSearchParams,
    Headers,
    Request,
    Response,
    AbortController,
    TextEncoder,
    TextDecoder,
    Blob,
    FormData,
    structuredClone,
    atob: value => Buffer.from(String(value), 'base64').toString('binary'),
    btoa: value => Buffer.from(String(value), 'binary').toString('base64'),
  };

  env.window = env;
  env.self = env;
  env.globalThis = env;
  env.top = env;
  env.parent = env;
  return env;
}

export async function loadGemfall(options = {}) {
  const repoRoot = resolve(options.repoRoot || DEFAULT_REPO_ROOT);
  const indexPath = resolve(repoRoot, options.indexPath || 'match/index.html');
  const networkConfigPath = resolve(repoRoot,
    options.networkConfigPath || 'match/network-config.js');
  const html = await readFile(indexPath, 'utf8');
  const networkConfig = await readFile(networkConfigPath, 'utf8');
  const inlineScripts = extractInlineScripts(html);
  if (inlineScripts.length === 0) throw new Error(`没有在 ${indexPath} 找到内联脚本`);

  const consoleLines = [];
  const env = makeEnvironment(html, consoleLines, options.randomSeed);
  const context = vm.createContext(env, {
    name: 'gemfall-headless',
    codeGeneration: { strings: true, wasm: false },
  });

  // 浏览器会先执行 <script src="network-config.js">，再执行页面内联脚本。
  // 无头环境保持同一顺序，避免网络测试悄悄落回 index.html 的旧默认值。
  new vm.Script(networkConfig, {
    filename: networkConfigPath,
    displayErrors: true,
  }).runInContext(context, { timeout: options.timeoutMs || 30_000 });

  for (let index = 0; index < inlineScripts.length; index++) {
    const script = new vm.Script(inlineScripts[index], {
      filename: `${indexPath}#inline-script-${index + 1}`,
      displayErrors: true,
    });
    script.runInContext(context, { timeout: options.timeoutMs || 30_000 });
  }

  if (typeof context.window.__selftest !== 'function') {
    throw new Error('页面脚本已执行，但 window.__selftest 没有注册');
  }

  return {
    context,
    window: context.window,
    document: context.document,
    consoleLines,
    indexPath,
    networkConfigPath,
    inlineScriptCount: inlineScripts.length,
    run(code, filename = 'gemfall-headless-bridge.mjs') {
      return new vm.Script(code, { filename, displayErrors: true }).runInContext(context);
    },
  };
}
