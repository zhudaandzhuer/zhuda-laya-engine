/**
 * Lines that show what is in a scene: where its axes are, how big a thing
 * is, where a light points and how far it reaches, what a camera sees,
 * where a model's bones are.
 *
 * `ZhudaDebugDraw` keeps one of LayaAir's line sprites in a scene. Each
 * helper follows what it shows: `update()` draws all of them again from
 * what their targets are now, so it is called once a frame while anything
 * moves. Nothing is drawn, counted or kept by a game that makes none.
 *
 * The geometry is plain arithmetic (`zhuda…Lines`), so that it can be
 * checked without a GPU: every function returns line segments as
 * `[x0, y0, z0, x1, y1, z1, …]` in world units.
 */

type V3 = readonly [number, number, number];
/** Column-major, as LayaAir's `Matrix4x4.elements`. */
type M4 = ArrayLike<number>;

const add = (a: V3, b: V3, s = 1): [number, number, number] => [
  a[0] + b[0] * s,
  a[1] + b[1] * s,
  a[2] + b[2] * s,
];
const cross = (a: V3, b: V3): [number, number, number] => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: V3): [number, number, number] => {
  const length = Math.hypot(a[0], a[1], a[2]);
  return length > 1e-12 ? [a[0] / length, a[1] / length, a[2] / length] : [0, 0, 0];
};
/** A point of a node's own space in the world. */
const place = (m: M4, p: V3): [number, number, number] => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];
/** Two directions square to `axis` and to each other. */
function square(axis: V3): [V3, V3] {
  const n = unit(axis);
  const side = unit(cross(n, Math.abs(n[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0]));
  return [side, cross(n, side)];
}
const segment = (out: number[], a: V3, b: V3) => void out.push(a[0], a[1], a[2], b[0], b[1], b[2]);

/** The three axes of a matrix, each `size` long in its own units: x, then y, then z. */
export function zhudaAxesLines(matrix: M4 | null, size = 1): number[] {
  const m = matrix ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const out: number[] = [];
  const origin = place(m, [0, 0, 0]);
  segment(out, origin, place(m, [size, 0, 0]));
  segment(out, origin, place(m, [0, size, 0]));
  segment(out, origin, place(m, [0, 0, size]));
  return out;
}

/** A square grid on the plane `y`, `size` across, in `divisions` cells a side. */
export function zhudaGridLines(size = 10, divisions = 10, y = 0): number[] {
  if (!(size > 0) || !Number.isInteger(divisions) || divisions < 1 || divisions > 1000)
    throw Error('Invalid debug grid: a size above 0 and 1..1000 divisions');
  const out: number[] = [];
  const half = size / 2;
  for (let i = 0; i <= divisions; i++) {
    const at = -half + (size * i) / divisions;
    segment(out, [at, y, -half], [at, y, half]);
    segment(out, [-half, y, at], [half, y, at]);
  }
  return out;
}

/** The twelve edges of a box between two corners; with a matrix, of a box in that space. */
export function zhudaBoxLines(min: V3, max: V3, matrix: M4 | null = null): number[] {
  const corner = (i: number): [number, number, number] => {
    const p: V3 = [i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]];
    return matrix ? place(matrix, p) : [p[0], p[1], p[2]];
  };
  const out: number[] = [];
  for (let i = 0; i < 8; i++)
    for (const bit of [1, 2, 4]) if (!(i & bit)) segment(out, corner(i), corner(i | bit));
  return out;
}

/** A circle round `center`, flat to `normal`. */
export function zhudaCircleLines(center: V3, normal: V3, radius: number, segments = 32): number[] {
  const [u, v] = square(normal);
  const out: number[] = [];
  const at = (i: number) => {
    const angle = (i / segments) * Math.PI * 2;
    return add(add(center, u, Math.cos(angle) * radius), v, Math.sin(angle) * radius);
  };
  for (let i = 0; i < segments; i++) segment(out, at(i), at(i + 1));
  return out;
}

/** A sphere as its three great circles: how far a point light reaches. */
export function zhudaSphereLines(center: V3, radius: number, segments = 32): number[] {
  return [
    ...zhudaCircleLines(center, [1, 0, 0], radius, segments),
    ...zhudaCircleLines(center, [0, 1, 0], radius, segments),
    ...zhudaCircleLines(center, [0, 0, 1], radius, segments),
  ];
}

/**
 * A spot's cone: from `apex` along `direction` for `range`, `angle` degrees
 * across the whole cone. Four lines down its side and the circle at its end.
 */
export function zhudaConeLines(
  apex: V3,
  direction: V3,
  range: number,
  angle: number,
  segments = 32,
): number[] {
  const axis = unit(direction);
  const end = add(apex, axis, range);
  const radius = Math.tan(((angle / 2) * Math.PI) / 180) * range;
  const [u, v] = square(axis);
  const out = zhudaCircleLines(end, axis, radius, segments);
  for (const [a, b] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ])
    segment(out, apex, add(add(end, u, a * radius), v, b * radius));
  return out;
}

/** An arrow from a point along a direction: a shaft and four barbs. */
export function zhudaArrowLines(from: V3, direction: V3, length: number): number[] {
  const axis = unit(direction);
  const tip = add(from, axis, length);
  const [u, v] = square(axis);
  const out: number[] = [];
  segment(out, from, tip);
  const back = add(tip, axis, -length * 0.2);
  for (const side of [u, v])
    for (const sign of [1, -1]) segment(out, tip, add(back, side, sign * length * 0.08));
  return out;
}

/** What a camera sees, for `zhudaFrustumLines`. LayaAir's camera looks down its own -Z. */
export interface ZhudaDebugFrustum {
  /** The camera's world matrix. */
  matrix: M4;
  /** Vertical field of view in degrees; not read by an orthographic camera. */
  fieldOfView: number;
  /** Width over height. */
  aspect: number;
  near: number;
  far: number;
  orthographic?: boolean;
  /** The height an orthographic camera sees, in world units. */
  orthographicVerticalSize?: number;
}

/**
 * The frustum of a camera: the near rectangle, the far rectangle and the
 * four edges between them (twelve segments), from the camera's own values,
 * so that it is the same on WebGL and WebGPU whatever their depth ranges.
 */
export function zhudaFrustumLines(camera: ZhudaDebugFrustum): number[] {
  const { matrix, near, far, aspect } = camera;
  if (!(near > 0) || !(far > near) || !(aspect > 0))
    throw Error('Invalid debug frustum: near above 0, far above near, aspect above 0');
  const half = (distance: number) => {
    const height = camera.orthographic
      ? (camera.orthographicVerticalSize ?? 10) / 2
      : Math.tan(((camera.fieldOfView / 2) * Math.PI) / 180) * distance;
    return [height * aspect, height];
  };
  const corners = (distance: number) => {
    const [w, h] = half(distance);
    return (
      [
        [-w, -h],
        [w, -h],
        [w, h],
        [-w, h],
      ] as const
    ).map(([x, y]) => place(matrix, [x, y, -distance]));
  };
  const a = corners(near),
    b = corners(far);
  const out: number[] = [];
  for (let i = 0; i < 4; i++) {
    segment(out, a[i], a[(i + 1) % 4]);
    segment(out, b[i], b[(i + 1) % 4]);
    segment(out, a[i], b[i]);
  }
  return out;
}

/** A line from every bone to the bone it hangs from; `parent` is an index into the list, or -1. */
export function zhudaSkeletonLines(bones: readonly { position: V3; parent: number }[]): number[] {
  const out: number[] = [];
  bones.forEach((bone, index) => {
    const parent = bones[bone.parent];
    if (bone.parent < 0 || bone.parent === index || !parent) return;
    segment(out, parent.position, bone.position);
  });
  return out;
}

/** Red, green, blue as they are drawn (not scene-linear light). */
export type ZhudaDebugColor = readonly [number, number, number];

export interface ZhudaDebugDrawOptions {
  /** Draw over everything, whatever is in front (default false: things hide the lines behind them). */
  onTop?: boolean;
  /**
   * The most line segments kept, 16..65536 (default 8192). What does not
   * fit is left out, and counted in `dropped`.
   */
  maxLines?: number;
}

/** What a helper gives back: `remove()` takes it away. */
export interface ZhudaDebugHelper {
  remove(): void;
}

/** One colour for all of a helper's segments, or one a segment (repeated when there are fewer). */
export type ZhudaDebugColors = ZhudaDebugColor | readonly ZhudaDebugColor[];

interface Entry {
  /** The segments now. */
  lines(): number[];
  /** Their colours now; asked for after the segments. */
  colors: ZhudaDebugColors | (() => ZhudaDebugColors);
}

export function validateZhudaDebugDraw(options: ZhudaDebugDrawOptions): string[] {
  const issues: string[] = [];
  const o = (options ?? {}) as Record<string, unknown>;
  if (o.onTop !== undefined && typeof o.onTop !== 'boolean')
    issues.push('onTop: use true or false');
  if (
    o.maxLines !== undefined &&
    !(
      Number.isInteger(o.maxLines) &&
      (o.maxLines as number) >= 16 &&
      (o.maxLines as number) <= 65536
    )
  )
    issues.push('maxLines: use a whole number 16..65536');
  return issues;
}

const WHITE: ZhudaDebugColor = [1, 1, 1];
const AXES: readonly ZhudaDebugColor[] = [
  [1, 0.2, 0.2],
  [0.2, 1, 0.2],
  [0.3, 0.5, 1],
];

export class ZhudaDebugDraw {
  private readonly scene: any;
  private readonly sprite: any;
  private readonly material: any;
  private readonly maxLines: number;
  private readonly entries = new Set<Entry>();
  private disposed = false;
  /** Segments left out at the last `update()` because they did not fit in `maxLines`. */
  dropped = 0;

  constructor(scene3D: any, options: ZhudaDebugDrawOptions = {}) {
    const issues = validateZhudaDebugDraw(options);
    if (issues.length) throw Error('Invalid debug draw: ' + issues.join('; '));
    const l = (globalThis as any).Laya;
    if (!l?.PixelLineSprite3D) throw Error('Debug draw needs LayaAir 3D (the "3d" feature)');
    if (!scene3D?.addChild) throw Error('A Scene3D is required');
    this.scene = scene3D;
    this.maxLines = options.maxLines ?? 8192;
    this.sprite = new l.PixelLineSprite3D(Math.min(256, this.maxLines), 'ZhudaDebugDraw');
    // LayaAir makes a material for each line sprite and leaves it when the
    // sprite is destroyed.
    this.material = this.sprite._render?.sharedMaterial;
    if (options.onTop) {
      const material = this.material;
      material.depthTest = l.RenderState.DEPTHTEST_ALWAYS;
      material.depthWrite = false;
      // After everything else that is in the scene.
      material.renderQueue = 4500;
    }
    scene3D.addChild(this.sprite);
  }

  /** How many segments the last `update()` drew. */
  get lineCount(): number {
    return this.disposed ? 0 : this.sprite.lineCount;
  }

  private keep(entry: Entry): ZhudaDebugHelper {
    if (this.disposed) throw Error('Disposed debug draw');
    this.entries.add(entry);
    return { remove: () => void this.entries.delete(entry) };
  }

  /**
   * Segments of your own, worked out again at every `update()`. `colors` may
   * be a function too: it is asked after the segments, each time.
   */
  lines(
    lines: () => number[],
    colors: ZhudaDebugColors | (() => ZhudaDebugColors) = WHITE,
  ): ZhudaDebugHelper {
    if (typeof lines !== 'function') throw Error('Invalid debug lines: a function is required');
    return this.keep({ lines, colors });
  }

  /** The axes of a node (red x, green y, blue z), or of the world without one. */
  axes(node: any = null, size = 1): ZhudaDebugHelper {
    return this.keep({
      lines: () => zhudaAxesLines(node ? node.transform.worldMatrix.elements : null, size),
      colors: AXES,
    });
  }

  grid(
    options: { size?: number; divisions?: number; y?: number; color?: ZhudaDebugColor } = {},
  ): ZhudaDebugHelper {
    const segments = zhudaGridLines(options.size, options.divisions, options.y);
    return this.keep({ lines: () => segments, colors: options.color ?? [0.35, 0.35, 0.35] });
  }

  box(min: V3, max: V3, color: ZhudaDebugColor = WHITE): ZhudaDebugHelper {
    const segments = zhudaBoxLines(min, max);
    return this.keep({ lines: () => segments, colors: color });
  }

  /**
   * The box round everything a node and its children draw, in the world,
   * as it is now. A node that draws nothing shows nothing.
   */
  bounds(node: any, color: ZhudaDebugColor = [1, 0.9, 0.2]): ZhudaDebugHelper {
    if (!node?.transform) throw Error('Invalid debug bounds: a 3D node is required');
    return this.keep({
      lines: () => {
        const box = zhudaWorldBounds(node);
        return box ? zhudaBoxLines(box.min, box.max) : [];
      },
      colors: color,
    });
  }

  /**
   * A light: an arrow for a directional light, its reach for a point light,
   * its cone for a spot. `light` is the light's node or its component; the
   * lines take the light's colour unless one is given.
   */
  light(light: any, color?: ZhudaDebugColor): ZhudaDebugHelper {
    const l = (globalThis as any).Laya;
    const find = (type: any) =>
      type && (light instanceof type ? light : light?.getComponent?.(type));
    const spot = find(l.SpotLightCom),
      point = !spot && find(l.PointLightCom),
      sun = !spot && !point && find(l.DirectionLightCom);
    const component = spot || point || sun;
    if (!component?.owner?.transform) throw Error('Invalid debug light: a light is required');
    const owner = component.owner;
    const tint = (): ZhudaDebugColor =>
      color ?? [component.color?.r ?? 1, component.color?.g ?? 1, component.color?.b ?? 1];
    const entry: Entry = {
      lines: () => {
        const m: M4 = owner.transform.worldMatrix.elements;
        const at = place(m, [0, 0, 0]);
        const forward = unit([-m[8], -m[9], -m[10]]);
        if (spot) return zhudaConeLines(at, forward, spot.range, spot.spotAngle);
        if (point) return zhudaSphereLines(at, point.range);
        // A sun has no place: a small square where its node is, and the way it shines.
        const [u, v] = square(forward);
        const out = zhudaArrowLines(at, forward, 1.5);
        for (const [a, b] of [
          [0.3, 0.3],
          [-0.3, 0.3],
          [-0.3, -0.3],
          [0.3, -0.3],
        ])
          out.push(...zhudaArrowLines(add(add(at, u, a), v, b), forward, 1));
        return out;
      },
      colors: tint,
    };
    return this.keep(entry);
  }

  /** What a camera sees: its near and far rectangles and the edges between. */
  camera(camera: any, color: ZhudaDebugColor = [1, 0.6, 0.1]): ZhudaDebugHelper {
    if (!camera?.transform || typeof camera.nearPlane !== 'number')
      throw Error('Invalid debug camera: a camera is required');
    return this.keep({
      lines: () =>
        zhudaFrustumLines({
          matrix: camera.transform.worldMatrix.elements,
          fieldOfView: camera.fieldOfView,
          aspect: camera.aspectRatio,
          near: camera.nearPlane,
          far: camera.farPlane,
          orthographic: camera.orthographic,
          orthographicVerticalSize: camera.orthographicVerticalSize,
        }),
      colors: color,
    });
  }

  /**
   * The bones of every skinned mesh under a node: a line from each bone to
   * the bone it hangs from, as the pose is now.
   */
  skeleton(node: any, color: ZhudaDebugColor = [0.2, 1, 1]): ZhudaDebugHelper {
    if (!node?.transform) throw Error('Invalid debug skeleton: a 3D node is required');
    return this.keep({
      lines: () => zhudaSkeletonLines(zhudaBonesOf(node)),
      colors: color,
    });
  }

  /**
   * What the sun's shadow map covers: a sphere for each of its cascades,
   * as LayaAir fitted them at the last frame it drew shadows in. A thing
   * outside every sphere has no shadow from the map. Nothing is shown while
   * the scene draws no directional shadow.
   *
   * (The map itself cannot be shown as a picture: it is a comparison
   * texture, which WebGL may not read as a colour and WebGPU refuses to.)
   */
  shadowCascades(
    scene3D: any = this.scene,
    color: ZhudaDebugColor = [1, 0.4, 0.8],
  ): ZhudaDebugHelper {
    if (!scene3D?._shaderValues) throw Error('Invalid debug shadow: a Scene3D is required');
    return this.keep({
      lines: () => {
        const out: number[] = [];
        for (const sphere of zhudaShadowCascades(scene3D))
          out.push(...zhudaSphereLines(sphere.center, sphere.radius, 48));
        return out;
      },
      colors: color,
    });
  }

  /** Draws every helper again from what its target is now. Once a frame while anything moves. */
  update(): void {
    if (this.disposed) return;
    const l = (globalThis as any).Laya;
    const sprite = this.sprite;
    sprite.clear();
    let count = 0;
    this.dropped = 0;
    const from = new l.Vector3(),
      to = new l.Vector3(),
      tint = new l.Color(1, 1, 1, 1);
    for (const entry of this.entries) {
      const segments = entry.lines();
      const colors = typeof entry.colors === 'function' ? entry.colors() : entry.colors;
      const each = Array.isArray(colors[0]);
      for (let i = 0; i + 5 < segments.length; i += 6) {
        if (count >= this.maxLines) {
          this.dropped++;
          continue;
        }
        if (count >= sprite.maxLineCount)
          sprite.maxLineCount = Math.min(this.maxLines, sprite.maxLineCount * 2);
        const c = (each ? (colors as ZhudaDebugColor[])[(i / 6) % colors.length] : colors) as
          | ZhudaDebugColor
          | undefined;
        from.setValue(segments[i], segments[i + 1], segments[i + 2]);
        to.setValue(segments[i + 3], segments[i + 4], segments[i + 5]);
        tint.r = c?.[0] ?? 1;
        tint.g = c?.[1] ?? 1;
        tint.b = c?.[2] ?? 1;
        sprite.addLine(from, to, tint, tint);
        count++;
      }
    }
  }

  /** Takes every helper away; the next `update()` draws nothing. */
  clear(): void {
    this.entries.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.entries.clear();
    // A scene destroyed first has taken its children with it.
    if (!this.sprite.destroyed) this.sprite.destroy();
    const material = this.material;
    if (material && !material.destroyed && !material.lock) material.destroy?.();
  }
}

/**
 * The box round everything a node and its children draw, in the world;
 * `null` when they draw nothing.
 */
export function zhudaWorldBounds(node: any): { min: V3; max: V3 } | null {
  const l = (globalThis as any).Laya;
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  const visit = (current: any) => {
    const renderer = l?.BaseRender ? current.getComponent?.(l.BaseRender) : undefined;
    const bounds = renderer?.bounds;
    if (bounds && current.activeInHierarchy !== false) {
      const low = bounds.getMin(),
        high = bounds.getMax();
      for (const [i, key] of ['x', 'y', 'z'].entries()) {
        if (Number.isFinite(low[key]) && low[key] < min[i]) min[i] = low[key];
        if (Number.isFinite(high[key]) && high[key] > max[i]) max[i] = high[key];
      }
    }
    for (let i = 0; i < (current.numChildren ?? 0); i++) visit(current.getChildAt(i));
  };
  visit(node);
  return min[0] <= max[0] ? { min: [min[0], min[1], min[2]], max: [max[0], max[1], max[2]] } : null;
}

/**
 * The spheres LayaAir fitted the sun's shadow cascades into at the last
 * frame it drew shadows in, nearest first; empty when a scene draws none.
 */
export function zhudaShadowCascades(scene3D: any): { center: V3; radius: number }[] {
  const l = (globalThis as any).Laya;
  const id = l?.ShadowCasterPass?.SHADOW_SPLIT_SPHERES;
  const data = scene3D?.destroyed ? undefined : scene3D?._shaderValues;
  const spheres = id === undefined ? undefined : data?.getBuffer?.(id);
  const out: { center: V3; radius: number }[] = [];
  for (let i = 0; spheres && i + 3 < spheres.length; i += 4) {
    // The fourth number is the radius squared; an unused cascade has none.
    const squared = spheres[i + 3];
    if (!(squared > 0) || !Number.isFinite(squared)) continue;
    out.push({
      center: [spheres[i], spheres[i + 1], spheres[i + 2]],
      radius: Math.sqrt(squared),
    });
  }
  return out;
}

/** The bones of every skinned mesh under a node, each with the index of the bone it hangs from. */
export function zhudaBonesOf(node: any): { position: V3; parent: number }[] {
  const l = (globalThis as any).Laya;
  const bones: any[] = [];
  const index = new Map<any, number>();
  const visit = (current: any) => {
    const renderer = l?.SkinnedMeshRenderer
      ? current.getComponent?.(l.SkinnedMeshRenderer)
      : undefined;
    for (const bone of renderer?.bones ?? [])
      if (bone?.transform && !index.has(bone)) {
        index.set(bone, bones.length);
        bones.push(bone);
      }
    for (let i = 0; i < (current.numChildren ?? 0); i++) visit(current.getChildAt(i));
  };
  visit(node);
  return bones.map((bone) => {
    const p = bone.transform.position;
    return { position: [p.x, p.y, p.z] as V3, parent: index.get(bone.parent) ?? -1 };
  });
}
