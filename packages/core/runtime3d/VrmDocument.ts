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
import type { ZhudaToonSpec } from '../shaders/ToonMaterial.ts';
import { zhudaQuatFromTo, zhudaQuatMultiply, zhudaQuatRotate, type ZhudaIkTurn } from './Ik.ts';

type Json = Record<string, unknown>;
type Vec3 = [number, number, number];
type Quat = [number, number, number, number];

/** Every humanoid bone of VRM 1.0, in the specification's order. */
export const ZHUDA_VRM_HUMAN_BONES = Object.freeze([
  'hips',
  'spine',
  'chest',
  'upperChest',
  'neck',
  'head',
  'leftEye',
  'rightEye',
  'jaw',
  'leftUpperLeg',
  'leftLowerLeg',
  'leftFoot',
  'leftToes',
  'rightUpperLeg',
  'rightLowerLeg',
  'rightFoot',
  'rightToes',
  'leftShoulder',
  'leftUpperArm',
  'leftLowerArm',
  'leftHand',
  'rightShoulder',
  'rightUpperArm',
  'rightLowerArm',
  'rightHand',
  'leftThumbMetacarpal',
  'leftThumbProximal',
  'leftThumbDistal',
  'leftIndexProximal',
  'leftIndexIntermediate',
  'leftIndexDistal',
  'leftMiddleProximal',
  'leftMiddleIntermediate',
  'leftMiddleDistal',
  'leftRingProximal',
  'leftRingIntermediate',
  'leftRingDistal',
  'leftLittleProximal',
  'leftLittleIntermediate',
  'leftLittleDistal',
  'rightThumbMetacarpal',
  'rightThumbProximal',
  'rightThumbDistal',
  'rightIndexProximal',
  'rightIndexIntermediate',
  'rightIndexDistal',
  'rightMiddleProximal',
  'rightMiddleIntermediate',
  'rightMiddleDistal',
  'rightRingProximal',
  'rightRingIntermediate',
  'rightRingDistal',
  'rightLittleProximal',
  'rightLittleIntermediate',
  'rightLittleDistal',
] as const);
export type ZhudaVrmHumanBoneName = (typeof ZHUDA_VRM_HUMAN_BONES)[number];

/** The bones a VRM 1.0 humanoid must have. */
export const ZHUDA_VRM_REQUIRED_BONES: readonly ZhudaVrmHumanBoneName[] = Object.freeze([
  'hips',
  'spine',
  'head',
  'leftUpperLeg',
  'leftLowerLeg',
  'leftFoot',
  'rightUpperLeg',
  'rightLowerLeg',
  'rightFoot',
  'leftUpperArm',
  'leftLowerArm',
  'leftHand',
  'rightUpperArm',
  'rightLowerArm',
  'rightHand',
]);

/** An optional bone that may be there only when the bone it names is (the specification's "Needs Parent Bone"). */
const NEEDS: Partial<Record<ZhudaVrmHumanBoneName, ZhudaVrmHumanBoneName>> = {
  upperChest: 'chest',
};
for (const side of ['left', 'right'] as const) {
  NEEDS[`${side}ThumbProximal`] = `${side}ThumbMetacarpal`;
  NEEDS[`${side}ThumbDistal`] = `${side}ThumbProximal`;
  for (const finger of ['Index', 'Middle', 'Ring', 'Little'] as const) {
    NEEDS[`${side}${finger}Intermediate`] = `${side}${finger}Proximal`;
    NEEDS[`${side}${finger}Distal`] = `${side}${finger}Intermediate`;
  }
}

/** The preset expressions of VRM 1.0. */
export const ZHUDA_VRM_EXPRESSION_PRESETS = Object.freeze([
  'happy',
  'angry',
  'sad',
  'relaxed',
  'surprised',
  'aa',
  'ih',
  'ou',
  'ee',
  'oh',
  'blink',
  'blinkLeft',
  'blinkRight',
  'lookUp',
  'lookDown',
  'lookLeft',
  'lookRight',
  'neutral',
] as const);
export type ZhudaVrmExpressionPreset = (typeof ZHUDA_VRM_EXPRESSION_PRESETS)[number];
/** The procedural expressions an override acts on. */
export const ZHUDA_VRM_BLINK: readonly string[] = Object.freeze([
  'blink',
  'blinkLeft',
  'blinkRight',
]);
export const ZHUDA_VRM_LOOK: readonly string[] = Object.freeze([
  'lookUp',
  'lookDown',
  'lookLeft',
  'lookRight',
]);
export const ZHUDA_VRM_MOUTH: readonly string[] = Object.freeze(['aa', 'ih', 'ou', 'ee', 'oh']);

export type ZhudaVrmIssueCode =
  | 'VRM0_UNSUPPORTED'
  | 'VRM_SPEC_VERSION'
  | 'VRM_INVALID'
  | 'VRM_META'
  | 'VRM_MISSING_BONE'
  | 'VRM_BONE'
  | 'VRM_EXPRESSION'
  | 'VRM_LOOK_AT'
  | 'VRM_FIRST_PERSON'
  | 'VRM_SPRING'
  | 'VRM_COLLIDER'
  | 'VRM_MTOON'
  | 'VRM_CONSTRAINT';
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
export type ZhudaVrmColorType =
  | 'color'
  | 'emissionColor'
  | 'shadeColor'
  | 'matcapColor'
  | 'rimColor'
  | 'outlineColor';
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
export type ZhudaVrmColliderShape =
  | {
      readonly type: 'sphere';
      readonly offset: readonly [number, number, number];
      readonly radius: number;
    }
  | {
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
  // glTF core
  readonly baseColorFactor: readonly [number, number, number, number];
  readonly baseColorTexture: ZhudaVrmTextureRef | null;
  /** `KHR_texture_transform` of the base colour texture: offset, scale, rotation (radians). */
  readonly baseColorTransform: {
    readonly offset: readonly [number, number];
    readonly scale: readonly [number, number];
    readonly rotation: number;
  } | null;
  readonly normalTexture: (ZhudaVrmTextureRef & { readonly scale: number }) | null;
  readonly emissiveFactor: readonly [number, number, number];
  readonly emissiveTexture: ZhudaVrmTextureRef | null;
  readonly alphaMode: 'OPAQUE' | 'MASK' | 'BLEND';
  readonly alphaCutoff: number;
  readonly doubleSided: boolean;
  // VRMC_materials_mtoon
  readonly transparentWithZWrite: boolean;
  readonly renderQueueOffsetNumber: number;
  readonly shadeColorFactor: readonly [number, number, number];
  readonly shadeMultiplyTexture: ZhudaVrmTextureRef | null;
  readonly shadingShiftFactor: number;
  readonly shadingShiftTexture: (ZhudaVrmTextureRef & { readonly scale: number }) | null;
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
export type ZhudaVrmAimAxis =
  | 'PositiveX'
  | 'NegativeX'
  | 'PositiveY'
  | 'NegativeY'
  | 'PositiveZ'
  | 'NegativeZ';
/** A node's `VRMC_node_constraint`: `node` is turned from `source`. */
export type ZhudaVrmConstraint =
  | {
      readonly node: number;
      readonly type: 'rotation';
      readonly source: number;
      readonly weight: number;
    }
  | {
      readonly node: number;
      readonly type: 'roll';
      readonly source: number;
      readonly weight: number;
      readonly rollAxis: 'X' | 'Y' | 'Z';
    }
  | {
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

// ------------------------------------------------------------------ reading ---

const record = (v: unknown): Json =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {};
const isRecord = (v: unknown): v is Json =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const freeze = <T>(v: T): T => {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const value of Object.values(v as object)) freeze(value);
  }
  return v;
};

class Reader {
  readonly issues: ZhudaVrmIssue[] = [];
  readonly document: Json;
  constructor(document: Json) {
    this.document = document;
  }
  error(code: ZhudaVrmIssueCode, path: string, message: string) {
    this.issues.push({ code, severity: 'error', path, message });
  }
  warn(code: ZhudaVrmIssueCode, path: string, message: string) {
    this.issues.push({ code, severity: 'warning', path, message });
  }
  count(key: 'nodes' | 'materials' | 'textures' | 'images' | 'meshes'): number {
    return list(this.document[key]).length;
  }
  /** An index into a top-level array, or null with a warning (or an error). */
  index(
    value: unknown,
    key: 'nodes' | 'materials' | 'textures' | 'images' | 'meshes',
    path: string,
    code: ZhudaVrmIssueCode,
    error = false,
  ): number | null {
    if (Number.isInteger(value) && (value as number) >= 0 && (value as number) < this.count(key))
      return value as number;
    (error ? this.error : this.warn).call(
      this,
      code,
      path,
      `${JSON.stringify(value)} is not an index into ${key} (${this.count(key)})`,
    );
    return null;
  }
  number(
    value: unknown,
    fallback: number,
    path: string,
    code: ZhudaVrmIssueCode,
    min = -Infinity,
    max = Infinity,
  ): number {
    if (value === undefined) return fallback;
    if (finite(value) && value >= min && value <= max) return value;
    this.warn(
      code,
      path,
      `${JSON.stringify(value)} is not a number in ${min}..${max}; ${fallback} is used`,
    );
    return fallback;
  }
  vector<N extends number>(
    value: unknown,
    size: N,
    fallback: readonly number[],
    path: string,
    code: ZhudaVrmIssueCode,
  ): number[] {
    if (value === undefined) return [...fallback];
    if (Array.isArray(value) && value.length >= size && value.slice(0, size).every(finite))
      return value.slice(0, size) as number[];
    this.warn(
      code,
      path,
      `${JSON.stringify(value)} is not ${size} numbers; ${JSON.stringify(fallback)} is used`,
    );
    return [...fallback];
  }
  choice<T extends string>(
    value: unknown,
    options: readonly T[],
    fallback: T,
    path: string,
    code: ZhudaVrmIssueCode,
  ): T {
    if (value === undefined) return fallback;
    if (options.includes(value as T)) return value as T;
    this.warn(
      code,
      path,
      `${JSON.stringify(value)} is not one of ${options.join(', ')}; ${fallback} is used`,
    );
    return fallback;
  }
  flag(value: unknown, fallback: boolean, path: string, code: ZhudaVrmIssueCode): boolean {
    if (value === undefined) return fallback;
    if (typeof value === 'boolean') return value;
    this.warn(code, path, `${JSON.stringify(value)} is not true or false; ${fallback} is used`);
    return fallback;
  }
  text(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }
  texture(value: unknown, path: string): ZhudaVrmTextureRef | null {
    if (value === undefined) return null;
    const t = record(value);
    const index = this.index(t.index, 'textures', `${path}.index`, 'VRM_MTOON');
    if (index === null) return null;
    const texCoord = this.number(t.texCoord, 0, `${path}.texCoord`, 'VRM_MTOON', 0, 7);
    return { index, texCoord: Math.round(texCoord) };
  }
}

const VRM = '$.extensions.VRMC_vrm';

function readMeta(r: Reader, raw: unknown): ZhudaVrmMeta | null {
  const path = `${VRM}.meta`;
  if (!isRecord(raw)) {
    r.error('VRM_META', path, 'meta is required (an object with name, authors and licenseUrl)');
    return null;
  }
  const m = raw;
  if (typeof m.name !== 'string') r.error('VRM_META', `${path}.name`, 'name is required');
  const authors = list(m.authors).filter((a): a is string => typeof a === 'string');
  if (!authors.length)
    r.error('VRM_META', `${path}.authors`, 'authors is required: one name or more');
  if (typeof m.licenseUrl !== 'string')
    r.error('VRM_META', `${path}.licenseUrl`, 'licenseUrl is required');
  const thumbnail =
    m.thumbnailImage === undefined
      ? null
      : r.index(m.thumbnailImage, 'images', `${path}.thumbnailImage`, 'VRM_META');
  const c = 'VRM_META' as const;
  return {
    name: typeof m.name === 'string' ? m.name : '',
    version: r.text(m.version),
    authors,
    copyrightInformation: r.text(m.copyrightInformation),
    contactInformation: r.text(m.contactInformation),
    references: list(m.references).filter((a): a is string => typeof a === 'string'),
    thirdPartyLicenses: r.text(m.thirdPartyLicenses),
    thumbnailImage: thumbnail,
    licenseUrl: typeof m.licenseUrl === 'string' ? m.licenseUrl : '',
    avatarPermission: r.choice(
      m.avatarPermission,
      ['onlyAuthor', 'onlySeparatelyLicensedPerson', 'everyone'] as const,
      'onlyAuthor',
      `${path}.avatarPermission`,
      c,
    ),
    allowExcessivelyViolentUsage: r.flag(
      m.allowExcessivelyViolentUsage,
      false,
      `${path}.allowExcessivelyViolentUsage`,
      c,
    ),
    allowExcessivelySexualUsage: r.flag(
      m.allowExcessivelySexualUsage,
      false,
      `${path}.allowExcessivelySexualUsage`,
      c,
    ),
    commercialUsage: r.choice(
      m.commercialUsage,
      ['personalNonProfit', 'personalProfit', 'corporation'] as const,
      'personalNonProfit',
      `${path}.commercialUsage`,
      c,
    ),
    allowPoliticalOrReligiousUsage: r.flag(
      m.allowPoliticalOrReligiousUsage,
      false,
      `${path}.allowPoliticalOrReligiousUsage`,
      c,
    ),
    allowAntisocialOrHateUsage: r.flag(
      m.allowAntisocialOrHateUsage,
      false,
      `${path}.allowAntisocialOrHateUsage`,
      c,
    ),
    creditNotation: r.choice(
      m.creditNotation,
      ['required', 'unnecessary'] as const,
      'required',
      `${path}.creditNotation`,
      c,
    ),
    allowRedistribution: r.flag(m.allowRedistribution, false, `${path}.allowRedistribution`, c),
    modification: r.choice(
      m.modification,
      ['prohibited', 'allowModification', 'allowModificationRedistribution'] as const,
      'prohibited',
      `${path}.modification`,
      c,
    ),
    otherLicenseUrl: r.text(m.otherLicenseUrl),
  };
}

function readHumanoid(r: Reader, raw: unknown) {
  const path = `${VRM}.humanoid.humanBones`;
  const bones = record(record(raw).humanBones);
  if (!isRecord(record(raw).humanBones))
    r.error('VRM_MISSING_BONE', path, 'humanoid.humanBones is required');
  const out: Partial<Record<ZhudaVrmHumanBoneName, number>> = {};
  const seen = new Map<number, string>();
  for (const [name, value] of Object.entries(bones)) {
    if (!(ZHUDA_VRM_HUMAN_BONES as readonly string[]).includes(name)) {
      r.warn(
        'VRM_BONE',
        `${path}.${name}`,
        `${name} is not a VRM 1.0 humanoid bone; it is left out`,
      );
      continue;
    }
    const node = r.index(record(value).node, 'nodes', `${path}.${name}.node`, 'VRM_BONE', true);
    if (node === null) continue;
    if (seen.has(node)) {
      r.error('VRM_BONE', `${path}.${name}.node`, `node ${node} is already ${seen.get(node)}`);
      continue;
    }
    seen.set(node, name);
    out[name as ZhudaVrmHumanBoneName] = node;
  }
  for (const name of ZHUDA_VRM_REQUIRED_BONES)
    if (out[name] === undefined)
      r.error('VRM_MISSING_BONE', `${path}.${name}`, `${name} is a required humanoid bone`);
  for (const [bone, needs] of Object.entries(NEEDS) as [
    ZhudaVrmHumanBoneName,
    ZhudaVrmHumanBoneName,
  ][])
    if (out[bone] !== undefined && out[needs] === undefined)
      r.warn(
        'VRM_BONE',
        `${path}.${bone}`,
        `${bone} needs ${needs}, which the model does not have`,
      );
  // A humanoid bone lies under the bone the specification makes its parent.
  const parents = nodeParents(r.document);
  const under = (node: number, ancestor: number) => {
    for (let n = parents[node]; n !== undefined && n !== -1; n = parents[n])
      if (n === ancestor) return true;
    return false;
  };
  const expected: [ZhudaVrmHumanBoneName, ZhudaVrmHumanBoneName][] = [
    ['spine', 'hips'],
    ['head', 'spine'],
    ['leftUpperLeg', 'hips'],
    ['leftLowerLeg', 'leftUpperLeg'],
    ['leftFoot', 'leftLowerLeg'],
    ['rightUpperLeg', 'hips'],
    ['rightLowerLeg', 'rightUpperLeg'],
    ['rightFoot', 'rightLowerLeg'],
    ['leftUpperArm', 'spine'],
    ['leftLowerArm', 'leftUpperArm'],
    ['leftHand', 'leftLowerArm'],
    ['rightUpperArm', 'spine'],
    ['rightLowerArm', 'rightUpperArm'],
    ['rightHand', 'rightLowerArm'],
  ];
  for (const [bone, ancestor] of expected)
    if (
      out[bone] !== undefined &&
      out[ancestor] !== undefined &&
      !under(out[bone]!, out[ancestor]!)
    )
      r.warn(
        'VRM_BONE',
        `${path}.${bone}`,
        `${bone} (node ${out[bone]}) is not under ${ancestor} (node ${out[ancestor]})`,
      );
  return out;
}

/** Each glTF node's parent index, -1 at a root. */
export function zhudaGltfNodeParents(document: unknown): number[] {
  return nodeParents(record(document));
}
function nodeParents(document: Json): number[] {
  const nodes = list(document.nodes);
  const parents = nodes.map(() => -1);
  nodes.forEach((raw, i) => {
    for (const child of list(record(raw).children))
      if (
        Number.isInteger(child) &&
        (child as number) >= 0 &&
        (child as number) < nodes.length &&
        parents[child as number] === -1
      )
        parents[child as number] = i;
  });
  return parents;
}

function readExpressions(r: Reader, raw: unknown): ZhudaVrmExpression[] {
  const path = `${VRM}.expressions`;
  const e = record(raw);
  const out: ZhudaVrmExpression[] = [];
  const one = (
    name: string,
    preset: ZhudaVrmExpressionPreset | 'custom',
    value: unknown,
    at: string,
  ) => {
    if (!isRecord(value)) {
      r.warn('VRM_EXPRESSION', at, `expression ${name} is not an object; it is left out`);
      return;
    }
    const c = 'VRM_EXPRESSION' as const;
    const morphs: ZhudaVrmMorphBind[] = [];
    list(value.morphTargetBinds).forEach((b, i) => {
      const bind = record(b);
      const p = `${at}.morphTargetBinds[${i}]`;
      const node = r.index(bind.node, 'nodes', `${p}.node`, c);
      if (node === null) return;
      const mesh = record(list(r.document.nodes)[node]).mesh;
      if (!Number.isInteger(mesh)) {
        r.warn(c, `${p}.node`, `node ${node} has no mesh; the bind is left out`);
        return;
      }
      const targets = list(
        record(list(record(list(r.document.meshes)[mesh as number]).primitives)[0]).targets,
      ).length;
      if (
        !(
          Number.isInteger(bind.index) &&
          (bind.index as number) >= 0 &&
          (bind.index as number) < targets
        )
      ) {
        r.warn(
          c,
          `${p}.index`,
          `${JSON.stringify(bind.index)} is not one of the ${targets} morph targets of node ${node}'s mesh; the bind is left out`,
        );
        return;
      }
      if (!finite(bind.weight)) {
        r.warn(c, `${p}.weight`, 'weight is required, a number; the bind is left out');
        return;
      }
      morphs.push({ node, index: bind.index as number, weight: bind.weight });
    });
    const colors: ZhudaVrmColorBind[] = [];
    list(value.materialColorBinds).forEach((b, i) => {
      const bind = record(b);
      const p = `${at}.materialColorBinds[${i}]`;
      const material = r.index(bind.material, 'materials', `${p}.material`, c);
      if (material === null) return;
      const type = [
        'color',
        'emissionColor',
        'shadeColor',
        'matcapColor',
        'rimColor',
        'outlineColor',
      ].includes(bind.type as string)
        ? (bind.type as ZhudaVrmColorType)
        : null;
      if (!type) {
        r.warn(
          c,
          `${p}.type`,
          `${JSON.stringify(bind.type)} is not a material colour type; the bind is left out`,
        );
        return;
      }
      if (
        !(
          Array.isArray(bind.targetValue) &&
          bind.targetValue.length === 4 &&
          bind.targetValue.every(finite)
        )
      ) {
        r.warn(c, `${p}.targetValue`, 'targetValue is four numbers; the bind is left out');
        return;
      }
      colors.push({ material, type, target: bind.targetValue as [number, number, number, number] });
    });
    const textures: ZhudaVrmTextureBind[] = [];
    list(value.textureTransformBinds).forEach((b, i) => {
      const bind = record(b);
      const p = `${at}.textureTransformBinds[${i}]`;
      const material = r.index(bind.material, 'materials', `${p}.material`, c);
      if (material === null) return;
      textures.push({
        material,
        scale: r.vector(bind.scale, 2, [1, 1], `${p}.scale`, c) as [number, number],
        offset: r.vector(bind.offset, 2, [0, 0], `${p}.offset`, c) as [number, number],
      });
    });
    const override = (key: string) =>
      r.choice(value[key], ['none', 'block', 'blend'] as const, 'none', `${at}.${key}`, c);
    out.push({
      name,
      preset,
      morphs,
      colors,
      textures,
      isBinary: r.flag(value.isBinary, false, `${at}.isBinary`, c),
      overrideBlink: override('overrideBlink'),
      overrideLookAt: override('overrideLookAt'),
      overrideMouth: override('overrideMouth'),
    });
  };
  for (const [name, value] of Object.entries(record(e.preset))) {
    if (!(ZHUDA_VRM_EXPRESSION_PRESETS as readonly string[]).includes(name)) {
      r.warn(
        'VRM_EXPRESSION',
        `${path}.preset.${name}`,
        `${name} is not a preset expression; it is left out`,
      );
      continue;
    }
    one(name, name as ZhudaVrmExpressionPreset, value, `${path}.preset.${name}`);
  }
  for (const [name, value] of Object.entries(record(e.custom))) {
    if ((ZHUDA_VRM_EXPRESSION_PRESETS as readonly string[]).includes(name)) {
      r.warn(
        'VRM_EXPRESSION',
        `${path}.custom.${name}`,
        `a custom expression may not take the preset name ${name}; it is left out`,
      );
      continue;
    }
    one(name, 'custom', value, `${path}.custom.${name}`);
  }
  return out;
}

function readLookAt(r: Reader, raw: unknown): ZhudaVrmLookAt {
  const path = `${VRM}.lookAt`;
  const l = record(raw);
  const type = r.choice(
    l.type,
    ['bone', 'expression'] as const,
    'bone',
    `${path}.type`,
    'VRM_LOOK_AT',
  );
  const range = (key: string): ZhudaVrmRangeMap => {
    const m = record(l[key]);
    return {
      inputMaxValue: r.number(
        m.inputMaxValue,
        90,
        `${path}.${key}.inputMaxValue`,
        'VRM_LOOK_AT',
        0,
        180,
      ),
      outputScale: r.number(
        m.outputScale,
        type === 'bone' ? 10 : 1,
        `${path}.${key}.outputScale`,
        'VRM_LOOK_AT',
      ),
    };
  };
  return {
    type,
    // The specification's example (and three-vrm's default) when absent: between the eyes.
    offsetFromHeadBone: r.vector(
      l.offsetFromHeadBone,
      3,
      [0, 0.06, 0],
      `${path}.offsetFromHeadBone`,
      'VRM_LOOK_AT',
    ) as Vec3,
    horizontalInner: range('rangeMapHorizontalInner'),
    horizontalOuter: range('rangeMapHorizontalOuter'),
    verticalDown: range('rangeMapVerticalDown'),
    verticalUp: range('rangeMapVerticalUp'),
  };
}

function readFirstPerson(r: Reader, raw: unknown): ZhudaVrmMeshAnnotation[] {
  const path = `${VRM}.firstPerson.meshAnnotations`;
  const out: ZhudaVrmMeshAnnotation[] = [];
  list(record(raw).meshAnnotations).forEach((a, i) => {
    const node = r.index(record(a).node, 'nodes', `${path}[${i}].node`, 'VRM_FIRST_PERSON');
    if (node === null) return;
    out.push({
      node,
      type: r.choice(
        record(a).type,
        ['auto', 'both', 'thirdPersonOnly', 'firstPersonOnly'] as const,
        'auto',
        `${path}[${i}].type`,
        'VRM_FIRST_PERSON',
      ),
    });
  });
  return out;
}

function readSpringBone(r: Reader, raw: unknown): ZhudaVrmSpringBone | null {
  if (raw === undefined) return null;
  const path = '$.extensions.VRMC_springBone';
  const s = record(raw);
  if (s.specVersion !== '1.0' && s.specVersion !== '1.0-beta')
    r.warn(
      'VRM_SPRING',
      `${path}.specVersion`,
      `${JSON.stringify(s.specVersion)}: VRMC_springBone 1.0 is read`,
    );
  const colliders: ZhudaVrmCollider[] = [];
  const colliderIndex = new Map<number, number>();
  list(s.colliders).forEach((c, i) => {
    const p = `${path}.colliders[${i}]`;
    const node = r.index(record(c).node, 'nodes', `${p}.node`, 'VRM_COLLIDER');
    const shape = record(record(c).shape);
    let made: ZhudaVrmColliderShape | null = null;
    if (isRecord(shape.sphere)) {
      made = {
        type: 'sphere',
        offset: r.vector(
          shape.sphere.offset,
          3,
          [0, 0, 0],
          `${p}.shape.sphere.offset`,
          'VRM_COLLIDER',
        ) as Vec3,
        radius: r.number(shape.sphere.radius, 0, `${p}.shape.sphere.radius`, 'VRM_COLLIDER', 0),
      };
    } else if (isRecord(shape.capsule)) {
      made = {
        type: 'capsule',
        offset: r.vector(
          shape.capsule.offset,
          3,
          [0, 0, 0],
          `${p}.shape.capsule.offset`,
          'VRM_COLLIDER',
        ) as Vec3,
        tail: r.vector(
          shape.capsule.tail,
          3,
          [0, 0, 0],
          `${p}.shape.capsule.tail`,
          'VRM_COLLIDER',
        ) as Vec3,
        radius: r.number(shape.capsule.radius, 0, `${p}.shape.capsule.radius`, 'VRM_COLLIDER', 0),
      };
    } else
      r.warn('VRM_COLLIDER', `${p}.shape`, 'a collider has a sphere or a capsule; it is left out');
    if (node === null || !made) return;
    colliderIndex.set(i, colliders.length);
    colliders.push({ node, shape: made });
  });
  const colliderGroups: ZhudaVrmColliderGroup[] = [];
  const groupIndex = new Map<number, number>();
  list(s.colliderGroups).forEach((g, i) => {
    const p = `${path}.colliderGroups[${i}]`;
    const members: number[] = [];
    list(record(g).colliders).forEach((c, k) => {
      const at = Number.isInteger(c) ? colliderIndex.get(c as number) : undefined;
      if (at === undefined)
        r.warn(
          'VRM_COLLIDER',
          `${p}.colliders[${k}]`,
          `${JSON.stringify(c)} is not a collider that was read`,
        );
      else members.push(at);
    });
    groupIndex.set(i, colliderGroups.length);
    colliderGroups.push({
      name: typeof record(g).name === 'string' ? (record(g).name as string) : '',
      colliders: members,
    });
  });
  const springs: ZhudaVrmSpring[] = [];
  list(s.springs).forEach((sp, i) => {
    const p = `${path}.springs[${i}]`;
    const raw = record(sp);
    const joints: ZhudaVrmSpringJoint[] = [];
    let broken = false;
    list(raw.joints).forEach((j, k) => {
      const jp = `${p}.joints[${k}]`;
      const joint = record(j);
      const node = r.index(joint.node, 'nodes', `${jp}.node`, 'VRM_SPRING');
      if (node === null) {
        broken = true;
        return;
      }
      joints.push({
        node,
        hitRadius: r.number(joint.hitRadius, 0, `${jp}.hitRadius`, 'VRM_SPRING', 0),
        stiffness: r.number(joint.stiffness, 1, `${jp}.stiffness`, 'VRM_SPRING', 0),
        gravityPower: r.number(joint.gravityPower, 0, `${jp}.gravityPower`, 'VRM_SPRING', 0),
        gravityDir: r.vector(
          joint.gravityDir,
          3,
          [0, -1, 0],
          `${jp}.gravityDir`,
          'VRM_SPRING',
        ) as Vec3,
        dragForce: r.number(joint.dragForce, 0.5, `${jp}.dragForce`, 'VRM_SPRING', 0, 1),
      });
    });
    if (broken) {
      r.warn('VRM_SPRING', `${p}.joints`, 'a joint does not name a node; the spring is left out');
      return;
    }
    if (joints.length < 2) {
      r.warn(
        'VRM_SPRING',
        `${p}.joints`,
        'a spring needs two joints or more (the last is where it ends); it is left out',
      );
      return;
    }
    const groups: number[] = [];
    list(raw.colliderGroups).forEach((g, k) => {
      const at = Number.isInteger(g) ? groupIndex.get(g as number) : undefined;
      if (at === undefined)
        r.warn(
          'VRM_SPRING',
          `${p}.colliderGroups[${k}]`,
          `${JSON.stringify(g)} is not a collider group`,
        );
      else groups.push(at);
    });
    springs.push({
      name: typeof raw.name === 'string' ? raw.name : '',
      joints,
      colliderGroups: groups,
      center:
        raw.center === undefined ? null : r.index(raw.center, 'nodes', `${p}.center`, 'VRM_SPRING'),
    });
  });
  return { colliders, colliderGroups, springs };
}

function readMToon(r: Reader): ZhudaVrmMToon[] {
  const out: ZhudaVrmMToon[] = [];
  list(r.document.materials).forEach((raw, i) => {
    const m = record(raw);
    const ext = record(m.extensions).VRMC_materials_mtoon;
    if (ext === undefined) return;
    const p = `$.materials[${i}].extensions.VRMC_materials_mtoon`;
    const t = record(ext);
    const c = 'VRM_MTOON' as const;
    if (t.specVersion !== '1.0' && t.specVersion !== '1.0-beta')
      r.warn(
        c,
        `${p}.specVersion`,
        `${JSON.stringify(t.specVersion)}: VRMC_materials_mtoon 1.0 is read`,
      );
    const pbr = record(m.pbrMetallicRoughness);
    const base = record(pbr.baseColorTexture);
    const transform = record(record(base.extensions).KHR_texture_transform);
    const normal = record(m.normalTexture);
    const shift = record(t.shadingShiftTexture);
    out.push({
      material: i,
      name: typeof m.name === 'string' ? m.name : null,
      baseColorFactor: r.vector(
        pbr.baseColorFactor,
        4,
        [1, 1, 1, 1],
        `$.materials[${i}].pbrMetallicRoughness.baseColorFactor`,
        c,
      ) as Quat,
      baseColorTexture: r.texture(
        pbr.baseColorTexture,
        `$.materials[${i}].pbrMetallicRoughness.baseColorTexture`,
      ),
      baseColorTransform: isRecord(record(base.extensions).KHR_texture_transform)
        ? {
            offset: r.vector(
              transform.offset,
              2,
              [0, 0],
              `$.materials[${i}]...KHR_texture_transform.offset`,
              c,
            ) as [number, number],
            scale: r.vector(
              transform.scale,
              2,
              [1, 1],
              `$.materials[${i}]...KHR_texture_transform.scale`,
              c,
            ) as [number, number],
            rotation: r.number(
              transform.rotation,
              0,
              `$.materials[${i}]...KHR_texture_transform.rotation`,
              c,
            ),
          }
        : null,
      normalTexture:
        m.normalTexture === undefined
          ? null
          : (() => {
              const ref = r.texture(m.normalTexture, `$.materials[${i}].normalTexture`);
              return ref
                ? {
                    ...ref,
                    scale: r.number(normal.scale, 1, `$.materials[${i}].normalTexture.scale`, c),
                  }
                : null;
            })(),
      emissiveFactor: r.vector(
        m.emissiveFactor,
        3,
        [0, 0, 0],
        `$.materials[${i}].emissiveFactor`,
        c,
      ) as Vec3,
      emissiveTexture: r.texture(m.emissiveTexture, `$.materials[${i}].emissiveTexture`),
      alphaMode: r.choice(
        m.alphaMode,
        ['OPAQUE', 'MASK', 'BLEND'] as const,
        'OPAQUE',
        `$.materials[${i}].alphaMode`,
        c,
      ),
      alphaCutoff: r.number(m.alphaCutoff, 0.5, `$.materials[${i}].alphaCutoff`, c, 0),
      doubleSided: r.flag(m.doubleSided, false, `$.materials[${i}].doubleSided`, c),
      transparentWithZWrite: r.flag(
        t.transparentWithZWrite,
        false,
        `${p}.transparentWithZWrite`,
        c,
      ),
      renderQueueOffsetNumber: Math.round(
        r.number(t.renderQueueOffsetNumber, 0, `${p}.renderQueueOffsetNumber`, c, -9, 9),
      ),
      shadeColorFactor: r.vector(
        t.shadeColorFactor,
        3,
        [1, 1, 1],
        `${p}.shadeColorFactor`,
        c,
      ) as Vec3,
      shadeMultiplyTexture: r.texture(t.shadeMultiplyTexture, `${p}.shadeMultiplyTexture`),
      shadingShiftFactor: r.number(t.shadingShiftFactor, 0, `${p}.shadingShiftFactor`, c),
      shadingShiftTexture:
        t.shadingShiftTexture === undefined
          ? null
          : (() => {
              const ref = r.texture(t.shadingShiftTexture, `${p}.shadingShiftTexture`);
              return ref
                ? { ...ref, scale: r.number(shift.scale, 1, `${p}.shadingShiftTexture.scale`, c) }
                : null;
            })(),
      shadingToonyFactor: r.number(t.shadingToonyFactor, 0.9, `${p}.shadingToonyFactor`, c, 0, 1),
      giEqualizationFactor: r.number(
        t.giEqualizationFactor,
        0.9,
        `${p}.giEqualizationFactor`,
        c,
        0,
        1,
      ),
      matcapFactor: r.vector(t.matcapFactor, 3, [1, 1, 1], `${p}.matcapFactor`, c) as Vec3,
      matcapTexture: r.texture(t.matcapTexture, `${p}.matcapTexture`),
      parametricRimColorFactor: r.vector(
        t.parametricRimColorFactor,
        3,
        [0, 0, 0],
        `${p}.parametricRimColorFactor`,
        c,
      ) as Vec3,
      rimMultiplyTexture: r.texture(t.rimMultiplyTexture, `${p}.rimMultiplyTexture`),
      rimLightingMixFactor: r.number(
        t.rimLightingMixFactor,
        1,
        `${p}.rimLightingMixFactor`,
        c,
        0,
        1,
      ),
      parametricRimFresnelPowerFactor: r.number(
        t.parametricRimFresnelPowerFactor,
        5,
        `${p}.parametricRimFresnelPowerFactor`,
        c,
        0,
      ),
      parametricRimLiftFactor: r.number(
        t.parametricRimLiftFactor,
        0,
        `${p}.parametricRimLiftFactor`,
        c,
      ),
      outlineWidthMode: r.choice(
        t.outlineWidthMode,
        ['none', 'worldCoordinates', 'screenCoordinates'] as const,
        'none',
        `${p}.outlineWidthMode`,
        c,
      ),
      outlineWidthFactor: r.number(t.outlineWidthFactor, 0, `${p}.outlineWidthFactor`, c, 0),
      outlineWidthMultiplyTexture: r.texture(
        t.outlineWidthMultiplyTexture,
        `${p}.outlineWidthMultiplyTexture`,
      ),
      outlineColorFactor: r.vector(
        t.outlineColorFactor,
        3,
        [0, 0, 0],
        `${p}.outlineColorFactor`,
        c,
      ) as Vec3,
      outlineLightingMixFactor: r.number(
        t.outlineLightingMixFactor,
        1,
        `${p}.outlineLightingMixFactor`,
        c,
        0,
        1,
      ),
      uvAnimationMaskTexture: r.texture(t.uvAnimationMaskTexture, `${p}.uvAnimationMaskTexture`),
      uvAnimationScrollXSpeedFactor: r.number(
        t.uvAnimationScrollXSpeedFactor,
        0,
        `${p}.uvAnimationScrollXSpeedFactor`,
        c,
      ),
      uvAnimationScrollYSpeedFactor: r.number(
        t.uvAnimationScrollYSpeedFactor,
        0,
        `${p}.uvAnimationScrollYSpeedFactor`,
        c,
      ),
      uvAnimationRotationSpeedFactor: r.number(
        t.uvAnimationRotationSpeedFactor,
        0,
        `${p}.uvAnimationRotationSpeedFactor`,
        c,
      ),
    });
  });
  return out;
}

function readConstraints(r: Reader): ZhudaVrmConstraint[] {
  const out: ZhudaVrmConstraint[] = [];
  list(r.document.nodes).forEach((raw, node) => {
    const ext = record(record(raw).extensions).VRMC_node_constraint;
    if (ext === undefined) return;
    const p = `$.nodes[${node}].extensions.VRMC_node_constraint`;
    const c = record(record(ext).constraint);
    const kinds = (['roll', 'aim', 'rotation'] as const).filter((k) => isRecord(c[k]));
    if (kinds.length !== 1) {
      r.warn(
        'VRM_CONSTRAINT',
        `${p}.constraint`,
        'a constraint has exactly one of roll, aim and rotation; it is left out',
      );
      return;
    }
    const type = kinds[0];
    const body = record(c[type]);
    const at = `${p}.constraint.${type}`;
    const source = r.index(body.source, 'nodes', `${at}.source`, 'VRM_CONSTRAINT');
    if (source === null) return;
    if (source === node) {
      r.warn(
        'VRM_CONSTRAINT',
        `${at}.source`,
        'the source may not be the node itself; it is left out',
      );
      return;
    }
    const weight = r.number(body.weight, 1, `${at}.weight`, 'VRM_CONSTRAINT', 0, 1);
    if (type === 'rotation') out.push({ node, type, source, weight });
    else if (type === 'roll') {
      if (!['X', 'Y', 'Z'].includes(body.rollAxis as string)) {
        r.warn('VRM_CONSTRAINT', `${at}.rollAxis`, 'rollAxis is X, Y or Z; it is left out');
        return;
      }
      out.push({ node, type, source, weight, rollAxis: body.rollAxis as 'X' | 'Y' | 'Z' });
    } else {
      const axes = ['PositiveX', 'NegativeX', 'PositiveY', 'NegativeY', 'PositiveZ', 'NegativeZ'];
      if (!axes.includes(body.aimAxis as string)) {
        r.warn(
          'VRM_CONSTRAINT',
          `${at}.aimAxis`,
          `aimAxis is one of ${axes.join(', ')}; it is left out`,
        );
        return;
      }
      out.push({ node, type, source, weight, aimAxis: body.aimAxis as ZhudaVrmAimAxis });
    }
  });
  // A constraint whose source depends on it, round a loop, is left out (the specification forbids the loop).
  const by = new Map(out.map((c) => [c.node, c]));
  const looped = new Set<number>();
  for (const c of out) {
    const seen = new Set<number>([c.node]);
    for (let s = by.get(c.source); s; s = by.get(s.source)) {
      if (seen.has(s.node)) {
        looped.add(c.node);
        break;
      }
      seen.add(s.node);
    }
  }
  for (const node of looped)
    r.warn(
      'VRM_CONSTRAINT',
      `$.nodes[${node}].extensions.VRMC_node_constraint`,
      'its source goes round a loop of constraints back to it; it is left out',
    );
  return out.filter((c) => !looped.has(c.node));
}

/**
 * The VRM 1.0 data of a glTF document (the JSON of a `.vrm` or `.glb`).
 * `vrm` is null for a file without `VRMC_vrm`, and for one an error refuses
 * (VRM 0.x, a missing required bone, meta without its required fields).
 */
export function readZhudaVrm(document: unknown): ZhudaVrmReadResult {
  const d = record(document);
  const r = new Reader(d);
  const extensions = record(d.extensions);
  if (extensions.VRMC_vrm === undefined) {
    if (extensions.VRM !== undefined)
      r.error(
        'VRM0_UNSUPPORTED',
        '$.extensions.VRM',
        'This is a VRM 0.x file (the VRM extension). The engine reads VRM 1.0 (VRMC_vrm): convert it with UniVRM or the VRM Add-on for Blender.',
      );
    return freeze({ vrm: null, issues: r.issues });
  }
  const v = record(extensions.VRMC_vrm);
  if (v.specVersion !== '1.0' && v.specVersion !== '1.0-beta') {
    r.error(
      'VRM_SPEC_VERSION',
      `${VRM}.specVersion`,
      `${JSON.stringify(v.specVersion)}: the engine reads VRMC_vrm 1.0`,
    );
    return freeze({ vrm: null, issues: r.issues });
  }
  if (v.specVersion === '1.0-beta')
    r.warn('VRM_SPEC_VERSION', `${VRM}.specVersion`, '1.0-beta is read as 1.0');
  const meta = readMeta(r, v.meta);
  const humanBones = readHumanoid(r, v.humanoid);
  const expressions = readExpressions(r, v.expressions);
  const lookAt = readLookAt(r, v.lookAt);
  const firstPerson = readFirstPerson(r, v.firstPerson);
  const springBone = readSpringBone(r, extensions.VRMC_springBone);
  const mtoon = readMToon(r);
  const constraints = readConstraints(r);
  if (
    lookAt.type === 'bone' &&
    (humanBones.leftEye === undefined || humanBones.rightEye === undefined)
  )
    r.warn(
      'VRM_LOOK_AT',
      `${VRM}.lookAt.type`,
      'gaze by bone needs leftEye and rightEye; the eyes are not turned',
    );
  if (r.issues.some((i) => i.severity === 'error') || !meta)
    return freeze({ vrm: null, issues: r.issues });
  return freeze({
    vrm: {
      specVersion: v.specVersion as '1.0' | '1.0-beta',
      meta,
      humanBones,
      expressions,
      lookAt,
      firstPerson,
      springBone,
      mtoon,
      constraints,
    },
    issues: r.issues,
  });
}

// --------------------------------------------------------------- expressions ---

const clamp01 = (v: number) => (v > 1 ? 1 : v > 0 ? v : 0);
const kindOf = (name: string): 'blink' | 'look' | 'mouth' | null =>
  ZHUDA_VRM_BLINK.includes(name)
    ? 'blink'
    : ZHUDA_VRM_LOOK.includes(name)
      ? 'look'
      : ZHUDA_VRM_MOUTH.includes(name)
        ? 'mouth'
        : null;

/**
 * Each expression's weight as it is applied: the weight set (clamped to
 * 0..1), 0 or 1 for a binary one, and the procedural ones (blink, gaze,
 * mouth) lowered by the overrides of the others, as the specification and
 * three-vrm do it: `block` takes them to 0 while the overriding expression
 * shows at all, `blend` lowers them by its weight; a binary expression that
 * is lowered at all shows nothing. An expression's override of its own kind
 * is not counted.
 */
export function zhudaVrmExpressionWeights(
  expressions: readonly ZhudaVrmExpression[],
  weights: ReadonlyMap<string, number> | Readonly<Record<string, number>>,
): Map<string, number> {
  const get = (name: string) => {
    const w =
      weights instanceof Map ? weights.get(name) : (weights as Record<string, number>)[name];
    return Number.isFinite(w) ? clamp01(w as number) : 0;
  };
  const output = (e: ZhudaVrmExpression) => {
    const w = get(e.name);
    return e.isBinary ? (w > 0.5 ? 1 : 0) : w;
  };
  const amount = (o: ZhudaVrmOverride, w: number) =>
    o === 'block' ? (w > 0 ? 1 : 0) : o === 'blend' ? w : 0;
  let blink = 1,
    look = 1,
    mouth = 1;
  for (const e of expressions) {
    const w = output(e),
      kind = kindOf(e.preset === 'custom' ? '' : e.name);
    if (kind !== 'blink') blink -= amount(e.overrideBlink, w);
    if (kind !== 'look') look -= amount(e.overrideLookAt, w);
    if (kind !== 'mouth') mouth -= amount(e.overrideMouth, w);
  }
  const multiplier = {
    blink: Math.max(0, blink),
    look: Math.max(0, look),
    mouth: Math.max(0, mouth),
  };
  const out = new Map<string, number>();
  for (const e of expressions) {
    const kind = kindOf(e.preset === 'custom' ? '' : e.name);
    let w = output(e) * (kind ? multiplier[kind] : 1);
    if (e.isBinary && w < 1) w = 0;
    out.set(e.name, w);
  }
  return out;
}

// --------------------------------------------------------------------- gaze ---

/**
 * Yaw and pitch, degrees, of a point given in the gaze's own space (glTF's
 * axes: +Z forward, +Y up, +X the model's left): yaw is positive toward the
 * left, pitch positive downward, as the specification has them.
 */
export function zhudaVrmYawPitch(local: readonly [number, number, number]): {
  yaw: number;
  pitch: number;
} {
  const [x, y, z] = local;
  const deg = 180 / Math.PI;
  return { yaw: Math.atan2(x, z) * deg, pitch: Math.atan2(-y, Math.hypot(x, z)) * deg };
}
/** A range map on the size of a yaw or a pitch (degrees): `outputScale` at `inputMaxValue` and past it. */
export function zhudaVrmRangeMap(map: ZhudaVrmRangeMap, value: number): number {
  const v = Math.abs(value);
  // The specification's recommendation for a range of 0: nothing at 0, all of it otherwise.
  const max = Math.max(0.001, map.inputMaxValue);
  return (Math.min(v, max) / max) * map.outputScale;
}
/** Each eye's yaw and pitch, degrees, for a gaze by bone: the specification's inner and outer ranges. */
export function zhudaVrmEyeAngles(
  lookAt: ZhudaVrmLookAt,
  yaw: number,
  pitch: number,
): { left: { yaw: number; pitch: number }; right: { yaw: number; pitch: number } } {
  const vertical =
    pitch > 0
      ? zhudaVrmRangeMap(lookAt.verticalDown, pitch)
      : -zhudaVrmRangeMap(lookAt.verticalUp, pitch);
  return {
    left: {
      yaw:
        yaw > 0
          ? zhudaVrmRangeMap(lookAt.horizontalOuter, yaw)
          : -zhudaVrmRangeMap(lookAt.horizontalInner, yaw),
      pitch: vertical,
    },
    right: {
      yaw:
        yaw > 0
          ? zhudaVrmRangeMap(lookAt.horizontalInner, yaw)
          : -zhudaVrmRangeMap(lookAt.horizontalOuter, yaw),
      pitch: vertical,
    },
  };
}
/** The four gaze expressions' weights for a gaze by expression. */
export function zhudaVrmLookWeights(
  lookAt: ZhudaVrmLookAt,
  yaw: number,
  pitch: number,
): { lookLeft: number; lookRight: number; lookUp: number; lookDown: number } {
  const h = zhudaVrmRangeMap(lookAt.horizontalOuter, yaw);
  return {
    lookLeft: yaw > 0 ? h : 0,
    lookRight: yaw > 0 ? 0 : h,
    lookDown: pitch > 0 ? zhudaVrmRangeMap(lookAt.verticalDown, pitch) : 0,
    lookUp: pitch > 0 ? 0 : zhudaVrmRangeMap(lookAt.verticalUp, pitch),
  };
}
/** The turn of a yaw about +Y and then a pitch about +X (degrees; Euler order Y, X). */
export function zhudaVrmYawPitchTurn(yaw: number, pitch: number): Quat {
  const y = (yaw * Math.PI) / 360,
    p = (pitch * Math.PI) / 360;
  return zhudaQuatMultiply([0, Math.sin(y), 0, Math.cos(y)], [Math.sin(p), 0, 0, Math.cos(p)]);
}

// ------------------------------------------------------------------- springs ---

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
export function zhudaVrmSpringSetting(
  joint: ZhudaVrmSpringJoint,
  boneLength: number,
  step = 1 / 120,
): ZhudaVrmSpringSetting {
  if (!(Number.isFinite(boneLength) && boneLength > 0))
    throw Error('VRM spring: a bone length above 0');
  if (!(Number.isFinite(step) && step > 0)) throw Error('VRM spring: a step above 0');
  const clamp = (v: number, low: number, high: number) => Math.min(high, Math.max(low, v));
  const g = joint.gravityPower / step;
  return {
    stiffness: clamp(joint.stiffness / boneLength, 0, 1000),
    drag: joint.dragForce >= 1 ? 100 : clamp(-60 * Math.log(1 - joint.dragForce), 0, 100),
    gravity: [joint.gravityDir[0] * g, joint.gravityDir[1] * g, joint.gravityDir[2] * g],
    radius: clamp(joint.hitRadius, 0, 1),
  };
}

// --------------------------------------------------------------- constraints ---

const conj = (q: ZhudaIkTurn): Quat => [-q[0], -q[1], -q[2], q[3]];
/** Spherical interpolation from `a` to `b`, the short way round. */
export function zhudaQuatSlerp(a: ZhudaIkTurn, b: ZhudaIkTurn, t: number): Quat {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const s = d < 0 ? -1 : 1;
  d *= s;
  let ka: number, kb: number;
  if (d > 0.9995) {
    ka = 1 - t;
    kb = t * s;
  } else {
    const angle = Math.acos(d),
      sin = Math.sin(angle);
    ka = Math.sin((1 - t) * angle) / sin;
    kb = (Math.sin(t * angle) / sin) * s;
  }
  const q: Quat = [
    a[0] * ka + b[0] * kb,
    a[1] * ka + b[1] * kb,
    a[2] * ka + b[2] * kb,
    a[3] * ka + b[3] * kb,
  ];
  const l = Math.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}
const AXES: Record<string, Vec3> = {
  X: [1, 0, 0],
  Y: [0, 1, 0],
  Z: [0, 0, 1],
  PositiveX: [1, 0, 0],
  NegativeX: [-1, 0, 0],
  PositiveY: [0, 1, 0],
  NegativeY: [0, -1, 0],
  PositiveZ: [0, 0, 1],
  NegativeZ: [0, 0, -1],
};
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
export function zhudaVrmConstraintRotation(
  c: ZhudaVrmConstraint,
  pose: ZhudaVrmConstraintPose,
): Quat {
  const dstRest = pose.nodeRest;
  if (c.type === 'rotation') {
    const delta = zhudaQuatMultiply(conj(pose.sourceRest), pose.source);
    return zhudaQuatSlerp(dstRest, zhudaQuatMultiply(dstRest, delta), c.weight);
  }
  if (c.type === 'roll') {
    const axis = AXES[c.rollAxis];
    const delta = zhudaQuatMultiply(conj(pose.sourceRest), pose.source);
    const inParent = zhudaQuatMultiply(
      zhudaQuatMultiply(pose.sourceRest, delta),
      conj(pose.sourceRest),
    );
    const inDst = zhudaQuatMultiply(zhudaQuatMultiply(conj(dstRest), inParent), dstRest);
    const to = zhudaQuatRotate(inDst, axis);
    const fromTo = zhudaQuatFromTo(axis, to);
    return zhudaQuatSlerp(
      dstRest,
      zhudaQuatMultiply(zhudaQuatMultiply(dstRest, conj(fromTo)), inDst),
      c.weight,
    );
  }
  const parent = pose.parentWorld ?? [0, 0, 0, 1];
  const at = pose.nodePosition,
    to = pose.sourcePosition;
  if (!at || !to) throw Error('VRM aim constraint: the node and source positions are needed');
  const from = zhudaQuatRotate(zhudaQuatMultiply(parent, dstRest), AXES[c.aimAxis]);
  const way: Vec3 = [to[0] - at[0], to[1] - at[1], to[2] - at[2]];
  if (!(Math.hypot(way[0], way[1], way[2]) > 1e-9))
    return [dstRest[0], dstRest[1], dstRest[2], dstRest[3]];
  const fromTo = zhudaQuatFromTo(from, way);
  const target = zhudaQuatMultiply(
    zhudaQuatMultiply(zhudaQuatMultiply(conj(parent), fromTo), parent),
    dstRest,
  );
  return zhudaQuatSlerp(dstRest, target, c.weight);
}

// --------------------------------------------------------------------- MToon ---

/** A linear channel as a display (sRGB) one, the inverse of `zhudaSrgbToLinear` below 1. */
export function zhudaLinearToSrgb(value: number): number {
  const v = Math.max(0, value);
  return v <= 0.0031308 ? v * 12.92 : Math.min(1, 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
}
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
export function zhudaVrmToonPlan(
  m: ZhudaVrmMToon,
  options: { screenHeight?: number } = {},
): ZhudaVrmToonPlan {
  const issues: ZhudaVrmIssue[] = [];
  const path = `$.materials[${m.material}].extensions.VRMC_materials_mtoon`;
  const lost = (key: string, what: string) =>
    issues.push({
      code: 'VRM_MTOON',
      severity: 'warning',
      path: `${path}.${key}`,
      message: `${what} is not drawn`,
    });
  const display = (c: readonly number[]): [number, number, number] => [
    zhudaLinearToSrgb(c[0]),
    zhudaLinearToSrgb(c[1]),
    zhudaLinearToSrgb(c[2]),
  ];
  // Shade: a tint of the base colour texture, or a colour of its own.
  let shade: NonNullable<ZhudaToonSpec['shade']>;
  if (
    m.shadeMultiplyTexture &&
    m.baseColorTexture &&
    m.shadeMultiplyTexture.index === m.baseColorTexture.index
  ) {
    const ratio = m.shadeColorFactor.map((v, i) => v / Math.max(1e-4, m.baseColorFactor[i]));
    if (ratio.some((v) => v > 1))
      issues.push({
        code: 'VRM_MTOON',
        severity: 'warning',
        path: `${path}.shadeColorFactor`,
        message:
          'the shade colour is brighter than the base colour in a channel; it is drawn at the base colour there',
      });
    shade = { color: display(ratio.map((v) => Math.min(1, v))), multiply: true };
  } else {
    if (m.shadeMultiplyTexture)
      issues.push({
        code: 'VRM_MTOON',
        severity: 'warning',
        path: `${path}.shadeMultiplyTexture`,
        message:
          'a shade texture other than the base colour texture is not drawn: the shade is the shade colour alone',
      });
    shade = { color: display(m.shadeColorFactor), multiply: false };
  }
  const edge = Math.min(0.999, Math.max(0.001, 0.5 - 0.5 * m.shadingShiftFactor));
  const softness = Math.min(1, Math.max(0, 1 - m.shadingToonyFactor));
  if (m.shadingShiftTexture) lost('shadingShiftTexture', 'the shading shift texture');
  if (m.matcapTexture) lost('matcapTexture', 'matcap');
  if (m.rimMultiplyTexture) lost('rimMultiplyTexture', 'the rim texture');
  if (m.outlineWidthMultiplyTexture)
    lost('outlineWidthMultiplyTexture', 'the outline width texture');
  if (
    m.uvAnimationScrollXSpeedFactor ||
    m.uvAnimationScrollYSpeedFactor ||
    m.uvAnimationRotationSpeedFactor
  )
    lost('uvAnimationScrollXSpeedFactor', 'UV animation');
  if (m.baseColorTransform?.rotation)
    lost('baseColorTexture', 'a turned base colour texture (KHR_texture_transform rotation)');
  for (const ref of [m.baseColorTexture, m.normalTexture, m.emissiveTexture])
    if (ref && ref.texCoord !== 0)
      issues.push({
        code: 'VRM_MTOON',
        severity: 'warning',
        path,
        message: `texture ${ref.index} asks for texture coordinates ${ref.texCoord}; the first set is used`,
      });
  const rimOn = m.parametricRimColorFactor.some((v) => v > 0);
  // Where MToon's parametric rim reaches half: pow(1 − N·V + lift, power) = 0.5.
  const half =
    Math.pow(0.5, 1 / Math.max(1e-3, m.parametricRimFresnelPowerFactor)) -
    m.parametricRimLiftFactor;
  const rimWidth = Math.min(1, Math.max(0.01, 1 - half));
  let outline: ZhudaToonSpec['outline'];
  if (m.outlineWidthMode !== 'none' && m.outlineWidthFactor > 0) {
    if (m.outlineWidthMode === 'worldCoordinates')
      outline = {
        color: display(m.outlineColorFactor),
        width: Math.min(10, m.outlineWidthFactor),
        space: 'world',
      };
    else {
      const height = options.screenHeight ?? 1080;
      if (!(Number.isFinite(height) && height > 0))
        throw Error('VRM MToon: screenHeight is pixels above 0');
      outline = {
        color: display(m.outlineColorFactor),
        width: Math.min(32, m.outlineWidthFactor * height),
        space: 'screen',
      };
    }
  }
  const blend = m.alphaMode === 'MASK' ? 'cutout' : m.alphaMode === 'BLEND' ? 'alpha' : 'opaque';
  const scale = m.baseColorTransform?.scale ?? [1, 1],
    offset = m.baseColorTransform?.offset ?? [0, 0];
  return freeze({
    material: m.material,
    spec: {
      ramp: { edges: [edge], levels: [0, 1], softness },
      shade,
      ...(rimOn
        ? {
            rim: {
              color: display(m.parametricRimColorFactor),
              width: rimWidth,
              strength: 1,
              softness: Math.min(1, Math.max(0.01, rimWidth * 0.5)),
            },
          }
        : {}),
      ...(outline ? { outline } : {}),
      ambient: { strength: 1, flat: m.giEqualizationFactor },
      normalConvention: 'opengl' as const,
      material: {
        color: [...display(m.baseColorFactor), m.baseColorFactor[3]] as [
          number,
          number,
          number,
          number,
        ],
        emission: display(m.emissiveFactor),
        blend,
        ...(blend === 'cutout' ? { alphaCutoff: Math.min(1, m.alphaCutoff) } : {}),
        ...(blend === 'alpha' ? { depthWrite: m.transparentWithZWrite } : {}),
        ...(m.doubleSided ? { doubleSided: true } : {}),
      },
    },
    textures: {
      albedo: m.baseColorTexture?.index ?? null,
      normal: m.normalTexture?.index ?? null,
      emission: m.emissiveTexture?.index ?? null,
    },
    tilingOffset: [scale[0], scale[1], offset[0], offset[1]],
    renderQueueOffset: blend === 'alpha' ? m.renderQueueOffsetNumber : 0,
    issues,
  });
}
