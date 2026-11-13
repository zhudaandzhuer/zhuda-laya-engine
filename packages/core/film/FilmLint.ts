/**
 * Advice for a film scene that is valid but will not look its best.
 * Validation refuses what cannot be built; this names what its author would
 * regret, each with the change that fixes it. Pure: no browser, no GPU.
 *
 * Every rule was a trap found by drawing scenes (see
 * docs/plans/records/quality-defaults). A rule earns its place only when it
 * names a visible defect and a concrete fix; taste is not linted.
 */
import {
  ZHUDA_FILM_ABSENT_LOOK,
  resolveZhudaFilmLook,
  type ZhudaFilmScene,
  type ZhudaFilmVec3,
} from './FilmScene.ts';
import { zhudaDecodeColor } from './ColorValues.ts';

export interface ZhudaFilmAdvice {
  /** Stable id of the rule (see `ZHUDA_FILM_LINT_RULES`). */
  rule: string;
  /** `warn`: a visible defect. `tip`: a likely improvement. */
  level: 'warn' | 'tip';
  /** Where in the scene, written like a validation path. */
  path: string;
  /** What is the matter, in one sentence. */
  message: string;
  /** The change that fixes it: a patch fragment where one exists. */
  fix: string;
}

export interface ZhudaFilmLintContext {
  /**
   * Tile size in metres of each texture recipe the host can bake, by name
   * (`tileMeters` of the recipe). Without it texture density is not judged.
   */
  tileMeters?: Readonly<Record<string, readonly [number, number]>>;
}

/** What each rule looks for. The ids are stable; new rules get new ids. */
export const ZHUDA_FILM_LINT_RULES: Readonly<Record<string, string>> = Object.freeze({
  'look.plain': 'A look without a preset: flat sky, no shadows, no HDR grade.',
  'look.no-grade': 'No grade: no tone mapping, bloom, ambient occlusion or edge smoothing.',
  'look.no-shadows': 'The sun shines but nothing casts a shadow.',
  'lightFog.dark-horizon': 'Ground fog far darker than the sky it meets: a dark band.',
  'sun.behind-camera': 'The sun is behind the camera: shadows fall out of sight.',
  'ambient.flat': 'Shadowed sides are lit by one flat colour.',
  'lights.unshadowed': 'Lamps are the key light and none casts a shadow.',
  'emission.no-bloom': 'A material brighter than white, with bloom off.',
  'emission.washes-out': 'A coloured lamp so bright that the lamp itself is drawn near-white.',
  'surface.in-ground-plane': 'Water or a reflector exactly in the plane of the ground.',
  'texture.density': 'A ground texture too coarse for a camera this close.',
  'texture.repeats': 'A ground texture repeated many times with every tile the same.',
});

const luminance = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const round = (value: number) => +value.toFixed(2);
const json = (value: unknown) => JSON.stringify(value);
/** Pixels per metre below which a surface a few metres from the camera reads as blurred. */
const COARSE_PX_PER_M = 200;
const WANTED_PX_PER_M = 256;
/**
 * Sun intensity times the luminance of its colour above which the sun carries
 * the scene: the day, dawn and dusk presets are above it (0.8 to 1.2), the
 * overcast sun and the night moon below (0.42 and 0.32).
 */
const SUN_IS_KEY = 0.5;

/**
 * Returns advice for `scene`, warnings first. The scene must already be valid
 * (`validateZhudaFilmScene` returned no issue). An empty list means none of
 * the known traps applies, not that the picture is good.
 */
export function lintZhudaFilmScene(
  scene: ZhudaFilmScene,
  context: ZhudaFilmLintContext = {},
): ZhudaFilmAdvice[] {
  const advice: ZhudaFilmAdvice[] = [];
  const add = (
    level: ZhudaFilmAdvice['level'],
    rule: string,
    path: string,
    message: string,
    fix: string,
  ) => advice.push({ rule, level, path, message, fix });
  const authored = scene.look ?? ZHUDA_FILM_ABSENT_LOOK;
  const look = resolveZhudaFilmLook(authored);
  const nodes = scene.nodes ?? [];
  const objects = nodes.filter((n) =>
    ['prop', 'box', 'lathe', 'extrude', 'model'].includes(n.type),
  );
  const sunLight = look.sun.intensity * luminance(look.sun.color);

  const plain = !authored.preset && !look.shadows && !look.atmosphere && !look.panorama;
  if (plain)
    add(
      'warn',
      'look.plain',
      'scene.look',
      'A look without a preset: a flat sky colour, no shadows and no HDR grade. This bare look exists for tests.',
      'look: { "preset": "day", "grade": {} }  (or dawn, dusk, night, overcast)',
    );
  else {
    if (authored.grade === undefined)
      add(
        'warn',
        'look.no-grade',
        'scene.look.grade',
        'No grade: the frame skips the HDR chain, so there is no tone mapping, bloom, ambient occlusion or edge smoothing, and light fog and water cannot be used.',
        'look: { "grade": {} }',
      );
    if (authored.shadows === undefined && !look.shadows && sunLight > 0.05 && objects.length)
      add(
        'warn',
        'look.no-shadows',
        'scene.look.shadows',
        'The sun shines but nothing casts a shadow: objects look detached from the ground.',
        'look: { "shadows": {} }',
      );
  }

  if (look.lightFog && typeof authored.lightFog === 'object' && authored.lightFog.color) {
    // What the fog would default to: the sky near the horizon of this look.
    const sky = resolveZhudaFilmLook({ ...authored, grade: {}, lightFog: {} });
    const horizon = (sky.lightFog as { color: ZhudaFilmVec3 }).color;
    // In light, as the thresholds were set: both are display values.
    const fog = luminance(zhudaDecodeColor(look.lightFog.color)),
      meets = luminance(zhudaDecodeColor(horizon));
    if (meets > 0.15 && fog < meets * 0.3)
      add(
        'warn',
        'lightFog.dark-horizon',
        'scene.look.lightFog.color',
        `The fog (luminance ${round(fog)}) is far darker than the sky it meets (${round(meets)}): it draws a dark band along the horizon.`,
        `remove lightFog.color (the default follows the sky), or use ${json(horizon.map(round))}`,
      );
  }

  const [ex, ey, ez] = scene.camera.eye,
    [tx, ty, tz] = scene.camera.target;
  const fx = tx - ex,
    fy = ty - ey,
    fz = tz - ez;
  const level = Math.hypot(fx, fz),
    reach = Math.hypot(fx, fy, fz);
  if (
    look.shadows &&
    sunLight > SUN_IS_KEY &&
    look.sun.elevationDeg < 75 &&
    objects.length &&
    level > 1e-6 &&
    Math.abs(fy) / reach < 0.8
  ) {
    // At azimuth a the light travels along (-sin a, -cos a) in X and Z.
    const a = (look.sun.azimuthDeg * Math.PI) / 180;
    const along = (fx * -Math.sin(a) + fz * -Math.cos(a)) / level;
    if (along > Math.cos((35 * Math.PI) / 180)) {
      const facing = (Math.atan2(-fx, -fz) * 180) / Math.PI;
      const turned = Math.round((((facing + 120) % 360) + 360) % 360);
      add(
        'tip',
        'sun.behind-camera',
        'scene.look.sun.azimuthDeg',
        'The sun shines from behind the camera: shadows fall out of sight behind what casts them and surfaces look flat.',
        `look: { "sun": { "azimuthDeg": ${turned} } }  (light from the side and a little ahead)`,
      );
    }
  }

  if (!plain && look.grade && !look.ambientGround && !look.environment && objects.length)
    add(
      'tip',
      'ambient.flat',
      'scene.look.ambientGround',
      'Shadowed sides are lit by one flat colour from every direction. Light thrown back from the ground gives them shape.',
      `look: { "ambientGround": ${json([0.75, 0.65, 0.5].map((k, i) => round(look.ambient[i] * k)))} }  (the ambient, dimmed and warmed by the ground)`,
    );

  const lamps = nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => node.type === 'light' && !(node as { fogOnly?: boolean }).fogOnly);
  if (
    lamps.length &&
    sunLight < SUN_IS_KEY &&
    objects.length &&
    !lamps.some(({ node }) => (node as { castsShadow?: boolean }).castsShadow)
  ) {
    const spot = lamps.find(({ node }) => (node as { kind?: string }).kind === 'spot');
    add(
      'tip',
      'lights.unshadowed',
      `scene.nodes[${(spot ?? lamps[0]).index}]`,
      'The lamps are the key light here and none of them casts a shadow: their light passes through walls and objects.',
      spot
        ? 'set "castsShadow": true on the spot light that carries the scene (one spot light and up to four point lights may cast)'
        : 'set "castsShadow": true on the lamp that carries the scene (up to four point lights and one spot light may cast)',
    );
  }

  if (look.grade && look.grade.bloom === 0)
    for (const [name, material] of Object.entries(scene.materials ?? {})) {
      const emission = (material as { emission?: readonly number[] }).emission;
      if (emission && Math.max(...emission) > 1) {
        add(
          'tip',
          'emission.no-bloom',
          `scene.materials.${name}.emission`,
          'This material is brighter than white but bloom is off: it shows as a flat patch, not as a light.',
          'look: { "grade": { "bloom": 0.2 } }',
        );
        break;
      }
    }

  // Emission is decoded like a colour: above 1 the light grows as the 2.4th
  // power, and tone mapping takes bright colour to white. Measured through the
  // grade: red [1, 0.07, 0.02] draws 212, 0, 0; at 2 it draws 255, 139, 41; at
  // 3 it draws 255, 208, 128.
  if (look.grade)
    for (const [name, material] of Object.entries(scene.materials ?? {})) {
      const emission = (material as { emission?: readonly number[] }).emission;
      if (!emission) continue;
      const most = Math.max(...emission);
      if (most > 2.5 && Math.min(...emission) < most * 0.1)
        add(
          'tip',
          'emission.washes-out',
          `scene.materials.${name}.emission`,
          'This bright, the lamp itself is drawn near-white: emission grows as the 2.4th power and tone mapping takes bright colour to white. Its colour then shows only in its bloom and halo.',
          `to see the colour on the lamp itself keep the brightest channel near 2: ${json(emission.map((v) => round((v * 2) / most)))}`,
        );
    }

  const ground = nodes.some((n) => n.type === 'ground');
  nodes.forEach((node, index) => {
    if ((node.type !== 'reflector' && node.type !== 'water') || !ground) return;
    if (Math.abs(node.position[1]) < 0.002)
      add(
        'warn',
        'surface.in-ground-plane',
        `scene.nodes[${index}].position`,
        'The surface lies exactly in the plane of the ground (y = 0): the two flicker against each other.',
        `"position": [${node.position[0]}, 0.01, ${node.position[2]}]  (a centimetre above the ground)`,
      );
  });

  // The ground: fine enough for a camera this close, and not a visible grid of tiles.
  if (context.tileMeters) {
    const judged = new Set<string>();
    nodes.forEach((node, index) => {
      if (node.type !== 'ground' || judged.has(node.material)) return;
      judged.add(node.material);
      const named = scene.materials?.[node.material] as
        | { recipe?: string; size?: number; variation?: number }
        | undefined;
      const recipe = named ? named.recipe : node.material;
      const tile = recipe ? context.tileMeters![recipe] : undefined;
      if (!tile) return;
      const size = named?.size ?? 256,
        metres = Math.max(tile[0], tile[1]),
        density = size / metres;
      // A camera within a few metres of the ground shows every texel of it.
      if (ey > 0 && ey <= 8 && density < COARSE_PX_PER_M) {
        const wanted = [512, 1024, 2048].find((s) => s / metres >= WANTED_PX_PER_M) ?? 2048;
        add(
          'tip',
          'texture.density',
          named ? `scene.materials.${node.material}.size` : `scene.nodes[${index}].material`,
          `The ground texture has ${Math.round(density)} pixels per metre and the camera is ${round(ey)} m above it: it reads as blurred up close.`,
          named
            ? `materials: { ${json(node.material)}: { "size": ${wanted} } }  (${Math.round(wanted / metres)} pixels per metre)`
            : `materials: { "ground": { "recipe": ${json(recipe)}, "size": ${wanted} } } and "material": "ground" on the node  (${Math.round(wanted / metres)} pixels per metre)`,
        );
      }
      const repeats = Math.round(Math.max(node.size[0] / tile[0], node.size[1] / tile[1]));
      if (repeats > 12 && !(named && (named.variation ?? 0) > 0))
        add(
          'tip',
          'texture.repeats',
          named ? `scene.materials.${node.material}.variation` : `scene.nodes[${index}].material`,
          `The ground texture repeats ${repeats} times across the ground: every tile is the same, which shows as a grid.`,
          named
            ? `materials: { ${json(node.material)}: { "variation": 0.5 } }`
            : `materials: { "ground": { "recipe": ${json(recipe)}, "variation": 0.5 } } and "material": "ground" on the node`,
        );
    });
  }

  return [...advice.filter((a) => a.level === 'warn'), ...advice.filter((a) => a.level === 'tip')];
}
