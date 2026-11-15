// Generated from TypeScript source; run npm run types:generate.
/**
 * A Spine 4.2 character on LayaAir's Spine2DRenderNode, set up the way that was found to work when a game
 * changes the skeleton by hand (grabbing cloth, pulling a layer, swapping attachments):
 *
 * - Spine physics on: the node's `physicsUpdate` defaults to 0 (none), so PhysicsConstraints never step.
 * - The slow render path (`useFastRender = false`, no cache): the fast one draws from caches and does not
 *   show bones moved or attachments set by the game.
 * - Straight alpha by default (zhuda-spine2D exports `pma:false`), set again after the templet is applied:
 *   LayaAir switches to premultiplied, and its `templet.checkPremultipliedAlpha()` reported true for a
 *   `pma:false` atlas, so it is not trusted.
 * - Places in the art's pixels: the node draws the skeleton's bounds (its JSON `skeleton.x/y/width/height`)
 *   with their top-left corner at the node's origin, and moves the skeleton itself (`skeleton.x/y`), so a
 *   bone's world position has that subtracted. This class converts between the skeleton's space (y up)
 *   and the art's canvas (pixels, y down, origin at the bounds' top-left), which is how rigs made with
 *   zhuda-spine2D place everything.
 *
 * Drive it from the runtime's frame callback: call `update()` once a frame. It makes no clock of its own.
 */
/** The skeleton's bounds as its JSON gives them (Spine units, y up): `skeleton.x/y/width/height`. */
export interface ZhudaSpineBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface ZhudaSpineCharacterOptions {
    /** A Laya.Sprite (or Scene) the character is added to. */
    parent: {
        addChild(child: any): any;
    };
    /** A loaded Laya.SpineTemplet: `await Laya.loader.load(url, Laya.Loader.SPINE)`. */
    templet: any;
    /** The animation to play on track 0 (default: none). */
    animation?: string;
    /** Loop it (default true). */
    loop?: boolean;
    /** Step Spine 4.2 physics (default true; LayaAir's own default is off). */
    physics?: boolean;
    /** Premultiplied alpha (default false: straight, as zhuda-spine2D exports). Set true only for a `pma:true` atlas. */
    premultipliedAlpha?: boolean;
}
export interface ZhudaSpineDiagnostics {
    physicsUpdate: number;
    useFastRender: boolean;
    premultipliedAlpha: boolean;
    /** Where LayaAir has moved the skeleton (subtracted from bone world positions). */
    skeletonOffset: [number, number];
    bounds: ZhudaSpineBounds;
    bones: number;
    slots: number;
    ikConstraints: number;
    physicsConstraints: number;
}
/** Spine's PhysicsConstraint update mode `update` (spine.Physics.update). */
export declare const ZHUDA_SPINE_PHYSICS_UPDATE = 2;
/** A point of the skeleton's space (y up) on the art's canvas (pixels, y down, origin at the bounds' top-left). */
export declare function zhudaSpineToCanvas(bounds: ZhudaSpineBounds, x: number, y: number): [number, number];
/** A point of the art's canvas in the skeleton's space. */
export declare function zhudaSpineFromCanvas(bounds: ZhudaSpineBounds, cx: number, cy: number): [number, number];
export declare class ZhudaSpineCharacter {
    /** The Laya.Sprite holding the renderer; its local space is the art's canvas. */
    readonly node: any;
    /** The Laya.Spine2DRenderNode. */
    readonly renderer: any;
    /** The spine-core Skeleton (the web runtime exposes it). */
    readonly skeleton: any;
    readonly bounds: ZhudaSpineBounds;
    private readonly pma;
    private readonly physics;
    private disposed;
    constructor(options: ZhudaSpineCharacterOptions);
    /** Once a frame: keeps the settings LayaAir may reset after the templet is applied. */
    update(): void;
    /** A point of the stage (Laya.stage pixels) on the art's canvas. */
    stageToCanvas(x: number, y: number): [number, number];
    /** A point along a bone (`along` from its start, in its length's units; default its start), on the canvas. */
    boneCanvas(name: string, along?: number): [number, number];
    /** The far end of a bone (start + its length), on the canvas: the tip of a chain's last link. */
    boneTipCanvas(name: string): [number, number];
    /** Puts a bone's start at a point of the canvas (through its parent's world transform). */
    moveBoneTo(name: string, cx: number, cy: number): void;
    /** Moves a bone from its setup place by (dx, dy) canvas pixels (y down), in its parent's axes. */
    nudgeBone(name: string, dx: number, dy: number): void;
    /** An IK constraint's mix (0 lets go, 1 follows its target). */
    setIkMix(name: string, mix: number): void;
    /** Shows an attachment in a slot, or empties it (null). Unknown names are refused by name. */
    setAttachment(slot: string, attachment: string | null): void;
    diagnostics(): ZhudaSpineDiagnostics;
    dispose(): void;
    private get offsetX();
    private get offsetY();
    private bone;
}
