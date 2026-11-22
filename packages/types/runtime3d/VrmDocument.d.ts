// Generated from TypeScript source; run npm run types:generate.
/**
 * VRM 1.0 read from a glTF document: `VRMC_vrm` (meta, humanoid bones,
 * expressions, gaze, first person), `VRMC_springBone`, the materials'
 * `VRMC_materials_mtoon` and the nodes' `VRMC_node_constraint`, as the VRM
 * Consortium's specification describes them (vrm-c/vrm-specification,
 * `specification/VRMC_*-1.0`), with its defaults where a value is absent.
 *
 * Also the specification's arithmetic, so that it can be checked without a
 * renderer: expression weights with their overrides, gaze angles and range
 * maps, a spring joint's settings on the engine's solver, node constraints,
 * and an MToon material as the engine's toon material.
 *
 * Pure: no LayaAir. VRM 0.x (the `VRM` extension) is refused by name.
 */
import type { ZhudaToonSpec } from '../shaders/ToonMaterial.js';
import { type ZhudaIkTurn } from './Ik.js';
type Quat = [number, number, number, number];
/** Every humanoid bone of VRM 1.0, in the specification's order. */
export declare const ZHUDA_VRM_HUMAN_BONES: readonly ["hips", "spine", "chest", "upperChest", "neck", "head", "leftEye", "rightEye", "jaw", "leftUpperLeg", "leftLowerLeg", "leftFoot", "leftToes", "rightUpperLeg", "rightLowerLeg", "rightFoot", "rightToes", "leftShoulder", "leftUpperArm", "leftLowerArm", "leftHand", "rightShoulder", "rightUpperArm", "rightLowerArm", "rightHand", "leftThumbMetacarpal", "leftThumbProximal", "leftThumbDistal", "leftIndexProximal", "leftIndexIntermediate", "leftIndexDistal", "leftMiddleProximal", "leftMiddleIntermediate", "leftMiddleDistal", "leftRingProximal", "leftRingIntermediate", "leftRingDistal", "leftLittleProximal", "leftLittleIntermediate", "leftLittleDistal", "rightThumbMetacarpal", "rightThumbProximal", "rightThumbDistal", "rightIndexProximal", "rightIndexIntermediate", "rightIndexDistal", "rightMiddleProximal", "rightMiddleIntermediate", "rightMiddleDistal", "rightRingProximal", "rightRingIntermediate", "rightRingDistal", "rightLittleProximal", "rightLittleIntermediate", "rightLittleDistal"];
export type ZhudaVrmHumanBoneName = (typeof ZHUDA_VRM_HUMAN_BONES)[number];
/** The bones a VRM 1.0 humanoid must have. */
export declare const ZHUDA_VRM_REQUIRED_BONES: readonly ZhudaVrmHumanBoneName[];
/** The preset expressions of VRM 1.0. */
export declare const ZHUDA_VRM_EXPRESSION_PRESETS: readonly ["happy", "angry", "sad", "relaxed", "surprised", "aa", "ih", "ou", "ee", "oh", "blink", "blinkLeft", "blinkRight", "lookUp", "lookDown", "lookLeft", "lookRight", "neutral"];
export type ZhudaVrmExpressionPreset = (typeof ZHUDA_VRM_EXPRESSION_PRESETS)[number];
/** The procedural expressions an override acts on. */
export declare const ZHUDA_VRM_BLINK: readonly string[];
export declare const ZHUDA_VRM_LOOK: readonly string[];
export declare const ZHUDA_VRM_MOUTH: readonly string[];
export type ZhudaVrmIssueCode = 'VRM0_UNSUPPORTED' | 'VRM_SPEC_VERSION' | 'VRM_INVALID' | 'VRM_META' | 'VRM_MISSING_BONE' | 'VRM_BONE' | 'VRM_EXPRESSION' | 'VRM_LOOK_AT' | 'VRM_FIRST_PERSON' | 'VRM_SPRING' | 'VRM_COLLIDER' | 'VRM_MTOON' | 'VRM_CONSTRAINT';
/** Something in the file: an error refuses the VRM; a warning drops or approximates the part named. */
export interface ZhudaVrmIssue {
    readonly code: ZhudaVrmIssueCode;
    readonly severity: 'error' | 'warning';
    /** Where in the glTF JSON, as `$.extensions.VRMC_vrm.humanoid...`. */
    readonly path: string;
    readonly message: string;
}
/** `VRMC_vrm.meta`: who made the model and what its licence allows, as the file states it (the specification's defaults where it is silent). */
export interface ZhudaVrmMeta {
    readonly name: string;
    readonly version: string | null;
    readonly authors: readonly string[];
    readonly copyrightInformation: string | null;
    readonly contactInformation: string | null;
    readonly references: readonly string[];
    readonly thirdPartyLicenses: string | null;
    /** Index into the glTF `images`, or null. */
    readonly thumbnailImage: number | null;
    readonly licenseUrl: string;
    readonly avatarPermission: 'onlyAuthor' | 'onlySeparatelyLicensedPerson' | 'everyone';
    readonly allowExcessivelyViolentUsage: boolean;
    readonly allowExcessivelySexualUsage: boolean;
    readonly commercialUsage: 'personalNonProfit' | 'personalProfit' | 'corporation';
    readonly allowPoliticalOrReligiousUsage: boolean;
    readonly allowAntisocialOrHateUsage: boolean;
    readonly creditNotation: 'required' | 'unnecessary';
    readonly allowRedistribution: boolean;
    readonly modification: 'prohibited' | 'allowModification' | 'allowModificationRedistribution';
    readonly otherLicenseUrl: string | null;
}
/** A morph target an expression moves: `weight` at an expression weight of 1. */
export interface ZhudaVrmMorphBind {
    /** The glTF node whose mesh has the target. */
    readonly node: number;
    /** The morph target's index in that mesh. */
    readonly index: number;
    readonly weight: number;
}
export type ZhudaVrmColorType = 'color' | 'emissionColor' | 'shadeColor' | 'matcapColor' | 'rimColor' | 'outlineColor';
/** A material colour an expression moves toward `target` (linear, as glTF factors are). */
export interface ZhudaVrmColorBind {
    readonly material: number;
    readonly type: ZhudaVrmColorType;
    readonly target: readonly [number, number, number, number];
}
/** A material's texture scale and offset an expression moves toward. */
export interface ZhudaVrmTextureBind {
    readonly material: number;
    readonly scale: readonly [number, number];
    readonly offset: readonly [number, number];
}
export type ZhudaVrmOverride = 'none' | 'block' | 'blend';
export interface ZhudaVrmExpression {
    /** The preset's name, or the custom expression's key. */
    readonly name: string;
    readonly preset: ZhudaVrmExpressionPreset | 'custom';
    readonly morphs: readonly ZhudaVrmMorphBind[];
    readonly colors: readonly ZhudaVrmColorBind[];
    readonly textures: readonly ZhudaVrmTextureBind[];
    readonly isBinary: boolean;
    readonly overrideBlink: ZhudaVrmOverride;
    readonly overrideLookAt: ZhudaVrmOverride;
    readonly overrideMouth: ZhudaVrmOverride;
}
export interface ZhudaVrmRangeMap {
    /** Degrees of yaw or pitch at which the output is at its largest (0..180). */
    readonly inputMaxValue: number;
    /** Degrees of eye rotation (`bone`) or an expression's weight (`expression`) there. */
    readonly outputScale: number;
}
export interface ZhudaVrmLookAt {
    readonly type: 'bone' | 'expression';
    /** Where the eyes look from, in the head's own space, metres. */
    readonly offsetFromHeadBone: readonly [number, number, number];
    readonly horizontalInner: ZhudaVrmRangeMap;
    readonly horizontalOuter: ZhudaVrmRangeMap;
    readonly verticalDown: ZhudaVrmRangeMap;
    readonly verticalUp: ZhudaVrmRangeMap;
}
export interface ZhudaVrmMeshAnnotation {
    readonly node: number;
    readonly type: 'auto' | 'both' | 'thirdPersonOnly' | 'firstPersonOnly';
}
export type ZhudaVrmColliderShape = {
    readonly type: 'sphere';
    readonly offset: readonly [number, number, number];
    readonly radius: number;
} | {
    readonly type: 'capsule';
    readonly offset: readonly [number, number, number];
    readonly tail: readonly [number, number, number];
    readonly radius: number;
};
export interface ZhudaVrmCollider {
    readonly node: number;
    readonly shape: ZhudaVrmColliderShape;
}
export interface ZhudaVrmColliderGroup {
    readonly name: string;
    /** Indices into `colliders`. */
    readonly colliders: readonly number[];
}
/** A spring's joint, with VRM's own settings (per frame, as UniVRM and three-vrm run them). */
export interface ZhudaVrmSpringJoint {
    readonly node: number;
    readonly hitRadius: number;
    readonly stiffness: number;
    readonly gravityPower: number;
    readonly gravityDir: readonly [number, number, number];
    readonly dragForce: number;
}
export interface ZhudaVrmSpring {
    readonly name: string;
    /** Root first; the last joint is where the spring ends. */
    readonly joints: readonly ZhudaVrmSpringJoint[];
    /** Indices into `colliderGroups`. */
    readonly colliderGroups: readonly number[];
    /** The node whose space the spring moves in, or null (the world). */
    readonly center: number | null;
}
export interface ZhudaVrmSpringBone {
    readonly colliders: readonly ZhudaVrmCollider[];
    readonly colliderGroups: readonly ZhudaVrmColliderGroup[];
    readonly springs: readonly ZhudaVrmSpring[];
}
/** A texture slot: the glTF texture index and its texture coordinate set. */
export interface ZhudaVrmTextureRef {
    readonly index: number;
    readonly texCoord: number;
}
/** A material's `VRMC_materials_mtoon`, with the glTF core values it reads. */
export interface ZhudaVrmMToon {
    readonly material: number;
    readonly name: string | null;
    readonly baseColorFactor: readonly [number, number, number, number];
    readonly baseColorTexture: ZhudaVrmTextureRef | null;
    /** `KHR_texture_transform` of the base colour texture: offset, scale, rotation (radians). */
    readonly baseColorTransform: {
        readonly offset: readonly [number, number];
        readonly scale: readonly [number, number];
        readonly rotation: number;
    } | null;
    readonly normalTexture: (ZhudaVrmTextureRef & {
        readonly scale: number;
    }) | null;
    readonly emissiveFactor: readonly [number, number, number];
    readonly emissiveTexture: ZhudaVrmTextureRef | null;
    readonly alphaMode: 'OPAQUE' | 'MASK' | 'BLEND';
    readonly alphaCutoff: number;
    readonly doubleSided: boolean;
    readonly transparentWithZWrite: boolean;
    readonly renderQueueOffsetNumber: number;
    readonly shadeColorFactor: readonly [number, number, number];
    readonly shadeMultiplyTexture: ZhudaVrmTextureRef | null;
    readonly shadingShiftFactor: number;
    readonly shadingShiftTexture: (ZhudaVrmTextureRef & {
        readonly scale: number;
    }) | null;
    readonly shadingToonyFactor: number;
    readonly giEqualizationFactor: number;
    readonly matcapFactor: readonly [number, number, number];
    readonly matcapTexture: ZhudaVrmTextureRef | null;
    readonly parametricRimColorFactor: readonly [number, number, number];
    readonly rimMultiplyTexture: ZhudaVrmTextureRef | null;
    readonly rimLightingMixFactor: number;
    readonly parametricRimFresnelPowerFactor: number;
    readonly parametricRimLiftFactor: number;
    readonly outlineWidthMode: 'none' | 'worldCoordinates' | 'screenCoordinates';
    readonly outlineWidthFactor: number;
    readonly outlineWidthMultiplyTexture: ZhudaVrmTextureRef | null;
    readonly outlineColorFactor: readonly [number, number, number];
    readonly outlineLightingMixFactor: number;
    readonly uvAnimationMaskTexture: ZhudaVrmTextureRef | null;
    readonly uvAnimationScrollXSpeedFactor: number;
    readonly uvAnimationScrollYSpeedFactor: number;
    readonly uvAnimationRotationSpeedFactor: number;
}
export type ZhudaVrmAimAxis = 'PositiveX' | 'NegativeX' | 'PositiveY' | 'NegativeY' | 'PositiveZ' | 'NegativeZ';
/** A node's `VRMC_node_constraint`: `node` is turned from `source`. */
export type ZhudaVrmConstraint = {
    readonly node: number;
    readonly type: 'rotation';
    readonly source: number;
    readonly weight: number;
} | {
    readonly node: number;
    readonly type: 'roll';
    readonly source: number;
    readonly weight: number;
    readonly rollAxis: 'X' | 'Y' | 'Z';
} | {
    readonly node: number;
    readonly type: 'aim';
    readonly source: number;
    readonly weight: number;
    readonly aimAxis: ZhudaVrmAimAxis;
};
/** A model's VRM 1.0 data. Node, material and texture numbers are glTF indices. */
export interface ZhudaVrmDocument {
    readonly specVersion: '1.0' | '1.0-beta';
    readonly meta: ZhudaVrmMeta;
    /** Each humanoid bone the model has, to its glTF node. */
    readonly humanBones: Readonly<Partial<Record<ZhudaVrmHumanBoneName, number>>>;
    readonly expressions: readonly ZhudaVrmExpression[];
    readonly lookAt: ZhudaVrmLookAt;
    readonly firstPerson: readonly ZhudaVrmMeshAnnotation[];
    /** `VRMC_springBone`, or null when the file has none. */
    readonly springBone: ZhudaVrmSpringBone | null;
    /** The materials with `VRMC_materials_mtoon`, by material index order. */
    readonly mtoon: readonly ZhudaVrmMToon[];
    readonly constraints: readonly ZhudaVrmConstraint[];
}
export interface ZhudaVrmReadResult {
    /** Null when the file is not VRM 1.0, or when an error refuses it. */
    readonly vrm: ZhudaVrmDocument | null;
    readonly issues: readonly ZhudaVrmIssue[];
}
/** Each glTF node's parent index, -1 at a root. */
export declare function zhudaGltfNodeParents(document: unknown): number[];
/**
 * The VRM 1.0 data of a glTF document (the JSON of a `.vrm` or `.glb`).
 * `vrm` is null for a file without `VRMC_vrm`, and for one an error refuses
 * (VRM 0.x, a missing required bone, meta without its required fields).
 */
export declare function readZhudaVrm(document: unknown): ZhudaVrmReadResult;
/**
 * Each expression's weight as it is applied: the weight set (clamped to
 * 0..1), 0 or 1 for a binary one, and the procedural ones (blink, gaze,
 * mouth) lowered by the overrides of the others, as the specification and
 * three-vrm do it: `block` takes them to 0 while the overriding expression
 * shows at all, `blend` lowers them by its weight; a binary expression that
 * is lowered at all shows nothing. An expression's override of its own kind
 * is not counted.
 */
export declare function zhudaVrmExpressionWeights(expressions: readonly ZhudaVrmExpression[], weights: ReadonlyMap<string, number> | Readonly<Record<string, number>>): Map<string, number>;
/**
 * Yaw and pitch, degrees, of a point given in the gaze's own space (glTF's
 * axes: +Z forward, +Y up, +X the model's left): yaw is positive toward the
 * left, pitch positive downward, as the specification has them.
 */
export declare function zhudaVrmYawPitch(local: readonly [number, number, number]): {
    yaw: number;
    pitch: number;
};
/** A range map on the size of a yaw or a pitch (degrees): `outputScale` at `inputMaxValue` and past it. */
export declare function zhudaVrmRangeMap(map: ZhudaVrmRangeMap, value: number): number;
/** Each eye's yaw and pitch, degrees, for a gaze by bone: the specification's inner and outer ranges. */
export declare function zhudaVrmEyeAngles(lookAt: ZhudaVrmLookAt, yaw: number, pitch: number): {
    left: {
        yaw: number;
        pitch: number;
    };
    right: {
        yaw: number;
        pitch: number;
    };
};
/** The four gaze expressions' weights for a gaze by expression. */
export declare function zhudaVrmLookWeights(lookAt: ZhudaVrmLookAt, yaw: number, pitch: number): {
    lookLeft: number;
    lookRight: number;
    lookUp: number;
    lookDown: number;
};
/** The turn of a yaw about +Y and then a pitch about +X (degrees; Euler order Y, X). */
export declare function zhudaVrmYawPitchTurn(yaw: number, pitch: number): Quat;
/** A spring joint's settings on the engine's solver (`ZhudaSpringBoneSetting`). */
export interface ZhudaVrmSpringSetting {
    stiffness: number;
    drag: number;
    gravity: [number, number, number];
    radius: number;
}
/**
 * A VRM joint's settings on the engine's solver. VRM's are given per frame
 * (UniVRM and three-vrm move a joint once a frame); the solver's are rates
 * a second at a fixed step, chosen so a bone hangs where VRM hangs it:
 * - `stiffness` s pushes the tail s metres a second toward rest; the solver
 *   pulls a share of the way a second: s / the bone's length.
 * - `gravityPower` g along `gravityDir` pushes the tail g metres a second;
 *   the solver's gravity is an acceleration: g / step.
 * - `dragForce` d keeps 1 − d of the motion a frame, taken at 60 frames a
 *   second: −60 ln(1 − d) a second (100, the solver's most, from d ≈ 0.81).
 * - `hitRadius` is the joint's radius against colliders.
 * Each is clamped to the solver's limits.
 */
export declare function zhudaVrmSpringSetting(joint: ZhudaVrmSpringJoint, boneLength: number, step?: number): ZhudaVrmSpringSetting;
/** Spherical interpolation from `a` to `b`, the short way round. */
export declare function zhudaQuatSlerp(a: ZhudaIkTurn, b: ZhudaIkTurn, t: number): Quat;
/** What a constraint reads: rest and current rotations in parents' spaces, places in the world. */
export interface ZhudaVrmConstraintPose {
    /** The node's rotation in its parent at rest. */
    readonly nodeRest: ZhudaIkTurn;
    /** The source's rotation in its parent at rest, and now. */
    readonly sourceRest: ZhudaIkTurn;
    readonly source: ZhudaIkTurn;
    /** Aim only: the node's parent's rotation in the world now, and where the node and the source are. */
    readonly parentWorld?: ZhudaIkTurn;
    readonly nodePosition?: readonly [number, number, number];
    readonly sourcePosition?: readonly [number, number, number];
}
/**
 * The node's rotation in its parent under its constraint, as the
 * specification's examples have it (VRMC_node_constraint 1.0): `rotation`
 * copies the source's turn from its rest (local to local); `roll` copies
 * only its part about the axis; `aim` turns the axis toward the source.
 * The weight goes from the rest (0) to all of it (1).
 */
export declare function zhudaVrmConstraintRotation(c: ZhudaVrmConstraint, pose: ZhudaVrmConstraintPose): Quat;
/** A linear channel as a display (sRGB) one, the inverse of `zhudaSrgbToLinear` below 1. */
export declare function zhudaLinearToSrgb(value: number): number;
/** An MToon material as the engine's toon material, and what of it is not drawn. */
export interface ZhudaVrmToonPlan {
    readonly material: number;
    /** A toon spec without its `name` (the caller names the shader). */
    readonly spec: Omit<ZhudaToonSpec, 'name'>;
    /** glTF texture indices for the toon material's slots. */
    readonly textures: {
        readonly albedo: number | null;
        readonly normal: number | null;
        readonly emission: number | null;
    };
    /** LayaAir's tiling and offset of the base colour texture: scale u, v, offset u, v. */
    readonly tilingOffset: readonly [number, number, number, number];
    /** Added to the render queue of a blended material. */
    readonly renderQueueOffset: number;
    readonly issues: readonly ZhudaVrmIssue[];
}
/**
 * An MToon material as a `ZhudaToonMaterial`:
 * - lit and shade colours: two bands on 0.5 + 0.5·N·L, the edge where MToon
 *   has its middle (−`shadingShiftFactor`) and as soft as
 *   `shadingToonyFactor` leaves it; the shade colour is the base colour
 *   texture times `shadeColorFactor ÷ baseColorFactor` when
 *   `shadeMultiplyTexture` is the base texture, `shadeColorFactor` alone when
 *   there is none;
 * - `giEqualizationFactor` is the ambient light's `flat`;
 * - the parametric rim is a rim band where MToon's reaches half;
 * - the outline in metres (`worldCoordinates`) or in pixels of a picture
 *   `screenHeight` tall (`screenCoordinates`);
 * - base, normal and emissive textures, alpha mode, cut-off, two sides.
 * Matcap, the shading shift texture, the rim and outline width textures,
 * the rim's and outline's lighting mix and UV animation are not drawn: each
 * one the material uses is an issue.
 */
export declare function zhudaVrmToonPlan(m: ZhudaVrmMToon, options?: {
    screenHeight?: number;
}): ZhudaVrmToonPlan;
export {};
