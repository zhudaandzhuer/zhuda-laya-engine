/**
 * Movement from the keyboard and a stick, and who decides where the player aims.
 */

/** Keys that walk: WASD and the arrows. */
export const MOVE_KEYS: readonly string[] = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

/**
 * Walking direction from held keys plus a stick tilt, clamped to length 1.
 * Screen axes: +x right, +y down.
 */
export function moveVector(keys: ReadonlySet<string>, stickX = 0, stickY = 0): { x: number; y: number } {
  let x = stickX,
    y = stickY;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  const length = Math.hypot(x, y);
  if (length > 1) {
    x /= length;
    y /= length;
  }
  return { x, y };
}

/**
 * The last thing the player touched decides the aim (a torch, a gun, a gaze):
 * a hovering mouse aims for `holdMs` after it last moved; a movement key or a
 * press on the stick hands the aim back to the walking direction at once.
 */
export interface PointerAim {
  /** A mouse moved to (x, y), in whatever units the game uses. */
  point(x: number, y: number): void;
  /** Movement took over (a walk key, the stick). */
  release(): void;
  /** The mouse still holds the aim. */
  active(): boolean;
  readonly x: number;
  readonly y: number;
}

export function createPointerAim(options: { holdMs?: number; now?: () => number } = {}): PointerAim {
  const holdMs = options.holdMs ?? 4000,
    now = options.now ?? (() => performance.now());
  let x = 0,
    y = 0,
    until = 0;
  return {
    point(px, py) {
      x = px;
      y = py;
      until = now() + holdMs;
    },
    release() {
      until = 0;
    },
    active: () => now() < until,
    get x() {
      return x;
    },
    get y() {
      return y;
    },
  };
}
