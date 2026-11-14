// Generated from TypeScript source; run npm run types:generate.
type V3 = readonly [number, number, number];
type M4 = ArrayLike<number>;
type Quat = readonly [number, number, number, number];
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
export declare function zhudaPointerRay(camera: ZhudaGizmoCamera, x: number, y: number, width: number, height: number): ZhudaRay;
/**
 * Where a ray passes an axis line: how far along the axis from its origin
 * (`along`, signed), how far along the ray (`rayT`) and how far apart the
 * two are there. `null` when they are parallel.
 */
export declare function zhudaRayAxis(ray: ZhudaRay, origin: V3, axis: V3): {
    along: number;
    rayT: number;
    distance: number;
} | null;
/** Where a ray meets the plane through `point` square to `normal`; `null` when it does not, in front of it. */
export declare function zhudaRayPlane(ray: ZhudaRay, point: V3, normal: V3): V3 | null;
/**
 * How far along an axis the pointer is, for a drag: the ray is met with the
 * plane that holds the axis and faces the viewer most, and the meeting point
 * is measured along the axis. A pointer beside the axis then moves the node
 * as far as it moved along the axis on the screen. `facing` is the direction
 * from the handle to the viewer. `null` when the axis points at the viewer,
 * where a drag along it cannot be told.
 */
export declare function zhudaAlongAxis(ray: ZhudaRay, origin: V3, axis: V3, facing: V3): number | null;
/**
 * The angle of a point round an axis through `origin`, in radians,
 * counter-clockwise seen from the axis' tip. Only differences of it mean
 * anything.
 */
export declare function zhudaAngleRound(point: V3, origin: V3, axis: V3): number;
/** A turn of `radians` about an axis, as a quaternion `[x, y, z, w]`. */
export declare function zhudaAxisTurn(axis: V3, radians: number): Quat;
/** `a` after `b`: the turn `b`, then the turn `a`. */
export declare function zhudaTurnAfter(a: Quat, b: Quat): Quat;
export type ZhudaGizmoMode = 'translate' | 'rotate' | 'scale';
export type ZhudaGizmoAxis = 'x' | 'y' | 'z';
export declare const ZHUDA_GIZMO_MODES: readonly ZhudaGizmoMode[];
/**
 * Which handle is under a ray. `axes` are the three directions of the
 * handles (length 1), `length` how long a handle is in world units.
 * A move or scale handle is hit within 0.1 of its length of its line; a ring
 * within 0.1 of its radius of its circle. The nearest to the ray wins.
 */
export declare function zhudaGizmoHit(ray: ZhudaRay, mode: ZhudaGizmoMode, origin: V3, axes: readonly [V3, V3, V3], length: number): ZhudaGizmoAxis | null;
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
    snap?: {
        translate?: number;
        rotate?: number;
        scale?: number;
    };
    /** Told after every change a drag makes to the node. */
    onChange?: (node: any) => void;
}
export declare function validateZhudaTransformGizmo(options: ZhudaTransformGizmoOptions): string[];
export declare class ZhudaTransformGizmo {
    private readonly camera;
    private readonly draw;
    private node;
    private options;
    private hovered;
    private drag;
    private disposed;
    constructor(scene3D: any, camera: any, options?: ZhudaTransformGizmoOptions);
    /** The node the handles are on; `null` takes them off. A drag in progress ends. */
    attach(node: any): void;
    get attached(): any;
    get mode(): ZhudaGizmoMode;
    get space(): 'world' | 'local';
    /** Whether a handle is being dragged. */
    get dragging(): boolean;
    /** The handle being dragged, or under the pointer at the last move. */
    get axis(): ZhudaGizmoAxis | null;
    /** New values in place; a drag in progress ends. */
    set(options: Pick<ZhudaTransformGizmoOptions, 'mode' | 'space' | 'size' | 'snap'>): void;
    private view;
    /** Where the handles are, which way they point and how long they are now. */
    private frame;
    private handles;
    /** Draws the handles where the node is now. Once a frame. */
    update(): void;
    /**
     * The pointer went down at `x`, `y` (CSS pixels from the top left of a
     * view `width` by `height`). True when a handle is under it: the drag has
     * begun, and the pointer is the gizmo's until `pointerUp`.
     */
    pointerDown(x: number, y: number, width: number, height: number): boolean;
    /** How far along the handle (or round it, for a turn) the ray is. */
    private measure;
    /**
     * The pointer moved. While a handle is dragged the node follows and true
     * is returned; otherwise the handle under the pointer lights up.
     */
    pointerMove(x: number, y: number, width: number, height: number): boolean;
    /** The pointer went up, or was taken away: the drag ends where it is. */
    pointerUp(): void;
    /** Puts the node back where the drag in progress began, and ends it. */
    cancel(): void;
    dispose(): void;
}
export {};
