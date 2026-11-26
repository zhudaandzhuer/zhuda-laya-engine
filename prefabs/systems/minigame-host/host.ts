// systems/minigame-host/host: a thin bridge to the host a game runs in: a WeChat mini game when
// `wx` exists, the browser otherwise. Numbers kept between sessions, vibration, the inset that keeps
// an interface clear of the capsule button and the notches, subpackages, the share menu, the
// moment the game is hidden, and rewarded and interstitial ads paced by the platform's rules. Every
// call is optional and tolerant of failure, so a game plays the same where a feature is missing.
// The ad unit ids are the game's: pass them to `initAds`, keep them out of the library.
// From the workspace game zhuda-raft-survival (`src/platform.ts`, 2026-11-19), unchanged apart
// from this header. Routes: docs/routes/raft-brawl-3d-minigame.md, drop-merge-2d-minigame.md.

type Wx = Record<string, any>;
const wx: Wx | undefined = (globalThis as { wx?: Wx }).wx;

export const isWeChat = !!wx && typeof wx.getSystemInfoSync === 'function';

export function loadNumber(key: string, fallback = 0): number {
  try {
    const raw = isWeChat ? wx!.getStorageSync(key) : globalThis.localStorage?.getItem(key);
    const n = Number(raw);
    return Number.isFinite(n) && raw !== '' && raw !== null ? n : fallback;
  } catch {
    return fallback;
  }
}

export function saveNumber(key: string, value: number): void {
  try {
    if (isWeChat) wx!.setStorageSync(key, String(value));
    else globalThis.localStorage?.setItem(key, String(value));
  } catch {
    /* storage is a convenience */
  }
}

export function vibrate(strong = false): void {
  try {
    if (isWeChat) wx!.vibrateShort({ type: strong ? 'medium' : 'light' });
  } catch {
    /* optional */
  }
}

/** Top inset (design px) that keeps UI clear of the WeChat capsule button and the status bar. */
export function topInset(designWidth: number): number {
  try {
    if (!isWeChat) return 24;
    const info = wx!.getSystemInfoSync();
    const rect = wx!.getMenuButtonBoundingClientRect?.();
    const bottom = rect && rect.bottom ? rect.bottom : (info.statusBarHeight || 20) + 44;
    return (bottom + 8) * (designWidth / info.windowWidth);
  } catch {
    return 100;
  }
}

/** Safe area for a landscape screen of the given design height: notches on the sides and the WeChat
 * capsule at the top right, all in design pixels. */
export function safeArea(designHeight: number, designWidth: number): { left: number; right: number; capsuleLeft: number; capsuleBottom: number } {
  try {
    if (!isWeChat) return { left: 0, right: 0, capsuleLeft: designWidth, capsuleBottom: 0 };
    const info = wx!.getSystemInfoSync();
    const k = designHeight / info.windowHeight;
    const sa = info.safeArea;
    const left = sa ? sa.left * k : 0;
    const right = sa ? (info.windowWidth - sa.right) * k : 0;
    const rect = wx!.getMenuButtonBoundingClientRect?.();
    return { left, right, capsuleLeft: rect && rect.left ? rect.left * k : designWidth, capsuleBottom: rect && rect.bottom ? rect.bottom * k : 0 };
  } catch {
    return { left: 40, right: 40, capsuleLeft: designWidth - 220, capsuleBottom: 70 };
  }
}

/** Loads a WeChat subpackage (the models live in one so the main package stays under 4 MB). Resolves at
 * once off WeChat, where every file is already there. */
export function loadSubpackage(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isWeChat || typeof wx!.loadSubpackage !== 'function') return resolve();
    wx!.loadSubpackage({ name, success: () => resolve(), fail: (e: { errMsg?: string }) => reject(Error('subpackage ' + name + ': ' + (e?.errMsg ?? 'failed'))) });
  });
}

/** Share menu (user-initiated only: the "..." menu). No rewards are tied to sharing. */
export function enableShare(getTitle: () => string): void {
  if (!isWeChat) return;
  try {
    wx!.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage', 'shareTimeline'] });
    wx!.onShareAppMessage(() => ({ title: getTitle() }));
    wx!.onShareTimeline?.(() => ({ title: getTitle() }));
  } catch {
    /* optional */
  }
}

export function onHide(callback: () => void): void {
  try {
    if (isWeChat) wx!.onHide(callback);
    else globalThis.addEventListener?.('pagehide', callback);
  } catch {
    /* optional */
  }
}

// ---- ads (流量主) -------------------------------------------------------------------------------
// Rules followed (流量主运营规范, ad.weixin.qq.com/docs/74): rewarded video only when the player taps a
// button that says it plays a video; the reward is given only when the video was watched to the end;
// the button only shows when an ad has actually loaded; interstitials only at a natural pause (game
// over), never at launch, at most once every 3 rounds and 60 s.
let rewarded: any;
let rewardedReady = false;
let interstitial: any;
let interstitialUnit = '';
const launchedAt = Date.now();
let lastInterstitial = 0;
let rounds = 0;

export function initAds(units: { rewarded: string; interstitial: string }): void {
  if (!isWeChat) return;
  try {
    if (units.rewarded && typeof wx!.createRewardedVideoAd === 'function') {
      rewarded = wx!.createRewardedVideoAd({ adUnitId: units.rewarded });
      rewarded.onLoad(() => (rewardedReady = true));
      rewarded.onError(() => (rewardedReady = false));
      rewarded.load().catch(() => (rewardedReady = false));
    }
  } catch {
    rewarded = undefined;
  }
  interstitialUnit = units.interstitial;
}

/** Shows the rewarded video; resolves true only when it was watched to the end. */
export function showRewarded(): Promise<boolean> {
  if (!rewarded) return Promise.resolve(false);
  return new Promise((resolve) => {
    const close = (res: { isEnded?: boolean } | undefined) => {
      rewarded.offClose(close);
      rewardedReady = false;
      rewarded.load().catch(() => {});
      resolve(!!(res && res.isEnded));
    };
    try {
      rewarded.onClose(close);
      rewarded.show().catch(() =>
        rewarded.load().then(() => rewarded.show()).catch(() => {
          rewarded.offClose(close);
          resolve(false);
        }),
      );
    } catch {
      resolve(false);
    }
  });
}

export const hasRewarded = (): boolean => !!rewarded && rewardedReady;

/** Call when a round ends; may show an interstitial (every 3rd round, 60 s apart, not in the first 30 s). */
export function roundEnded(): void {
  rounds++;
  if (!isWeChat || !interstitialUnit || typeof wx!.createInterstitialAd !== 'function') return;
  const now = Date.now();
  if (rounds % 3 !== 0 || now - launchedAt < 30000 || now - lastInterstitial < 60000) return;
  try {
    interstitial ??= wx!.createInterstitialAd({ adUnitId: interstitialUnit });
    lastInterstitial = now;
    interstitial.show().catch(() => {});
  } catch {
    /* no ad this time */
  }
}

/** Opens the share sheet when the player taps a share button (no reward is attached to sharing). */
export function shareNow(title: string): void {
  try {
    if (isWeChat) wx!.shareAppMessage({ title });
  } catch {
    /* optional */
  }
}
