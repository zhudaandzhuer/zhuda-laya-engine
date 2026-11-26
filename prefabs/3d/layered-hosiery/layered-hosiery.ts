// Layered hosiery on a modelled lower body: two legs with skin, a stocking 2.3 mm off the skin,
// and over that a skirt (the engine's cloth), shorts or trousers (a second layer over each leg) or
// nothing. Whatever is on top where a finger lands is pulled; pulled far enough it tears, and
// through a hole in a garment the stocking below is pulled in turn. Fifteen kinds of stocking
// (`patterns.ts`), thirteen things worn over them (`bottoms.ts`).
//
// Everything is on the engine's public API: ZhudaLitSurfaceMaterial with the hooks in
// `shaders.ts`, ZhudaDynamicMesh (the layers, moved per vertex in `meshleg.ts`), ZhudaCloth with
// the legs as bodies, ZhudaTriangleBvh for picking. It keeps no clock and no pointer of its own:
// the game gives it rays (`pointerRay`) and calls `step`. Route: docs/routes/layered-cloth-on-body.md.
//
// After `sync.mjs … 3d/layered-hosiery` the body is served at `common/3d/layered-hosiery/assets/legs.json`
// next to the game's index.html (how it was made: source/export_legs.py).
//
// Units: the legs keep their own (metres / LT, the waistband at TOP, the floor at FLOOR); `toWorld`
// turns them into metres with the soles on y = 0. Heights in `bottoms.ts` are in leg units.
import { Zhuda3D, ZhudaCloth, ZhudaDynamicMesh, ZhudaHdrEnvironment, ZhudaLitSurfaceMaterial, ZhudaTriangleBvh, createSurfaceMaterial, createSurfaceTexture, createZhudaClothTube, zhudaStudioEnvironment, type ZhudaFilmLook } from 'zhuda-laya-engine';
import { BOTTOMS, type Bottom, type PantsSpec, type SkirtSpec } from './bottoms.ts';
import { AROUND, BASE, LT, SPAN, TOP, UP, bridgeCrotch, clamp, createLayer, createLeg, hipReach, legTable, offsetAt, outwardAt, pull, relax, tearOrigin, toWorld, type Leg, type LegData } from './meshleg.ts';
import { TYPES, display, tileOf, type StockingType } from './patterns.ts';
import { GARMENT, HOSIERY, SKIRT, TEARS, TEAR_UNIFORMS } from './shaders.ts';

export const HOSIERY_BASE = 'common/3d/layered-hosiery/assets/';
/** The served path of the body, for a page that has the module synced in. */
export const LEGS_PATH = `${HOSIERY_BASE}legs.json`;
/** What `assets/legs.json` holds: the two legs (side -1 and 1) and the places of the joints, metres. */
export interface LegsFile {
  legs: LegData[];
  joints: Record<string, number[]>;
}

type V3 = [number, number, number];
const vOf = (y: number) => (y - BASE) / SPAN;

// --- the room: light, studio reflections, the camera's framing --------------------------------

/** The background the bench was composed on: the look's sky and fog, the camera's clear colour, the page. */
export const HOSIERY_BACKGROUND: V3 = [0.012, 0.02, 0.04];
export const HOSIERY_BACKGROUND_CSS = '#05080f';

/**
 * The look the stockings were tuned under (ZhudaSceneLook's settings): a high warm sun, soft
 * shadows, AgX, a little bloom and grain. `coarse` is a phone: smaller shadow map.
 */
export function hosieryLook(o: { coarse?: boolean; ao?: number; antialias?: 'fxaa' | 'smaa' | 'msaa' | 'none' } = {}): ZhudaFilmLook {
  return {
    preset: 'day' as const,
    atmosphere: false,
    sky: [...HOSIERY_BACKGROUND] as V3,
    // The floor fades into the background behind the figure: no horizon line.
    fog: { color: [...HOSIERY_BACKGROUND] as V3, start: 2.6, end: 4.2 },
    ambient: [0.2, 0.2, 0.23] as V3,
    ambientGround: [0.16, 0.14, 0.13] as V3,
    sun: { azimuthDeg: -8, elevationDeg: 68, intensity: 1.7, color: [1, 0.94, 0.88] as V3 },
    shadows: { distance: 5, resolution: (o.coarse ? 1024 : 2048) as 1024 | 2048, cascades: 2 as const, softness: 'soft' as const, strength: 0.75 },
    // (FSR is skipped under LayaAir's own FXAA, so the default is SMAA.)
    grade: { exposure: 0.8, bloom: 0.22, ao: o.ao ?? 0.6, aoRadius: 0.1, antialias: o.antialias ?? ('smaa' as const), toneMapping: 'agx' as any, saturation: 1.08, grain: 0.1, vignette: 0.32 },
  };
}

/**
 * The studio's reflections and two cyan lights from behind on both sides. The rims are dimmer than
 * the look's sun so the sun keeps its shadow (LayaAir gives the shadow to the brightest directional light).
 */
export function mountHosieryStudio(scene: any, camera: any) {
  const environment = new ZhudaHdrEnvironment(scene, { cube: zhudaStudioEnvironment({ intensity: 0.35, walls: [0.09, 0.085, 0.085] }) }, { camera, sky: false });
  const rims = [-1, 1].map((side) => {
    const rim = Zhuda3D.createDirectionalLight(scene);
    rim.light.color = new Laya.Color(0.18, 1.05, 1.45, 1);
    rim.light.intensity = 1.5 * (side > 0 ? 1 : 0.8);
    rim.node.transform.position = new Laya.Vector3(side * 1.7, 0.75, -1.6);
    rim.node.transform.lookAt(new Laya.Vector3(0, 0.62, 0), new Laya.Vector3(0, 1, 0));
    return rim;
  });
  return { environment, rims };
}

/** Where the camera stands: angles in radians round the figure, `zoom` 1 shows waistband to soles. */
export interface HosieryView {
  yaw: number;
  pitch: number;
  fov: number;
  zoom: number;
}
export const HOSIERY_VIEW: HosieryView = { yaw: 0, pitch: (3 * Math.PI) / 180, fov: 30, zoom: 1 };
export const HOSIERY_VIEW_LIMITS = { yaw: [-0.9, 0.9], pitch: [-0.27, 0.45], zoom: [0.45, 1.8] } as const;

/**
 * The eye and the point looked at for a picture of `width` x `height` CSS pixels: from the
 * waistband down to the soles (the body above is never seen), drawn back on a narrow screen so both
 * legs fit. `panelPx` is a panel covering the right side (the figure stands in the middle of what
 * is left), `barPx` a bar along the bottom (the feet stand above it), `targetY` fixes the height looked at.
 */
export function frameHosiery(view: HosieryView, width: number, height: number, o: { panelPx?: number; barPx?: number; targetY?: number } = {}) {
  const t = Math.tan((view.fov * Math.PI) / 360);
  const reserved = (o.barPx ?? 0) / height;
  const top = toWorld(0, TOP - 0.1, 0)[1],
    span = (top + 0.03) / (1 - reserved),
    bottom = top - span;
  const distance = Math.max(span / 2 / t, 0.3 / (t * (width / height))) * view.zoom;
  const shift = ((o.panelPx ?? 0) / 2 / height) * 2 * distance * t;
  const target: V3 = [Math.cos(view.yaw) * shift, o.targetY ?? (top + bottom) / 2, -Math.sin(view.yaw) * shift];
  const eye: V3 = [target[0] + Math.sin(view.yaw) * Math.cos(view.pitch) * distance, target[1] + Math.sin(view.pitch) * distance, target[2] + Math.cos(view.yaw) * Math.cos(view.pitch) * distance];
  return { eye, target, distance };
}

/** A ray under a pointer, with the camera's right and up and how many metres a pixel covers one metre away. */
export interface PointerRay {
  origin: number[];
  direction: number[];
  right: number[];
  up: number[];
  pixel: number;
}
export function pointerRay(eye: readonly number[], target: readonly number[], fov: number, box: { left: number; top: number; width: number; height: number }, clientX: number, clientY: number): PointerRay {
  const x = ((clientX - box.left) / box.width) * 2 - 1,
    y = 1 - ((clientY - box.top) / box.height) * 2;
  const f = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]],
    fl = Math.hypot(f[0], f[1], f[2]);
  const forward = f.map((c) => c / fl);
  const rl = Math.hypot(forward[2], forward[0]);
  const right = [-forward[2] / rl, 0, forward[0] / rl];
  const up = [right[1] * forward[2] - right[2] * forward[1], right[2] * forward[0] - right[0] * forward[2], right[0] * forward[1] - right[1] * forward[0]];
  const t = Math.tan((fov * Math.PI) / 360),
    aspect = box.width / box.height;
  const direction = [0, 1, 2].map((c) => forward[c] + right[c] * x * t * aspect + up[c] * y * t);
  const l = Math.hypot(direction[0], direction[1], direction[2]);
  return { origin: [...eye], direction: direction.map((c) => c / l), right, up, pixel: (2 * t) / box.height };
}

// --- the wearer ---------------------------------------------------------------------------

export interface WearerOptions {
  /** A phone: a coarser skirt (64 columns, three quarters of the rows) and a wider reach for picking its cloth. */
  coarse?: boolean;
  type?: StockingType;
  color?: number;
  bottom?: Bottom;
  /** The seed of the tears' shapes: the same pulls give the same holes. */
  seed?: number;
  /** A floor in the background's colour, so the feet stand and cast their shadows. Default on. */
  floor?: boolean;
  /** A fitted black top above the waistband (the legs' mesh is cut there). Default on. */
  top?: boolean;
  /** Called after what is worn or torn was put back (a new kind, a new bottom, a reset): time to redraw a panel. */
  onChange?: () => void;
}

export interface HosieryWearer {
  readonly legs: Leg[];
  readonly type: StockingType;
  readonly color: number;
  readonly bottom: Bottom;
  /** What the pointer holds now. */
  readonly held: 'leg' | 'skirt' | null;
  /** Puts on a kind of stocking in a colour; every tear is gone. */
  dress(type: StockingType, color?: number): void;
  /** Puts on a skirt, shorts, trousers or nothing; every tear is gone. */
  wear(bottom: Bottom): void;
  /** Mends everything and lets go. */
  reset(): void;
  /** A pointer went down along `ray`: takes hold of the skirt or of what is on top of the leg there. Null: it met nothing. */
  press(ray: PointerRay): 'leg' | 'skirt' | null;
  /** The pointer is now `dx`, `dy` CSS pixels from where it went down. */
  drag(dx: number, dy: number): void;
  /** The pointer left. `lifted` (a real lift, not a cancel): a pull past the tearing point goes on to tear. */
  release(lifted: boolean): void;
  /** Each frame: the cloth, the pull's spring, tears opening. `delta` in seconds on the game's clock. */
  step(delta: number): void;
  stats(): Record<string, unknown>;
  /** The skirt's cloth as it is now: stretch, particles inside a body, hands held. Null without a skirt. */
  cloth(): Record<string, unknown> | null;
  /** The skirt hem's mean height and sideways place, for checking how it moves. Null without a skirt. */
  hem(): { y: number; x: number } | null;
  /** How far the pull is out, 0..1.1. */
  readonly amount: number;
  dispose(): void;
}

/**
 * Builds the figure in `scene` from the body file and dresses it. The scene needs light (a
 * ZhudaSceneLook with `hosieryLook()`, `mountHosieryStudio`) and a camera (`frameHosiery`).
 */
export function createHosieryWearer(scene: any, file: LegsFile, options: WearerOptions = {}): HosieryWearer {
  const coarse = !!options.coarse;
  let seed = options.seed ?? 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  let built = false;
  const changed = () => {
    if (built) options.onChange?.();
  };

  // --- legs ---------------------------------------------------------------------------
  const skin = new ZhudaLitSurfaceMaterial({
    name: 'ZhudaGameSkin',
    subsurface: { color: [0.95, 0.5, 0.4], wrap: 0.45, back: 0.2 },
    surface: 'void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 p, vec3 n) { s.thickness = 0.3; }',
    material: { color: [0xc7 / 255, 0xa8 / 255, 0x9d / 255, 1], roughness: 0.62 },
  });
  // The panty top of tights starts 6 cm below the crotch.
  const pantyV = (file.joints.crotch[1] / LT + (BASE - 0.38) - 0.28 - BASE) / SPAN;
  const legs: Leg[] = [];
  for (const side of [-1, 1]) {
    const leg = createLeg(scene, file.legs.find((l) => l.side === side)!);
    leg.skin.node.meshRenderer.sharedMaterial = skin.material;
    leg.skin.node.meshRenderer.castShadow = leg.skin.node.meshRenderer.receiveShadow = true;
    leg.hosiery.node.meshRenderer.castShadow = false;
    leg.hosiery.node.meshRenderer.receiveShadow = true;
    legs.push(leg);
  }
  // The stocking spans the crotch as cloth does.
  bridgeCrotch(legs, legs, () => 0.011);
  const extras: { destroy(): void }[] = [];
  if (options.floor !== false) {
    const floor = new Laya.MeshSprite3D(Zhuda3D.createPrimitiveMesh('box', { width: 12, height: 0.1, depth: 12 }));
    floor.meshRenderer.sharedMaterial = createSurfaceMaterial({ type: 'pbr', color: [0.008, 0.01, 0.016, 1], roughness: 0.9 });
    floor.meshRenderer.receiveShadow = true;
    floor.transform.position = new Laya.Vector3(0, -0.05, 0);
    scene.addChild(floor);
    extras.push({ destroy: () => floor.destroy() });
  }
  const pickers = legs.map((leg) => {
    const positions = new Float32Array(leg.skinRest.length);
    for (let i = 0; i < positions.length; i += 3) positions.set(toWorld(leg.skinRest[i], leg.skinRest[i + 1], leg.skinRest[i + 2]), i);
    return new ZhudaTriangleBvh({ positions, indices: leg.skin.data.indices });
  });
  const uvOf = (leg: Leg, hit: { triangle: number; barycentric: [number, number, number] }) => {
    const indices = leg.skin.data.indices,
      uvs = leg.skin.data.uvs!;
    let u = 0,
      v = 0;
    for (let c = 0; c < 3; c++) {
      const vertex = indices[hit.triangle * 3 + c];
      u += uvs[vertex * 2] * hit.barycentric[c];
      v += uvs[vertex * 2 + 1] * hit.barycentric[c];
    }
    return [u, v] as [number, number];
  };
  // Above the waistband, a fitted black top: a tube round the hips that narrows to the waist.
  if (options.top !== false) {
    const columns = 64,
      rows = 14,
      from = TOP - 0.2,
      to = TOP + 1.6;
    const positions = new Float32Array((columns + 1) * (rows + 1) * 3),
      normals = new Float32Array(positions.length),
      uvs = new Float32Array((columns + 1) * (rows + 1) * 2),
      indices = new Uint16Array(columns * rows * 6);
    let k = 0;
    for (let r = 0; r <= rows; r++) {
      const t = r / rows,
        y = from + (to - from) * t;
      const waist = 1 - 0.17 * Math.sin(Math.min(1, t / 0.55) * Math.PI * 0.5) + (0.06 * Math.max(0, t - 0.55)) / 0.45;
      for (let c = 0; c <= columns; c++) {
        const angle = (c / columns) * Math.PI * 2,
          at = r * (columns + 1) + c;
        const reach = (hipReach(legs, TOP, angle) + 0.07) * waist;
        positions.set(toWorld(Math.sin(angle) * reach, y, Math.cos(angle) * reach), at * 3);
        normals.set([Math.sin(angle), 0, Math.cos(angle)], at * 3);
        uvs.set([c / columns, t], at * 2);
        if (r < rows && c < columns) {
          const b = at + 1,
            d = at + columns + 1;
          indices.set([at, b, d, b, d + 1, d], k);
          k += 6;
        }
      }
    }
    const top = new ZhudaDynamicMesh({ positions, normals, uvs, indices }, scene);
    top.node.meshRenderer.sharedMaterial = createSurfaceMaterial({ type: 'pbr', color: [0.014, 0.014, 0.017, 1], roughness: 1 });
    top.node.meshRenderer.castShadow = top.node.meshRenderer.receiveShadow = true;
    extras.push({ destroy: () => top.dispose() });
  }

  // --- what can be torn: each surface has its material, its tears and its rules -----------------
  type Tears = { center: number[]; axis: number[]; shape: number[]; count: number };
  type Rules = { tearAt: number; holeSize: number; ladder: number; lace?: [number, number] };
  const materials = new Map<Leg, ZhudaLitSurfaceMaterial>();
  const tears = new Map<Leg, Tears>();
  const rules = new Map<Leg, Rules>();
  const freshTears = (): Tears => ({ center: new Array(TEARS * 2).fill(0), axis: new Array(TEARS * 2).fill(0), shape: new Array(TEARS * 4).fill(0), count: 0 });
  const writeTears = (surface: Leg) => {
    const list = tears.get(surface)!,
      material = materials.get(surface)!;
    for (let i = 0; i < list.count; i++) {
      material.set(`u_ZhudaTearPlace${i}`, [list.center[i * 2], list.center[i * 2 + 1], list.axis[i * 2], list.axis[i * 2 + 1]]);
      material.set(`u_ZhudaTearShape${i}`, list.shape.slice(i * 4, i * 4 + 4));
    }
    material.set('u_ZhudaTearCount', list.count);
  };
  /** Whether (u, v) lies in a hole already torn in this surface. */
  const inHole = (surface: Leg, u: number, v: number) => {
    const list = tears.get(surface);
    if (!list) return false;
    for (let i = 0; i < list.count; i++) {
      const du = u - list.center[i * 2],
        dv = v - list.center[i * 2 + 1];
      if (Math.hypot((du - Math.round(du)) * 2.7, dv * SPAN) < list.shape[i * 4 + 1] * 1.25) return true;
    }
    return false;
  };

  // Stockings: one material a leg, made again for each kind.
  const textures = new Map<string, any>();
  const textureOf = (type: StockingType) => {
    const key = JSON.stringify(type.tile);
    if (!textures.has(key)) {
      const tile = tileOf(type);
      textures.set(key, createSurfaceTexture(tile.size, tile.size, tile.pixels, 'data', { mipmap: true, anisoLevel: 16 }));
    }
    return textures.get(key);
  };
  // The engine's shader contract includes each uniform's starting value: every material of one
  // shader is made with the same zeros, and its own values are set straight after.
  const withValues = (material: ZhudaLitSurfaceMaterial, values: Record<string, number[] | number>) => {
    for (const [name, value] of Object.entries(values)) material.set(name, value);
    return material;
  };
  const zeros = (names: string[]) => Object.fromEntries(names.map((name) => [name, { type: 'vec4' as const, value: [0, 0, 0, 0] }]));
  const stockingMaterial = (type: StockingType, shade: number, side: number) =>
    withValues(
      new ZhudaLitSurfaceMaterial(
        {
          name: 'ZhudaGameStocking',
          surface: HOSIERY,
          common: true,
          // The edge glow takes a little of the yarn's own colour.
          // Dark yarn glows less at its edge than light yarn (a black stocking stays black).
          sheen: { color: display(shade).map((c, _, all) => (0.35 + 0.65 * c ** 0.5) * type.sheen * 0.65 * (0.18 + 0.82 * Math.max(...all) ** 0.8)) as V3, roughness: type.sheenRoughness },
          uniforms: {
            u_ZhudaKnit: { type: 'texture2D' },
            ...zeros(['u_ZhudaKnitParams', 'u_ZhudaKnitScale', 'u_ZhudaKnitStyle', 'u_ZhudaKnitExtra', 'u_ZhudaKnitRim', 'u_ZhudaKnitRimColor']),
            ...TEAR_UNIFORMS(),
          },
          material: { color: [...display(shade), 1], roughness: type.roughness, metallic: 0, blend: 'alpha', doubleSided: false, anisotropy: 0.64, anisotropyRotationDeg: 73 } as any,
        },
        { u_ZhudaKnit: textureOf(type) },
      ),
      {
        u_ZhudaKnitParams: [type.depth, type.relief, type.grain, type.gapFloor],
        u_ZhudaKnitScale: [type.tilesU, type.tilesV, type.ladder, type.gloss],
        u_ZhudaKnitStyle: [type.seam ? 1 : 0, type.lace ? type.lace[0] : 2, type.lace ? type.lace[1] : 2, type.dots ? 1 : 0],
        // All-over lace; garter; where the strap runs round the leg (a little to the outside of the front).
        u_ZhudaKnitExtra: [type.fullLace ? 1 : 0, type.garter ? 1 : 0, 0.5 + side * 0.07, type.lace ? 0 : pantyV],
        u_ZhudaKnitRim: [0.38, 2.7, 0, 0],
        u_ZhudaKnitRimColor: [0.13, 0.68, 0.99, 0],
      },
    );
  const garmentMaterial = (spec: PantsSpec) =>
    withValues(
      new ZhudaLitSurfaceMaterial({
        name: 'ZhudaGameGarment',
        surface: GARMENT,
        common: true,
        sheen: { color: spec.fabric === 'wool' ? [0.18, 0.18, 0.2] : [0.25, 0.27, 0.32], roughness: 0.75 },
        uniforms: {
          ...zeros(['u_ZhudaGarment', 'u_ZhudaGarmentColor']),
          ...TEAR_UNIFORMS(),
        },
        material: { color: [1, 1, 1, 1], roughness: 0.8, metallic: 0, blend: 'cutout', doubleSided: true } as any,
      }),
      {
        u_ZhudaGarment: [vOf(spec.from), spec.fabric === 'denim' ? 1 : 0, spec.frayed ? (spec.fringe ?? 1) : 0, spec.cuff ? 1 : 0],
        u_ZhudaGarmentColor: [...display(spec.color).map((c) => c ** 2.2), 1],
      },
    );

  let current = options.type ?? TYPES[1];
  let color = options.color ?? current.colors[0];
  let bottom = options.bottom ?? BOTTOMS[0];
  let garments: (Leg | null)[] = [null, null];
  let skirt: { cloth: ZhudaCloth; material: ZhudaLitSurfaceMaterial; columns: number; rows: number } | null = null;

  // --- skirts: the engine's cloth, rebuilt for each style --------------------------------------
  const buildSkirt = (spec: SkirtSpec) => {
    const columns = coarse ? 64 : 96,
      rows = coarse ? Math.round(spec.rows * 0.75) : spec.rows;
    // Pressed pleats take four columns each: outer crease, face, inner crease, face.
    const pleatCount = spec.pressed ? columns / 4 : spec.pleats;
    const waistY = TOP - 0.02;
    const shape = createZhudaClothTube({ columns, rows, center: toWorld(0, waistY, 0), topRadius: 0.2, bottomRadius: 0.3, length: (waistY - spec.hem) * LT });
    // A tube is round and a waist is not: each ring is laid round the hips (as far
    // as the legs reach in each direction, a flare, folds), its particles evenly
    // along it, and every constraint takes its new length.
    for (let r = 0; r < rows; r++) {
      const t = r / (rows - 1),
        y = waistY - t * (waistY - spec.hem);
      const ring: [number, number][] = [];
      const samples = 360;
      for (let a = 0; a <= samples; a++) {
        const angle = (a / samples) * Math.PI * 2;
        const fold = spec.pleats && !spec.pressed ? Math.abs((((angle / (Math.PI * 2)) * spec.pleats) % 1) - 0.5) * 2 - 0.5 : 0;
        // A fitted skirt follows the legs down; a flared one hangs from the hips.
        const body = spec.flare < 0.1 ? hipReach(legs, y, angle) : hipReach(legs, Math.max(y, 1.05), angle);
        const reach = body + 0.06 + spec.flare * t * t + fold * (spec.pleatDepth * (0.3 + 0.7 * t));
        ring.push([Math.sin(angle) * reach, Math.cos(angle) * reach]);
      }
      const lengths = [0];
      for (let a = 1; a <= samples; a++) lengths.push(lengths[a - 1] + Math.hypot(ring[a][0] - ring[a - 1][0], ring[a][1] - ring[a - 1][1]));
      for (let c = 0; c < columns; c++) {
        const want = (c / columns) * lengths[samples];
        let a = 1;
        while (a < samples && lengths[a] < want) a++;
        const f = (want - lengths[a - 1]) / (lengths[a] - lengths[a - 1] || 1);
        let x = ring[a - 1][0] + (ring[a][0] - ring[a - 1][0]) * f,
          z = ring[a - 1][1] + (ring[a][1] - ring[a - 1][1]) * f;
        if (spec.pressed) {
          // The zigzag: out at the outer crease, in at the inner one; stitched flat at the
          // hips, open from a third of the way down.
          const depth = spec.pleatDepth * (0.12 + 0.88 * Math.min(1, t / 0.35) ** 2) * [1, 0, -1, 0][c % 4];
          const l = Math.hypot(x, z) || 1;
          x += (x / l) * depth;
          z += (z / l) * depth;
        }
        shape.particles.set(toWorld(x, y, z), (r * columns + c) * 3);
      }
    }
    const { a: ca, b: cb, rest } = shape.constraints;
    for (let i = 0; i < rest.length; i++) {
      const p = shape.particles;
      rest[i] = Math.hypot(p[ca[i] * 3] - p[cb[i] * 3], p[ca[i] * 3 + 1] - p[cb[i] * 3 + 1], p[ca[i] * 3 + 2] - p[cb[i] * 3 + 2]);
    }
    // Pressed pleats keep their folds: a stiffer bend. Wool loses its swing quickly (a high
    // drag); a light chiffon keeps a little more.
    const cloth = new ZhudaCloth(shape, scene, { thickness: 0.008, friction: 0.6, compliance: { structural: 0, shear: 4e-4, bend: spec.pressed ? 2e-5 : 6e-4 }, windDrag: spec.windDrag, drag: spec.windDrag > 3 ? 2.5 : 4.5 });
    const material = withValues(
      new ZhudaLitSurfaceMaterial({
        name: 'ZhudaGameSkirt',
        surface: SKIRT,
        sheen: { color: [0.07, 0.07, 0.08], roughness: 0.85 },
        uniforms: zeros(['u_ZhudaSkirtColor', 'u_ZhudaSkirtColor2', 'u_ZhudaSkirtPleat']),
        material: { doubleSided: true, roughness: 0.8 },
      }),
      {
        u_ZhudaSkirtColor: [...display(spec.color).map((c) => c ** 2.2), spec.windDrag > 3 ? 0.55 : 0.8],
        u_ZhudaSkirtPleat: [pleatCount, spec.pressed ? 1 : 0, spec.pattern === 'houndstooth' ? 1 : 0, 0],
        u_ZhudaSkirtColor2: [...display(spec.color2 ?? spec.color).map((c) => c ** 2.2), 1],
      },
    );
    cloth.node.meshRenderer.sharedMaterial = material.material;
    cloth.node.meshRenderer.castShadow = cloth.node.meshRenderer.receiveShadow = true;
    for (let c = 0; c < columns; c++) cloth.solver.pin(c);
    for (const leg of legs) cloth.solver.addCollider(legTable(leg, Math.min(spec.hem - 0.6, -0.4), 0.015));
    for (let i = 0; i < 200; i++) cloth.update(1 / 60);
    return { cloth, material, columns, rows };
  };
  const buildGarments = (spec: PantsSpec) => {
    const fit = (y: number) => spec.fit + (spec.hemFit - spec.fit) * clamp((0.6 - y) / (0.6 - spec.from), 0, 1);
    const layers = legs.map((leg) => {
      const layer = createLayer(scene, leg, fit, spec.reach);
      const material = garmentMaterial(spec);
      layer.hosiery.node.meshRenderer.sharedMaterial = material.material;
      layer.hosiery.node.meshRenderer.castShadow = layer.hosiery.node.meshRenderer.receiveShadow = true;
      materials.set(layer, material);
      tears.set(layer, freshTears());
      rules.set(layer, { tearAt: spec.tearAt, holeSize: spec.holeSize, ladder: 0 });
      return layer;
    });
    // Trousers span the crotch too.
    bridgeCrotch(legs, layers, fit);
    return layers;
  };

  const surfaces = () => [...legs, ...garments.filter((g): g is Leg => !!g)];

  // --- the pull ---------------------------------------------------------------------------
  const grip = { leg: legs[0] as Leg, u: 0.5, v: 0.6, direction: null as number[] | null };
  let amount = 0,
    goal = 0,
    speed = 0,
    dirty = false;
  const setGrip = (surface: Leg, u: number, v: number, direction: number[] | null) => {
    if (grip.leg !== surface) relax(grip.leg);
    Object.assign(grip, { leg: surface, u, v, direction });
    dirty = true;
  };

  type Held =
    | { kind: 'leg'; leg: Leg; u: number; v: number; start: number[]; out: number[]; unit: number; right: number[]; up: number[]; engaged: boolean }
    | { kind: 'skirt'; pinch: { index: number; offset: number[] }[]; anchor: number[]; at: number[]; want: number[]; out: number[]; unit: number; right: number[]; up: number[] };
  let held: Held | null = null;

  const newRound = () => {
    for (const surface of surfaces()) {
      tears.set(surface, freshTears());
      if (materials.has(surface)) writeTears(surface);
      relax(surface);
    }
    // Rips a garment comes with, already open.
    if (bottom.spec.kind === 'pants')
      for (const rip of bottom.spec.rips ?? []) {
        const garment = garments[rip.side < 0 ? 0 : 1];
        const list = garment && tears.get(garment);
        if (!garment || !list) continue;
        const i = list.count++;
        list.center.splice(i * 2, 2, rip.u, vOf(rip.y));
        list.axis.splice(i * 2, 2, Math.sin(rip.turn), Math.cos(rip.turn));
        list.shape.splice(i * 4, 4, rip.size * 0.5, rip.size, rip.u * 17, 1);
        writeTears(garment);
      }
    grip.leg = legs[0];
    amount = goal = speed = 0;
    held = null;
    changed();
  };
  const dress = (type: StockingType, shade: number = type.colors[0]) => {
    current = type;
    color = shade;
    for (const leg of legs) {
      const old = materials.get(leg);
      const material = stockingMaterial(type, shade, leg.side);
      leg.hosiery.node.meshRenderer.sharedMaterial = material.material;
      materials.set(leg, material);
      old?.dispose();
      rules.set(leg, { tearAt: type.tearAt, holeSize: type.holeSize, ladder: type.ladder, lace: type.lace });
    }
    newRound();
  };
  const undress = () => {
    if (skirt) {
      skirt.cloth.dispose();
      skirt.material.dispose();
      skirt = null;
    }
    for (const garment of garments)
      if (garment) {
        materials.get(garment)?.dispose();
        garment.hosiery.dispose();
        materials.delete(garment);
        tears.delete(garment);
        rules.delete(garment);
      }
    garments = [null, null];
  };
  const wear = (next: Bottom) => {
    bottom = next;
    undress();
    if (next.spec.kind === 'skirt') skirt = buildSkirt(next.spec);
    if (next.spec.kind === 'pants') garments = buildGarments(next.spec);
    newRound();
  };

  const tear = () => {
    const surface = grip.leg,
      rule = rules.get(surface)!;
    const [u, v] = tearOrigin(surface, grip.u, grip.v);
    const list = tears.get(surface)!;
    // A lace-top stocking ends at its top: nothing to tear above it.
    const above = !!rule.lace && v > rule.lace[1];
    let near = false;
    for (let i = 0; i < list.count; i++) {
      const du = u - list.center[i * 2],
        dv = v - list.center[i * 2 + 1];
      if (Math.hypot((du - Math.round(du)) * 2.7, dv * SPAN) < 0.105 * rule.holeSize) near = true;
    }
    if (!near && !above && list.count < TEARS) {
      const i = list.count++;
      const turn = (u - 0.5) * Math.PI * 2,
        d = grip.direction || [0, 0, 0];
      const sideways = grip.direction ? d[0] * Math.cos(turn) - d[2] * Math.sin(turn) : -0.32,
        upward = grip.direction ? d[1] : 0;
      const angle = Math.atan2(-upward, 0.54 + Math.abs(sideways)) * 0.67 + (random() - 0.5) * 0.3;
      const h = rule.holeSize;
      list.center.splice(i * 2, 2, u, v);
      list.axis.splice(i * 2, 2, Math.sin(angle), Math.cos(angle));
      list.shape.splice(i * 4, 4, (0.49 + 0.16 * random() + 0.05 * Math.abs(sideways)) * (0.45 + 0.55 * rule.ladder) * 0.6 * h, (0.095 + 0.045 * random() + 0.025 * Math.abs(upward)) * h, random() * Math.PI * 2, 0.52);
      writeTears(surface);
    }
    goal = 0;
    speed = -9;
    held = null;
  };

  // --- the pointer, as rays ----------------------------------------------------------------
  const v3 = (c: number[]) => ({ x: c[0], y: c[1], z: c[2] });
  const releaseSkirt = () => {
    if (held?.kind === 'skirt' && skirt) for (const { index } of held.pinch) skirt.cloth.solver.unpin(index);
  };
  const press = (ray: PointerRay): 'leg' | 'skirt' | null => {
    if (held) return held.kind;
    let best: any = null;
    legs.forEach((leg, i) => {
      const hit = pickers[i].raycast({ origin: v3(ray.origin), direction: v3(ray.direction) }, 10, { side: 'front' });
      if (hit && (!best || hit.distance < best.distance)) best = { kind: 'leg', distance: hit.distance, index: i, hit };
    });
    if (skirt) {
      const { solver } = skirt.cloth;
      const particle = solver.nearestToRay(ray.origin as any, ray.direction as any, coarse ? 0.03 : 0.015);
      if (particle >= 0 && !solver.isPinned(particle)) {
        const p = solver.positions.subarray(particle * 3, particle * 3 + 3);
        const d = (p[0] - ray.origin[0]) * ray.direction[0] + (p[1] - ray.origin[1]) * ray.direction[1] + (p[2] - ray.origin[2]) * ray.direction[2];
        if (!best || d < best.distance + 0.01) best = { kind: 'skirt', distance: d, particle };
      }
    }
    if (!best) return null;
    const metresPerPixel = Math.max(0.1, best.distance) * ray.pixel;
    if (best.kind === 'skirt' && skirt) {
      const { solver } = skirt.cloth,
        { columns, rows } = skirt;
      const p = Array.from(solver.positions.subarray(best.particle * 3, best.particle * 3 + 3));
      const ol = Math.hypot(p[0] * 0.31, p[2]) || 1;
      // Fingers take a pinch of cloth: the particle picked and its eight neighbours are
      // pinned and carried together; the cloth round them makes the fold itself. (The
      // engine's hand holds one particle and waits whenever its threads stretch, which
      // made a larger held patch jitter.)
      const row = Math.floor(best.particle / columns),
        column = best.particle % columns,
        pinch: { index: number; offset: number[] }[] = [];
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const r = row + dr;
          if (r < 1 || r >= rows) continue;
          const index = r * columns + ((column + dc + columns) % columns);
          if (solver.isPinned(index)) continue;
          const q = solver.positions.subarray(index * 3, index * 3 + 3);
          solver.pin(index);
          pinch.push({ index, offset: [q[0] - p[0], q[1] - p[1], q[2] - p[2]] });
        }
      held = { kind: 'skirt', pinch, anchor: p, at: [...p], want: [...p], out: [(p[0] * 0.31) / ol, 0, p[2] / ol], unit: metresPerPixel, right: ray.right, up: ray.up };
      return 'skirt';
    }
    // On the leg: the garment where it covers, unless this is a hole in it; else the stocking.
    const leg = legs[best.index];
    const [u, v] = uvOf(leg, best.hit);
    const garment = garments[best.index];
    const spec = bottom.spec;
    const onGarment = !!garment && spec.kind === 'pants' && v >= vOf(spec.from) && !inHole(garment, u, v);
    const target = onGarment ? garment! : leg;
    held = { kind: 'leg', leg: target, u, v, start: offsetAt(target, u, v), out: outwardAt(target, u, v), unit: metresPerPixel / LT, right: ray.right, up: ray.up, engaged: false };
    return 'leg';
  };
  const drag = (dx: number, dy: number) => {
    if (!held) return;
    if (held.kind === 'skirt') {
      if (!skirt) return;
      const h = held;
      const w = [0, 1, 2].map((c) => h.right[c] * dx * h.unit - h.up[c] * dy * h.unit);
      const length = Math.hypot(w[0], w[1], w[2]);
      const towards = [0, 1, 2].map((c) => w[c] + h.out[c] * 0.23 * length);
      // A long skirt can be lifted farther: up to six tenths of its length.
      const most = Math.max(0.9, (TOP - (bottom.spec.kind === 'skirt' ? bottom.spec.hem : TOP)) * 0.6) * LT;
      const tl = Math.hypot(towards[0], towards[1], towards[2]),
        k = tl > most ? most / tl : 1;
      // Where the fingers are asked to be; each frame the pinch moves toward it, no faster than a hand.
      h.want = [0, 1, 2].map((c) => h.anchor[c] + towards[c] * k);
      return;
    }
    if (!held.engaged && Math.hypot(dx, dy) < 3) return;
    if (!held.engaged) {
      setGrip(held.leg, held.u, held.v, null);
      amount = Math.min(1, Math.hypot(held.start[0], held.start[1], held.start[2]) / (1.17 * held.leg.reach));
      speed = 0;
      held.engaged = true;
    }
    const h = held;
    // The pointer's travel, scaled to how far a full pull carries this surface.
    const w = [0, 1, 2].map((c) => h.start[c] / h.leg.reach + h.right[c] * dx * h.unit - h.up[c] * dy * h.unit);
    const outward = w[0] * h.out[0] + w[1] * h.out[1] + w[2] * h.out[2],
      bias = Math.hypot(Math.hypot(w[0], w[1], w[2]), outward) * 0.19;
    for (let c = 0; c < 3; c++) w[c] += h.out[c] * Math.max(0, bias - outward);
    const length = Math.hypot(w[0], w[1], w[2]);
    goal = clamp(length / 1.17, 0, 1.1);
    grip.direction = length > 1e-6 ? w.map((c) => c / length) : null;
    dirty = true;
  };
  const release = (lifted: boolean) => {
    if (!held) return;
    releaseSkirt();
    if (held.kind === 'leg' && held.engaged && !(lifted && goal >= rules.get(held.leg)!.tearAt)) goal = 0;
    held = null;
  };

  // --- each frame ---------------------------------------------------------------------------
  const timing = { cloth: 0, pull: 0, frames: 0 };
  const step = (delta: number) => {
    const dt = Math.min(delta, 0.04);
    const before = performance.now();
    if (skirt && held?.kind === 'skirt') {
      const h = held;
      const d = [0, 1, 2].map((c) => h.want[c] - h.at[c]),
        far = Math.hypot(d[0], d[1], d[2]),
        most = 1.6 * dt; // metres a second
      const k = far > most ? most / far : 1;
      for (let c = 0; c < 3; c++) h.at[c] += d[c] * k;
      for (const { index, offset } of h.pinch) skirt.cloth.solver.movePin(index, h.at[0] + offset[0], h.at[1] + offset[1], h.at[2] + offset[2]);
    }
    if (skirt) skirt.cloth.update(delta);
    const mid = performance.now();
    const holding = held?.kind === 'leg' && held.engaged,
      resting = !holding && goal === 0;
    const stiffness = resting ? 1080 : holding ? 370 : 196,
      damping = resting ? 48 : holding ? 35 : 19;
    const steps = Math.max(1, Math.ceil(dt * 200));
    for (let i = 0; i < steps; i++) {
      const h = dt / steps;
      speed += ((goal - amount) * stiffness - speed * damping) * h;
      amount += speed * h;
    }
    if (Math.abs(amount - goal) < 3e-4 && Math.abs(speed) < 0.004) {
      if (amount !== goal) dirty = true;
      amount = goal;
      speed = 0;
    }
    if (dirty || speed !== 0) {
      pull(grip.leg, clamp(amount, 0, 1.1), grip.u, grip.v, grip.direction);
      dirty = false;
    }
    const rule = rules.get(grip.leg);
    if (rule && goal >= rule.tearAt && amount >= rule.tearAt) tear();
    for (const s of surfaces()) {
      const list = tears.get(s);
      if (!list) continue;
      let opened = false;
      for (let i = 0; i < list.count; i++)
        if (list.shape[i * 4 + 3] < 1) {
          list.shape[i * 4 + 3] = Math.min(1, list.shape[i * 4 + 3] + dt * 4.2);
          opened = true;
        }
      if (opened) writeTears(s);
    }
    timing.cloth += mid - before;
    timing.pull += performance.now() - mid;
    timing.frames++;
  };

  dress(current, color);
  wear(bottom);
  built = true;

  return {
    legs,
    get type() {
      return current;
    },
    get color() {
      return color;
    },
    get bottom() {
      return bottom;
    },
    get held() {
      return held?.kind ?? null;
    },
    get amount() {
      return amount;
    },
    dress,
    wear,
    reset: () => wear(bottom),
    press,
    drag,
    release,
    step,
    stats: () => ({
      type: current.id,
      color,
      bottom: bottom.id,
      tears: surfaces().map((s) => tears.get(s)?.count ?? 0),
      frames: timing.frames,
      clothMs: +(timing.cloth / Math.max(1, timing.frames)).toFixed(3),
      pullMs: +(timing.pull / Math.max(1, timing.frames)).toFixed(3),
      amount: +amount.toFixed(3),
      inside: skirt ? skirt.cloth.solver.countInside() : 0,
      held: held?.kind ?? null,
      rows: UP,
      around: AROUND,
    }),
    cloth: () => {
      if (!skirt) return null;
      const info = skirt.cloth.solver.inspect() as any;
      return { maxStretch: +skirt.cloth.solver.measureStrain().toFixed(3), inside: info.inside, hands: info.hands, dropped: info.dropped };
    },
    hem: () => {
      if (!skirt) return null;
      const { columns, rows } = skirt,
        p = skirt.cloth.solver.positions;
      let y = 0,
        x = 0;
      for (let c = 0; c < columns; c++) {
        y += p[((rows - 1) * columns + c) * 3 + 1] / columns;
        x += p[((rows - 1) * columns + c) * 3] / columns;
      }
      return { y, x };
    },
    dispose: () => {
      releaseSkirt();
      held = null;
      undress();
      for (const leg of legs) {
        materials.get(leg)?.dispose();
        leg.hosiery.dispose();
        leg.skin.dispose();
      }
      materials.clear();
      tears.clear();
      rules.clear();
      for (const extra of extras) extra.destroy();
      skin.dispose();
    },
  };
}
