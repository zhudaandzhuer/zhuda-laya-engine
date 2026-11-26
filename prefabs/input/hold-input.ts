/**
 * Held actions for touch, mouse and keyboard, for action games where pressing
 * does one thing and letting go another (charge then swing, hold to walk, hold
 * to block), and where two thumbs act at once (walk with one, attack with the other).
 *
 * Each action ("role") is owned by one source at a time — a finger, the mouse or
 * a key — from its press until that same source lets go:
 * - a second finger on a role that is already held is ignored, so one thumb never
 *   ends another thumb's hold;
 * - the pressed element captures its pointer, so the hold survives the finger
 *   sliding off it; a cancelled pointer or lost capture ends it as cancelled;
 * - clear() drops every hold silently (pause, rotation, a hidden page): the game
 *   resets its own state, and no release fires afterwards.
 *
 * padDirection() reads a two-way pad: which half of an element a finger is over,
 * with a dead zone in the middle, so sliding across the middle turns around.
 */

/** Who holds a role: a pointerId, or a key code such as 'KeyJ'. */
export type HoldSource = number | string;

export interface HoldDetail {
  /** The element the hold belongs to (for keys, the one the game named). */
  node: HTMLElement;
  /** The pointer event behind this begin or end; absent for keys. */
  event?: PointerEvent;
}

export interface HoldInputOptions<R extends string> {
  /** A hold started. */
  begin(role: R, detail: HoldDetail): void;
  /** A hold ended: let go (cancelled false), or a cancelled pointer / lost capture (true). */
  end(role: R, cancelled: boolean, detail: HoldDetail): void;
  /** Removes the listeners and clears every hold when it aborts. */
  signal?: AbortSignal;
}

export interface HoldBindOptions {
  /**
   * Runs on each primary press before it is claimed; return false to ignore it
   * (a menu is open, the round is over). It may also get the game ready first.
   */
  accept?: (event: PointerEvent) => boolean;
  /** Each move of the pointer that holds this binding's role (e.g. a pad). */
  move?: (event: PointerEvent) => void;
}

export interface HoldInput<R extends string> {
  /** Presses on `node` hold `role`. Several elements may share a role. */
  bind(node: HTMLElement, role: R, options?: HoldBindOptions): void;
  /** Starts a hold from any source (a key, a focused button). False when the role is already held. */
  press(role: R, source: HoldSource, node: HTMLElement, event?: PointerEvent): boolean;
  /** Ends the hold when `source` is the one holding `role`. */
  release(role: R, source: HoldSource, cancelled?: boolean, event?: PointerEvent): void;
  /** Ends every hold this source owns, e.g. on keyup. */
  releaseSource(source: HoldSource): void;
  held(role: R): boolean;
  /** Drops every hold without calling end(), and gives back captured pointers. */
  clear(): void;
}

export function createHoldInput<R extends string>(options: HoldInputOptions<R>): HoldInput<R> {
  const owners = new Map<R, { source: HoldSource; node: HTMLElement }>(),
    signal = options.signal,
    listen = signal ? { signal } : undefined;

  function press(role: R, source: HoldSource, node: HTMLElement, event?: PointerEvent) {
    if (owners.has(role)) return false;
    owners.set(role, { source, node });
    options.begin(role, { node, event });
    return true;
  }
  function release(role: R, source: HoldSource, cancelled = false, event?: PointerEvent) {
    const owner = owners.get(role);
    if (!owner || owner.source !== source) return;
    owners.delete(role);
    options.end(role, cancelled, { node: owner.node, event });
  }
  function clear() {
    const claimed = [...owners.values()];
    owners.clear();
    for (const { source, node } of claimed)
      if (typeof source === 'number' && node.hasPointerCapture?.(source)) node.releasePointerCapture(source);
  }
  signal?.addEventListener('abort', clear, { once: true });

  return {
    bind(node, role, bind = {}) {
      node.addEventListener(
        'pointerdown',
        (event) => {
          if (event.button !== 0) return;
          if (bind.accept && !bind.accept(event)) return;
          event.preventDefault();
          if (!press(role, event.pointerId, node, event)) return;
          try {
            node.setPointerCapture(event.pointerId);
          } catch {
            // Capture is optional; the window-level release still works without it.
          }
        },
        listen,
      );
      node.addEventListener('pointerup', (event) => release(role, event.pointerId, false, event), listen);
      const cancel = (event: PointerEvent) => release(role, event.pointerId, true, event);
      node.addEventListener('pointercancel', cancel, listen);
      node.addEventListener('lostpointercapture', cancel, listen);
      const move = bind.move;
      if (move)
        node.addEventListener(
          'pointermove',
          (event) => {
            if (owners.get(role)?.source === event.pointerId) move(event);
          },
          listen,
        );
    },
    press,
    release,
    releaseSource(source) {
      for (const [role, owner] of [...owners]) if (owner.source === source) release(role, source);
    },
    held: (role) => owners.has(role),
    clear,
  };
}

/**
 * Which way a two-way pad points under a finger at `clientX`: -1 (left half),
 * 1 (right half), or 0 inside the dead zone around the middle (a fraction of
 * the pad's width each side of centre). Sliding across the middle turns around.
 */
export function padDirection(node: HTMLElement, clientX: number, deadZone = 0.065): -1 | 0 | 1 {
  const rect = node.getBoundingClientRect();
  const offset = (clientX - rect.left) / rect.width - 0.5;
  return Math.abs(offset) < deadZone ? 0 : offset < 0 ? -1 : 1;
}
