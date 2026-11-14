/**
 * The route from "a scene that looks good" to a verified result, as data.
 * The MCP tool `get_quality_route` returns it, docs/quality-route.md explains
 * it, a unit test keeps the two in step and `npm run verify:quality-route`
 * draws its example scenes. It states what is built; anything in `notYet` is
 * not, whatever a plan says.
 */
import {
  ZHUDA_FILM_LIMITS,
  ZHUDA_FILM_LINT_RULES,
  ZHUDA_FILM_LOOK_PRESETS,
  ZHUDA_STARTER_TEXTURES,
} from './runtime.mjs';

export const QUALITY_ROUTE_VERSION = 1;

const paint = (tint) => ({ recipe: 'painted-steel', tint, size: 512 });
const barriers = (z) =>
  [0, 1, 2, 3].map((i) => ({
    id: 'barrier' + i,
    type: 'prop',
    prop: 'jersey-barrier',
    position: [-6 + i * 3.4, 0, z],
    yawDeg: i % 2 ? 4 : -3,
  }));

/**
 * Two complete scenes built from the starter props and recipes alone, so they
 * mount on the bundled film host without any asset. Each gets no advice from
 * `lintZhudaFilmScene` and draws without a metrics flag.
 */
export const QUALITY_ROUTE_SCENES = Object.freeze({
  'day-yard': {
    schemaVersion: 1,
    id: 'route-day-yard',
    camera: { eye: [9, 2.4, 12], target: [-1, 1.6, -1], focalLengthMm: 32, fStop: 5.6 },
    look: {
      preset: 'day',
      // The camera looks toward -X and -Z: the sun comes from the side and a little ahead.
      sun: { azimuthDeg: 160, elevationDeg: 32 },
      // Sky light from above and the light the asphalt throws back from below.
      ambient: [0.62, 0.63, 0.67],
      ambientGround: [0.55, 0.52, 0.48],
      shadows: { distance: 70, resolution: 4096, cascades: 4 },
      grade: { exposure: 1.1, bloom: 0.2, ao: 0.7, aoRadius: 0.6 },
      lightFog: { density: 0.003, falloffMeters: 12 },
    },
    materials: {
      road: { recipe: 'asphalt', size: 1024, variation: 0.5 },
      red: paint([0.75, 0.22, 0.18, 1]),
      blue: paint([0.2, 0.35, 0.7, 1]),
    },
    nodes: [
      { id: 'ground', type: 'ground', size: [120, 120], material: 'road' },
      {
        id: 'c1',
        type: 'prop',
        prop: 'container20',
        position: [-4, 0, -3],
        seed: 1,
        params: { paint: 'red' },
      },
      {
        id: 'c2',
        type: 'prop',
        prop: 'container20',
        position: [3.4, 0, -4],
        yawDeg: 180,
        seed: 2,
        params: { paint: 'blue' },
      },
      { id: 'c3', type: 'prop', prop: 'container20', position: [-3.8, 2.591, -3], seed: 3 },
      ...barriers(5),
      { id: 'pallet1', type: 'prop', prop: 'pallet', position: [5, 0, 2.5], yawDeg: 12 },
      { id: 'pallet2', type: 'prop', prop: 'pallet', position: [6.4, 0, 2.2], yawDeg: -20 },
    ],
  },
  'night-wet': {
    schemaVersion: 1,
    id: 'route-night-wet',
    camera: { eye: [8, 2, 16], target: [-1, 1.5, 2], focalLengthMm: 30, fStop: 4 },
    look: {
      preset: 'night',
      ambient: [0.31, 0.35, 0.45],
      ambientGround: [0.19, 0.19, 0.22],
      shadows: { distance: 60, resolution: 2048, cascades: 2 },
      grade: { exposure: 1.9, bloom: 0.45, ao: 0.9, aoRadius: 0.6, grain: 0.15, vignette: 0.3 },
      lightFog: { density: 0.02, falloffMeters: 7, scatter: 1.5 },
    },
    materials: {
      road: { recipe: 'asphalt', size: 1024, variation: 0.5 },
      yellow: paint([0.85, 0.65, 0.15, 1]),
      'neon-warm': { color: [1, 0.5, 0.2], roughness: 0.4, emission: [8, 3.6, 1.2] },
      'neon-cool': { color: [0.3, 0.7, 1], roughness: 0.4, emission: [2, 5.5, 8] },
    },
    nodes: [
      { id: 'ground', type: 'ground', size: [120, 120], material: 'road' },
      { id: 'c1', type: 'prop', prop: 'container20', position: [-5, 0, -2], seed: 1 },
      {
        id: 'c2',
        type: 'prop',
        prop: 'container20',
        position: [2.4, 0, -3],
        yawDeg: 180,
        seed: 2,
        params: { paint: 'yellow' },
      },
      ...barriers(4),
      // Lamps: a point light for the glow and its halo in the fog, a small
      // emissive box so the lamp itself is seen (and mirrored).
      ...[
        [-7, 'neon-cool', [0.35, 0.75, 1]],
        [0, 'neon-warm', [1, 0.55, 0.25]],
        [7, 'neon-cool', [0.35, 0.75, 1]],
      ].flatMap(([x, material, color], i) => [
        {
          id: 'lamp' + i,
          type: 'light',
          kind: 'point',
          position: [x, 4.2, 1],
          color,
          intensity: 4.5,
          range: 14,
        },
        {
          id: 'bulb' + i,
          type: 'box',
          size: [0.5, 0.12, 0.12],
          position: [x, 4.2, 1],
          material,
        },
      ]),
      // The one light that casts shadows carries the scene.
      {
        id: 'key',
        type: 'light',
        kind: 'spot',
        position: [3, 9, 12],
        target: [0, 0, 3],
        spotAngleDeg: 55,
        color: [1, 0.9, 0.75],
        intensity: 5,
        range: 30,
        castsShadow: true,
      },
      // Wet ground: a centimetre above the ground it covers.
      {
        id: 'wet',
        type: 'reflector',
        position: [0, 0.01, 6],
        size: [50, 24],
        wetness: 0.5,
        roughness: 0.3,
        ripple: 0.35,
      },
    ],
  },
});

/** Tile sizes of the starter recipes, for `lintZhudaFilmScene`'s texture density rule. */
export const STARTER_TILE_METERS = Object.freeze(
  Object.fromEntries(
    Object.entries(ZHUDA_STARTER_TEXTURES).map(([name, recipe]) => [name, recipe.tileMeters]),
  ),
);

const STEPS = [
  {
    id: 'pick-the-surface',
    do: 'Decide what you are making. A still or a film: a film scene, authored as data through the film_* tools. A game: TypeScript on the public SDK, with the same look object.',
    api: 'film: film_scene_create → film_scene_apply → film_scene_preview. game: ZhudaSceneLook(scene3D, camera, look).',
    why: 'Both paths resolve the same `look`, so a look tuned in film previews carries over to the game unchanged.',
    check:
      'film: a session id and revision 0. game: the scaffold of `zhuda-laya-init` builds and passes its Doctor.',
  },
  {
    id: 'start-from-a-preset',
    do: 'Give the look a preset (day, dawn, dusk, night, overcast) and a grade. A scene with no look at all gets the day preset without a grade; a look without a preset is the bare look, which exists for tests.',
    api: 'look: { "preset": "day", "grade": {} }',
    why: 'The preset brings the sun, soft shadows, the procedural sky and distance fog. The grade is the HDR chain: tone mapping, bloom, ambient occlusion, multisampling. Light fog and water need it.',
    check: 'Advice holds neither look.plain nor look.no-grade.',
  },
  {
    id: 'physically-based-surfaces',
    do: 'Use physically based materials only. Film: recipes, sized for the camera. Game: createSurfaceMaterial, createZhudaProceduralMaterial, or Zhuda3D.createMaterial with type "pbr".',
    api: 'materials: { "road": { "recipe": "asphalt", "size": 1024, "variation": 0.5 } }; nodes: box, lathe { "profile": [[radius, height], ...] }, extrude { "outline": [[x, z], ...], "height" }',
    why: 'Zhuda3D.createMaterial defaults to Blinn-Phong, which ignores the sky, the environment and the HDR chain. A recipe bakes at 256 unless told otherwise: 128 pixels per metre on a two-metre tile.',
    check:
      'Advice holds neither texture.density nor texture.repeats. Aim for 256 pixels per metre or more on what the camera stands on; give a large floor some variation so its tiles do not read as a grid.',
  },
  {
    id: 'light-from-the-side',
    do: 'Turn the sun so that it comes from the side or from ahead of the camera, and say what the ground throws back.',
    api: 'look: { "sun": { "azimuthDeg": …, "elevationDeg": 25..45 }, "ambientGround": [r, g, b] }',
    why: 'With the sun behind the camera shadows fall out of sight and every surface is evenly lit. ambientGround lights shadowed sides from below instead of with one flat colour.',
    check:
      'Advice holds neither sun.behind-camera nor ambient.flat. In the preview shadows are in view.',
  },
  {
    id: 'shadows-that-carry',
    do: 'Day: four cascades at 4096 for anything wider than a room. Night: let the lamp that carries the scene cast shadows.',
    api: 'look.shadows: { "distance": 70, "resolution": 4096, "cascades": 4 }; light: { "kind": "point", "castsShadow": true }',
    why: 'Up to eight point lights and one spot light per scene can cast shadows. Without a shadow from the key light, light passes through walls.',
    check: 'Advice holds no lights.unshadowed. Objects touch the ground in the preview.',
  },
  {
    id: 'air',
    do: 'Add ground fog. Leave its colour alone unless you have a reason: it follows the sky. At night, lamps light it; with a low sun, add shafts.',
    api: 'look.lightFog: { "density": 0.003..0.02, "falloffMeters": 7..12, "shafts": { "strength": 0.8 } }',
    why: 'Fog gives depth and joins the ground to the sky. A fog colour far darker than the sky draws a dark band along the horizon.',
    check: 'Advice holds no lightFog.dark-horizon. The horizon has no band, dark or bright.',
  },
  {
    id: 'wet-ground-and-water',
    do: 'Wet ground: a reflector a centimetre above the ground. Running water: a water node at the water line.',
    api: 'node: { "type": "reflector", "position": [x, 0.01, z], "size": [w, d], "wetness": 0.5 }',
    why: 'What lies below the mirror is cut from the mirrored view, so a ground node, box or prop under it does not block the reflection. A scene holds one reflector or one water node. For rain on everything else (walls, props), add look.screenReflections: reflections of what is on screen, by Fresnel.',
    check: 'Advice holds no surface.in-ground-plane. Lamps and sky show in the surface.',
  },
  {
    id: 'baked-light-for-models',
    do: 'For light bounced off props, boxes, shapes and the ground give the look bounceLight. For static models, bake light in Blender and give the model its lightmap; mark lamps that are in the bake as fogOnly.',
    api: 'look: { "bounceLight": { "spacing": 3 } }; node: { "type": "model", "asset": "…glb", "lightmap": "….hdr", "lightmapDirection": "….hdr" }',
    why: 'There is no real-time global illumination. bounceLight is captured once, at mount, from probes over the scene (six small draws each); a lightmap is baked offline.',
    check: 'docs/film-scenes.md, "Baked light". The model needs a second UV set.',
  },
  {
    id: 'finish',
    do: 'Set exposure first, then bloom (0.4 at most), then grain and vignette lightly. Keep multisampling on.',
    api: 'look.grade: { "exposure": …, "bloom": 0.2, "ao": 0.7, "grain": 0.15, "vignette": 0.3 }',
    why: 'Exposure decides what bloom and grain have to work with. Multisampling smooths edges in a frame drawn once; without it a preview shows stair-steps.',
    check:
      'The preview metrics have no flag: underexposed, burnt-out, crushed, low-contrast, hard-edges.',
  },
  {
    id: 'look-at-it',
    do: 'Preview after every change. Read the advice and the metrics that come with the reply; compare two to four cameras in one review grid.',
    api: 'film_scene_apply { preview: true } · film_scene_preview · film_scene_review',
    why: 'Advice names scenes that are valid and still wrong. Metrics describe the frame in numbers for an agent that cannot judge a picture; `vivid` lists strong hues, and one the scene has no source for is a defect.',
    check: 'advice is empty, metrics.flags is empty, glErrors is absent.',
  },
  {
    id: 'hold-the-frame-budget',
    do: 'In a game, let ZhudaQualityGovernor decide the level and apply it to the look every frame it changes.',
    api: 'const level = governor.sample(dt * 1000); if (level !== undefined) look.setQuality(level as ZhudaLookQuality);',
    why: 'Level 2 drops ambient occlusion, level 1 the beams, lens finish and multisampling (edges are then smoothed in one pass), level 0 the HDR chain. Sky, ground light and distance fog stay.',
    check: 'A frame-time recording on the target device, in the consumer repository.',
  },
  {
    id: 'final-evidence',
    do: 'Film: render the still or the video as a job. Game: record a real browser report. Write what was not verified.',
    api: 'film_render_job { kind: "still", samples: 16 } · npm run verify in the consumer',
    why: 'A preview is one sample on one GPU. Declarations and unit tests prove no pixel.',
    check:
      'The file exists and is the frame you approved; the verification record lists unverified platforms.',
  },
];

/** The route; safe to serialise. */
export function getQualityRoute() {
  return {
    version: QUALITY_ROUTE_VERSION,
    document: 'docs/quality-route.md',
    goal: 'A 3D scene that reads as lit, grounded and deep, verified by drawn frames.',
    steps: STEPS.map((step) => ({ ...step })),
    defaults: [
      'Ground fog takes the colour of the sky near the horizon of the look.',
      'Mipmapped surface textures and the textures of loaded models use anisotropic filtering 8.',
      'A look with a grade multisamples the HDR target (grade.antialias "msaa").',
      'What lies below a reflector is cut from its mirrored view.',
    ],
    presets: Object.keys(ZHUDA_FILM_LOOK_PRESETS),
    limits: {
      realTimeLights: ZHUDA_FILM_LIMITS.lights,
      fogLights: ZHUDA_FILM_LIMITS.fogLights,
      shadowCastingSpots: 1,
      shadowCastingPointLights: ZHUDA_FILM_LIMITS.pointShadows,
      reflectorsOrWaterPerScene: 1,
      environmentProbes: 1,
      materialBakeSizes: [128, 256, 512, 1024, 2048],
      shadowResolutions: [1024, 2048, 4096],
      shadowCascades: [1, 2, 4],
      modelCopiesPerNode: ZHUDA_FILM_LIMITS.placements,
      nodes: ZHUDA_FILM_LIMITS.nodes,
    },
    adviceRules: { ...ZHUDA_FILM_LINT_RULES },
    metricsFlags: ['underexposed', 'burnt-out', 'crushed', 'low-contrast', 'hard-edges'],
    examples: Object.keys(QUALITY_ROUTE_SCENES),
    notYet: [
      'Real-time global illumination: bounceLight is captured at mount; a game can capture it again a few probes at a time (ZhudaProbeVolume.refresh), which follows a change in seconds, not frames. With bounceLight.visibility a thin wall no longer leaks.',
      "Reflections of things that are off screen: screenReflections shows what the frame holds and, with sky, the sky's colour where a ray finds nothing (it cannot tell a roof off screen from open sky). One planar mirror, one environment probe (environment.box looks it up at the room's walls).",
      'Shadows from more than eight point lights and one spot light (LayaAir 3.4.2 draws one spot shadow map).',
      "Motion blur of things that move by themselves: look.motionBlur smears only what the camera's own movement smears. look.depthOfField is one disc radius per pixel, without the shape of an aperture.",
      "Decals that wrap round geometry (a decal node lies on one plane); parallax (LayaAir's PBR shader takes no height map); the fine repeat inside one texture tile (variation hides the grid of tiles only). A sweep does not round its corners.",
      'Weather: clouds is one layer of one kind of cloud, without shadows on the ground or rain. Skin (subsurface light), hair strands, and cloth sheen in a film scene: a flat material has clearCoat and anisotropy only (game code has sheen, thin films and glass on createSurfaceMaterial type physical).',
    ],
    evidence: {
      rule: 'Desktop WebGL frames, and the same checks on desktop WebGPU through npm run verify:film-webgpu (Apple M4). Phones and mini-game hosts need their own records.',
      commands: [
        'npm run verify:quality-route',
        'npm run verify:film-remount',
        'npm run verify:film-highlights',
        'npm run verify:film-reflections',
        'npm run verify:film-variation',
        'npm run verify:film-point-shadow',
        'npm run verify:film-shapes',
        'npm run verify:film-colours',
        'npm run verify:film-bounce',
        'npm run verify:film-look',
        'npm run verify:film-fog',
        'npm run verify:film-reflector',
      ],
    },
  };
}
