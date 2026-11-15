// Generated from TypeScript source; run npm run types:generate.
/**
 * A human hand from numbers: a skeleton with adult proportions, a pose given
 * as joint angles, soft parts round each bone joined by fillets, and nails.
 *
 * Built on `Isosurface.ts`. Pure data: the result is `MeshData` for the skin
 * and for the nails, and where each joint ended up. Nothing here touches Laya
 * or comes from a file.
 *
 * The hand's own frame (a right hand; a left one is its mirror in x): the
 * middle of the wrist's crease at the origin, the fingers along +y, the back
 * of the hand toward +z, the thumb toward -x. Metres.
 *
 * The proportions are an adult's of middle size (hand length 0.185, breadth
 * across the knuckles 0.082), the bones' lengths in the ratios anatomy
 * tables give; `length` and `breadth` scale them.
 */
import type { MeshData } from '../runtime3d/Surfaces.js';
import type { ZhudaVec3 } from './Geometry.js';
export type ZhudaHandFinger = 'index' | 'middle' | 'ring' | 'little';
export type ZhudaHandDigit = 'thumb' | ZhudaHandFinger;
export declare const ZHUDA_HAND_FINGERS: readonly ZhudaHandFinger[];
export declare const ZHUDA_HAND_DIGITS: readonly ZhudaHandDigit[];
/** Joint angles in degrees. A finger's are its knuckle, middle and end joints; the thumb's its base, knuckle and end joints. */
export interface ZhudaHandPose {
    /** Bend at each joint toward the palm, degrees: [knuckle, middle, end]. */
    index?: [number, number, number];
    middle?: [number, number, number];
    ring?: [number, number, number];
    little?: [number, number, number];
    /** Bend at [base, knuckle, end]; the base turns the thumb across the palm. */
    thumb?: [number, number, number];
    /** How far the fingers fan out, degrees between neighbours on average (default 6). */
    spread?: number;
    /** How far the thumb stands out from the palm, degrees (default 40). */
    thumbOut?: number;
}
/** A hand at rest: the fingers bend more toward the little one, as a hand left alone does. */
export declare const ZHUDA_HAND_RELAXED: Readonly<Required<ZhudaHandPose>>;
/** A hand laid flat with the fingers a little apart. */
export declare const ZHUDA_HAND_FLAT: Readonly<Required<ZhudaHandPose>>;
export interface ZhudaHandOptions {
    side?: 'right' | 'left';
    /** From the wrist's crease to the end of the middle finger, metres (default 0.185; 0.12 to 0.25). */
    length?: number;
    /** Across the knuckles, metres (default 0.082; 0.06 to 0.11). */
    breadth?: number;
    /** Joint angles; any left out are the relaxed pose's. */
    pose?: ZhudaHandPose;
    /** The skin's colour as a display colour (default a light skin, 0.86, 0.66, 0.56). */
    tone?: [number, number, number];
    /** The skin mesh's cell, metres (default 0.0009; 0.0006 to 0.004). */
    cellSize?: number;
    /** How far the forearm runs below the wrist's crease, metres (default 0.05; 0.01 to 0.2). */
    forearm?: number;
}
export interface ZhudaHandJoint {
    digit: ZhudaHandDigit;
    /** 0 the bone's base (the finger's knuckle, the thumb's base), up to 3 the end of the last bone. */
    index: number;
    position: ZhudaVec3;
}
export interface ZhudaHandMesh {
    /**
     * The skin, in chunks of at most 65535 vertices (one `ZhudaDynamicMesh` each). Its colour a vertex carries the tint as a display colour (a
     * lit surface reads it as light in `s.vertexColor.rgb`) and, in alpha, how
     * thin the hand is there (1 a sheet of nothing, about 0.4 through a finger,
     * 0.25 through the palm): read it into `s.thickness` for light from behind.
     */
    skin: MeshData[];
    /** The five nails, one mesh; their colour a vertex is the nail's tint (whiter at the free edge) and 1. */
    nails: MeshData;
    joints: ZhudaHandJoint[];
    /** Where the tip of each digit is (the end of its flesh, not of its bone). */
    tips: Record<ZhudaHandDigit, ZhudaVec3>;
    side: 'right' | 'left';
}
/** What is wrong with the options; empty when a hand can be made. */
export declare function validateZhudaHand(options?: ZhudaHandOptions): string[];
/** Makes the hand. Throws with every problem `validateZhudaHand` finds. */
export declare function createZhudaHandMesh(options?: ZhudaHandOptions): ZhudaHandMesh;
