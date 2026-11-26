// Helpers for a 2D game on the engine's Laya stage: a design-size root fitted to the screen,
// text, shapes, pictures, buttons (the engine's vector button), click areas that a recorded run
// can find by name, and tweens on the session's clock.
import { ZhudaUI } from 'zhuda-laya-engine';

export const FONT = '"Noto Sans TC","Noto Sans CJK TC","PingFang TC","Microsoft JhengHei",sans-serif';

/** A root of `w` × `h` design units, scaled and centred in the stage whenever it changes size. */
export function designRoot(w: number, h: number): { root: Laya.Sprite; fit: () => void; scale: () => number } {
  const root = new Laya.Sprite();
  root.name = 'design';
  Laya.stage.addChild(root);
  let k = 1;
  const fit = () => {
    k = Math.min(Laya.stage.width / w, Laya.stage.height / h);
    root.scale(k, k);
    root.pos((Laya.stage.width - w * k) / 2, (Laya.stage.height - h * k) / 2);
  };
  fit();
  return { root, fit, scale: () => k };
}

export interface TextOptions { x?: number; y?: number; w?: number; h?: number; size?: number; color?: string; align?: 'left' | 'center' | 'right'; valign?: 'top' | 'middle' | 'bottom'; bold?: boolean; wrap?: boolean; stroke?: string; leading?: number }
export function text(parent: Laya.Sprite, value: string, o: TextOptions = {}): Laya.Text {
  const t = new Laya.Text();
  t.font = FONT;
  t.fontSize = o.size ?? 24;
  t.color = o.color ?? '#ffffff';
  t.align = o.align ?? 'left';
  t.valign = o.valign ?? 'top';
  t.bold = o.bold ?? false;
  t.wordWrap = o.wrap ?? false;
  t.leading = o.leading ?? 0;
  if (o.stroke) (t.stroke = 4), (t.strokeColor = o.stroke);
  t.width = o.w ?? 300;
  if (o.h) t.height = o.h;
  t.text = value;
  t.pos(o.x ?? 0, o.y ?? 0);
  t.mouseEnabled = false;
  parent.addChild(t);
  return t;
}

export function node(parent: Laya.Sprite, x = 0, y = 0, name = ''): Laya.Sprite {
  const s = new Laya.Sprite();
  s.name = name;
  s.pos(x, y);
  parent.addChild(s);
  return s;
}

export function rect(parent: Laya.Sprite, x: number, y: number, w: number, h: number, fill: string, radius = 0, line?: string, lineWidth = 2): Laya.Sprite {
  const s = node(parent, x, y);
  if (radius) s.graphics.drawRoundRect(0, 0, w, h, radius, radius, radius, radius, fill, line, line ? lineWidth : 0);
  else s.graphics.drawRect(0, 0, w, h, fill, line, line ? lineWidth : 0);
  s.size(w, h);
  return s;
}

/** Where a named control is on the page (client pixels), so a recorded run can really click it. */
export const hot: Record<string, [number, number]> = {};
const hotNodes = new Map<string, { s: Laya.Sprite; w: number; h: number }>();
export function refreshHot(): void {
  for (const k of Object.keys(hot)) delete hot[k];
  const canvas = document.querySelector('canvas') as HTMLCanvasElement;
  const box = canvas.getBoundingClientRect();
  const kx = box.width / Laya.stage.width, ky = box.height / Laya.stage.height;
  for (const [name, { s, w, h }] of hotNodes) {
    if (s.destroyed || !s.stage || !shown(s)) {
      if (s.destroyed) hotNodes.delete(name);
      continue;
    }
    const p = s.localToGlobal(new Laya.Point(w / 2, h / 2));
    hot[name] = [Math.round(box.left + p.x * kx), Math.round(box.top + p.y * ky)];
  }
}
function shown(s: Laya.Node | null): boolean {
  for (let n = s as Laya.Sprite | null; n && n !== (Laya.stage as unknown as Laya.Sprite); n = n.parent as Laya.Sprite | null) if (!n.visible) return false;
  return true;
}

export function clickable(s: Laya.Sprite, w: number, h: number, go: () => void, name?: string): void {
  s.size(w, h);
  s.hitArea = new Laya.Rectangle(0, 0, w, h);
  s.mouseEnabled = true;
  s.on(Laya.Event.CLICK, null, (e: Laya.Event) => {
    e.stopPropagation();
    go();
  });
  if (name) hotNodes.set(name, { s, w, h });
}

const TONES = {
  gold: { bgColor: '#e0a93a', hoverBgColor: '#f0c050', activeBgColor: '#c08a20', borderColor: '#7a5210', textColor: '#3a2300' },
  red: { bgColor: '#c8433a', hoverBgColor: '#dc5a50', activeBgColor: '#a02f28', borderColor: '#5c1410', textColor: '#ffffff' },
  blue: { bgColor: '#3d6fb0', hoverBgColor: '#5587c8', activeBgColor: '#2c5590', borderColor: '#17335c', textColor: '#ffffff' },
  dark: { bgColor: '#2b3140', hoverBgColor: '#3a4256', activeBgColor: '#20252f', borderColor: '#596178', textColor: '#e8ecf5' },
  off: { bgColor: '#4a4d55', hoverBgColor: '#4a4d55', activeBgColor: '#4a4d55', borderColor: '#33363c', textColor: '#9a9da5' },
};
/** A button drawn by the engine's vector button, with a red dot when asked. */
export function button(parent: Laya.Sprite, x: number, y: number, w: number, h: number, label: string, tone: keyof typeof TONES, go: () => void, name?: string, dot = false, size = 26): Laya.Sprite {
  const b = ZhudaUI.createVectorButton(parent, x, y, label, { width: w, height: h, radius: Math.min(16, h / 3), borderWidth: 2, fontSize: size, bold: true, ...TONES[tone] }, go);
  b.label.font = FONT;
  if (name) hotNodes.set(name, { s: b.root, w, h });
  if (dot) redDot(b.root, w - 8, 6);
  return b.root;
}
export function redDot(parent: Laya.Sprite, x: number, y: number): void {
  const d = node(parent, x, y);
  d.graphics.drawCircle(0, 0, 10, '#ff3b30', '#ffffff', 2);
  d.mouseEnabled = false;
}

const textures = new Map<string, Promise<Laya.Texture | null>>();
export function loadTexture(url: string): Promise<Laya.Texture | null> {
  let p = textures.get(url);
  if (!p) textures.set(url, (p = Laya.loader.load(url, Laya.Loader.IMAGE).then((t: unknown) => (t as Laya.Texture) ?? null, () => null)));
  return p;
}
const ready = new Map<string, Laya.Texture>();
export async function preload(urls: string[]): Promise<void> {
  await Promise.all(urls.map(async (u) => {
    const t = await loadTexture(u);
    if (t) ready.set(u, t);
  }));
}
/** Draws a preloaded picture into a new sprite at w × h. */
export function picture(parent: Laya.Sprite, url: string, x: number, y: number, w: number, h: number): Laya.Sprite {
  const s = node(parent, x, y);
  const t = ready.get(url);
  if (t) s.graphics.drawTexture(t, 0, 0, w, h);
  else s.graphics.drawRect(0, 0, w, h, '#333a48');
  s.size(w, h);
  return s;
}

/** Tweens run by the game's frame, on whichever clock the caller advances them with. */
interface Tween { target: any; from: Record<string, number>; to: Record<string, number>; t: number; d: number; ease: (k: number) => number; done?: () => void }
const tweens: Tween[] = [];
export const easeOut = (k: number) => 1 - (1 - k) * (1 - k);
export const easeBack = (k: number) => 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2);
export function tween(target: any, to: Record<string, number>, seconds: number, ease = easeOut, done?: () => void): void {
  const from: Record<string, number> = {};
  for (const k of Object.keys(to)) from[k] = target[k];
  tweens.push({ target, from, to, t: 0, d: seconds, ease, done });
}
export function advanceTweens(dt: number): void {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const w = tweens[i];
    if (w.target.destroyed) {
      tweens.splice(i, 1);
      continue;
    }
    w.t += dt;
    const k = w.ease(Math.min(1, w.t / w.d));
    for (const key of Object.keys(w.to)) w.target[key] = w.from[key] + (w.to[key] - w.from[key]) * k;
    if (w.t >= w.d) (tweens.splice(i, 1), w.done?.());
  }
}

export const short = (n: number): string => (n >= 1e12 ? `${(n / 1e12).toFixed(2)}兆` : n >= 1e8 ? `${(n / 1e8).toFixed(2)}億` : n >= 1e4 ? `${(n / 1e4).toFixed(n >= 1e6 ? 0 : 1)}萬` : String(Math.round(n)));
