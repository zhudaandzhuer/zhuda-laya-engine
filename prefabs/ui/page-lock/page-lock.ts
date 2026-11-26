/**
 * Mobile page lock for a game page: a double tap or a pinch never zooms the page; on a touch
 * device that has the Fullscreen API (Android Chrome, WeChat's XWeb, …) a tap puts the page in
 * native fullscreen (browser bars hidden); in an iPhone browser (no Fullscreen API) a one-time
 * "swipe up" layer gets Safari to collapse its bars. Call once at boot: `lockPage({ … })`.
 *
 * The practice comes from a production H5 platform (not in this repository), 2026-11-26:
 *  - The viewport is locked: `width=device-width, initial-scale=1, minimum-scale=1,
 *    maximum-scale=1, user-scalable=no`, other keys kept (`lockedViewportContent()`), and a
 *    pinch guard stops WebKit `gesture*` events, more than one touch and ctrl+wheel
 *    (preventDefault; listeners `{ passive: false, capture: true }`).
 *  - A tap calls `documentElement.requestFullscreen({ navigationUI: 'hide' })` (webkit/moz/ms
 *    fallbacks); leaving fullscreen asks again on a later tap. Here any tap does (no prompt).
 *  - iPhone Safari only collapses its bars after a real document scroll, so a 200dvh layer in
 *    normal flow takes the swipe while the game stays fixed on screen; done once the page has
 *    scrolled min(80, max(24, maxScroll / 4)) px (never from the finger distance: locking too
 *    early stops Safari from collapsing); afterwards the layer stays (z-index -1, no pointer
 *    events) and the page stays `pan-y` so the bars remain controllable. Skipped in an iframe
 *    and in in-app browsers. The arrow is CSS and the text comes from the game. The page's
 *    overflow is opened by an attribute on <html> and a stylesheet rule: LayaAir puts
 *    `overflow: hidden` inline on <body> when it boots.
 *
 * Why every piece is needed: Android browsers honour `user-scalable=no`; iOS Safari and
 * WKWebView (WeChat on iPhone) have ignored it since iOS 10, so the page also needs
 * `touch-action` other than auto (stops double-tap zoom, iOS 13+) and the `gesture*` guard
 * (pinch). `touch-action` goes on <html> and <body> here: `none`, or `pan-y` when the swipe-up
 * layer is used (the page has to scroll; pan-y still allows no zoom). A panel that scrolls must
 * set `touch-action: pan-x pan-y` itself: in WebKit a scroll container starts touch-action
 * afresh, so it would otherwise zoom on a double tap again.
 *
 * The whole strategy (every platform): docs/routes/mobile-web-fullscreen.md.
 */
export interface PageLockDevice {
  /** iPhone / iPad (iPadOS reports a Mac with touch). No page fullscreen there. */
  readonly ios: boolean;
  /** A touch screen is the main pointer (`(pointer: coarse)`). */
  readonly touch: boolean;
  /** An iPhone browser tab (Safari, Chrome, …) at the top level: not an in-app browser such as
   *  WeChat, not an iframe, not a home-screen app. Only there can a scroll hide the bars. */
  readonly iphoneBrowser?: boolean;
}

export interface SwipeUpOptions {
  /** The game's root element. It must stay on screen while the page scrolls under it: give it
   *  `position: fixed` in the game's CSS (if it is not fixed, it is pinned inline). */
  readonly game: HTMLElement;
  /** Text under the arrow (the game's language). */
  readonly label?: string;
  /** Degrees to turn the text so the player can read it (e.g. 90 while the game is turned);
   *  the arrow keeps pointing up the screen, which is the way the page has to be swiped. */
  readonly labelTurn?: () => number;
  /** Stacking order of the layer while it waits for the swipe. Default 50. */
  readonly zIndex?: number;
  readonly onDone?: () => void;
}

export interface PageLockOptions {
  /** Ask for native fullscreen on a tap (touch devices with the Fullscreen API). Default true. */
  fullscreen?: boolean;
  /** Checked on each tap before asking; return false to wait (e.g. during a fight). */
  fullscreenWhen?: () => boolean;
  /** Give up asking after this many refusals (a browser or WebView that says no). Default 2. */
  maxFullscreenFailures?: number;
  /** iPhone browsers: the one-time swipe-up layer. Off unless given. */
  iosSwipeUp?: SwipeUpOptions;
  signal?: AbortSignal;
  /** Override the detected device (tests). */
  device?: PageLockDevice;
}

export type SwipeUpPhase = 'off' | 'active' | 'done';

export interface PageLockState {
  readonly fullscreen: boolean;
  readonly canFullscreen: boolean;
  readonly requests: number;
  readonly failures: number;
  readonly viewport: string;
  readonly swipeUp: SwipeUpPhase;
}

export interface PageLock {
  readonly state: () => PageLockState;
  dispose(): void;
}

const LOCKED: Record<string, string> = {
  width: 'device-width',
  'initial-scale': '1',
  'minimum-scale': '1',
  'maximum-scale': '1',
  'user-scalable': 'no',
};

/** A viewport `content` with the zoom keys locked; every other key (e.g. `viewport-fit=cover`) is kept. */
export function lockedViewportContent(content: string): string {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const token of content.split(',')) {
    const item = token.trim();
    if (!item) continue;
    const key = item.split('=')[0]!.trim().toLowerCase();
    if (key in LOCKED) {
      if (!seen.has(key)) out.push(`${key}=${LOCKED[key]}`);
      seen.add(key);
      continue;
    }
    out.push(item);
  }
  for (const key of Object.keys(LOCKED)) if (!seen.has(key)) out.push(`${key}=${LOCKED[key]}`);
  return out.join(', ');
}

/** How far (px) the page must have scrolled before the swipe-up counts (the production rule); Infinity
 *  when the page cannot scroll far enough (then the layer is dropped at once). */
export function swipeUpThreshold(maxScroll: number): number {
  if (!(maxScroll >= 24)) return Infinity;
  return Math.min(80, Math.max(24, Math.floor(maxScroll / 4)));
}

/** In-app browsers (their bars do not collapse) and an app shell's marker. */
const IN_APP = /MicroMessenger|Line\/|FBAN|FBAV|Instagram|closeSwipe/i;

export function detectPageLockDevice(): PageLockDevice {
  const nav = globalThis.navigator as (Navigator & { standalone?: boolean }) | undefined;
  const ua = nav?.userAgent ?? '';
  const ios = /iP(hone|ad|od)/.test(ua) || (nav?.platform === 'MacIntel' && (nav?.maxTouchPoints ?? 0) > 1);
  const media = (q: string) => (typeof matchMedia === 'function' ? matchMedia(q).matches : false);
  const touch = media('(pointer: coarse)');
  let top = false;
  try {
    top = window.top === window.self;
  } catch {
    top = false;
  }
  const iphoneBrowser = /iP(hone|od)/.test(ua) && /Safari\//.test(ua) && !IN_APP.test(ua) && nav?.standalone !== true && !media('(display-mode: standalone)') && top;
  return { ios, touch, iphoneBrowser };
}

type FullscreenDoc = Document & {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
};
type FullscreenEl = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

const fullscreenElement = (doc: FullscreenDoc) =>
  doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement || null;

export function lockPage(options: PageLockOptions = {}): PageLock {
  const doc = document as FullscreenDoc;
  const root = doc.documentElement as FullscreenEl;
  const device = options.device ?? detectPageLockDevice();
  const swipe = options.iosSwipeUp && device.iphoneBrowser && doc.body ? options.iosSwipeUp : null;
  const cleanups: (() => void)[] = [];
  const listen = (target: EventTarget, type: string, fn: (event: any) => void, opts: AddEventListenerOptions) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };
  const guard: AddEventListenerOptions = { passive: false, capture: true };

  // 1. viewport: no zoom (Android, XWeb)
  let meta = doc.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
  const created = !meta;
  if (!meta) {
    meta = doc.createElement('meta') as HTMLMetaElement;
    meta.setAttribute('name', 'viewport');
    (doc.head ?? root).appendChild(meta);
  }
  const before = meta.getAttribute('content');
  const viewport = lockedViewportContent(before ?? '');
  meta.setAttribute('content', viewport);
  cleanups.push(() => {
    if (created) meta!.remove?.();
    else if (before === null) meta!.removeAttribute('content');
    else meta!.setAttribute('content', before);
  });

  // 2. touch-action on the page (iOS double tap); no rubber band unless the page must scroll
  for (const el of [root, doc.body].filter(Boolean) as HTMLElement[]) {
    const old = { touchAction: el.style.touchAction, overscroll: el.style.getPropertyValue?.('overscroll-behavior') ?? '' };
    el.style.touchAction = swipe ? 'pan-y' : 'none';
    if (!swipe) el.style.setProperty?.('overscroll-behavior', 'none');
    cleanups.push(() => {
      el.style.touchAction = old.touchAction;
      el.style.setProperty?.('overscroll-behavior', old.overscroll);
    });
  }

  // 3. pinch: WebKit gesture events, a second finger moving, ctrl+wheel (trackpad pinch)
  const stop = (event: Event) => event.preventDefault();
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    listen(window, type, stop, guard);
    listen(doc, type, stop, guard);
  }
  const multiTouch = (event: TouchEvent) => {
    if (event.touches && event.touches.length > 1 && event.cancelable !== false) event.preventDefault();
  };
  // touchmove only: cancelling a second finger's touchstart would also cancel the click a
  // menu button gets from it; the controls themselves listen to pointer events, which are
  // dispatched before touch events and are not affected.
  listen(doc, 'touchmove', multiTouch, guard);
  listen(window, 'wheel', (event: WheelEvent) => event.ctrlKey && event.preventDefault(), guard);

  // 4. fullscreen on a tap (not on iPhones; not on a mouse)
  const api = !!(root.requestFullscreen || root.webkitRequestFullscreen || root.mozRequestFullScreen || root.msRequestFullscreen);
  const enabled = doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? true;
  const canFullscreen = options.fullscreen !== false && device.touch && !device.ios && api && enabled !== false;
  const maxFailures = options.maxFullscreenFailures ?? 2;
  let requests = 0,
    failures = 0,
    pending = false;
  const failed = () => {
    failures++;
    pending = false;
  };
  const request = () => {
    pending = true;
    requests++;
    try {
      let result: Promise<void> | void;
      if (root.requestFullscreen) {
        try {
          result = root.requestFullscreen({ navigationUI: 'hide' });
        } catch {
          result = root.requestFullscreen();
        }
      } else result = (root.webkitRequestFullscreen || root.mozRequestFullScreen || root.msRequestFullscreen)!.call(root);
      if (result && typeof result.then === 'function') result.then(() => (pending = false), failed);
      else pending = false;
    } catch {
      failed();
    }
  };
  if (canFullscreen) {
    listen(
      doc,
      'pointerup',
      (event: PointerEvent) => {
        if (event.pointerType === 'mouse' || pending || failures >= maxFailures) return;
        if (fullscreenElement(doc)) return;
        if (options.fullscreenWhen && !options.fullscreenWhen()) return;
        request();
      },
      { capture: true, passive: true },
    );
  }

  // 5. iPhone browsers: the one-time swipe-up layer
  const gate = swipe ? startSwipeUp(doc, swipe, listen, cleanups) : null;

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    while (cleanups.length) cleanups.pop()!();
  };
  options.signal?.addEventListener('abort', dispose, { once: true });
  return {
    state: () => ({ fullscreen: !!fullscreenElement(doc), canFullscreen, requests, failures, viewport, swipeUp: gate ? gate.phase() : 'off' }),
    dispose,
  };
}

const SWIPE_CSS = `
html[data-cp-swipe-up],html[data-cp-swipe-up] body{overflow:visible!important}
#cp-swipe-up{display:block;position:relative;width:100%;height:200vh;height:200svh;height:200dvh;margin:0;padding:0;pointer-events:auto;touch-action:pan-y}
#cp-swipe-up .cp-swipe-veil{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;background:rgba(20,10,4,.6)}
#cp-swipe-up .cp-swipe-box{display:flex;flex-direction:column;align-items:center;gap:clamp(10px,3vmin,22px)}
#cp-swipe-up .cp-swipe-arrow{position:relative;width:80px;height:136px}
#cp-swipe-up .cp-swipe-arrow i{position:absolute;left:17px;width:46px;height:46px;border-top:9px solid #fff;border-left:9px solid #fff;border-radius:4px;transform:rotate(45deg);opacity:0;animation:cp-swipe-rise 1.5s ease-in-out infinite;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))}
#cp-swipe-up .cp-swipe-arrow i:nth-child(1){top:80px}
#cp-swipe-up .cp-swipe-arrow i:nth-child(2){top:46px;animation-delay:.18s}
#cp-swipe-up .cp-swipe-arrow i:nth-child(3){top:12px;animation-delay:.36s}
#cp-swipe-up .cp-swipe-label{color:#fff;font-weight:700;font-size:clamp(16px,4.6vmin,26px);text-align:center;text-shadow:0 2px 4px rgba(0,0,0,.55);padding:8px 20px;border-radius:999px;background:rgba(0,0,0,.45);white-space:nowrap}
@keyframes cp-swipe-rise{0%{opacity:.15;margin-top:16px}40%{opacity:1}100%{opacity:.15;margin-top:-16px}}
`;

function startSwipeUp(
  doc: Document,
  o: SwipeUpOptions,
  listen: (target: EventTarget, type: string, fn: (event: any) => void, opts: AddEventListenerOptions) => void,
  cleanups: (() => void)[],
): { phase: () => SwipeUpPhase } {
  const html = doc.documentElement,
    body = doc.body!;
  let phase: SwipeUpPhase = 'active';

  // the page has to be able to scroll under the game. An attribute and an !important rule, not
  // inline styles: the engine sets body's inline overflow back to hidden when it boots (LayaAir),
  // and a hidden body overflow is the viewport's, so a finger could not scroll the page.
  html.setAttribute('data-cp-swipe-up', '');
  cleanups.push(() => html.removeAttribute('data-cp-swipe-up'));
  const pinned = typeof getComputedStyle === 'function' && getComputedStyle(o.game).position !== 'fixed';
  if (pinned) {
    const old = { position: o.game.style.position, left: o.game.style.left, top: o.game.style.top };
    Object.assign(o.game.style, { position: 'fixed', left: '0', top: '0' });
    cleanups.push(() => Object.assign(o.game.style, old));
  }

  const style = doc.createElement('style');
  style.textContent = SWIPE_CSS;
  (doc.head ?? html).appendChild(style);
  const layer = doc.createElement('div');
  layer.id = 'cp-swipe-up';
  layer.style.zIndex = String(o.zIndex ?? 50);
  const veil = doc.createElement('div');
  veil.className = 'cp-swipe-veil';
  const box = doc.createElement('div');
  box.className = 'cp-swipe-box';
  const arrow = doc.createElement('div');
  arrow.className = 'cp-swipe-arrow';
  for (let i = 0; i < 3; i++) arrow.appendChild(doc.createElement('i'));
  box.appendChild(arrow);
  if (o.label) {
    const label = doc.createElement('div');
    label.className = 'cp-swipe-label';
    label.textContent = o.label;
    box.appendChild(label);
  }
  veil.appendChild(box);
  layer.appendChild(veil);
  body.appendChild(layer);
  cleanups.push(() => {
    layer.remove();
    style.remove();
  });

  // the text turns with the game; the arrow keeps pointing up the screen
  const turn = () => {
    const deg = o.labelTurn?.() ?? 0;
    box.style.transform = deg ? `rotate(${deg}deg)` : '';
    arrow.style.transform = deg ? `rotate(${-deg}deg)` : '';
  };
  turn();

  const scroller = doc.scrollingElement ?? html;
  scroller.scrollTop = 0;
  const viewHeight = () => Math.max(1, window.innerHeight || html.clientHeight || 1);
  const scrollTop = () => Math.max(0, scroller.scrollTop || 0, window.scrollY || 0, -layer.getBoundingClientRect().top);
  const maxScroll = () =>
    Math.max(0, (scroller.scrollHeight || 0) - (scroller.clientHeight || viewHeight()), layer.getBoundingClientRect().height - viewHeight());
  const done = () => {
    if (phase !== 'active') return;
    phase = 'done';
    // stays in the page (the scroll that hid the bars must stay possible), out of the way
    layer.style.zIndex = '-1';
    layer.style.pointerEvents = 'none';
    veil.style.display = 'none';
    o.onDone?.();
  };
  const check = () => {
    if (phase === 'active' && scrollTop() >= swipeUpThreshold(maxScroll())) done();
  };
  listen(window, 'scroll', check, { passive: true });
  listen(doc, 'scroll', check, { passive: true });
  listen(window, 'resize', turn, { passive: true });
  listen(window, 'orientationchange', turn, { passive: true });
  // nothing to scroll (the page cannot scroll far enough): drop the layer at once
  requestAnimationFrame(() => {
    if (phase === 'active' && swipeUpThreshold(maxScroll()) === Infinity) done();
  });
  return { phase: () => phase };
}
