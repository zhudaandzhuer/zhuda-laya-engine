// A minimal stand-in DOM for the prefab tests: elements with classes, styles, children,
// listeners and text; a window with listeners; an in-memory localStorage.
export class El {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.style = {};
    this.dataset = {};
    this.listeners = {};
    this.children = [];
    this.textContent = '';
    this.hidden = false;
    this.type = '';
    const set = new Set();
    this._classes = set;
    this.classList = {
      add: (...c) => c.forEach((x) => set.add(x)),
      remove: (...c) => c.forEach((x) => set.delete(x)),
      contains: (c) => set.has(c),
      toggle: (c, force) => ((force ?? !set.has(c)) ? (set.add(c), true) : (set.delete(c), false)),
    };
  }
  set className(v) { this._classes.clear(); for (const c of String(v).split(/\s+/).filter(Boolean)) this._classes.add(c); }
  get className() { return [...this._classes].join(' '); }
  set innerHTML(_v) { this.children = []; }
  get innerHTML() { return ''; }
  append(...nodes) { this.children.push(...nodes); }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn); }
  dispatch(type, event = {}) { for (const fn of this.listeners[type] || []) fn({ preventDefault() {}, stopPropagation() {}, ...event }); }
  setPointerCapture() {}
  focus() { globalThis.document.activeElement = this; this.dispatch('focus'); }
  click() { this.dispatch('click'); }
  remove() { this.removed = true; }
  setAttribute(k, v) { (this.attrs ||= {})[k] = String(v); }
  getAttribute(k) { return this.attrs?.[k] ?? null; }
  /** All text below this element, in order. */
  text() { return [this.textContent, ...this.children.map((c) => (c instanceof El ? c.text() : c.text ?? ''))].join(''); }
}

export function installDom({ width = 1280, height = 720 } = {}) {
  const winListeners = {};
  const window = {
    innerWidth: width,
    innerHeight: height,
    addEventListener: (t, fn) => (winListeners[t] ||= []).push(fn),
    removeEventListener: (t, fn) => (winListeners[t] = (winListeners[t] || []).filter((f) => f !== fn)),
    dispatch: (t, event = {}) => (winListeners[t] || []).forEach((fn) => fn(event)),
    listeners: winListeners,
  };
  const marked = [];
  const document = {
    documentElement: {},
    title: '',
    createElement: (tag) => new El(tag),
    createTextNode: (text) => ({ text }),
    querySelectorAll: (sel) => (sel === '[data-i18n]' ? marked : []),
    marked,
  };
  const mem = new Map();
  const localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), mem };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorage });
  Object.assign(globalThis, { window, document });
  return { window, document, localStorage };
}
