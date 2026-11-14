/**
 * Levels of detail by distance for copies of models: near the eye a copy
 * draws its full model, farther away a lighter one, and beyond a limit
 * nothing. The caller says where the eye is; this never reads a camera or a
 * clock, and it owns no model: it only switches nodes it was given on and off.
 */

/** What `update` did: how many copies draw each level, how many draw nothing, how many changed. */
export interface ZhudaLodCounts {
  levels: number[];
  culled: number;
  switched: number;
}

/** A copy that is not drawn. */
export const ZHUDA_LOD_CULLED = -1;

/**
 * The level a copy at `distance` draws. `from[k]` is where level `k + 1`
 * takes over from level `k`; beyond `cull` nothing is drawn. A copy keeps its
 * `current` level until it is past a border by `hysteresis` (a share of that
 * border), so one standing on a border does not flicker.
 */
export function zhudaLodLevel(
  distance: number,
  from: readonly number[],
  cull: number | undefined,
  current = 0,
  hysteresis = 0.08,
): number {
  if (!(distance >= 0)) return current;
  if (cull !== undefined) {
    const border = cull * (current === ZHUDA_LOD_CULLED ? 1 - hysteresis : 1 + hysteresis);
    if (distance > border) return ZHUDA_LOD_CULLED;
  }
  const held = current === ZHUDA_LOD_CULLED ? from.length : current;
  let level = 0;
  for (let k = 0; k < from.length; k++) {
    // Borders below the level in use were crossed outward: come back in only well inside them.
    const border = from[k] * (k < held ? 1 - hysteresis : 1 + hysteresis);
    if (distance > border) level = k + 1;
    else break;
  }
  return level;
}

/** Lists what is wrong with level borders and a cull distance; empty when valid. */
export function validateZhudaLodDistances(
  from: readonly unknown[],
  cull: unknown,
  max = 100000,
): string[] {
  const issues: string[] = [];
  let last = 0;
  from.forEach((value, i) => {
    if (typeof value !== 'number' || !(value > last && value <= max))
      issues.push(`level ${i + 1}: fromMeters must rise and stay within 0..${max}`);
    else last = value;
  });
  if (cull !== undefined && (typeof cull !== 'number' || !(cull > last && cull <= max)))
    issues.push(`cullMeters must be beyond the last level and at most ${max}`);
  return issues;
}

export interface ZhudaLodItem {
  /** The node whose world position the distance is measured to. */
  anchor: any;
  /** One node per level, nearest first; exactly one is active, or none when culled. */
  nodes: any[];
  /** Where each further level begins, in metres. */
  from: readonly number[];
  cull?: number;
}

/** Switches the levels of many copies for one eye position. */
export class ZhudaModelLod {
  private readonly items: ZhudaLodItem[];
  private readonly current: Int8Array;
  private positions: Float32Array | undefined;
  private disposed = false;
  private readonly most: number;
  readonly hysteresis: number;
  private readonly show: (node: any, visible: boolean) => void;
  /**
   * `show` makes one level's node drawn or not; by default it sets the node's
   * `active`. A renderer that must stay in its scene's lists passes its own.
   */
  constructor(
    items: ZhudaLodItem[],
    hysteresis = 0.08,
    show: (node: any, visible: boolean) => void = (node, visible) => (node.active = visible),
  ) {
    if (!(hysteresis >= 0 && hysteresis < 0.5)) throw Error('hysteresis: use 0 up to 0.5');
    for (const item of items)
      if (item.nodes.length !== item.from.length + 1 || item.nodes.length > 8)
        throw Error('Each level needs a node: one more node than borders, at most 8');
    this.items = items;
    this.hysteresis = hysteresis;
    this.show = show;
    this.current = new Int8Array(items.length);
    this.most = items.reduce((most, item) => Math.max(most, item.nodes.length), 0);
    // Everything starts at its full model, as if the eye stood at every copy.
    for (const item of items) item.nodes.forEach((node, level) => show(node, level === 0));
  }
  get size() {
    return this.items.length;
  }
  /** Call after the copies moved: their positions are read again on the next update. */
  invalidate() {
    this.positions = undefined;
  }
  /**
   * Chooses what every copy draws for an eye at `[x, y, z]` in world metres.
   * `reach` scales every distance at once (default 1): at 0.5 a copy turns
   * to its lighter version, and stops being drawn, at half the distance it
   * was authored for. For a device that cannot draw as much: one number
   * instead of a second set of distances. 0.05..8.
   */
  update(eye: readonly [number, number, number], reach = 1): ZhudaLodCounts {
    if (this.disposed) throw Error('Disposed model levels');
    if (eye.length !== 3 || !eye.every(Number.isFinite))
      throw Error('eye: use three finite numbers');
    if (!(reach >= 0.05 && reach <= 8)) throw Error('reach: use 0.05..8');
    if (!this.positions) {
      // Scenery stands still: world positions are read once.
      this.positions = new Float32Array(this.items.length * 3);
      this.items.forEach((item, i) => {
        const p = item.anchor.transform.position;
        this.positions!.set([p.x, p.y, p.z], i * 3);
      });
    }
    // One count per level the copies can draw, also when none draws it now.
    const counts: ZhudaLodCounts = { levels: new Array(this.most).fill(0), culled: 0, switched: 0 };
    const positions = this.positions;
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const distance =
        Math.hypot(
          positions[i * 3] - eye[0],
          positions[i * 3 + 1] - eye[1],
          positions[i * 3 + 2] - eye[2],
        ) / reach;
      const before = this.current[i];
      const level = zhudaLodLevel(distance, item.from, item.cull, before, this.hysteresis);
      if (level !== before) {
        if (before !== ZHUDA_LOD_CULLED) this.show(item.nodes[before], false);
        if (level !== ZHUDA_LOD_CULLED) this.show(item.nodes[level], true);
        this.current[i] = level;
        counts.switched++;
      }
      if (level === ZHUDA_LOD_CULLED) counts.culled++;
      else counts.levels[level]++;
    }
    return counts;
  }
  /** Puts every copy back to its full model and stops. The nodes belong to their owner. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const item of this.items)
      item.nodes.forEach((node, level) => !node.destroyed && this.show(node, level === 0));
  }
}
