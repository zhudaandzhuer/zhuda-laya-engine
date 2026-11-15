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
import type { ZhudaLitSurfaceSpec } from '../shaders/LitSurfaceMaterial.js';
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
/** A hand held up gracefully: the fingers a little bent and apart, more toward the little one. */
export declare const ZHUDA_HAND_GRACEFUL: Readonly<Required<ZhudaHandPose>>;
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
    /** The build of the hand beyond its size: slender or strong, nails, veins. */
    build?: ZhudaHandBuild;
}
/** What makes one adult's hand differ from another's beyond its length and breadth. Every value has a neutral default. */
export interface ZhudaHandBuild {
    /** The fingers' thickness, a share of the default (0.8 to 1.2; default 1). */
    fingerWidth?: number;
    /** The tip's radius as a share of the default; the joints between follow (0.75 to 1.1; default 1). */
    taper?: number;
    /** The fingers' length against the palm's; `length` is kept (0.9 to 1.2; default 1). */
    fingerLength?: number;
    /** How much bone shows: the joints' waist and knuckles, the knuckles and tendons on the back (0 to 1.5; default 1). */
    bone?: number;
    /** The flesh of the palm: the ball of the thumb, the heel and the pads (0.85 to 1.15; default 1). */
    flesh?: number;
    /** How far the nails run past the end of the finger, metres (0 to 0.006; default 0.0008). */
    nailFree?: number;
    /** The nails' free edge: 0 square, 0.5 round, 1 almond (narrowing to a soft point) (default 0.5). */
    nailRound?: number;
    /** The nails' colour over the bed, a display colour (default 0.9, 0.66, 0.64). */
    nailTone?: [number, number, number];
    /** How much the veins on the back of the hand show through, as a tint (0 to 1; default 0.3). */
    veins?: number;
    /** How much the tendons on the back of the hand stand out (0 to 1.5; default `bone`). */
    tendons?: number;
    /** How pink the knuckles, the fingertips and the palm's pads are (0 to 1.5; default 0.6). */
    flush?: number;
}
/** A man's hand, fine rather than rough: long, broad, with clean joints, short square-round nails. */
export declare const ZHUDA_HAND_MALE: Readonly<ZhudaHandOptions>;
/** A woman's hand with fair skin: slender, long straight fingers that taper, long almond nails, pink at the knuckles and tips. */
export declare const ZHUDA_HAND_FEMALE: Readonly<ZhudaHandOptions>;
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
export interface ZhudaHandSurfaceOptions {
    /** A prefix for the two shader names (each name is a shader contract: one per look, not per hand). */
    name: string;
    /** How much fine creasing shows close up (0 to 2; default 1). */
    detail?: number;
    /** Faint blotches of colour across the skin (0 to 2; default 1). */
    mottle?: number;
    /** The skin's roughness between its creases (0.25 to 0.8; default 0.48). */
    roughness?: number;
    /** The colour light takes through skin, as light (default 1, 0.3, 0.2). */
    subsurfaceColor?: [number, number, number];
}
/**
 * The lit surfaces a `createZhudaHandMesh` hand is drawn with: skin that reads
 * the mesh's tint and thinness, light round and through it, a soft network of
 * fine creases that fades out where it would be smaller than a pixel,
 * faint blotches of colour; and glossy nails. Pass each to
 * `new ZhudaLitSurfaceMaterial(spec)`, and give the skin the hand's place
 * with `setZhudaHandSkinSpace` whenever the hand moves, turns or scales: the
 * fine pattern is in the hand's own space and stays on it.
 */
export declare function createZhudaHandSurfaces(options: ZhudaHandSurfaceOptions): {
    skin: ZhudaLitSurfaceSpec;
    nail: ZhudaLitSurfaceSpec;
};
/**
 * Gives a hand's skin (a material made from `createZhudaHandSurfaces().skin`)
 * the hand's place, so its fine pattern stays on the hand: `worldMatrix` is
 * the hand node's world matrix as 16 numbers in LayaAir's order (the axes in
 * 0..2, 4..6, 8..10, the position in 12..14), e.g.
 * `node.transform.worldMatrix.elements`. Call it when the hand moves.
 */
export declare function setZhudaHandSkinSpace(skin: {
    set(name: string, value: readonly number[]): void;
}, worldMatrix: ArrayLike<number>): void;
