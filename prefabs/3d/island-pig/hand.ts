// The player's hand over the island: press a character to pick it up by the scruff,
// move to carry and swing it, let go to throw it (the hand's speed is the throw);
// drag empty space to turn the camera, wheel or pinch to come closer. Mouse and touch
// alike (pointer events); a second finger pinches. The camera itself is the game's:
// the hand only moves `orbit` (yaw, pitch, distance), which the game eases toward.
import { add, approach, clamp, norm, scale, type V3 } from '../math.ts';
import type { Pig } from './pig.ts';

export interface OrbitGoal {
  yaw: number;
  pitch: number;
  distance: number;
}

export interface HandOptions {
  canvas: HTMLCanvasElement;
  camera: Laya.Camera;
  /** The orbit the game eases its camera toward: the hand turns and zooms it. */
  orbit: OrbitGoal;
  /** The camera's yaw now (the drag plane faces it). */
  yaw(): number;
  /** Who can be picked up (the nearest along the pointer's ray that is not held wins). */
  pickable(): readonly Pig[];
  /** The island's top, so a carried character stays above it. */
  ground(x: number, z: number): number | null;
  /** Nearest and farthest the camera may come (metres). */
  minDistance: number;
  maxDistance: number;
  /** Wheel zooms (false inside a page that scrolls past the scene). */
  wheel?: boolean;
  /**
   * While one is held, the drag plane moves forward to this point's depth (the island's middle),
   * so one picked up far back can be carried to the front. Leave out to keep the plane where it was grabbed.
   */
  bringForwardTo?: () => V3;
  /** The game's own reactions: what was grabbed and where the pointer is, the pointer moving while holding, the hand letting go. */
  onGrab?(pig: Pig, at: [number, number]): void;
  onCarry?(at: [number, number]): void;
  onRelease?(pig: Pig): void;
}

export interface Hand {
  /** Pointer events by hand (checks and scripted scenes): an id, and the place on the page. */
  press(pointerId: number, clientX: number, clientY: number): void;
  move(pointerId: number, clientX: number, clientY: number): void;
  release(pointerId: number): void;
  /** Each frame: the hand lifts what it holds a little and, with bringForwardTo, brings the drag plane forward. */
  update(dt: number): void;
  /** The character held now. */
  readonly held: Pig | null;
  /** Seconds since the player last touched (the game may turn the camera slowly when idle); set to 0 to wake it. */
  idle: number;
  /** The page point of a world point (for checks: where to press to take a character). */
  project(p: V3): [number, number];
  dispose(): void;
}

/** Where a ray (origin o, direction d) meets a plane, or null when it runs along it or away from it. */
export function planeHit(o: V3, d: V3, plane: { point: V3; normal: V3 }): V3 | null {
  const denom = d[0] * plane.normal[0] + d[1] * plane.normal[1] + d[2] * plane.normal[2];
  if (Math.abs(denom) < 1e-4) return null;
  const t = ((plane.point[0] - o[0]) * plane.normal[0] + (plane.point[1] - o[1]) * plane.normal[1] + (plane.point[2] - o[2]) * plane.normal[2]) / denom;
  return t > 0 ? add(o, scale(d, t)) : null;
}

export function createHand(o: HandOptions): Hand {
  const { canvas, camera, orbit } = o;
  const pointers = new Map<number, { x: number; y: number }>();
  let grabbing: number | null = null;
  let dragPlane: { point: V3; normal: V3 } | null = null;
  let held: Pig | null = null;
  let pinch = 0;
  let lift = 0;
  let at: [number, number] = [0, 0];
  const ray = new Laya.Ray(new Laya.Vector3(), new Laya.Vector3());
  const rayAt = (clientX: number, clientY: number): [V3, V3] => {
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * Laya.stage.width,
      y = ((clientY - rect.top) / rect.height) * Laya.stage.height;
    camera.viewportPointToRay(new Laya.Vector2(x, y), ray);
    return [
      [ray.origin.x, ray.origin.y, ray.origin.z],
      norm([ray.direction.x, ray.direction.y, ray.direction.z]),
    ];
  };
  /** The nearest character along a ray, not one already held. */
  const hitPig = (origin: V3, dir: V3) => {
    let best: Pig | null = null,
      bestT = Infinity;
    for (const p of o.pickable()) {
      if (p.held) continue;
      const t = p.hit(origin, dir);
      if (t !== null && t < bestT) (bestT = t), (best = p);
    }
    return best;
  };
  const handTo = (clientX: number, clientY: number) => {
    at = [clientX, clientY];
    if (!dragPlane) return;
    const [origin, dir] = rayAt(clientX, clientY);
    const hit = planeHit(origin, dir, dragPlane);
    if (!hit) return;
    const g = o.ground(hit[0], hit[2]);
    hit[1] = Math.max(hit[1] + lift, (g ?? -40) + 1.08);
    held?.drag(hit);
  };
  const hand: Hand = {
    idle: 0,
    get held() {
      return held;
    },
    press(pointerId, clientX, clientY) {
      pointers.set(pointerId, { x: clientX, y: clientY });
      hand.idle = 0;
      if (pointers.size !== 1) return void (pinch = 0);
      const [origin, dir] = rayAt(clientX, clientY);
      const p = hitPig(origin, dir);
      if (p) {
        grabbing = pointerId;
        held = p;
        p.grab();
        const yaw = o.yaw();
        dragPlane = { point: p.scruff, normal: [Math.sin(yaw), 0, Math.cos(yaw)] };
        lift = 0;
        handTo(clientX, clientY);
        canvas.style.cursor = 'none';
        o.onGrab?.(p, [clientX, clientY]);
      }
    },
    move(pointerId, clientX, clientY) {
      const p = pointers.get(pointerId);
      if (!p) {
        const [origin, dir] = rayAt(clientX, clientY);
        canvas.style.cursor = hitPig(origin, dir) ? 'grab' : 'default';
        return;
      }
      const dx = clientX - p.x,
        dy = clientY - p.y;
      p.x = clientX;
      p.y = clientY;
      hand.idle = 0;
      if (grabbing === pointerId) {
        o.onCarry?.([clientX, clientY]);
        return handTo(clientX, clientY);
      }
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const span = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) orbit.distance = clamp(orbit.distance * (pinch / span), o.minDistance, o.maxDistance);
        pinch = span;
        return;
      }
      orbit.yaw -= dx * 0.006;
      orbit.pitch = clamp(orbit.pitch + dy * 0.004, -0.05, 1.25);
    },
    release(pointerId) {
      pointers.delete(pointerId);
      if (grabbing === pointerId) {
        grabbing = null;
        dragPlane = null;
        const p = held;
        held = null;
        p?.release();
        canvas.style.cursor = 'default';
        if (p) o.onRelease?.(p);
      }
      pinch = 0;
    },
    update(dt) {
      if (!held || !dragPlane) return;
      lift = approach(lift, 0.55, 8, dt);
      if (!o.bringForwardTo) return;
      // One grabbed far back (behind the tree or the house) is brought forward to the island's
      // middle depth while held, so the hand can carry it to the front instead of only sideways.
      const f = dragPlane.normal;
      const depth = (q: V3) => q[0] * f[0] + q[2] * f[2];
      const want = Math.max(depth(o.bringForwardTo()), depth(dragPlane.point)); // the normal points at the camera: larger is nearer
      const now = depth(dragPlane.point);
      if (want - now > 0.01) {
        const step = Math.min(want - now, dt * 6);
        dragPlane.point = add(dragPlane.point, scale([f[0], 0, f[2]], step));
        handTo(at[0], at[1]);
      }
    },
    project(p) {
      const out = new Laya.Vector4();
      camera.worldToViewportPoint(new Laya.Vector3(...p), out);
      const rect = canvas.getBoundingClientRect();
      return [rect.left + (out.x / Laya.stage.width) * rect.width, rect.top + (out.y / Laya.stage.height) * rect.height];
    },
    dispose() {
      for (const [type, fn] of listeners) canvas.removeEventListener(type, fn as EventListener);
      window.removeEventListener('blur', onBlur);
    },
  };
  const listeners: [string, (e: PointerEvent & WheelEvent) => void][] = [
    [
      'pointerdown',
      (e) => {
        canvas.setPointerCapture?.(e.pointerId);
        hand.press(e.pointerId, e.clientX, e.clientY);
      },
    ],
    ['pointermove', (e) => hand.move(e.pointerId, e.clientX, e.clientY)],
    ['pointerup', (e) => hand.release(e.pointerId)],
    ['pointercancel', (e) => hand.release(e.pointerId)],
  ];
  for (const [type, fn] of listeners) canvas.addEventListener(type, fn as EventListener);
  const onWheel = (e: WheelEvent) => {
    // Inside a page the wheel scrolls the page, not the scene.
    if (o.wheel === false) return;
    e.preventDefault();
    orbit.distance = clamp(orbit.distance * Math.exp(e.deltaY * 0.001), o.minDistance, o.maxDistance);
  };
  canvas.addEventListener('wheel', onWheel, { passive: false });
  listeners.push(['wheel', onWheel as (e: PointerEvent & WheelEvent) => void]);
  const onBlur = () => {
    if (grabbing !== null) hand.release(grabbing);
    pointers.clear();
  };
  window.addEventListener('blur', onBlur);
  return hand;
}
