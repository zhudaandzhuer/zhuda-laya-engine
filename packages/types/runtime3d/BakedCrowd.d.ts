// Generated from TypeScript source; run npm run types:generate.
/**
 * A crowd of one animated character without a skeleton for each: the
 * character's clips are played once when it is made, every bone of every
 * frame is written into a texture, and each copy says which clip and which
 * frame it shows. The copies are grouped by the square of ground they stand
 * on (as `ZhudaInstancedMesh` groups props), a group is one draw a
 * sub-mesh in every pass, and a frame costs four numbers a copy. Five
 * hundred walkers are a handful of draws, lit and shadowed like any mesh.
 *
 * What it gives up: a copy shows whole frames of one clip (no blending
 * between clips or between frames; bake at the rate it is seen at), nothing
 * can be attached to its bones, and it is culled with its group.
 *
 * LayaAir draws such a mesh with its "simple skinned" shader path
 * (`SIMPLEBONE` with `GPU_INSTANCE`); the texture is laid out as that path
 * reads it. The layout and the frame arithmetic are plain; the baking and
 * the crowd need the Laya runtime.
 */
import type { ModelInstance } from './Assets.js';
import type { ZhudaModelPlacement } from './ModelPlacements.js';
export interface ZhudaBakedClip {
    name: string;
    /** How long it is, in seconds. */
    seconds: number;
    /** How many frames were written: one at each `1 / fps`, and the last at its end. */
    frames: number;
    /** The texel its first frame begins at. */
    start: number;
}
export interface ZhudaBakedLayout {
    /** The texture is `size` by `size` texels, four numbers each. */
    size: number;
    fps: number;
    /** Texels a frame: four a bone, for every bone of every skinned mesh. */
    frameTexels: number;
    clips: ZhudaBakedClip[];
    /** For each skinned mesh of the model: the bone its bones begin at inside a frame. */
    bases: number[];
    /** Texels in use; the rest of the texture is empty. */
    texels: number;
}
/**
 * Where every bone of every frame goes in the texture: clip after clip,
 * frame after frame, the skinned meshes of the model one after another
 * inside a frame, four texels (a matrix, column by column) a bone.
 */
export declare function zhudaBakedLayout(clips: readonly {
    name: string;
    seconds: number;
}[], bones: readonly number[], fps?: number): ZhudaBakedLayout;
/**
 * The frame of a clip a copy shows at `seconds`, for a copy that began
 * `phase` seconds into the clip and plays at `speed`: the clip goes round.
 * The last written frame is the clip's end, which a round shows as its
 * beginning, so a round has `frames - 1` steps.
 */
export declare function zhudaCrowdFrame(clip: Pick<ZhudaBakedClip, 'seconds' | 'frames'>, seconds: number, phase?: number, speed?: number): number;
export interface ZhudaBakeOptions {
    /** Which clips, by name (default: every clip of the model). */
    clips?: readonly string[];
    /** Frames a second written, 1..120 (default 30). */
    fps?: number;
}
interface BakedPart {
    mesh: any;
    materials: any[];
    /** The mesh's vertices with each bone index as the skeleton numbers it. */
    vertices: any;
}
/** A model's animation written out for a crowd; owns the texture and the vertex buffers made for it. */
export declare class ZhudaBakedCharacter {
    readonly layout: ZhudaBakedLayout;
    /** The box round the character through all its clips, in the model's own space. */
    readonly min: [number, number, number];
    readonly max: [number, number, number];
    /** @internal */
    readonly texture: any;
    /** @internal */
    readonly parts: BakedPart[];
    private disposed;
    /**
     * Plays every asked clip of `instance` once, a frame at a time, and keeps
     * every bone of every frame. The instance is the caller's and is left in
     * the pose of the last frame written; it need not be in a scene. It must
     * stay alive while the character is used: the crowd draws with its meshes
     * and materials.
     */
    constructor(instance: ModelInstance, options?: ZhudaBakeOptions);
    private readonly owned;
    /** The clip of that name. */
    clip(name: string): ZhudaBakedClip;
    /** Bytes of the texture on the graphics card. */
    get textureBytes(): number;
    get isDisposed(): boolean;
    /** After every crowd made from it is disposed. */
    dispose(): void;
}
export interface ZhudaCrowdCopy {
    /** Where the copy stands under the crowd's parent: `[x, y, z, yawDeg, scale]`. */
    place: ZhudaModelPlacement;
    /** The clip it shows, by name (default: the first that was baked). */
    clip?: string;
    /** Seconds into the clip it begins at (default 0): copies in step look like a drill. */
    phase?: number;
    /** How fast it plays, 0..8 (default 1). */
    speed?: number;
}
export interface ZhudaBakedCrowdOptions {
    castShadow?: boolean;
    receiveShadow?: boolean;
    /** Side of the squares the copies are grouped by, in metres (default 32). */
    cellMeters?: number;
    /** Most copies in one group (default 1024). */
    maxPerCell?: number;
    layer?: number;
    label?: string;
}
export declare class ZhudaBakedCrowd {
    readonly count: number;
    private readonly character;
    private readonly clips;
    private readonly phases;
    private readonly speeds;
    private readonly groups;
    private readonly nodes;
    private readonly owned;
    private changed;
    private disposed;
    /**
     * @param parent the node the groups are added under; the places are under it.
     * @param character what `ZhudaBakedCharacter` baked; shared by every crowd made from it.
     */
    constructor(parent: any, character: ZhudaBakedCharacter, copies: readonly ZhudaCrowdCopy[], options?: ZhudaBakedCrowdOptions);
    /** Copies, groups, and draws a pass. */
    get stats(): {
        copies: number;
        groups: number;
        drawsPerPass: number;
    };
    /** Gives a copy another clip, from its beginning at the `seconds` it is given. */
    setClip(copy: number, clip: string, options?: {
        phase?: number;
        speed?: number;
    }): void;
    /**
     * Shows every copy the frame of its clip at `seconds`, the time of the
     * clock the scene runs on. Returns how many copies changed frame; a group
     * none of whose copies did is not touched.
     */
    update(seconds: number): number;
    private release;
    /** Destroys the group nodes and their buffers; the baked character is the caller's. */
    dispose(): void;
}
export {};
