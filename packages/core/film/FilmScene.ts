/**
 * Film scenes as data. An agent (or a person) authors a `ZhudaFilmScene`,
 * changes it with patches and renders it through the existing cinematic
 * capture. Everything here is pure and runs in Node, a Worker or a browser.
 *
 * The scene only names things the engine already owns: registered procedural
 * props, texture recipes and flat PBR colours. It never carries code, file
 * paths or URLs.
 */
import {
  validateZhudaTextureRecipe,
  type ZhudaTextureRecipe,
} from '../procedural/TextureRecipe.ts';

export type ZhudaFilmVec3 = [number, number, number];

export interface ZhudaFilmCamera {
  eye: ZhudaFilmVec3;
  target: ZhudaFilmVec3;
  /** 35 mm full-frame equivalent focal length (default 35). */
  focalLengthMm?: number;
  /** Aperture used by final renders for depth of field (default 8). */
  fStop?: number;
  /** Metres; defaults to the eye-target distance. */
  focusDistanceM?: number;
}

export interface ZhudaFilmSun {
  /** Turns the sun about +Y, degrees. At 0 the light travels toward -Z. */
  azimuthDeg: number;
  /** Height above the horizon, degrees (0..90). */
  elevationDeg: number;
  intensity?: number;
  /** Linear RGB 0..1. */
  color?: ZhudaFilmVec3;
}

export interface ZhudaFilmLook {
  /** Background colour, linear RGB 0..1. */
  sky?: ZhudaFilmVec3;
  /** Ambient light colour, linear RGB 0..1. */
  ambient?: ZhudaFilmVec3;
  sun?: ZhudaFilmSun;
}

/** A baked recipe (a registered recipe name or an inline recipe) or a flat PBR colour. */
export type ZhudaFilmMaterial =
  | {
      recipe: string | ZhudaTextureRecipe;
      tint?: [number, number, number, number];
      /** Bake size; 128, 256 or 512 (default 256). */
      size?: 128 | 256 | 512;
    }
  | { color: ZhudaFilmVec3; roughness?: number; metallic?: number };

export type ZhudaFilmNode =
  | {
      id: string;
      type: 'prop';
      /** Id in the prop registry the host was given. */
      prop: string;
      position: ZhudaFilmVec3;
      yawDeg?: number;
      seed?: number;
      params?: Record<string, unknown>;
    }
  | {
      id: string;
      type: 'box';
      size: ZhudaFilmVec3;
      /** Centre of the underside. */
      position: ZhudaFilmVec3;
      yawDeg?: number;
      bevel?: number;
      /** A scene material, or a recipe name the host knows. */
      material: string;
    }
  | {
      id: string;
      type: 'ground';
      /** Width (X) and depth (Z) in metres; the top surface sits at y = 0. */
      size: [number, number];
      material: string;
    };

export interface ZhudaFilmScene {
  schemaVersion: 1;
  id: string;
  camera: ZhudaFilmCamera;
  look?: ZhudaFilmLook;
  materials?: Record<string, ZhudaFilmMaterial>;
  nodes: ZhudaFilmNode[];
}

/** Atomic change set. Removals run first, then upserts by node id. */
export interface ZhudaFilmScenePatch {
  camera?: Partial<ZhudaFilmCamera>;
  look?: Partial<ZhudaFilmLook>;
  /** `null` removes a material. */
  materials?: Record<string, ZhudaFilmMaterial | null>;
  upsert?: ZhudaFilmNode[];
  remove?: string[];
}

export interface ZhudaFilmValidationContext {
  /** Prop ids the host can build. When omitted, prop ids are not checked. */
  props?: readonly string[];
  /** Recipe names the host can bake. When omitted, recipe names are not checked. */
  recipes?: readonly string[];
}

export interface ZhudaFilmCameraKey {
  time: number;
  camera: ZhudaFilmCamera;
}

export const ZHUDA_FILM_LIMITS = Object.freeze({
  nodes: 512,
  materials: 64,
  extent: 10_000,
  idLength: 64,
});

export const ZHUDA_FILM_DEFAULT_LOOK: Readonly<Required<ZhudaFilmLook>> = Object.freeze({
  sky: [0.55, 0.65, 0.78] as ZhudaFilmVec3,
  ambient: [0.3, 0.3, 0.32] as ZhudaFilmVec3,
  sun: Object.freeze({
    azimuthDeg: 50,
    elevationDeg: 40,
    intensity: 1.2,
    color: [1, 0.97, 0.92] as ZhudaFilmVec3,
  }),
});

const ID = /^[a-z0-9][a-z0-9._-]*$/;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const isId = (v: unknown) =>
  typeof v === 'string' && v.length <= ZHUDA_FILM_LIMITS.idLength && ID.test(v);

function vec3(
  value: unknown,
  path: string,
  issues: string[],
  extent: number = ZHUDA_FILM_LIMITS.extent,
) {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    !value.every((n) => finite(n) && Math.abs(n) <= extent)
  )
    issues.push(`${path}: use three finite numbers within ±${extent}`);
}
function colour(value: unknown, path: string, issues: string[]) {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    !value.every((n) => finite(n) && n >= 0 && n <= 1)
  )
    issues.push(`${path}: use linear RGB with three values between 0 and 1`);
}
function unknownKeys(
  value: Record<string, unknown>,
  allowed: string[],
  path: string,
  issues: string[],
) {
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) issues.push(`${path}.${key}: unknown field`);
}

function validateCamera(camera: unknown, path: string, issues: string[], partial = false) {
  if (!object(camera)) return void issues.push(`${path}: camera object required`);
  unknownKeys(camera, ['eye', 'target', 'focalLengthMm', 'fStop', 'focusDistanceM'], path, issues);
  if (!partial || camera.eye !== undefined) vec3(camera.eye, `${path}.eye`, issues);
  if (!partial || camera.target !== undefined) vec3(camera.target, `${path}.target`, issues);
  if (
    !partial &&
    Array.isArray(camera.eye) &&
    Array.isArray(camera.target) &&
    camera.eye.every((v, i) => v === (camera.target as number[])[i])
  )
    issues.push(`${path}: eye and target must differ`);
  if (
    camera.focalLengthMm !== undefined &&
    !(finite(camera.focalLengthMm) && camera.focalLengthMm >= 8 && camera.focalLengthMm <= 600)
  )
    issues.push(`${path}.focalLengthMm: use 8..600`);
  if (
    camera.fStop !== undefined &&
    !(finite(camera.fStop) && camera.fStop >= 0.7 && camera.fStop <= 64)
  )
    issues.push(`${path}.fStop: use 0.7..64`);
  if (
    camera.focusDistanceM !== undefined &&
    !(
      finite(camera.focusDistanceM) &&
      camera.focusDistanceM > 0.05 &&
      camera.focusDistanceM <= ZHUDA_FILM_LIMITS.extent
    )
  )
    issues.push(`${path}.focusDistanceM: use a distance above 0.05 m`);
}

function validateLook(look: unknown, path: string, issues: string[]) {
  if (!object(look)) return void issues.push(`${path}: look object required`);
  unknownKeys(look, ['sky', 'ambient', 'sun'], path, issues);
  if (look.sky !== undefined) colour(look.sky, `${path}.sky`, issues);
  if (look.ambient !== undefined) colour(look.ambient, `${path}.ambient`, issues);
  if (look.sun !== undefined) {
    const sun = look.sun;
    if (!object(sun)) return void issues.push(`${path}.sun: object required`);
    unknownKeys(sun, ['azimuthDeg', 'elevationDeg', 'intensity', 'color'], `${path}.sun`, issues);
    if (!(finite(sun.azimuthDeg) && Math.abs(sun.azimuthDeg) <= 360))
      issues.push(`${path}.sun.azimuthDeg: use -360..360`);
    if (!(finite(sun.elevationDeg) && sun.elevationDeg >= 0 && sun.elevationDeg <= 90))
      issues.push(`${path}.sun.elevationDeg: use 0..90`);
    if (
      sun.intensity !== undefined &&
      !(finite(sun.intensity) && sun.intensity >= 0 && sun.intensity <= 8)
    )
      issues.push(`${path}.sun.intensity: use 0..8`);
    if (sun.color !== undefined) colour(sun.color, `${path}.sun.color`, issues);
  }
}

function validateMaterial(
  material: unknown,
  path: string,
  issues: string[],
  context: ZhudaFilmValidationContext,
) {
  if (!object(material)) return void issues.push(`${path}: material object required`);
  if ('recipe' in material) {
    unknownKeys(material, ['recipe', 'tint', 'size'], path, issues);
    if (typeof material.recipe === 'string') {
      if (context.recipes && !context.recipes.includes(material.recipe))
        issues.push(
          `${path}.recipe: unknown recipe ${material.recipe}; known: ${context.recipes.join(', ')}`,
        );
    } else
      for (const issue of validateZhudaTextureRecipe(material.recipe))
        issues.push(`${path}.recipe${issue.startsWith('.') ? '' : ': '}${issue}`);
    if (
      material.tint !== undefined &&
      !(
        Array.isArray(material.tint) &&
        material.tint.length === 4 &&
        material.tint.every((n) => finite(n) && n >= 0 && n <= 4)
      )
    )
      issues.push(`${path}.tint: use four values between 0 and 4`);
    if (material.size !== undefined && ![128, 256, 512].includes(material.size as number))
      issues.push(`${path}.size: use 128, 256 or 512`);
  } else if ('color' in material) {
    unknownKeys(material, ['color', 'roughness', 'metallic'], path, issues);
    colour(material.color, `${path}.color`, issues);
    for (const key of ['roughness', 'metallic'] as const)
      if (
        material[key] !== undefined &&
        !(finite(material[key]) && (material[key] as number) >= 0 && (material[key] as number) <= 1)
      )
        issues.push(`${path}.${key}: use 0..1`);
  } else issues.push(`${path}: use { recipe } or { color }`);
}

function validateNode(
  node: unknown,
  path: string,
  issues: string[],
  context: ZhudaFilmValidationContext,
  materials: ReadonlySet<string>,
) {
  if (!object(node)) return void issues.push(`${path}: node object required`);
  if (!isId(node.id))
    issues.push(`${path}.id: use lowercase letters, digits, dot, dash or underscore`);
  const yaw = () => {
    if (node.yawDeg !== undefined && !(finite(node.yawDeg) && Math.abs(node.yawDeg) <= 360))
      issues.push(`${path}.yawDeg: use -360..360`);
  };
  const usesMaterial = () => {
    if (
      typeof node.material !== 'string' ||
      !(materials.has(node.material) || context.recipes?.includes(node.material))
    )
      issues.push(`${path}.material: name a scene material or a known recipe`);
  };
  switch (node.type) {
    case 'prop':
      unknownKeys(
        node,
        ['id', 'type', 'prop', 'position', 'yawDeg', 'seed', 'params'],
        path,
        issues,
      );
      if (typeof node.prop !== 'string' || !node.prop)
        issues.push(`${path}.prop: prop id required`);
      else if (context.props && !context.props.includes(node.prop))
        issues.push(`${path}.prop: unknown prop ${node.prop}; known: ${context.props.join(', ')}`);
      vec3(node.position, `${path}.position`, issues);
      yaw();
      if (
        node.seed !== undefined &&
        !(Number.isSafeInteger(node.seed) && (node.seed as number) >= 0)
      )
        issues.push(`${path}.seed: use a non-negative integer`);
      if (node.params !== undefined && !object(node.params))
        issues.push(`${path}.params: object required`);
      break;
    case 'box':
      unknownKeys(
        node,
        ['id', 'type', 'size', 'position', 'yawDeg', 'bevel', 'material'],
        path,
        issues,
      );
      vec3(node.size, `${path}.size`, issues, 1000);
      if (Array.isArray(node.size) && node.size.some((n) => !(n > 0)))
        issues.push(`${path}.size: every side must be positive`);
      vec3(node.position, `${path}.position`, issues);
      yaw();
      if (node.bevel !== undefined && !(finite(node.bevel) && node.bevel >= 0))
        issues.push(`${path}.bevel: use a non-negative number`);
      usesMaterial();
      break;
    case 'ground':
      unknownKeys(node, ['id', 'type', 'size', 'material'], path, issues);
      if (
        !Array.isArray(node.size) ||
        node.size.length !== 2 ||
        !node.size.every((n) => finite(n) && n > 0 && n <= ZHUDA_FILM_LIMITS.extent)
      )
        issues.push(`${path}.size: use [width, depth] in metres`);
      usesMaterial();
      break;
    default:
      issues.push(`${path}.type: use prop, box or ground`);
  }
}

/** Lists every problem with a path; an empty list means the scene is valid. */
export function validateZhudaFilmScene(
  scene: unknown,
  context: ZhudaFilmValidationContext = {},
): string[] {
  const issues: string[] = [];
  if (!object(scene)) return ['scene: object required'];
  unknownKeys(
    scene,
    ['schemaVersion', 'id', 'camera', 'look', 'materials', 'nodes'],
    'scene',
    issues,
  );
  if (scene.schemaVersion !== 1) issues.push('scene.schemaVersion: must be 1');
  if (!isId(scene.id))
    issues.push('scene.id: use lowercase letters, digits, dot, dash or underscore');
  validateCamera(scene.camera, 'scene.camera', issues);
  if (scene.look !== undefined) validateLook(scene.look, 'scene.look', issues);
  const materials = new Set<string>();
  if (scene.materials !== undefined) {
    if (!object(scene.materials)) issues.push('scene.materials: object required');
    else {
      const entries = Object.entries(scene.materials);
      if (entries.length > ZHUDA_FILM_LIMITS.materials)
        issues.push(`scene.materials: at most ${ZHUDA_FILM_LIMITS.materials}`);
      for (const [name, material] of entries) {
        if (!isId(name)) issues.push(`scene.materials.${name}: invalid material name`);
        materials.add(name);
        validateMaterial(material, `scene.materials.${name}`, issues, context);
      }
    }
  }
  if (!Array.isArray(scene.nodes)) issues.push('scene.nodes: array required');
  else {
    if (scene.nodes.length > ZHUDA_FILM_LIMITS.nodes)
      issues.push(`scene.nodes: at most ${ZHUDA_FILM_LIMITS.nodes}`);
    const ids = new Set<string>();
    scene.nodes.forEach((node, i) => {
      validateNode(node, `scene.nodes[${i}]`, issues, context, materials);
      const id = object(node) ? node.id : undefined;
      if (typeof id === 'string') {
        if (ids.has(id)) issues.push(`scene.nodes[${i}].id: duplicate ${id}`);
        ids.add(id);
      }
    });
  }
  return issues;
}

/** Throws with every problem listed; returns a detached copy otherwise. */
export function parseZhudaFilmScene(
  scene: unknown,
  context: ZhudaFilmValidationContext = {},
): ZhudaFilmScene {
  const issues = validateZhudaFilmScene(scene, context);
  if (issues.length) throw Error('Invalid film scene:\n- ' + issues.join('\n- '));
  return structuredClone(scene) as ZhudaFilmScene;
}

/** Applies a patch atomically: the input is untouched and an invalid result throws. */
export function applyZhudaFilmScenePatch(
  scene: ZhudaFilmScene,
  patch: ZhudaFilmScenePatch,
  context: ZhudaFilmValidationContext = {},
): ZhudaFilmScene {
  if (!object(patch as unknown)) throw Error('Invalid film patch: object required');
  const issues: string[] = [];
  unknownKeys(
    patch as Record<string, unknown>,
    ['camera', 'look', 'materials', 'upsert', 'remove'],
    'patch',
    issues,
  );
  if (patch.camera !== undefined) validateCamera(patch.camera, 'patch.camera', issues, true);
  if (patch.remove !== undefined && !(Array.isArray(patch.remove) && patch.remove.every(isId)))
    issues.push('patch.remove: array of node ids required');
  if (patch.upsert !== undefined && !Array.isArray(patch.upsert))
    issues.push('patch.upsert: array of nodes required');
  if (patch.materials !== undefined && !object(patch.materials))
    issues.push('patch.materials: object required');
  if (issues.length) throw Error('Invalid film patch:\n- ' + issues.join('\n- '));
  const next = structuredClone(scene);
  if (patch.camera) next.camera = { ...next.camera, ...structuredClone(patch.camera) };
  if (patch.look) {
    const look = { ...(next.look ?? {}), ...structuredClone(patch.look) };
    if (patch.look.sun && next.look?.sun) look.sun = { ...next.look.sun, ...patch.look.sun };
    next.look = look;
  }
  if (patch.materials) {
    const materials = { ...(next.materials ?? {}) };
    for (const [name, material] of Object.entries(patch.materials))
      if (material === null) delete materials[name];
      else materials[name] = structuredClone(material);
    next.materials = materials;
  }
  if (patch.remove) {
    const missing = patch.remove.filter((id) => !next.nodes.some((node) => node.id === id));
    if (missing.length)
      throw Error('Invalid film patch:\n- patch.remove: unknown node ' + missing.join(', '));
    next.nodes = next.nodes.filter((node) => !patch.remove!.includes(node.id));
  }
  for (const node of patch.upsert ?? []) {
    const index = next.nodes.findIndex((existing) => existing.id === (node as { id?: string })?.id);
    if (index >= 0) next.nodes[index] = structuredClone(node);
    else next.nodes.push(structuredClone(node));
  }
  return parseZhudaFilmScene(next, context);
}

/** Camera with every default filled in. */
export function resolveZhudaFilmCamera(camera: ZhudaFilmCamera): Required<ZhudaFilmCamera> {
  const distance = Math.hypot(
    camera.target[0] - camera.eye[0],
    camera.target[1] - camera.eye[1],
    camera.target[2] - camera.eye[2],
  );
  return {
    eye: [...camera.eye],
    target: [...camera.target],
    focalLengthMm: camera.focalLengthMm ?? 35,
    fStop: camera.fStop ?? 8,
    focusDistanceM: camera.focusDistanceM ?? Math.max(distance, 0.06),
  };
}

/** Look with every default filled in. */
export interface ZhudaResolvedFilmLook {
  sky: ZhudaFilmVec3;
  ambient: ZhudaFilmVec3;
  sun: Required<ZhudaFilmSun>;
}

export function resolveZhudaFilmLook(look: ZhudaFilmLook = {}): ZhudaResolvedFilmLook {
  const d = ZHUDA_FILM_DEFAULT_LOOK;
  return {
    sky: look.sky ?? [...d.sky],
    ambient: look.ambient ?? [...d.ambient],
    sun: {
      azimuthDeg: look.sun?.azimuthDeg ?? d.sun.azimuthDeg,
      elevationDeg: look.sun?.elevationDeg ?? d.sun.elevationDeg,
      intensity: look.sun?.intensity ?? d.sun.intensity ?? 1.2,
      color: look.sun?.color ?? ([...d.sun.color!] as ZhudaFilmVec3),
    },
  };
}

/** Checks a keyed camera move: two to 256 keys, strictly increasing times from 0. */
export function validateZhudaFilmCameraPath(keys: unknown): string[] {
  const issues: string[] = [];
  if (!Array.isArray(keys) || keys.length < 2 || keys.length > 256)
    return ['cameraPath: use 2..256 keys'];
  keys.forEach((key, i) => {
    if (!object(key)) return void issues.push(`cameraPath[${i}]: object required`);
    if (!finite(key.time) || key.time < 0) issues.push(`cameraPath[${i}].time: use seconds >= 0`);
    if (i === 0 && key.time !== 0) issues.push('cameraPath[0].time: must be 0');
    if (
      i > 0 &&
      finite(key.time) &&
      object(keys[i - 1]) &&
      !(key.time > (keys[i - 1] as { time: number }).time)
    )
      issues.push(`cameraPath[${i}].time: must increase`);
    validateCamera(key.camera, `cameraPath[${i}].camera`, issues);
  });
  return issues;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Camera at time `t` along keyed shots, eased in and out between keys
 * (smoothstep). Times outside the path hold the first or last key.
 */
export function sampleZhudaFilmCameraPath(
  keys: readonly ZhudaFilmCameraKey[],
  t: number,
): Required<ZhudaFilmCamera> {
  if (!keys.length) throw Error('Camera path is empty');
  if (t <= keys[0].time) return resolveZhudaFilmCamera(keys[0].camera);
  const last = keys[keys.length - 1];
  if (t >= last.time) return resolveZhudaFilmCamera(last.camera);
  let i = 0;
  while (keys[i + 1].time < t) i++;
  const a = resolveZhudaFilmCamera(keys[i].camera),
    b = resolveZhudaFilmCamera(keys[i + 1].camera),
    k = smooth((t - keys[i].time) / (keys[i + 1].time - keys[i].time));
  const v = (p: ZhudaFilmVec3, q: ZhudaFilmVec3): ZhudaFilmVec3 => [
    mix(p[0], q[0], k),
    mix(p[1], q[1], k),
    mix(p[2], q[2], k),
  ];
  return {
    eye: v(a.eye, b.eye),
    target: v(a.target, b.target),
    focalLengthMm: mix(a.focalLengthMm, b.focalLengthMm, k),
    fStop: mix(a.fStop, b.fStop, k),
    focusDistanceM: mix(a.focusDistanceM, b.focusDistanceM, k),
  };
}
