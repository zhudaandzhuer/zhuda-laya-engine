/**
 * Neutral starter content for the procedural pipeline: a few texture
 * recipes, props and sounds that exercise every mechanism end to end.
 *
 * These are samples, not approved art. A game keeps its own recipes, props
 * and surface meanings in its own repository.
 */
import {
  createZhudaBoxMesh,
  createZhudaRodMesh,
  mergeZhudaMeshes,
  transformZhudaMesh,
} from '../core/procedural/Geometry.ts';
import type { ZhudaPropDefinition } from '../core/procedural/PropFactory.ts';
import type { ZhudaSynthRecipe } from '../core/procedural/SynthAudio.ts';
import type { ZhudaTextureRecipe } from '../core/procedural/TextureRecipe.ts';

export const ZHUDA_STARTER_TEXTURES: Record<string, ZhudaTextureRecipe> = {
  'painted-steel': {
    schemaVersion: 1,
    id: 'painted-steel',
    tileMeters: [1.2, 2.4],
    seed: 1,
    base: { color: [0.72, 0.72, 0.7], roughness: 0.5, metallic: 0 },
    layers: [
      { name: 'ribs', mask: { type: 'stripes', axis: 'u', count: 4 }, heightMm: 30 },
      {
        name: 'grime',
        mask: { type: 'fbm', frequency: [3, 2], octaves: 4, range: [0.5, 0.85] },
        color: [0.2, 0.19, 0.17],
        roughness: 0.85,
        opacity: 0.5,
      },
      {
        name: 'rust',
        mask: { type: 'cells', frequency: [5, 9], mode: 'id', range: [0.86, 0.96] },
        within: { type: 'fbm', frequency: 14, octaves: 3, range: [0.4, 0.7] },
        color: [0.2, 0.08, 0.03],
        roughness: 0.95,
        heightMm: 0.4,
      },
    ],
  },
  'galvanized-steel': {
    schemaVersion: 1,
    id: 'galvanized-steel',
    tileMeters: [1, 1],
    seed: 2,
    base: { color: [0.56, 0.58, 0.6], roughness: 0.42, metallic: 1 },
    layers: [
      {
        name: 'spangle',
        mask: { type: 'cells', frequency: 24, mode: 'id' },
        color: [0.7, 0.72, 0.74],
        roughness: 0.3,
        opacity: 0.35,
      },
      {
        name: 'weathering',
        mask: { type: 'fbm', frequency: 4, octaves: 5, range: [0.45, 0.8] },
        color: [0.4, 0.41, 0.42],
        roughness: 0.65,
        opacity: 0.6,
      },
    ],
  },
  concrete: {
    schemaVersion: 1,
    id: 'concrete',
    tileMeters: [3, 3],
    seed: 3,
    base: { color: [0.42, 0.41, 0.39], roughness: 0.88, metallic: 0 },
    layers: [
      {
        name: 'mottle',
        mask: { type: 'fbm', frequency: 3, octaves: 5 },
        color: [0.3, 0.29, 0.28],
        opacity: 0.45,
      },
      {
        name: 'pores',
        mask: { type: 'cells', frequency: 48, mode: 'distance', range: [0.18, 0.05] },
        color: [0.2, 0.2, 0.19],
        heightMm: -1.2,
        opacity: 0.7,
      },
      { name: 'grain', mask: { type: 'fbm', frequency: 64, octaves: 2 }, heightMm: 0.6 },
    ],
  },
  asphalt: {
    schemaVersion: 1,
    id: 'asphalt',
    tileMeters: [2, 2],
    seed: 4,
    base: { color: [0.05, 0.05, 0.055], roughness: 0.92, metallic: 0 },
    layers: [
      {
        name: 'aggregate',
        mask: { type: 'cells', frequency: 64, mode: 'distance', range: [0.45, 0.15] },
        color: [0.16, 0.16, 0.16],
        roughness: 0.8,
        heightMm: 1.5,
      },
      {
        name: 'wear',
        mask: { type: 'fbm', frequency: 2, octaves: 4, range: [0.5, 0.8] },
        color: [0.1, 0.1, 0.1],
        roughness: 0.7,
        opacity: 0.6,
      },
    ],
  },
  'wood-planks': {
    schemaVersion: 1,
    id: 'wood-planks',
    tileMeters: [1.2, 1.2],
    seed: 5,
    base: { color: [0.35, 0.22, 0.12], roughness: 0.75, metallic: 0 },
    layers: [
      {
        name: 'grain',
        mask: { type: 'fbm', frequency: [2, 48], octaves: 3 },
        color: [0.22, 0.13, 0.07],
        opacity: 0.6,
        heightMm: 0.5,
      },
      {
        name: 'gaps',
        mask: { type: 'stripes', axis: 'u', count: 8, profile: 'square', duty: 0.05 },
        color: [0.04, 0.03, 0.02],
        roughness: 0.95,
        heightMm: -4,
      },
    ],
  },
};

const container20: ZhudaPropDefinition<{ paint: string }> = {
  id: 'container20',
  // ISO 668 1CC: 6.058 m long, 2.591 m high, 2.438 m wide.
  size: [6.058, 2.591, 2.438],
  defaults: { paint: 'painted-steel' },
  build(params, random) {
    const [w, h, d] = [6.058, 2.591, 2.438];
    const posts = [];
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        posts.push(
          transformZhudaMesh(
            createZhudaBoxMesh({ width: 0.16, height: h, depth: 0.16, origin: 'bottom', bevel: 0.01 }),
            { position: [sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.08)] },
          ),
        );
    const bars = [-0.75, -0.3, 0.3, 0.75].map((z) =>
      createZhudaRodMesh([w / 2 + 0.02, 0.15, z], [w / 2 + 0.02, h - 0.15, z], 0.018, 6),
    );
    // A seeded offset keeps a yard of identical boxes from looking stamped.
    const slide = random.range(-0.03, 0.03);
    return {
      parts: [
        {
          name: 'shell',
          material: params.paint,
          mesh: createZhudaBoxMesh({
            width: w - 0.04,
            height: h - 0.04,
            depth: d - 0.04,
            origin: 'bottom',
            bevel: 0.02,
          }),
        },
        { name: 'corner-posts', material: 'galvanized-steel', mesh: mergeZhudaMeshes(posts)[0] },
        {
          name: 'lock-bars',
          material: 'galvanized-steel',
          mesh: transformZhudaMesh(mergeZhudaMeshes(bars)[0], { position: [0, 0, slide] }),
        },
      ],
      colliders: [{ min: [-w / 2, 0, -d / 2], max: [w / 2, h, d / 2], surface: 'metal' }],
      sockets: { roof: [0, h, 0], doors: [w / 2, h / 2, 0] },
    };
  },
};

const pallet: ZhudaPropDefinition<{ boards: number }> = {
  id: 'pallet',
  size: [1.2, 0.144, 1],
  defaults: { boards: 5 },
  build(params) {
    const boards = Math.max(3, Math.min(9, Math.round(params.boards)));
    const top = [];
    for (let i = 0; i < boards; i++)
      top.push(
        transformZhudaMesh(createZhudaBoxMesh({ width: 1.2, height: 0.022, depth: 0.1 }), {
          position: [0, 0.133, -0.45 + (0.9 * i) / (boards - 1)],
        }),
      );
    const blocks = [];
    for (const x of [-0.5, 0, 0.5])
      for (const z of [-0.45, 0, 0.45])
        blocks.push(
          transformZhudaMesh(createZhudaBoxMesh({ width: 0.14, height: 0.1, depth: 0.1 }), {
            position: [x, 0.072, z],
          }),
        );
    const skids = [-0.45, 0, 0.45].map((z) =>
      transformZhudaMesh(createZhudaBoxMesh({ width: 1.2, height: 0.022, depth: 0.1 }), {
        position: [0, 0.011, z],
      }),
    );
    return {
      parts: [
        { name: 'boards', material: 'wood-planks', mesh: mergeZhudaMeshes([...top, ...skids])[0] },
        { name: 'blocks', material: 'wood-planks', mesh: mergeZhudaMeshes(blocks)[0] },
      ],
      colliders: [{ min: [-0.6, 0, -0.5], max: [0.6, 0.144, 0.5], surface: 'wood' }],
    };
  },
};

const barrier: ZhudaPropDefinition<Record<string, never>> = {
  id: 'jersey-barrier',
  size: [3, 0.81, 0.6],
  defaults: {},
  build() {
    return {
      parts: [
        {
          name: 'foot',
          material: 'concrete',
          mesh: createZhudaBoxMesh({ width: 3, height: 0.25, depth: 0.6, origin: 'bottom', bevel: 0.02 }),
        },
        {
          name: 'stem',
          material: 'concrete',
          mesh: transformZhudaMesh(
            createZhudaBoxMesh({ width: 3, height: 0.56, depth: 0.24, origin: 'bottom', bevel: 0.02 }),
            { position: [0, 0.25, 0] },
          ),
        },
      ],
      colliders: [
        { min: [-1.5, 0, -0.3], max: [1.5, 0.25, 0.3], surface: 'concrete' },
        { min: [-1.5, 0.25, -0.12], max: [1.5, 0.81, 0.12], surface: 'concrete' },
      ],
    };
  },
};

export const ZHUDA_STARTER_PROPS = [container20, pallet, barrier] as const;

export const ZHUDA_STARTER_SOUNDS: Record<string, ZhudaSynthRecipe> = {
  'impact-metal': {
    schemaVersion: 1,
    id: 'impact-metal',
    durationSec: 0.35,
    seed: 1,
    layers: [
      { type: 'noise', color: 'white', gain: 1, envelope: { releaseSec: 0.03 }, highpassHz: 1500 },
      {
        type: 'tone',
        wave: 'sine',
        frequencyHz: 1240,
        endFrequencyHz: 1180,
        gain: 0.5,
        envelope: { attackSec: 0.001, releaseSec: 0.3 },
      },
      {
        type: 'tone',
        wave: 'triangle',
        frequencyHz: 410,
        gain: 0.35,
        envelope: { attackSec: 0.001, releaseSec: 0.18 },
      },
    ],
  },
  'footstep-concrete': {
    schemaVersion: 1,
    id: 'footstep-concrete',
    durationSec: 0.18,
    seed: 2,
    layers: [
      { type: 'noise', color: 'brown', gain: 1, envelope: { releaseSec: 0.06 }, lowpassHz: 700 },
      {
        type: 'noise',
        color: 'white',
        gain: 0.35,
        envelope: { releaseSec: 0.02 },
        highpassHz: 2500,
        startSec: 0.005,
      },
    ],
  },
};
