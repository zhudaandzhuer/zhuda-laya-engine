/**
 * Moving, turning and scaling a node by its axes with a pointer.
 *
 * The gizmo draws three handles at a node, the same size on the screen
 * however far the node is, and turns pointer positions into a change of
 * that node: a drag along an arrow moves it along that axis, a drag round a
 * ring turns it about that axis, a drag along a scale handle scales it
 * along that axis of its own.
 *
 * It listens to nothing and has no clock. Its caller hands it the pointer
 * (`pointerDown`, `pointerMove`, `pointerUp`, in CSS pixels from the view's
 * top left corner) and calls `update()` once a frame, so a game or an
 * editor decides what else its pointer does: `pointerDown` says whether a
 * handle was under it.
 *
 * The arithmetic (`zhudaPointerRay`, `zhudaRayAxis`, …) is plain numbers,
 * checked without a GPU.
 */
import {
  ZhudaDebugDraw,
  zhudaArrowLines,
  zhudaBoxLines,
  zhudaCircleLines,
  type ZhudaDebugColor,
} from './DebugDraw.ts';

type V3 = readonly [number, number, number];
type M4 = ArrayLike<number>;
type Quat = readonly [number, number, number, number];

const sub = (a: V3, b: V3): [number, number, number] => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const along = (a: V3, b: V3, s: number): [number, number, number] => [
  a[0] + b[0] * s,
  a[1] + b[1] * s,
  a[2] + b[2] * s,
];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): [number, number, number] => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: V3): [number, number, number] => {
  const length = Math.hypot(a[0], a[1], a[2]);
  return length > 1e-12 ? [a[0] / length, a[1] / length, a[2] / length] : [0, 0, 0];
};

/** What the gizmo needs of a camera. LayaAir's camera looks down its own -Z. */
export interface ZhudaGizmoCamera {
  /** The camera's world matrix, column-major. */
  matrix: M4;
  /** Vertical field of view in degrees; not read by an orthographic camera. */
  fieldOfView: number;
  /** Width over height of the view. */
  aspect: number;
  orthographic?: boolean;
  orthographicVerticalSize?: number;
}

export interface ZhudaRay {
  origin: V3;
  /** Of length 1. */
  direction: V3;
}

/**
 * The ray under a pointer. `x`, `y` are CSS pixels from the top left corner
 * of a view `width` by `height` CSS pixels.
 */
export function zhudaPointerRay(
  camera: ZhudaGizmoCamera,
  x: number,
  y: number,
  width: number,
  height: number,
): ZhudaRay {
  if (!(width > 0) || !(height > 0)) throw Error('Invalid pointer ray: the view has no size');
  const m = camera.matrix;
  const nx = (x / width) * 2 - 1,
    ny = 1 - (y / height) * 2;
  const turn = (v: V3): [number, number, number] => [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2],
  ];
  const eye: V3 = [m[12], m[13], m[14]];
  if (camera.orthographic) {
    const half = (camera.orthographicVerticalSize ?? 10) / 2;
    const offset = turn([nx * half * camera.aspect, ny * half, 0]);
    return {
      origin: [eye[0] + offset[0], eye[1] + offset[1], eye[2] + offset[2]],
      direction: unit(turn([0, 0, -1])),
    };
  }
  const h = Math.tan(((camera.fieldOfView / 2) * Math.PI) / 180);
  return { origin: eye, direction: unit(turn([nx * h * camera.aspect, ny * h, -1])) };
}

/**
 * Where a ray passes an axis line: how far along the axis from its origin
 * (`along`, signed), how far along the ray (`rayT`) and how far apart the
 * two are there. `null` when they are parallel.
 */
export function zhudaRayAxis(
  ray: ZhudaRay,
  origin: V3,
  axis: V3,
): { along: number; rayT: number; distance: number } | null {
  const u = unit(axis),
    d = ray.direction;
  const w = sub(ray.origin, origin);
  const b = dot(d, u),
    dw = dot(d, w),
    uw = dot(u, w);
  const denominator = 1 - b * b;
  if (denominator < 1e-9) return null;
  const s = (uw - b * dw) / denominator,
    t = (b * uw - dw) / denominator;
  const apart = sub(along(ray.origin, d, t), along(origin, u, s));
  return { along: s, rayT: t, distance: Math.hypot(apart[0], apart[1], apart[2]) };
}

/** Where a ray meets the plane through `point` square to `normal`; `null` when it does not, in front of it. */
export function zhudaRayPlane(ray: ZhudaRay, point: V3, normal: V3): V3 | null {
  const n = unit(normal);
  const facing = dot(ray.direction, n);
  if (Math.abs(facing) < 1e-6) return null;
  const t = dot(sub(point, ray.origin), n) / facing;
  return t > 0 ? along(ray.origin, ray.direction, t) : null;
}

/**
 * How far along an axis the pointer is, for a drag: the ray is met with the
 * plane that holds the axis and faces the viewer most, and the meeting point
 * is measured along the axis. A pointer beside the axis then moves the node
 * as far as it moved along the axis on the screen. `facing` is the direction
 * from the handle to the viewer. `null` when the axis points at the viewer,
 * where a drag along it cannot be told.
 */
export function zhudaAlongAxis(ray: ZhudaRay, origin: V3, axis: V3, facing: V3): number | null {
  const u = unit(axis);
  const side = cross(u, unit(facing));
  if (Math.hypot(side[0], side[1], side[2]) < 0.05) return null;
  const normal = unit(cross(side, u));
  const toward = dot(ray.direction, normal);
  if (Math.abs(toward) < 1e-6) return null;
  const t = dot(sub(origin, ray.origin), normal) / toward;
  return t > 0 ? dot(sub(along(ray.origin, ray.direction, t), origin), u) : null;
}

/** Two directions square to an axis and to each other; the same for the same axis. */
function square(axis: V3): [V3, V3] {
  const n = unit(axis);
  const side = unit(cross(n, Math.abs(n[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0]));
  return [side, cross(n, side)];
}

/**
 * The angle of a point round an axis through `origin`, in radians,
 * counter-clockwise seen from the axis' tip. Only differences of it mean
 * anything.
 */
export function zhudaAngleRound(point: V3, origin: V3, axis: V3): number {
  const [u, v] = square(axis);
  const p = sub(point, origin);
  return Math.atan2(dot(p, v), dot(p, u));
}

/** A turn of `radians` about an axis, as a quaternion `[x, y, z, w]`. */
export function zhudaAxisTurn(axis: V3, radians: number): Quat {
  const n = unit(axis),
    s = Math.sin(radians / 2);
  return [n[0] * s, n[1] * s, n[2] * s, Math.cos(radians / 2)];
}

/** `a` after `b`: the turn `b`, then the turn `a`. */
export function zhudaTurnAfter(a: Quat, b: Quat): Quat {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

export type ZhudaGizmoMode = 'translate' | 'rotate' | 'scale';
export type ZhudaGizmoAxis = 'x' | 'y' | 'z';
export const ZHUDA_GIZMO_MODES: readonly ZhudaGizmoMode[] = Object.freeze([
  'translate',
  'rotate',
  'scale',
]);

/**
 * Which handle is under a ray. `axes` are the three directions of the
 * handles (length 1), `length` how long a handle is in world units.
 * A move or scale handle is hit within 0.1 of its length of its line; a ring
 * within 0.1 of its radius of its circle. The nearest to the ray wins.
 */
export function zhudaGizmoHit(
  ray: ZhudaRay,
  mode: ZhudaGizmoMode,
  origin: V3,
  axes: readonly [V3, V3, V3],
  length: number,
): ZhudaGizmoAxis | null {
  let best: ZhudaGizmoAxis | null = null,
    miss = Infinity;
  (['x', 'y', 'z'] as const).forEach((name, i) => {
    if (mode === 'rotate') {
      const hit = zhudaRayPlane(ray, origin, axes[i]);
      if (!hit) return;
      const away = sub(hit, origin);
      const off = Math.abs(Math.hypot(away[0], away[1], away[2]) - length);
      if (off < length * 0.1 && off < miss) {
        miss = off;
        best = name;
      }
      return;
    }
    const pass = zhudaRayAxis(ray, origin, axes[i]);
    if (!pass || pass.rayT <= 0 || pass.along < 0 || pass.along > length * 1.1) return;
    if (pass.distance < length * 0.1 && pass.distance < miss) {
      miss = pass.distance;
      best = name;
    }
  });
  return best;
}

export interface ZhudaTransformGizmoOptions {
  /** `'translate'` (default), `'rotate'` or `'scale'`. */
  mode?: ZhudaGizmoMode;
  /**
   * The axes of a move or a turn: the world's (default) or the node's own.
   * A scale is always along the node's own axes.
   */
  space?: 'world' | 'local';
  /**
   * How long a handle is, as a share of the view's height, 0.02..0.5
   * (default 0.15). It stays that size on the screen however far the node is.
   */
  size?: number;
  /**
   * Steps a drag moves in: world units for a move, degrees for a turn, a
   * factor for a scale (0.1 scales in tenths). Without a step a drag is
   * smooth.
   */
  snap?: { translate?: number; rotate?: number; scale?: number };
  /** Told after every change a drag makes to the node. */
  onChange?: (node: any) => void;
}

export function validateZhudaTransformGizmo(options: ZhudaTransformGizmoOptions): string[] {
  const issues: string[] = [];
  const o = (options ?? {}) as Record<string, any>;
  if (o.mode !== undefined && !ZHUDA_GIZMO_MODES.includes(o.mode))
    issues.push('mode: use translate, rotate or scale');
  if (o.space !== undefined && o.space !== 'world' && o.space !== 'local')
    issues.push('space: use world or local');
  if (o.size !== undefined && !(typeof o.size === 'number' && o.size >= 0.02 && o.size <= 0.5))
    issues.push('size: use 0.02..0.5');
  if (o.snap !== undefined) {
    if (!o.snap || typeof o.snap !== 'object')
      issues.push('snap: use { translate, rotate, scale }');
    else
      for (const name of ['translate', 'rotate', 'scale'])
        if (
          o.snap[name] !== undefined &&
          !(typeof o.snap[name] === 'number' && Number.isFinite(o.snap[name]) && o.snap[name] > 0)
        )
          issues.push(`snap.${name}: use a number above 0`);
  }
  if (o.onChange !== undefined && typeof o.onChange !== 'function')
    issues.push('onChange: use a function');
  return issues;
}

const COLORS: Record<ZhudaGizmoAxis, ZhudaDebugColor> = {
  x: [1, 0.25, 0.25],
  y: [0.3, 1, 0.3],
  z: [0.35, 0.55, 1],
};
const ACTIVE: ZhudaDebugColor = [1, 0.9, 0.1];
const step = (value: number, size: number | undefined) =>
  size ? Math.round(value / size) * size : value;

export class ZhudaTransformGizmo {
  private readonly camera: any;
  private readonly draw: ZhudaDebugDraw;
  private node: any = null;
  private options: Required<Pick<ZhudaTransformGizmoOptions, 'mode' | 'space' | 'size'>> &
    Pick<ZhudaTransformGizmoOptions, 'snap' | 'onChange'>;
  private hovered: ZhudaGizmoAxis | null = null;
  private drag:
    | {
        axis: ZhudaGizmoAxis;
        direction: V3;
        origin: V3;
        /** Where the drag began: along the axis, or as an angle round it. */
        start: number;
        length: number;
        position: V3;
        rotation: Quat;
        scale: V3;
      }
    | undefined;
  private disposed = false;

  constructor(scene3D: any, camera: any, options: ZhudaTransformGizmoOptions = {}) {
    const issues = validateZhudaTransformGizmo(options);
    if (issues.length) throw Error('Invalid transform gizmo: ' + issues.join('; '));
    if (!camera?.transform) throw Error('A camera is required');
    this.camera = camera;
    this.options = {
      mode: options.mode ?? 'translate',
      space: options.space ?? 'world',
      size: options.size ?? 0.15,
      snap: options.snap,
      onChange: options.onChange,
    };
    this.draw = new ZhudaDebugDraw(scene3D, { onTop: true, maxLines: 512 });
    let drawn = this.handles();
    this.draw.lines(
      () => (drawn = this.handles()).segments,
      () => (drawn.colors.length ? drawn.colors : COLORS.x),
    );
  }

  /** The node the handles are on; `null` takes them off. A drag in progress ends. */
  attach(node: any): void {
    if (node && !node.transform) throw Error('Invalid transform gizmo: a 3D node is required');
    this.drag = undefined;
    this.hovered = null;
    this.node = node ?? null;
  }
  get attached(): any {
    return this.node;
  }
  get mode(): ZhudaGizmoMode {
    return this.options.mode;
  }
  get space(): 'world' | 'local' {
    return this.options.space;
  }
  /** Whether a handle is being dragged. */
  get dragging(): boolean {
    return !!this.drag;
  }
  /** The handle being dragged, or under the pointer at the last move. */
  get axis(): ZhudaGizmoAxis | null {
    return this.drag?.axis ?? this.hovered;
  }
  /** New values in place; a drag in progress ends. */
  set(options: Pick<ZhudaTransformGizmoOptions, 'mode' | 'space' | 'size' | 'snap'>): void {
    const issues = validateZhudaTransformGizmo(options);
    if (issues.length) throw Error('Invalid transform gizmo: ' + issues.join('; '));
    this.drag = undefined;
    // What was lit is another handle in another mode.
    this.hovered = null;
    this.options = { ...this.options, ...options };
  }

  private view(): ZhudaGizmoCamera {
    const camera = this.camera;
    return {
      matrix: camera.transform.worldMatrix.elements,
      fieldOfView: camera.fieldOfView,
      aspect: camera.aspectRatio,
      orthographic: camera.orthographic,
      orthographicVerticalSize: camera.orthographicVerticalSize,
    };
  }
  /** Where the handles are, which way they point and how long they are now. */
  private frame(): { origin: V3; axes: [V3, V3, V3]; length: number } | null {
    const node = this.node;
    if (!node || node.destroyed || this.camera.destroyed) return null;
    const m: M4 = node.transform.worldMatrix.elements;
    const origin: V3 = [m[12], m[13], m[14]];
    const own = this.options.mode === 'scale' || this.options.space === 'local';
    const axes: [V3, V3, V3] = own
      ? [unit([m[0], m[1], m[2]]), unit([m[4], m[5], m[6]]), unit([m[8], m[9], m[10]])]
      : [
          [1, 0, 0],
          [0, 1, 0],
          [0, 0, 1],
        ];
    const view = this.view();
    const eye = sub(origin, [view.matrix[12], view.matrix[13], view.matrix[14]]);
    const forward = unit([-view.matrix[8], -view.matrix[9], -view.matrix[10]]);
    const height = view.orthographic
      ? (view.orthographicVerticalSize ?? 10)
      : 2 * Math.tan(((view.fieldOfView / 2) * Math.PI) / 180) * Math.max(1e-4, dot(eye, forward));
    return { origin, axes, length: height * this.options.size };
  }
  private handles(): { segments: number[]; colors: ZhudaDebugColor[] } {
    const frame = this.frame();
    const segments: number[] = [],
      colors: ZhudaDebugColor[] = [];
    if (!frame) return { segments, colors };
    (['x', 'y', 'z'] as const).forEach((name, i) => {
      const axis = frame.axes[i];
      let lines: number[];
      if (this.options.mode === 'translate')
        lines = zhudaArrowLines(frame.origin, axis, frame.length);
      else if (this.options.mode === 'rotate')
        lines = zhudaCircleLines(frame.origin, axis, frame.length, 48);
      else {
        const tip = along(frame.origin, axis, frame.length),
          half = frame.length * 0.05;
        lines = [
          ...frame.origin,
          ...tip,
          ...zhudaBoxLines(
            [tip[0] - half, tip[1] - half, tip[2] - half],
            [tip[0] + half, tip[1] + half, tip[2] + half],
          ),
        ];
      }
      const color = this.axis === name ? ACTIVE : COLORS[name];
      for (let k = 0; k < lines.length; k += 6) colors.push(color);
      segments.push(...lines);
    });
    return { segments, colors };
  }

  /** Draws the handles where the node is now. Once a frame. */
  update(): void {
    if (!this.disposed) this.draw.update();
  }

  /**
   * The pointer went down at `x`, `y` (CSS pixels from the top left of a
   * view `width` by `height`). True when a handle is under it: the drag has
   * begun, and the pointer is the gizmo's until `pointerUp`.
   */
  pointerDown(x: number, y: number, width: number, height: number): boolean {
    const frame = this.frame();
    if (this.disposed || !frame) return false;
    const ray = zhudaPointerRay(this.view(), x, y, width, height);
    const axis = zhudaGizmoHit(ray, this.options.mode, frame.origin, frame.axes, frame.length);
    if (!axis) return false;
    const direction = frame.axes['xyz'.indexOf(axis)];
    const start = this.measure(ray, frame.origin, direction);
    if (start === null) return false;
    const t = this.node.transform;
    const p = t.position,
      q = t.rotation,
      s = t.localScale;
    this.drag = {
      axis,
      direction,
      origin: frame.origin,
      start,
      length: frame.length,
      position: [p.x, p.y, p.z],
      rotation: [q.x, q.y, q.z, q.w],
      scale: [s.x, s.y, s.z],
    };
    return true;
  }
  /** How far along the handle (or round it, for a turn) the ray is. */
  private measure(ray: ZhudaRay, origin: V3, direction: V3): number | null {
    if (this.options.mode === 'rotate') {
      const hit = zhudaRayPlane(ray, origin, direction);
      return hit ? zhudaAngleRound(hit, origin, direction) : null;
    }
    const view = this.view();
    const m = view.matrix;
    const facing: V3 = view.orthographic ? [m[8], m[9], m[10]] : sub([m[12], m[13], m[14]], origin);
    return zhudaAlongAxis(ray, origin, direction, facing);
  }

  /**
   * The pointer moved. While a handle is dragged the node follows and true
   * is returned; otherwise the handle under the pointer lights up.
   */
  pointerMove(x: number, y: number, width: number, height: number): boolean {
    const frame = this.frame();
    if (this.disposed || !frame) return false;
    const ray = zhudaPointerRay(this.view(), x, y, width, height);
    const drag = this.drag;
    if (!drag) {
      this.hovered = zhudaGizmoHit(ray, this.options.mode, frame.origin, frame.axes, frame.length);
      return false;
    }
    const now = this.measure(ray, drag.origin, drag.direction);
    if (now === null) return true;
    const l = (globalThis as any).Laya;
    const t = this.node.transform;
    const snap = this.options.snap ?? {};
    if (this.options.mode === 'translate') {
      const moved = step(now - drag.start, snap.translate);
      const p = along(drag.position, drag.direction, moved);
      t.position = new l.Vector3(p[0], p[1], p[2]);
    } else if (this.options.mode === 'rotate') {
      let turned = now - drag.start;
      // The short way round, so a drag across the back of the ring does not jump.
      turned = Math.atan2(Math.sin(turned), Math.cos(turned));
      const degrees = step((turned * 180) / Math.PI, snap.rotate);
      const q = zhudaTurnAfter(
        zhudaAxisTurn(drag.direction, (degrees * Math.PI) / 180),
        drag.rotation,
      );
      t.rotation = new l.Quaternion(q[0], q[1], q[2], q[3]);
    } else {
      const factor = Math.max(0.001, step(1 + (now - drag.start) / drag.length, snap.scale));
      const scale: [number, number, number] = [drag.scale[0], drag.scale[1], drag.scale[2]];
      scale['xyz'.indexOf(drag.axis)] *= factor;
      t.localScale = new l.Vector3(scale[0], scale[1], scale[2]);
    }
    this.options.onChange?.(this.node);
    return true;
  }
  /** The pointer went up, or was taken away: the drag ends where it is. */
  pointerUp(): void {
    this.drag = undefined;
  }
  /** Puts the node back where the drag in progress began, and ends it. */
  cancel(): void {
    const drag = this.drag;
    if (!drag || !this.node || this.node.destroyed) return;
    const l = (globalThis as any).Laya;
    const t = this.node.transform;
    t.position = new l.Vector3(...drag.position);
    t.rotation = new l.Quaternion(...drag.rotation);
    t.localScale = new l.Vector3(...drag.scale);
    this.drag = undefined;
    this.options.onChange?.(this.node);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.drag = undefined;
    this.node = null;
    this.draw.dispose();
  }
}
