/**
 * Floating virtual thumb stick (touch and mouse drag).
 *
 * Markup (the game owns placement and visibility):
 *   <div class="cp-stick-zone"></div>                       <- where a press starts the stick
 *   <div class="cp-stick"><div class="cp-stick-knob"></div></div>
 *
 * A press anywhere in the zone brings the stick to the thumb (kept on screen),
 * dragging tilts it, and the value is clamped to the unit circle. Lifting the
 * finger anywhere, a cancelled pointer, lost capture or a blurred window all let go.
 */
export interface VirtualStickOptions {
  zone: HTMLElement;
  stick: HTMLElement;
  knob: HTMLElement;
  /** Drag distance in px for full tilt; also how far the knob travels. Default 56. */
  reach?: number;
  /** Stick diameter in px, used to centre it under the thumb. Default 132. */
  size?: number;
  /** Closest the stick may come to the window edge, px. Default 8. */
  margin?: number;
  /** Called on every press in the zone, e.g. to hand aiming back to the stick. */
  onPress?: () => void;
  /**
   * Screen point → the stick's own layout coordinates (px, +x right, +y down as the game is
   * drawn). Default: the screen itself. A game turned 90° on a portrait phone (CSS rotate on
   * its root) passes the inverse of that turn, so a push toward the game's right is +x.
   */
  toLocal?: (clientX: number, clientY: number) => { x: number; y: number };
  /** Size of the area the stick is kept inside, in those coordinates. Default: the window. */
  bounds?: () => { width: number; height: number };
}

export interface VirtualStick {
  /** Tilt, -1..1 each, length <= 1. Screen axes: +x right, +y down. */
  readonly x: number;
  readonly y: number;
  /** A finger (or mouse) is on the stick. */
  readonly held: boolean;
  /** Releases the stick and puts it back in its resting place. */
  drop(): void;
  dispose(): void;
}

export function createVirtualStick(options: VirtualStickOptions): VirtualStick {
  const { zone, stick, knob, onPress } = options,
    toLocal = options.toLocal ?? ((x: number, y: number) => ({ x, y })),
    bounds = options.bounds ?? (() => ({ width: window.innerWidth, height: window.innerHeight })),
    reach = options.reach ?? 56,
    size = options.size ?? 132,
    margin = options.margin ?? 8;
  const thumb = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  const placeKnob = () => (knob.style.transform = `translate(${thumb.x * reach}px, ${thumb.y * reach}px)`);
  function drop() {
    if (thumb.id === -1 && !thumb.x && !thumb.y) return;
    thumb.id = -1;
    thumb.x = thumb.y = 0;
    stick.style.left = stick.style.top = stick.style.bottom = '';
    stick.classList.remove('live');
    placeKnob();
  }
  const down = (event: PointerEvent) => {
    onPress?.();
    if (thumb.id !== -1) return;
    thumb.id = event.pointerId;
    const at = toLocal(event.clientX, event.clientY),
      area = bounds();
    thumb.ox = at.x;
    thumb.oy = at.y;
    thumb.x = thumb.y = 0;
    // The stick comes to the thumb, as long as it stays on screen.
    const half = size / 2;
    stick.style.left = `${Math.max(margin, Math.min(area.width - size - margin, at.x - half))}px`;
    stick.style.top = `${Math.max(margin, Math.min(area.height - size - margin, at.y - half))}px`;
    stick.style.bottom = 'auto';
    stick.classList.add('live');
    placeKnob();
    try {
      zone.setPointerCapture(event.pointerId);
    } catch {
      // Capture is optional.
    }
  };
  const move = (event: PointerEvent) => {
    if (event.pointerId !== thumb.id) return;
    const at = toLocal(event.clientX, event.clientY);
    let dx = (at.x - thumb.ox) / reach,
      dy = (at.y - thumb.oy) / reach;
    const length = Math.hypot(dx, dy);
    if (length > 1) {
      dx /= length;
      dy /= length;
    }
    thumb.x = dx;
    thumb.y = dy;
    placeKnob();
  };
  const letGo = (event: PointerEvent) => {
    if (event.pointerId === thumb.id) drop();
  };
  const blur = () => drop();
  const noMenu = (event: Event) => event.preventDefault();
  zone.addEventListener('pointerdown', down);
  zone.addEventListener('pointermove', move);
  zone.addEventListener('pointerup', letGo);
  zone.addEventListener('pointercancel', letGo);
  zone.addEventListener('lostpointercapture', letGo);
  zone.addEventListener('contextmenu', noMenu);
  // If the finger lifts somewhere the zone cannot hear, the window still does.
  window.addEventListener('pointerup', letGo);
  window.addEventListener('pointercancel', letGo);
  window.addEventListener('blur', blur);
  return {
    get x() {
      return thumb.x;
    },
    get y() {
      return thumb.y;
    },
    get held() {
      return thumb.id !== -1;
    },
    drop,
    dispose() {
      drop();
      zone.removeEventListener('pointerdown', down);
      zone.removeEventListener('pointermove', move);
      zone.removeEventListener('pointerup', letGo);
      zone.removeEventListener('pointercancel', letGo);
      zone.removeEventListener('lostpointercapture', letGo);
      zone.removeEventListener('contextmenu', noMenu);
      window.removeEventListener('pointerup', letGo);
      window.removeEventListener('pointercancel', letGo);
      window.removeEventListener('blur', blur);
    },
  };
}
