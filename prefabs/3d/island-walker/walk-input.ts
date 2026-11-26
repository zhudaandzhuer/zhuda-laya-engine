// Keyboard, mouse and touch for walking a character in third person:
// - WASD or the arrow keys walk, read against the way the camera faces;
// - a touch on the left of the screen (38% of its width) is a walking stick: drag from
//   where the finger came down, 60 px for a full push;
// - any other drag turns the view (yaw, pitch), two fingers pinch to zoom, the wheel zooms.
// The view it turns is an orbit goal (FollowCamera.goal); stick() gives the walker its push.
//
//   const input = new WalkInput(canvas, follow.goal);
//   runtime.start((dt) => walker.update(dt, input.stick(follow.orbit.yaw)));
import { clamp } from '../math.ts';

export interface WalkInputOptions {
  /** Share of the screen's width, from the left, where a touch is the walking stick. Default 0.38. */
  stickShare?: number;
  /** Pixels of drag for a full push of the stick. Default 60. */
  stickReach?: number;
  /** Pitch limits, radians. Default 0.02..1.3. */
  pitch?: [number, number];
  /** Zoom limits, metres. Default 3..40. */
  distance?: [number, number];
}

export class WalkInput {
  private readonly keys = new Set<string>();
  private readonly pointers = new Map<number, { x: number; y: number; sx: number; sy: number; left: boolean }>();
  private pinch = 0;
  private touchStick: [number, number] = [0, 0];
  private readonly cleanups: (() => void)[] = [];

  /** `view`: the orbit goal it turns and zooms (yaw, pitch, distance). */
  constructor(canvas: HTMLElement, view: { yaw: number; pitch: number; distance: number }, options: WalkInputOptions = {}) {
    const share = options.stickShare ?? 0.38,
      reach = options.stickReach ?? 60;
    const [lowPitch, highPitch] = options.pitch ?? [0.02, 1.3];
    const [near, far] = options.distance ?? [3, 40];
    const listen = <K extends keyof HTMLElementEventMap>(target: EventTarget, type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      target.addEventListener(type, fn as EventListener, opts);
      this.cleanups.push(() => target.removeEventListener(type, fn as EventListener, opts));
    };
    listen(window, 'keydown', (e) => this.keys.add(e.key.toLowerCase()));
    listen(window, 'keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    listen(window, 'blur', () => this.keys.clear());
    listen(canvas, 'pointerdown', (e) => {
      canvas.setPointerCapture?.(e.pointerId);
      const rect = canvas.getBoundingClientRect();
      // A touch on the left of the screen is the walking stick; anything else turns the view.
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, left: e.pointerType === 'touch' && e.clientX - rect.left < rect.width * share });
      this.pinch = 0;
    });
    listen(canvas, 'pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x,
        dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (p.left) {
        const l = Math.hypot(p.x - p.sx, p.y - p.sy);
        const k = Math.min(1, l / reach) / (l || 1);
        this.touchStick = [(p.x - p.sx) * k, (p.y - p.sy) * k];
        return;
      }
      const turning = [...this.pointers.values()].filter((q) => !q.left);
      if (turning.length === 2) {
        const span = Math.hypot(turning[0].x - turning[1].x, turning[0].y - turning[1].y);
        if (this.pinch) view.distance = clamp(view.distance * (this.pinch / span), near, far);
        this.pinch = span;
        return;
      }
      view.yaw -= dx * 0.006;
      view.pitch = clamp(view.pitch + dy * 0.004, lowPitch, highPitch);
    });
    const lift = (e: PointerEvent) => {
      if (this.pointers.get(e.pointerId)?.left) this.touchStick = [0, 0];
      this.pointers.delete(e.pointerId);
      this.pinch = 0;
    };
    listen(canvas, 'pointerup', lift);
    listen(canvas, 'pointercancel', lift);
    listen(
      canvas,
      'wheel',
      (e) => {
        e.preventDefault();
        view.distance = clamp(view.distance * Math.exp(e.deltaY * 0.001), near, far);
      },
      { passive: false },
    );
  }

  /** The walk this frame in the world's x and z (length 0..1), for a camera at `yaw` (FollowCamera.orbit.yaw). */
  stick(yaw: number): [number, number] {
    const keys = this.keys;
    let kx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + this.touchStick[0],
      kz = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0) + this.touchStick[1];
    const kl = Math.hypot(kx, kz);
    if (kl > 1) (kx /= kl), (kz /= kl);
    const fwd: [number, number] = [-Math.sin(yaw), -Math.cos(yaw)],
      right: [number, number] = [Math.cos(yaw), -Math.sin(yaw)];
    return [right[0] * kx - fwd[0] * kz, right[1] * kx - fwd[1] * kz];
  }

  /** Lets go of every key, finger and the stick (a pause, a menu, a cut). */
  clear() {
    this.keys.clear();
    this.pointers.clear();
    this.pinch = 0;
    this.touchStick = [0, 0];
  }

  dispose() {
    this.clear();
    for (const off of this.cleanups.splice(0)) off();
  }
}
