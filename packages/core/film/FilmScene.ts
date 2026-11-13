/**
 * Film scenes as data. An agent (or a person) authors a `ZhudaFilmScene`,
 * changes it with patches and renders it through the existing cinematic
 * capture. Everything here is pure and runs in Node, a Worker or a browser.
 *
 * The scene only names things the host already owns: registered procedural
 * props, texture recipes, flat PBR colours and logical asset ids (models and
 * lightmaps an `AssetProvider` delivers). It never carries code, file paths
 * or URLs.
 */
import { normalizeAssetId } from '../runtime3d/AssetProvider.ts';
import {
  validateZhudaTextureRecipe,
  type ZhudaTextureRecipe,
} from '../procedural/TextureRecipe.ts';
import {
  validateZhudaExtrude,
  validateZhudaLathe,
  validateZhudaSweep,
} from '../procedural/Geometry.ts';
import { validateZhudaDecal, type ZhudaDecalShape } from '../runtime3d/Decals.ts';
import {
  resolveZhudaAutoExposure,
  resolveZhudaDepthOfField,
  resolveZhudaMotionBlur,
  validateZhudaAutoExposure,
  validateZhudaDepthOfField,
  validateZhudaMotionBlur,
  type ZhudaAutoExposureOptions,
  type ZhudaDepthOfFieldOptions,
  type ZhudaMotionBlurOptions,
} from '../runtime3d/CameraEffects.ts';
import { resolveZhudaClouds, validateZhudaClouds } from '../runtime3d/Clouds.ts';

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
  /** Turns the sun about +Y, degrees. At 0 the light travels toward -Z. Defaults to the preset. */
  azimuthDeg?: number;
  /** Height above the horizon, degrees (0..90). Defaults to the preset. */
  elevationDeg?: number;
  intensity?: number;
  /**
   * Display RGB 0..1, as a colour picker shows it (sRGB): LayaAir decodes it,
   * so 0.5 gives 21 % of the light. `intensity` is linear.
   */
  color?: ZhudaFilmVec3;
}

export type ZhudaFilmLookPreset = 'day' | 'dawn' | 'dusk' | 'night' | 'overcast';

/** Sun shadows (native `DirectionLightCom` shadow maps). */
export interface ZhudaFilmShadows {
  /** Metres from the camera that receive shadows (default 60). */
  distance?: number;
  /** 'soft' filters the edge (default); 'hard' does not. */
  softness?: 'hard' | 'soft';
  /** 0..1 (default 1). */
  strength?: number;
  /** Shadow map size (default 2048). */
  resolution?: 1024 | 2048 | 4096;
  /**
   * Shadow map splits by distance: 1, 2 or 4 (default 2). More splits keep
   * shadows near the camera sharp when `distance` is long.
   */
  cascades?: 1 | 2 | 4;
}

/** Procedural sky (native `SkyProceduralMaterial`); the sun disk follows the sun. */
export interface ZhudaFilmAtmosphere {
  /** Air density, 0..5 (default 1); higher is redder near the horizon. */
  thickness?: number;
  /** Linear RGB 0..1. */
  skyTint?: ZhudaFilmVec3;
  /** Colour below the horizon, linear RGB 0..1. */
  groundTint?: ZhudaFilmVec3;
  /** 0..8 (default 1.3). */
  exposure?: number;
  /** Sun disk size, 0..1 (default 0.04). */
  sunSize?: number;
}

/** Linear distance fog (native scene fog). */
export interface ZhudaFilmFog {
  /** Linear RGB 0..1; defaults to the sky or horizon colour. */
  color?: ZhudaFilmVec3;
  /** Metres where fog starts and where it is complete. */
  start: number;
  end: number;
}

/** Filmic camera chain (existing `ZhudaFilmicPipeline`): HDR, ACES, bloom, AO. */
export interface ZhudaFilmGrade {
  /** Linear exposure multiplier, 0.05..16 (default 1). */
  exposure?: number;
  /** 0.5..2 (default 1). */
  contrast?: number;
  /** 0..2 (default 1). */
  saturation?: number;
  /** Bloom intensity, 0..2; 0 turns bloom off (default 0.1). */
  bloom?: number;
  /** Ambient occlusion intensity, 0..4; 0 turns it off (default 0.5). */
  ao?: number;
  /** Ambient occlusion radius in metres, 0.05..5 (default 0.5). */
  aoRadius?: number;
  /**
   * Edge smoothing of a frame that is drawn once (a preview, a running game):
   * `msaa` multisamples the HDR target (default), `none` leaves edges as they
   * fall. Stills and video average their samples as well, with either value.
   */
  antialias?: 'msaa' | 'none';
  /**
   * What a real camera adds, after tone mapping, each 0..1 and off by
   * default: film grain, darker corners and colour fringing at the corners.
   */
  grain?: number;
  vignette?: number;
  fringe?: number;
}

export interface ZhudaFilmLook {
  /**
   * A time of day. Every other field overrides the preset. Without a preset
   * the look is the plain one: flat sky colour, no shadows, sky or fog.
   */
  preset?: ZhudaFilmLookPreset;
  /** Flat background colour (used when there is no atmosphere), display RGB 0..1. */
  sky?: ZhudaFilmVec3;
  /**
   * Ambient light colour, display RGB 0..1 (sRGB, as a colour picker shows
   * it): 0.5 gives 21 % of the light. With `ambientGround` it is the light
   * from above.
   */
  ambient?: ZhudaFilmVec3;
  /**
   * Light the ground throws back, display RGB 0..1 like `ambient`. With it
   * the ambient light has a direction: `ambient` comes from above (the sky)
   * and this from below, so undersides and shadows take the colour of the
   * ground instead of one flat tone. The day, dawn, dusk and overcast presets
   * give one; `false` makes the ambient light one flat colour again.
   */
  ambientGround?: ZhudaFilmVec3 | false;
  sun?: ZhudaFilmSun;
  /** `false` turns sun shadows off. */
  shadows?: ZhudaFilmShadows | false;
  /** `false` uses the flat `sky` colour instead of a procedural sky. */
  atmosphere?: ZhudaFilmAtmosphere | false;
  fog?: ZhudaFilmFog | false;
  /** HDR tone-mapped rendering with bloom and ambient occlusion; off unless given. */
  grade?: ZhudaFilmGrade | false;
  /**
   * Fog near the ground that lights shine into: halos around lamps, haze
   * down a street. Needs `grade`; off unless given.
   */
  lightFog?: ZhudaFilmLightFog | false;
  /**
   * Reflections of what is on screen, on every surface: wet walls, props,
   * ground beyond a `reflector`. The whole view reflects alike, by Fresnel
   * (a forward renderer has no roughness buffer): use it for rain and for
   * polished places. Needs `grade`; off unless given.
   */
  screenReflections?: ZhudaFilmScreenReflections | false;
  /**
   * The picture's brightness follows what is in view, as eyes do: a dark
   * alley is lifted, a noon square dimmed, over a second or so. `true` takes
   * the defaults. In a film scene the adaptation is immediate (`speed` 0
   * unless given): a still does not depend on the frames before it. Needs
   * `grade`; off unless given.
   */
  autoExposure?: ZhudaAutoExposureOptions | boolean;
  /**
   * Depth of field in a picture drawn once (a game): what is nearer or
   * farther than `focusDistanceM` is blurred. A film still or video does not
   * need it: it gets depth of field from the camera's `fStop` by drawing many
   * samples. Needs `grade`; off unless given.
   */
  depthOfField?: ZhudaDepthOfFieldOptions | false;
  /**
   * Motion blur from the camera's own movement in a picture drawn once (a
   * game). `true` takes the defaults. A film video gets motion blur from its
   * samples. Needs `grade`; off unless given.
   */
  motionBlur?: ZhudaMotionBlurOptions | boolean;
  /**
   * A layer of clouds with depth, lit by the look's sun and sky (see
   * `ZhudaClouds`): `true` takes the defaults. They drift with shot time (a
   * game: with the time its look is updated by). Needs `grade`; off unless
   * given.
   */
  clouds?: ZhudaFilmClouds | boolean;
  /**
   * Light bounced once off the scene: probes on a grid over its objects
   * capture their surroundings when the scene is mounted, and light physically
   * based materials in place of the ambient light (a sunlit red wall tints
   * what faces it). Captured once: `setLook` does not update it. Off unless
   * given.
   */
  bounceLight?: ZhudaFilmBounceLight | false;
  /**
   * A photograph as the sky: a 2:1 panorama (equirectangular) named by
   * logical asset id. Replaces `atmosphere`. Off unless given.
   */
  panorama?: ZhudaFilmPanorama | false;
  /**
   * Captures the scene around one point and uses it as the environment:
   * glossy surfaces reflect it and surfaces without a lightmap get its
   * ambient light. Off unless given.
   */
  environment?: ZhudaFilmEnvironment | false;
}

/** A panoramic picture drawn as the sky (Laya's native `SkyPanoramicMaterial`). */
export interface ZhudaFilmPanorama {
  /** Logical id of a `.png` or `.jpg` picture twice as wide as it is tall. */
  asset: string;
  /** Brightness, 0..16 (default 1). */
  exposure?: number;
  /** Turns the picture about the vertical axis, degrees (default 0). */
  rotationDeg?: number;
}

/** One environment probe (see `ZhudaEnvironmentProbe`). */
export interface ZhudaFilmEnvironment {
  /** Where the surroundings are captured from: near the subject of the shot. */
  position: ZhudaFilmVec3;
  /** Scales reflections, 0..8 (default 1). */
  reflection?: number;
  /** Scales the ambient light on surfaces without a lightmap, 0..8 (default 1). */
  ambient?: number;
  /**
   * Take only reflections from the capture and keep `look.ambient` as the
   * ambient light (default false). For shots under trees or between walls,
   * where the captured ambient light is as dark as the surroundings.
   */
  reflectionOnly?: boolean;
  /**
   * The room the capture stands for, as the corners of a world box: a
   * reflection is then looked up where the reflected ray meets the box (what
   * is on a wall is mirrored at its place on the wall). For interiors and
   * courtyards. Off unless given: the surroundings are infinitely far.
   */
  box?: { min: ZhudaFilmVec3; max: ZhudaFilmVec3 } | false;
}

/** Height fog lit by the scene's `light` nodes (see `ZhudaLightFog`). */
export interface ZhudaFilmLightFog {
  /** Extinction per metre at `baseY`, 0..1 (default 0.012). */
  density?: number;
  /** Height over which the fog thins to 1/e, 0.5..1000 metres (default 8). */
  falloffMeters?: number;
  /** Height where the density equals `density` (default 0). */
  baseY?: number;
  /**
   * Colour of the fog itself, display RGB 0..1. Default: the colour the look's
   * sky has near the horizon (the preset's measured `horizon`, or `look.sky`
   * for a flat or panoramic sky), so that the fog melts into the sky.
   */
  color?: ZhudaFilmVec3;
  /** Strength of the glow around lights, 0..16 (default 1). */
  scatter?: number;
  /**
   * Beams of the sun or moon in the fog, cut by whatever stands in the light
   * (`look.sun` gives direction, colour and intensity); off unless given.
   */
  shafts?: ZhudaFilmLightShafts | false;
}

/** One copy of a model: x, y, z in metres, yaw in degrees, uniform scale. */
export type ZhudaFilmPlacement = [number, number, number, number, number];

export interface ZhudaFilmLightShafts {
  /** Brightness of the beams, 0..64 (default 1). */
  strength?: number;
  /** Forward scattering, 0..0.95 (default 0.6): beams are brightest looking toward the light. */
  anisotropy?: number;
  /** How far from the camera beams are drawn, 5..2000 metres (default 60). */
  distance?: number;
  /** Steps along each view ray, 8..96 (default 40). */
  steps?: number;
}

/** A baked recipe (a registered recipe name or an inline recipe) or a flat PBR colour. */
export type ZhudaFilmMaterial =
  | {
      recipe: string | ZhudaTextureRecipe;
      tint?: [number, number, number, number];
      /**
       * Bake size: 128, 256, 512, 1024 or 2048 (default 256). Baking runs on
       * the CPU when the scene is mounted and its cost grows with the square
       * of the size (about 2 s at 1024 and 6 s and 48 MB at 2048 for a
       * two-layer recipe): for the large sizes pass a `bakeCache` filled ahead.
       */
      size?: 128 | 256 | 512 | 1024 | 2048;
      /**
       * Slow changes of brightness across the surface, 0..1 (default 0), so
       * that a large floor or road does not show its tiles as a grid. The
       * changes are several tiles wide.
       */
      variation?: number;
    }
  | {
      color: ZhudaFilmVec3;
      roughness?: number;
      metallic?: number;
      /**
       * Self-lit colour (lamp heads, signs), display RGB 0..8. It is decoded
       * like any colour, so above 1 the light grows as the 2.4th power: 2 is
       * 5.3 times white, 4 is 28, 8 is 147. What exceeds the grade's range
       * (56 after exposure) is drawn at that limit, near-white.
       */
      emission?: ZhudaFilmVec3;
      /** A clear layer over the surface (lacquer, varnish, a wet sheen), 0..1 (default 0). */
      clearCoat?: number;
      /** Roughness of that layer, 0..1 (default 0.1). */
      clearCoatRoughness?: number;
      /**
       * How far the highlight is drawn out, 0..1 (default 0): brushed metal,
       * hair, satin. On a `lathe` it becomes a ring about the axis.
       */
      anisotropy?: number;
    };

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
      type: 'lathe';
      /**
       * A body of revolution about the vertical axis (a bollard, a barrel, a
       * dome, a bowl, a column): its outline as [radius, height] pairs in
       * metres, 2..256 of them, from the bottom up along the outside. A
       * hollow form goes on down the inside.
       */
      profile: [number, number][];
      /** Sides around the axis, 3..96 (default 24). */
      segments?: number;
      /** Where the axis meets height 0 of the outline. */
      position: ZhudaFilmVec3;
      yawDeg?: number;
      material: string;
    }
  | {
      id: string;
      type: 'extrude';
      /**
       * A flat outline on the ground raised to `height` (a kerb, steps, a
       * sign, a piece of wall): [x, z] pairs in metres about `position`,
       * 3..256 of them, in either direction. It may be concave; it must not
       * cross itself.
       */
      outline: [number, number][];
      /** Metres. */
      height: number;
      position: ZhudaFilmVec3;
      yawDeg?: number;
      material: string;
    }
  | {
      id: string;
      type: 'sweep';
      /**
       * A cross-section carried along a path (a kerb round a bend, a rail, a
       * cornice, a wall that follows a street): [across, up] pairs in metres,
       * 3..64 of them, in either direction; across is to the left of the way
       * the path runs. It may be concave; it must not cross itself.
       */
      profile: [number, number][];
      /** The line it is carried along, 2..1024 [x, y, z] points in metres about `position`. */
      path: ZhudaFilmVec3[];
      /** The path returns to its first point (default false). */
      closed?: boolean;
      position: ZhudaFilmVec3;
      yawDeg?: number;
      material: string;
    }
  | {
      id: string;
      type: 'decal';
      /**
       * A mark laid on a flat surface (a stain, a wet patch, a scorch, a
       * painted line): its centre on the surface, and its width and length
       * in metres. It does not wrap round a corner.
       */
      position: ZhudaFilmVec3;
      size: [number, number];
      /** The way the surface faces (default [0, 1, 0]: a floor). */
      normal?: ZhudaFilmVec3;
      /** Turns the mark about that direction, degrees. */
      angleDeg?: number;
      /** Display RGB 0..1 (default nearly black). */
      color?: ZhudaFilmVec3;
      /** How much of the surface it covers at its middle, 0..1 (default 0.8). */
      opacity?: number;
      /** 0..1 (default 0.6); low is wet or glossy. */
      roughness?: number;
      /** An oval with a broken edge (`blob`, default), a rectangle (`patch`) or a `ring`. */
      shape?: ZhudaDecalShape;
      /** Width of the soft edge as a share of the mark, 0..1 (default 0.35). */
      edge?: number;
      /** How ragged a blob's outline is, 0..1 (default 0.5). */
      ragged?: number;
      /** Which outline; the same seed gives the same mark (default 1). */
      seed?: number;
    }
  | {
      id: string;
      type: 'ground';
      /** Width (X) and depth (Z) in metres; the top surface sits at y = 0. */
      size: [number, number];
      material: string;
    }
  | {
      id: string;
      type: 'model';
      /** Logical id of a self-contained `.glb` the host's asset provider delivers. */
      asset: string;
      /** Where the model's origin goes. */
      position: ZhudaFilmVec3;
      yawDeg?: number;
      /** Uniform scale, 0.001..1000 (default 1). */
      scale?: number;
      /**
       * Logical id of a Radiance `.hdr` lightmap baked for this model: the
       * diffuse light reaching its surfaces (direct and bounced), laid out by
       * the meshes' second UV set. Replaces the flat ambient on this model.
       */
      lightmap?: string;
      /** Scales the lightmap, 0..16 (default 1). */
      lightmapIntensity?: number;
      /**
       * Logical id of a Radiance `.hdr` picture of the dominant light
       * direction per lightmap texel (`d * 0.5 + 0.5`, world space). With it,
       * normal maps show relief under baked light. Needs `lightmap`; the
       * model must not be turned (`yawDeg` 0).
       */
      lightmapDirection?: string;
      /** Plays a clip of the model as a function of shot time. */
      animation?: ZhudaFilmAnimation;
      /**
       * Moves the model during the shot: two or more keys, the first at time
       * 0, times increasing. Replaces `position` and `yawDeg` while it runs;
       * the model holds the last key afterwards. Not with a lightmap.
       */
      motion?: ZhudaFilmMotionKey[];
      /**
       * Copies of the model: one `[x, y, z, yawDeg, scale]` per copy, in
       * metres relative to `position` (a forest floor of ferns, rocks along a
       * bank, trees). The copies share the model's meshes and materials. With
       * `placements` the model is drawn only at those places. Not with a
       * lightmap, an animation or motion.
       */
      placements?: ZhudaFilmPlacement[];
      /**
       * Leaves let light through: the cut-out (alpha-tested) materials of the
       * model glow in their own colour when the sun or a lamp is behind
       * them. Opaque materials of the same model (bark) are unchanged.
       */
      translucent?: boolean;
      /**
       * Scales the light the model's own materials give off, 0..8 (default
       * 1): 0 puts out lit windows and lanterns for a daytime shot of a
       * model built for night, without another copy of the asset.
       */
      emission?: number;
    }
  | {
      id: string;
      type: 'reflector';
      /**
       * A horizontal rectangle that mirrors the scene above it (wet paving,
       * still water). `position` is its centre; `y` is the mirror height and
       * should sit a few millimetres above the surface it covers.
       */
      position: ZhudaFilmVec3;
      /** Width (X) and depth (Z) in metres. */
      size: [number, number];
      /** Brightness of the reflection, 0..4 (default 1). */
      strength?: number;
      /** Share of the surface that is standing water, 0..1 (default 0.45). */
      wetness?: number;
      /** Blur on damp areas, 0..1 (default 0.35). */
      roughness?: number;
      /** How much damp areas break the reflection up, 0..1 (default 0.4). */
      ripple?: number;
      /** Size of the puddle pattern in metres, 0.1..100 (default 3). */
      patternMeters?: number;
      /** Longer side of the mirrored picture (default 1024). */
      resolution?: 256 | 512 | 1024 | 2048;
      /**
       * Ids of model nodes the mirror must not draw. What lies below the
       * mirror (the ground it covers, whatever kind of node that is) is cut
       * from the mirrored view by itself; this is for things above it that
       * should not show in the reflection.
       */
      hides?: string[];
    }
  | {
      id: string;
      type: 'water';
      /**
       * Clear running water on a horizontal rectangle (see
       * `ZhudaWaterSurface`): the bed shows through, bent by the waves and
       * tinted with depth; the surface mirrors the scene, glints in the sun
       * (`look.sun`) and foams where it is shallow. `position` is the centre;
       * `y` is the water level. Banks and stones are models that cross it.
       * Needs `grade`. One per scene, and not together with a reflector.
       */
      position: ZhudaFilmVec3;
      /** Width (X) and depth (Z) in metres. */
      size: [number, number];
      /** Flow in metres per second along X and Z (default [0, 0.6]). */
      flow?: [number, number];
      /** Colour of deep water, display RGB 0..1 (default a green-blue). */
      color?: ZhudaFilmVec3;
      /** Metres of water at which the bed has faded to about a third, 0.05..100 (default 1.5). */
      clarity?: number;
      /** Length of the waves in metres, 0.05..50 (default 0.9). */
      waveMeters?: number;
      /** Steepness of the waves, 0..1 (default 0.35). */
      waves?: number;
      /** How much the bed is bent by the waves, 0..1 (default 0.4). */
      refraction?: number;
      /** Brightness of the mirrored scene, 0..4 (default 1). */
      reflection?: number;
      /** How much deep water shines in its own colour, 0..4 (default 0.25). */
      glow?: number;
      /** Depth under which the water foams, 0..2 metres (default 0.12); 0 is no foam. */
      foamDepth?: number;
      /** Longer side of the mirrored picture (default 1024). */
      resolution?: 256 | 512 | 1024 | 2048;
      /** Ids of model nodes the mirror must not draw (the bed, if it shows in the reflection). */
      hides?: string[];
    }
  | {
      id: string;
      type: 'light';
      /** Point lights shine all around; spot lights shine at `target`. */
      kind: 'point' | 'spot';
      position: ZhudaFilmVec3;
      /** Display RGB 0..1 (sRGB, as a colour picker shows it; default warm white). */
      color?: ZhudaFilmVec3;
      /** 0..20 (default 2). */
      intensity?: number;
      /** Metres the light reaches, 0.1..200 (default 12). */
      range?: number;
      /** Spot lights: the point they aim at. */
      target?: ZhudaFilmVec3;
      /** Spot lights: full cone angle, 1..179 degrees (default 60). */
      spotAngleDeg?: number;
      /**
       * The light casts shadows: one spot light and up to eight point lights
       * per scene may (more than four share their texture at half the
       * sharpness). A spot uses LayaAir's own shadow map. A point light's
       * surroundings are drawn once from the lamp (`ZhudaPointShadow`), and
       * again when its `range` or something that moves with time changes: a
       * lamp that `follows` a model casts from where the model has carried
       * it. Nothing closer to it than 0.5 m casts (the lamp's own head).
       */
      castsShadow?: boolean;
      /**
       * Keeps the light at `offset` (metres, in the model's own frame: +Z is
       * the model's front before `yawDeg`) from a `model` node, following its
       * `motion`. Point lights only; `position` is then ignored.
       */
      follows?: { node: string; offset?: ZhudaFilmVec3 };
      /**
       * The light only shines into `look.lightFog` and does not light
       * surfaces: for lamps whose light is already in a lightmap. Point
       * lights only; such lights do not count against the 32 real-time lights.
       */
      fogOnly?: boolean;
    };

/** A clip of a model, sampled at `offsetSec + shotTime * speed`. */
export interface ZhudaFilmAnimation {
  /** Name of an animation in the model file. */
  clip: string;
  /** Repeat the clip (default true); otherwise hold its last frame. */
  loop?: boolean;
  /** 0..8 (default 1). */
  speed?: number;
  /** Clip time at shot time 0, 0..3600 seconds (default 0). */
  offsetSec?: number;
}

export interface ZhudaFilmMotionKey {
  /** Seconds from the start of the shot. */
  time: number;
  position: ZhudaFilmVec3;
  /** Defaults to the previous key's yaw (the node's `yawDeg` for the first). */
  yawDeg?: number;
}

/**
 * Where a moving node is at `time`: linear between keys, yaw the short way
 * around, the first and last keys held outside their range.
 */
export function sampleZhudaFilmMotion(
  keys: readonly ZhudaFilmMotionKey[],
  time: number,
  baseYawDeg = 0,
): { position: ZhudaFilmVec3; yawDeg: number } {
  const yaws: number[] = [];
  keys.forEach((key, i) => yaws.push(key.yawDeg ?? (i ? yaws[i - 1] : baseYawDeg)));
  if (!(time > keys[0].time)) return { position: [...keys[0].position], yawDeg: yaws[0] };
  for (let i = 1; i < keys.length; i++) {
    if (time > keys[i].time) continue;
    const a = keys[i - 1],
      b = keys[i],
      u = (time - a.time) / (b.time - a.time);
    const turn = ((((yaws[i] - yaws[i - 1]) % 360) + 540) % 360) - 180;
    return {
      position: a.position.map((v, k) => v + (b.position[k] - v) * u) as ZhudaFilmVec3,
      yawDeg: yaws[i - 1] + turn * u,
    };
  }
  const last = keys.length - 1;
  return { position: [...keys[last].position], yawDeg: yaws[last] };
}

/** Screen-space reflections (see `ZhudaScreenReflections`). */
export interface ZhudaFilmScreenReflections {
  /** Brightness of the reflections, 0..4 (default 1). */
  strength?: number;
  /** How wet the surfaces are, 0..1: how much shows when seen head-on (default 0.5). */
  wetness?: number;
  /** Metres a reflected ray is followed, 1..200 (default 30). */
  distance?: number;
  /** Steps along the ray, 8..64 (default 32). */
  steps?: number;
  /**
   * How much of the sky shows where a reflected ray finds nothing and points
   * upward, 0..1 (default 0). Give it to wet ground under an open sky; leave
   * it at 0 indoors and under cover, where the sky would shine through.
   */
  sky?: number;
  /** The sky's colour for that, 0..1 (default: the sky's colour near the horizon). */
  skyColor?: ZhudaFilmVec3;
}

/** A layer of clouds (see `ZhudaClouds`); their light comes from the look. */
export interface ZhudaFilmClouds {
  /** How much of the sky is cloud, 0..1 (default 0.5). */
  coverage?: number;
  /** Height of the clouds' underside in metres, 50..20000 (default 1500). */
  baseMeters?: number;
  /** How thick the layer is in metres, 50..8000 (default 900). */
  thicknessMeters?: number;
  /** Size of a cloud in metres, 100..50000 (default 2600). */
  sizeMeters?: number;
  /** How dense the cloud is, 0..4 (default 1). */
  density?: number;
  /** The wind: metres a second along X and Z (default [8, 0]). */
  wind?: [number, number];
  /** Steps along each view ray, 8..64 (default 32). */
  steps?: number;
  /** How far clouds are drawn in metres, 1000..200000 (default 40000). */
  distanceMeters?: number;
}

/** Light bounced once off the scene (see `ZhudaProbeVolume`). */
export interface ZhudaFilmBounceLight {
  /** Metres between probes, 1..20 (default 3). */
  spacing?: number;
  /** Multiplies the bounced light, 0..4 (default 1). */
  strength?: number;
  /** Corners of the box the probes fill; by default the scene's objects and lights, widened by 2 m. */
  min?: ZhudaFilmVec3;
  max?: ZhudaFilmVec3;
  /**
   * Each probe also keeps how far it sees, and a surface takes light only
   * from probes that see it: a wall thinner than `spacing` then no longer
   * lets the light of one side through to the other. One more depth pass a
   * probe at mount. Default false.
   */
  visibility?: boolean;
}

export interface ZhudaFilmScene {
  schemaVersion: 1;
  id: string;
  camera: ZhudaFilmCamera;
  /**
   * Left out, the scene gets `ZHUDA_FILM_ABSENT_LOOK`: the day preset (sun,
   * shadows, sky, distance fog). An empty object is the bare look, kept for
   * tests: a flat sky colour and no shadows.
   */
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
  /** Asset ids the host can deliver. When omitted, asset ids are not checked. */
  assets?: readonly string[];
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
  /**
   * Real-time lights a scene may ask for. The runtime must have been booted
   * with at least as many (`maxLights`; Laya's default is 32).
   */
  lights: 128,
  /** Point lights one `lightFog` can hold, fog-only lights included. */
  fogLights: 128,
  /** Point lights that may cast shadows (one spot light may as well). */
  pointShadows: 8,
  models: 64,
  /** Copies of one model node; a scene holds at most `placementsTotal` in all. */
  placements: 20000,
  placementsTotal: 60000,
});

/** What a scene that gives no `look` at all is drawn with. */
export const ZHUDA_FILM_ABSENT_LOOK: Readonly<ZhudaFilmLook> = Object.freeze({ preset: 'day' });

/** The bare look of a `look` without a preset (phase 1 behaviour). */
export const ZHUDA_FILM_DEFAULT_LOOK = Object.freeze({
  sky: [0.55, 0.65, 0.78] as ZhudaFilmVec3,
  ambient: [0.3, 0.3, 0.32] as ZhudaFilmVec3,
  sun: Object.freeze({
    azimuthDeg: 50,
    elevationDeg: 40,
    intensity: 1.2,
    color: [1, 0.97, 0.92] as ZhudaFilmVec3,
  }),
});

type PresetLook = {
  sky: ZhudaFilmVec3;
  ambient: ZhudaFilmVec3;
  sun: Required<ZhudaFilmSun>;
  shadows: Required<ZhudaFilmShadows>;
  atmosphere: Required<ZhudaFilmAtmosphere>;
  fog: Required<ZhudaFilmFog> | false;
  /**
   * The preset's sky 5 to 10 degrees above the horizon, averaged around the
   * compass (measured from a draw of the preset in scene-linear light, kept
   * here as the display value that decodes to it). Ground fog takes this
   * colour by default so that it melts into the sky.
   */
  /** Light from the ground below (the presets with a sun high enough give one). */
  ambientGround?: ZhudaFilmVec3;
  horizon: ZhudaFilmVec3;
};
const shadows = (strength: number): Required<ZhudaFilmShadows> => ({
  distance: 60,
  softness: 'soft',
  strength,
  resolution: 2048,
  cascades: 2,
});

/** Starting points for a time of day; any look field overrides them. */
export const ZHUDA_FILM_LOOK_PRESETS: Readonly<Record<ZhudaFilmLookPreset, PresetLook>> =
  Object.freeze({
    day: {
      sky: [0.5, 0.66, 0.9],
      horizon: [0.642, 0.761, 0.891],
      // Sky light from above and the light the ground throws back: about a
      // third of the sun's on the ground, as under a clear sky.
      ambient: [0.62, 0.64, 0.7],
      ambientGround: [0.5, 0.47, 0.42],
      sun: { azimuthDeg: 40, elevationDeg: 55, intensity: 1.3, color: [1, 0.97, 0.92] },
      shadows: shadows(0.85),
      atmosphere: {
        thickness: 1,
        skyTint: [0.5, 0.5, 0.5],
        groundTint: [0.37, 0.35, 0.33],
        exposure: 1.3,
        sunSize: 0.04,
      },
      fog: { color: [0.72, 0.8, 0.9], start: 120, end: 600 },
    },
    dawn: {
      sky: [0.93, 0.6, 0.42],
      horizon: [0.832, 0.735, 0.381],
      ambient: [0.64, 0.58, 0.55],
      ambientGround: [0.46, 0.4, 0.36],
      sun: { azimuthDeg: -70, elevationDeg: 9, intensity: 1.35, color: [1, 0.72, 0.46] },
      shadows: shadows(0.8),
      atmosphere: {
        thickness: 1.9,
        skyTint: [0.55, 0.45, 0.45],
        groundTint: [0.3, 0.25, 0.22],
        exposure: 1.2,
        sunSize: 0.05,
      },
      fog: { color: [0.9, 0.66, 0.52], start: 60, end: 400 },
    },
    dusk: {
      sky: [0.82, 0.45, 0.35],
      horizon: [0.687, 0.517, 0.1],
      ambient: [0.58, 0.52, 0.55],
      ambientGround: [0.4, 0.34, 0.32],
      sun: { azimuthDeg: 110, elevationDeg: 6, intensity: 1.2, color: [1, 0.6, 0.38] },
      shadows: shadows(0.75),
      atmosphere: {
        thickness: 2.2,
        skyTint: [0.5, 0.4, 0.5],
        groundTint: [0.25, 0.2, 0.2],
        exposure: 1.1,
        sunSize: 0.06,
      },
      fog: { color: [0.7, 0.45, 0.4], start: 50, end: 350 },
    },
    night: {
      sky: [0.025, 0.04, 0.09],
      horizon: [0.156, 0.203, 0.306],
      ambient: [0.08, 0.1, 0.17],
      // Moonlight: a dim, cool key that still casts soft shadows.
      sun: { azimuthDeg: 125, elevationDeg: 38, intensity: 0.45, color: [0.62, 0.72, 1] },
      shadows: shadows(0.6),
      atmosphere: {
        thickness: 0.6,
        skyTint: [0.12, 0.16, 0.3],
        groundTint: [0.05, 0.06, 0.09],
        exposure: 0.35,
        sunSize: 0.02,
      },
      fog: { color: [0.05, 0.07, 0.12], start: 40, end: 260 },
    },
    overcast: {
      sky: [0.62, 0.66, 0.7],
      horizon: [0.742, 0.804, 0.715],
      ambient: [0.7, 0.71, 0.73],
      ambientGround: [0.52, 0.51, 0.49],
      sun: { azimuthDeg: 30, elevationDeg: 60, intensity: 0.55, color: [0.92, 0.94, 1] },
      shadows: shadows(0.3),
      atmosphere: {
        thickness: 1.4,
        skyTint: [0.55, 0.55, 0.58],
        groundTint: [0.4, 0.4, 0.42],
        exposure: 1,
        sunSize: 0,
      },
      fog: { color: [0.66, 0.69, 0.72], start: 30, end: 300 },
    },
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
    issues.push(`${path}: use RGB with three values between 0 and 1`);
}
function unknownKeys(
  value: Record<string, unknown>,
  allowed: string[],
  path: string,
  issues: string[],
) {
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) {
      const near = nearestName(key, allowed);
      issues.push(`${path}.${key}: unknown field` + (near ? ` (did you mean ${near}?)` : ''));
    }
}
/** The allowed name a mistyped one most likely meant, if any is close enough. */
function nearestName(name: string, allowed: readonly string[]): string | undefined {
  const a = name.toLowerCase();
  let best: string | undefined,
    bestDistance = Infinity;
  for (const candidate of allowed) {
    const b = candidate.toLowerCase();
    if (a === b) return candidate;
    // One is the other plus an ending: `shadow` for `shadows`, `lightfogs` for `lightFog`.
    if (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a))) {
      const extra = Math.abs(a.length - b.length);
      if (extra <= 2 && extra < bestDistance) [best, bestDistance] = [candidate, extra];
      continue;
    }
    if (Math.abs(a.length - b.length) > 2 || Math.min(a.length, b.length) < 4) continue;
    let row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const next = [i];
      for (let j = 1; j <= b.length; j++)
        next[j] = Math.min(
          row[j] + 1,
          next[j - 1] + 1,
          row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
      row = next;
    }
    if (row[b.length] <= 2 && row[b.length] < bestDistance)
      [best, bestDistance] = [candidate, row[b.length]];
  }
  return best;
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

function validateLook(
  look: unknown,
  path: string,
  issues: string[],
  context: ZhudaFilmValidationContext = {},
) {
  if (!object(look)) return void issues.push(`${path}: look object required`);
  unknownKeys(
    look,
    [
      'preset',
      'sky',
      'ambient',
      'ambientGround',
      'sun',
      'shadows',
      'atmosphere',
      'fog',
      'grade',
      'lightFog',
      'screenReflections',
      'autoExposure',
      'depthOfField',
      'motionBlur',
      'clouds',
      'bounceLight',
      'environment',
      'panorama',
    ],
    path,
    issues,
  );
  if (look.preset !== undefined && !Object.hasOwn(ZHUDA_FILM_LOOK_PRESETS, String(look.preset)))
    issues.push(`${path}.preset: use ${Object.keys(ZHUDA_FILM_LOOK_PRESETS).join(', ')}`);
  const range = (value: unknown, at: string, lo: number, hi: number) => {
    if (value !== undefined && !(finite(value) && value >= lo && value <= hi))
      issues.push(`${at}: use ${lo}..${hi}`);
  };
  if (look.shadows !== undefined && look.shadows !== false) {
    const sh = look.shadows;
    if (!object(sh)) issues.push(`${path}.shadows: object or false required`);
    else {
      unknownKeys(
        sh,
        ['distance', 'softness', 'strength', 'resolution', 'cascades'],
        `${path}.shadows`,
        issues,
      );
      range(sh.distance, `${path}.shadows.distance`, 5, 500);
      range(sh.strength, `${path}.shadows.strength`, 0, 1);
      if (sh.softness !== undefined && sh.softness !== 'hard' && sh.softness !== 'soft')
        issues.push(`${path}.shadows.softness: use hard or soft`);
      if (sh.cascades !== undefined && ![1, 2, 4].includes(sh.cascades as number))
        issues.push(`${path}.shadows.cascades: use 1, 2 or 4`);
      if (sh.resolution !== undefined && ![1024, 2048, 4096].includes(sh.resolution as number))
        issues.push(`${path}.shadows.resolution: use 1024, 2048 or 4096`);
    }
  }
  if (look.atmosphere !== undefined && look.atmosphere !== false) {
    const at = look.atmosphere;
    if (!object(at)) issues.push(`${path}.atmosphere: object or false required`);
    else {
      unknownKeys(
        at,
        ['thickness', 'skyTint', 'groundTint', 'exposure', 'sunSize'],
        `${path}.atmosphere`,
        issues,
      );
      range(at.thickness, `${path}.atmosphere.thickness`, 0, 5);
      range(at.exposure, `${path}.atmosphere.exposure`, 0, 8);
      range(at.sunSize, `${path}.atmosphere.sunSize`, 0, 1);
      if (at.skyTint !== undefined) colour(at.skyTint, `${path}.atmosphere.skyTint`, issues);
      if (at.groundTint !== undefined)
        colour(at.groundTint, `${path}.atmosphere.groundTint`, issues);
    }
  }
  if (look.fog !== undefined && look.fog !== false) {
    const fog = look.fog;
    if (!object(fog)) issues.push(`${path}.fog: object or false required`);
    else {
      unknownKeys(fog, ['color', 'start', 'end'], `${path}.fog`, issues);
      if (fog.color !== undefined) colour(fog.color, `${path}.fog.color`, issues);
      if (
        !(
          finite(fog.start) &&
          fog.start >= 0 &&
          finite(fog.end) &&
          fog.end > fog.start &&
          fog.end <= ZHUDA_FILM_LIMITS.extent
        )
      )
        issues.push(`${path}.fog: start >= 0 and end > start (metres)`);
    }
  }
  if (look.grade !== undefined && look.grade !== false) {
    const g = look.grade;
    if (!object(g)) issues.push(`${path}.grade: object or false required`);
    else {
      unknownKeys(
        g,
        [
          'exposure',
          'contrast',
          'saturation',
          'bloom',
          'ao',
          'aoRadius',
          'grain',
          'vignette',
          'fringe',
          'antialias',
        ],
        `${path}.grade`,
        issues,
      );
      range(g.exposure, `${path}.grade.exposure`, 0.05, 16);
      range(g.contrast, `${path}.grade.contrast`, 0.5, 2);
      range(g.saturation, `${path}.grade.saturation`, 0, 2);
      range(g.bloom, `${path}.grade.bloom`, 0, 2);
      range(g.ao, `${path}.grade.ao`, 0, 4);
      range(g.aoRadius, `${path}.grade.aoRadius`, 0.05, 5);
      range(g.grain, `${path}.grade.grain`, 0, 1);
      range(g.vignette, `${path}.grade.vignette`, 0, 1);
      range(g.fringe, `${path}.grade.fringe`, 0, 1);
      if (g.antialias !== undefined && g.antialias !== 'msaa' && g.antialias !== 'none')
        issues.push(`${path}.grade.antialias: use msaa or none`);
    }
  }
  if (look.lightFog !== undefined && look.lightFog !== false) {
    const f = look.lightFog;
    if (!object(f)) issues.push(`${path}.lightFog: object or false required`);
    else {
      unknownKeys(
        f,
        ['density', 'falloffMeters', 'baseY', 'color', 'scatter', 'shafts'],
        `${path}.lightFog`,
        issues,
      );
      if (f.shafts !== undefined && f.shafts !== false) {
        const s = f.shafts;
        if (!object(s)) issues.push(`${path}.lightFog.shafts: object or false required`);
        else {
          unknownKeys(
            s,
            ['strength', 'anisotropy', 'distance', 'steps'],
            `${path}.lightFog.shafts`,
            issues,
          );
          range(s.strength, `${path}.lightFog.shafts.strength`, 0, 64);
          range(s.anisotropy, `${path}.lightFog.shafts.anisotropy`, 0, 0.95);
          range(s.distance, `${path}.lightFog.shafts.distance`, 5, 2000);
          if (
            s.steps !== undefined &&
            !(Number.isInteger(s.steps) && (s.steps as number) >= 8 && (s.steps as number) <= 96)
          )
            issues.push(`${path}.lightFog.shafts.steps: use a whole number 8..96`);
        }
      }
      range(f.density, `${path}.lightFog.density`, 0, 1);
      range(f.falloffMeters, `${path}.lightFog.falloffMeters`, 0.5, 1000);
      range(f.baseY, `${path}.lightFog.baseY`, -ZHUDA_FILM_LIMITS.extent, ZHUDA_FILM_LIMITS.extent);
      range(f.scatter, `${path}.lightFog.scatter`, 0, 16);
      if (f.color !== undefined) colour(f.color, `${path}.lightFog.color`, issues);
      if (look.grade === undefined || look.grade === false)
        issues.push(`${path}.lightFog: needs grade (the fog is part of the HDR chain)`);
    }
  }
  if (look.screenReflections !== undefined && look.screenReflections !== false) {
    const s = look.screenReflections,
      at = `${path}.screenReflections`;
    if (!object(s)) issues.push(`${at}: object or false required`);
    else {
      unknownKeys(s, ['strength', 'wetness', 'distance', 'steps', 'sky', 'skyColor'], at, issues);
      range(s.sky, `${at}.sky`, 0, 1);
      if (s.skyColor !== undefined) vec3(s.skyColor, `${at}.skyColor`, issues, 1);
      range(s.strength, `${at}.strength`, 0, 4);
      range(s.wetness, `${at}.wetness`, 0, 1);
      range(s.distance, `${at}.distance`, 1, 200);
      const steps: unknown = s.steps;
      if (
        steps !== undefined &&
        !(typeof steps === 'number' && Number.isInteger(steps) && steps >= 8 && steps <= 64)
      )
        issues.push(`${at}.steps: use a whole number 8..64`);
      if (look.grade === undefined || look.grade === false)
        issues.push(`${at}: needs grade (the reflections are part of the HDR chain)`);
    }
  }
  const lens = (
    name: 'autoExposure' | 'depthOfField' | 'motionBlur' | 'clouds',
    validate: (options: any) => string[],
    plain: boolean,
  ) => {
    const value: unknown = look[name];
    if (value === undefined || value === false) return;
    const at = `${path}.${name}`;
    if (value === true && plain) {
      // The defaults.
    } else if (!object(value)) {
      issues.push(`${at}: ${plain ? 'object, true or false' : 'object or false'} required`);
      return;
    } else for (const issue of validate(value)) issues.push(`${at}.${issue}`);
    if (look.grade === undefined || look.grade === false)
      issues.push(`${at}: needs grade (it is part of the HDR chain)`);
  };
  lens('autoExposure', validateZhudaAutoExposure, true);
  lens('depthOfField', validateZhudaDepthOfField, false);
  lens('motionBlur', validateZhudaMotionBlur, true);
  lens('clouds', validateZhudaClouds, true);
  if (object(look.clouds))
    for (const key of ['sunToward', 'sunColor', 'skyColor'])
      if (key in look.clouds)
        issues.push(`${path}.clouds.${key}: comes from the look's sun and ambient light`);
  if (look.bounceLight !== undefined && look.bounceLight !== false) {
    const b = look.bounceLight,
      at = `${path}.bounceLight`;
    if (!object(b)) issues.push(`${at}: object or false required`);
    else {
      unknownKeys(b, ['spacing', 'strength', 'min', 'max', 'visibility'], at, issues);
      if (b.visibility !== undefined && typeof b.visibility !== 'boolean')
        issues.push(`${at}.visibility: true or false`);
      range(b.spacing, `${at}.spacing`, 1, 20);
      range(b.strength, `${at}.strength`, 0, 4);
      if ((b.min === undefined) !== (b.max === undefined))
        issues.push(`${at}: give min and max together`);
      else if (b.min !== undefined) {
        vec3(b.min, `${at}.min`, issues);
        vec3(b.max, `${at}.max`, issues);
        const low = b.min as number[],
          high = b.max as number[];
        if (
          Array.isArray(low) &&
          Array.isArray(high) &&
          !low.every((value, i) => typeof value === 'number' && value < high[i])
        )
          issues.push(`${at}.min: below max on every axis`);
      }
    }
  }
  if (look.panorama !== undefined && look.panorama !== false) {
    const p = look.panorama;
    if (!object(p)) issues.push(`${path}.panorama: object or false required`);
    else {
      unknownKeys(p, ['asset', 'exposure', 'rotationDeg'], `${path}.panorama`, issues);
      let id: string | undefined;
      try {
        id = normalizeAssetId(p.asset as string);
      } catch {
        // Reported below.
      }
      if (id === undefined || id !== p.asset || !/\.(png|jpe?g)$/i.test(id))
        issues.push(`${path}.panorama.asset: use a logical asset id ending in .png or .jpg`);
      else if (context.assets && !context.assets.includes(id))
        issues.push(`${path}.panorama.asset: unknown asset ${id}`);
      range(p.exposure, `${path}.panorama.exposure`, 0, 16);
      range(p.rotationDeg, `${path}.panorama.rotationDeg`, -360, 360);
    }
  }
  if (look.environment !== undefined && look.environment !== false) {
    const e = look.environment;
    if (!object(e)) issues.push(`${path}.environment: object or false required`);
    else {
      unknownKeys(
        e,
        ['position', 'reflection', 'ambient', 'reflectionOnly', 'box'],
        `${path}.environment`,
        issues,
      );
      if (e.reflectionOnly !== undefined && typeof e.reflectionOnly !== 'boolean')
        issues.push(`${path}.environment.reflectionOnly: true or false`);
      vec3(e.position, `${path}.environment.position`, issues);
      range(e.reflection, `${path}.environment.reflection`, 0, 8);
      range(e.ambient, `${path}.environment.ambient`, 0, 8);
      if (e.box !== undefined && e.box !== false) {
        const at = `${path}.environment.box`;
        if (!object(e.box)) issues.push(`${at}: use { min, max } or false`);
        else {
          unknownKeys(e.box, ['min', 'max'], at, issues);
          const before = issues.length;
          vec3(e.box.min, `${at}.min`, issues);
          vec3(e.box.max, `${at}.max`, issues);
          if (
            issues.length === before &&
            !(e.box.min as number[]).every((v, i) => v < (e.box as any).max[i])
          )
            issues.push(`${at}.min: below max on every axis`);
        }
      }
    }
  }
  if (look.sky !== undefined) colour(look.sky, `${path}.sky`, issues);
  if (look.ambient !== undefined) colour(look.ambient, `${path}.ambient`, issues);
  if (look.ambientGround !== undefined && look.ambientGround !== false)
    colour(look.ambientGround, `${path}.ambientGround`, issues);
  if (look.sun !== undefined) {
    const sun = look.sun;
    if (!object(sun)) return void issues.push(`${path}.sun: object required`);
    unknownKeys(sun, ['azimuthDeg', 'elevationDeg', 'intensity', 'color'], `${path}.sun`, issues);
    if (
      sun.azimuthDeg !== undefined &&
      !(finite(sun.azimuthDeg) && Math.abs(sun.azimuthDeg) <= 360)
    )
      issues.push(`${path}.sun.azimuthDeg: use -360..360`);
    if (
      sun.elevationDeg !== undefined &&
      !(finite(sun.elevationDeg) && sun.elevationDeg >= 0 && sun.elevationDeg <= 90)
    )
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
    unknownKeys(material, ['recipe', 'tint', 'size', 'variation'], path, issues);
    const variation: unknown = material.variation;
    if (
      variation !== undefined &&
      !(typeof variation === 'number' && variation >= 0 && variation <= 1)
    )
      issues.push(`${path}.variation: use 0..1`);
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
    if (
      material.size !== undefined &&
      ![128, 256, 512, 1024, 2048].includes(material.size as number)
    )
      issues.push(`${path}.size: use 128, 256, 512, 1024 or 2048`);
  } else if ('color' in material) {
    unknownKeys(
      material,
      [
        'color',
        'roughness',
        'metallic',
        'emission',
        'clearCoat',
        'clearCoatRoughness',
        'anisotropy',
      ],
      path,
      issues,
    );
    colour(material.color, `${path}.color`, issues);
    if (
      material.emission !== undefined &&
      !(
        Array.isArray(material.emission) &&
        material.emission.length === 3 &&
        material.emission.every((n) => finite(n) && n >= 0 && n <= 8)
      )
    )
      issues.push(`${path}.emission: use RGB with three values between 0 and 8`);
    for (const key of [
      'roughness',
      'metallic',
      'clearCoat',
      'clearCoatRoughness',
      'anisotropy',
    ] as const)
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
    case 'lathe':
      unknownKeys(
        node,
        ['id', 'type', 'profile', 'segments', 'position', 'yawDeg', 'material'],
        path,
        issues,
      );
      for (const issue of validateZhudaLathe({
        profile: node.profile as [number, number][],
        segments: node.segments as number | undefined,
      }))
        issues.push(`${path}.${issue}`);
      vec3(node.position, `${path}.position`, issues);
      yaw();
      usesMaterial();
      break;
    case 'extrude':
      unknownKeys(
        node,
        ['id', 'type', 'outline', 'height', 'position', 'yawDeg', 'material'],
        path,
        issues,
      );
      for (const issue of validateZhudaExtrude({
        outline: node.outline as [number, number][],
        height: node.height as number,
      }))
        issues.push(`${path}.${issue}`);
      vec3(node.position, `${path}.position`, issues);
      yaw();
      usesMaterial();
      break;
    case 'sweep':
      unknownKeys(
        node,
        ['id', 'type', 'profile', 'path', 'closed', 'position', 'yawDeg', 'material'],
        path,
        issues,
      );
      for (const issue of validateZhudaSweep({
        profile: node.profile as [number, number][],
        path: node.path as [number, number, number][],
        closed: node.closed as boolean | undefined,
      }))
        issues.push(`${path}.${issue}`);
      vec3(node.position, `${path}.position`, issues);
      yaw();
      usesMaterial();
      break;
    case 'decal': {
      const { id: _id, type: _type, ...decal } = node;
      for (const issue of validateZhudaDecal(decal as any)) issues.push(`${path}.${issue}`);
      break;
    }
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
    case 'model': {
      unknownKeys(
        node,
        [
          'id',
          'type',
          'asset',
          'position',
          'yawDeg',
          'scale',
          'lightmap',
          'lightmapIntensity',
          'lightmapDirection',
          'animation',
          'motion',
          'placements',
          'translucent',
          'emission',
        ],
        path,
        issues,
      );
      const asset = (key: 'asset' | 'lightmap' | 'lightmapDirection', extension: string) => {
        const value = node[key];
        let id: string | undefined;
        try {
          id = normalizeAssetId(value as string);
        } catch {
          // Reported below.
        }
        if (id === undefined || id !== value || !id.toLowerCase().endsWith(extension))
          issues.push(`${path}.${key}: use a logical asset id ending in ${extension}`);
        else if (context.assets && !context.assets.includes(id))
          issues.push(
            `${path}.${key}: unknown asset ${id}; known: ${
              context.assets.filter((name) => name.toLowerCase().endsWith(extension)).join(', ') ||
              'none'
            }`,
          );
      };
      asset('asset', '.glb');
      if (node.lightmap !== undefined) asset('lightmap', '.hdr');
      if (node.lightmapDirection !== undefined) {
        asset('lightmapDirection', '.hdr');
        if (node.lightmap === undefined) issues.push(`${path}.lightmapDirection: needs a lightmap`);
        if (node.yawDeg !== undefined && node.yawDeg !== 0)
          issues.push(`${path}.lightmapDirection: directions are in world space; keep yawDeg 0`);
      }
      vec3(node.position, `${path}.position`, issues);
      yaw();
      if (
        node.scale !== undefined &&
        !(finite(node.scale) && node.scale >= 0.001 && node.scale <= 1000)
      )
        issues.push(`${path}.scale: use 0.001..1000`);
      if (
        node.emission !== undefined &&
        !(finite(node.emission) && node.emission >= 0 && node.emission <= 8)
      )
        issues.push(`${path}.emission: use 0..8`);
      if (node.translucent !== undefined && typeof node.translucent !== 'boolean')
        issues.push(`${path}.translucent: true or false`);
      if (node.placements !== undefined) {
        const list = node.placements;
        if (!Array.isArray(list) || !list.length || list.length > ZHUDA_FILM_LIMITS.placements)
          issues.push(`${path}.placements: 1..${ZHUDA_FILM_LIMITS.placements} places required`);
        else {
          const bad = list.findIndex(
            (place) =>
              !Array.isArray(place) ||
              place.length !== 5 ||
              !place.every(finite) ||
              place.slice(0, 3).some((v) => Math.abs(v as number) > ZHUDA_FILM_LIMITS.extent) ||
              !((place[4] as number) >= 0.001 && (place[4] as number) <= 1000),
          );
          if (bad >= 0)
            issues.push(
              `${path}.placements[${bad}]: use [x, y, z, yawDeg, scale] with scale 0.001..1000`,
            );
        }
        for (const key of ['lightmap', 'lightmapDirection', 'animation', 'motion'] as const)
          if (node[key] !== undefined) issues.push(`${path}.placements: not with ${key}`);
      }
      if (node.animation !== undefined) {
        const a = node.animation;
        if (!object(a)) issues.push(`${path}.animation: object required`);
        else {
          unknownKeys(a, ['clip', 'loop', 'speed', 'offsetSec'], `${path}.animation`, issues);
          if (typeof a.clip !== 'string' || !a.clip || a.clip.length > 128)
            issues.push(`${path}.animation.clip: clip name required`);
          if (a.loop !== undefined && typeof a.loop !== 'boolean')
            issues.push(`${path}.animation.loop: true or false`);
          if (a.speed !== undefined && !(finite(a.speed) && a.speed >= 0 && a.speed <= 8))
            issues.push(`${path}.animation.speed: use 0..8`);
          if (
            a.offsetSec !== undefined &&
            !(finite(a.offsetSec) && a.offsetSec >= 0 && a.offsetSec <= 3600)
          )
            issues.push(`${path}.animation.offsetSec: use 0..3600`);
        }
      }
      if (node.motion !== undefined) {
        const keys = node.motion;
        if (!Array.isArray(keys) || keys.length < 2 || keys.length > 256)
          issues.push(`${path}.motion: use 2..256 keys`);
        else {
          keys.forEach((key, i) => {
            const at = `${path}.motion[${i}]`;
            if (!object(key)) return void issues.push(`${at}: key object required`);
            unknownKeys(key, ['time', 'position', 'yawDeg'], at, issues);
            const before = i ? (keys[i - 1] as { time?: unknown })?.time : undefined;
            if (
              !finite(key.time) ||
              (i === 0 ? key.time !== 0 : !(finite(before) && key.time > before)) ||
              key.time > 3600
            )
              issues.push(`${at}.time: start at 0 and increase (seconds, at most 3600)`);
            vec3(key.position, `${at}.position`, issues);
            if (key.yawDeg !== undefined && !(finite(key.yawDeg) && Math.abs(key.yawDeg) <= 3600))
              issues.push(`${at}.yawDeg: use -3600..3600`);
          });
          if (node.lightmap !== undefined)
            issues.push(`${path}.motion: a lightmapped model cannot move`);
        }
      }
      if (
        node.lightmapIntensity !== undefined &&
        !(
          node.lightmap !== undefined &&
          finite(node.lightmapIntensity) &&
          node.lightmapIntensity >= 0 &&
          node.lightmapIntensity <= 16
        )
      )
        issues.push(`${path}.lightmapIntensity: needs a lightmap, 0..16`);
      break;
    }
    case 'reflector': {
      unknownKeys(
        node,
        [
          'id',
          'type',
          'position',
          'size',
          'strength',
          'wetness',
          'roughness',
          'ripple',
          'patternMeters',
          'resolution',
          'hides',
        ],
        path,
        issues,
      );
      vec3(node.position, `${path}.position`, issues);
      if (
        !Array.isArray(node.size) ||
        node.size.length !== 2 ||
        !node.size.every((n) => finite(n) && n >= 0.1 && n <= 4000)
      )
        issues.push(`${path}.size: use [width, depth] between 0.1 and 4000 metres`);
      const ranges: [string, number, number][] = [
        ['strength', 0, 4],
        ['wetness', 0, 1],
        ['roughness', 0, 1],
        ['ripple', 0, 1],
        ['patternMeters', 0.1, 100],
      ];
      for (const [key, min, max] of ranges) {
        const value = node[key];
        if (value !== undefined && !(finite(value) && value >= min && value <= max))
          issues.push(`${path}.${key}: use ${min}..${max}`);
      }
      if (
        node.resolution !== undefined &&
        ![256, 512, 1024, 2048].includes(node.resolution as number)
      )
        issues.push(`${path}.resolution: use 256, 512, 1024 or 2048`);
      if (
        node.hides !== undefined &&
        !(Array.isArray(node.hides) && node.hides.every((id) => typeof id === 'string'))
      )
        issues.push(`${path}.hides: list model node ids`);
      break;
    }
    case 'water': {
      unknownKeys(
        node,
        [
          'id',
          'type',
          'position',
          'size',
          'flow',
          'color',
          'clarity',
          'waveMeters',
          'waves',
          'refraction',
          'reflection',
          'glow',
          'foamDepth',
          'resolution',
          'hides',
        ],
        path,
        issues,
      );
      vec3(node.position, `${path}.position`, issues);
      if (
        !Array.isArray(node.size) ||
        node.size.length !== 2 ||
        !node.size.every((n) => finite(n) && n >= 0.1 && n <= 4000)
      )
        issues.push(`${path}.size: use [width, depth] between 0.1 and 4000 metres`);
      if (
        node.flow !== undefined &&
        !(
          Array.isArray(node.flow) &&
          node.flow.length === 2 &&
          node.flow.every((n) => finite(n) && Math.abs(n) <= 20)
        )
      )
        issues.push(`${path}.flow: use [x, z] in metres per second, -20..20`);
      if (node.color !== undefined) colour(node.color, `${path}.color`, issues);
      const ranges: [string, number, number][] = [
        ['clarity', 0.05, 100],
        ['waveMeters', 0.05, 50],
        ['waves', 0, 1],
        ['refraction', 0, 1],
        ['reflection', 0, 4],
        ['glow', 0, 4],
        ['foamDepth', 0, 2],
      ];
      for (const [key, min, max] of ranges) {
        const value = node[key];
        if (value !== undefined && !(finite(value) && value >= min && value <= max))
          issues.push(`${path}.${key}: use ${min}..${max}`);
      }
      if (
        node.resolution !== undefined &&
        ![256, 512, 1024, 2048].includes(node.resolution as number)
      )
        issues.push(`${path}.resolution: use 256, 512, 1024 or 2048`);
      if (
        node.hides !== undefined &&
        !(Array.isArray(node.hides) && node.hides.every((id) => typeof id === 'string'))
      )
        issues.push(`${path}.hides: list model node ids`);
      break;
    }
    case 'light':
      unknownKeys(
        node,
        [
          'id',
          'type',
          'kind',
          'position',
          'color',
          'intensity',
          'range',
          'target',
          'spotAngleDeg',
          'fogOnly',
          'follows',
          'castsShadow',
        ],
        path,
        issues,
      );
      if (node.kind !== 'point' && node.kind !== 'spot')
        issues.push(`${path}.kind: use point or spot`);
      vec3(node.position, `${path}.position`, issues);
      if (node.follows !== undefined) {
        const f = node.follows;
        if (!object(f) || typeof f.node !== 'string')
          issues.push(`${path}.follows: use { node, offset }`);
        else {
          unknownKeys(f, ['node', 'offset'], `${path}.follows`, issues);
          if (f.offset !== undefined) vec3(f.offset, `${path}.follows.offset`, issues, 1000);
          if (node.kind !== 'point') issues.push(`${path}.follows: point lights only`);
        }
      }
      if (node.color !== undefined) colour(node.color, `${path}.color`, issues);
      if (
        node.intensity !== undefined &&
        !(finite(node.intensity) && node.intensity >= 0 && node.intensity <= 20)
      )
        issues.push(`${path}.intensity: use 0..20`);
      if (
        node.range !== undefined &&
        !(finite(node.range) && node.range >= 0.1 && node.range <= 200)
      )
        issues.push(`${path}.range: use 0.1..200 metres`);
      if (node.kind === 'spot') {
        vec3(node.target, `${path}.target`, issues);
        if (
          Array.isArray(node.target) &&
          Array.isArray(node.position) &&
          node.target.every((v, i) => v === (node.position as number[])[i])
        )
          issues.push(`${path}.target: must differ from position`);
      } else if (node.target !== undefined) issues.push(`${path}.target: only spot lights aim`);
      if (
        node.spotAngleDeg !== undefined &&
        !(
          node.kind === 'spot' &&
          finite(node.spotAngleDeg) &&
          node.spotAngleDeg >= 1 &&
          node.spotAngleDeg <= 179
        )
      )
        issues.push(`${path}.spotAngleDeg: spot lights only, 1..179`);
      if (
        node.fogOnly !== undefined &&
        !(typeof node.fogOnly === 'boolean' && node.kind === 'point')
      )
        issues.push(`${path}.fogOnly: point lights only, true or false`);
      if (node.castsShadow !== undefined && typeof node.castsShadow !== 'boolean')
        issues.push(`${path}.castsShadow: true or false`);
      else if (node.castsShadow && node.kind === 'point' && node.fogOnly === true)
        issues.push(
          `${path}.castsShadow: not on a point light that is fogOnly (it lights no surface)`,
        );
      break;
    default:
      issues.push(
        `${path}.type: use prop, box, lathe, extrude, sweep, decal, ground, model, reflector, water or light`,
      );
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
  if (scene.look !== undefined) validateLook(scene.look, 'scene.look', issues, context);
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
    const models = scene.nodes.filter((node) => object(node) && node.type === 'model').length;
    if (models > ZHUDA_FILM_LIMITS.models)
      issues.push(`scene.nodes: at most ${ZHUDA_FILM_LIMITS.models} models`);
    const modelIds = new Set(
      scene.nodes.flatMap((node) =>
        object(node) && node.type === 'model' && typeof node.id === 'string' ? [node.id] : [],
      ),
    );
    scene.nodes.forEach((node, i) => {
      if (!object(node) || node.type !== 'light' || !object(node.follows)) return;
      if (typeof node.follows.node === 'string' && !modelIds.has(node.follows.node))
        issues.push(
          `scene.nodes[${i}].follows.node: ${node.follows.node} is not a model node in this scene`,
        );
    });
    let reflectors = 0;
    scene.nodes.forEach((node, i) => {
      if (!object(node) || (node.type !== 'reflector' && node.type !== 'water')) return;
      if (++reflectors === 2)
        issues.push(
          `scene.nodes[${i}]: one reflector or water per scene (each is a second scene render)`,
        );
      const grade = object(scene.look) ? scene.look.grade : undefined;
      if (node.type === 'water' && (grade === undefined || grade === false))
        issues.push(`scene.nodes[${i}]: water needs look.grade (it reads the HDR scene behind it)`);
      if (Array.isArray(node.hides))
        for (const id of node.hides)
          if (typeof id === 'string' && !modelIds.has(id))
            issues.push(`scene.nodes[${i}].hides: ${id} is not a model node in this scene`);
    });
    const copies = scene.nodes.reduce(
      (sum: number, node) =>
        sum + (object(node) && Array.isArray(node.placements) ? node.placements.length : 0),
      0,
    );
    if (copies > ZHUDA_FILM_LIMITS.placementsTotal)
      issues.push(
        `scene.nodes: at most ${ZHUDA_FILM_LIMITS.placementsTotal} placements in all, got ${copies}`,
      );
    const lightNodes = scene.nodes.filter((node) => object(node) && node.type === 'light');
    // Only point lights shine into the fog; spot lights do not count here.
    if (
      lightNodes.filter((node) => (node as { kind?: unknown }).kind === 'point').length >
      ZHUDA_FILM_LIMITS.fogLights
    )
      issues.push(
        `scene.nodes: at most ${ZHUDA_FILM_LIMITS.fogLights} point lights including fog-only ones`,
      );
    const casting = (kind: string) =>
      lightNodes.filter((node) => {
        const light = node as { castsShadow?: unknown; kind?: unknown };
        return light.castsShadow === true && light.kind === kind;
      }).length;
    if (casting('spot') > 1) issues.push('scene.nodes: one spot light may cast shadows');
    if (casting('point') > ZHUDA_FILM_LIMITS.pointShadows)
      issues.push(
        `scene.nodes: at most ${ZHUDA_FILM_LIMITS.pointShadows} point lights may cast shadows`,
      );
    const lights = lightNodes.filter((node) => !(node as { fogOnly?: unknown }).fogOnly).length;
    if (lights > ZHUDA_FILM_LIMITS.lights)
      issues.push(`scene.nodes: at most ${ZHUDA_FILM_LIMITS.lights} real-time lights`);
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
    for (const key of [
      'sun',
      'shadows',
      'atmosphere',
      'fog',
      'grade',
      'lightFog',
      'screenReflections',
      'autoExposure',
      'depthOfField',
      'motionBlur',
      'clouds',
      'bounceLight',
      'environment',
      'panorama',
    ] as const) {
      const before = next.look?.[key],
        after = patch.look[key];
      if (typeof after === 'object' && typeof before === 'object' && after && before)
        (look as Record<string, unknown>)[key] = { ...before, ...after };
    }
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
  preset: ZhudaFilmLookPreset | null;
  sky: ZhudaFilmVec3;
  ambient: ZhudaFilmVec3;
  ambientGround: ZhudaFilmVec3 | false;
  sun: Required<ZhudaFilmSun>;
  shadows: Required<ZhudaFilmShadows> | false;
  atmosphere: Required<ZhudaFilmAtmosphere> | false;
  fog: Required<ZhudaFilmFog> | false;
  grade: Required<ZhudaFilmGrade> | false;
  lightFog:
    | (Required<Omit<ZhudaFilmLightFog, 'shafts'>> & {
        shafts: Required<ZhudaFilmLightShafts> | false;
      })
    | false;
  screenReflections: Required<ZhudaFilmScreenReflections> | false;
  autoExposure: Required<ZhudaAutoExposureOptions> | false;
  depthOfField: Required<ZhudaDepthOfFieldOptions> | false;
  motionBlur: Required<ZhudaMotionBlurOptions> | false;
  clouds: Required<ZhudaFilmClouds> | false;
  bounceLight:
    | (Required<Pick<ZhudaFilmBounceLight, 'spacing' | 'strength' | 'visibility'>> &
        Pick<ZhudaFilmBounceLight, 'min' | 'max'>)
    | false;
  environment: Required<ZhudaFilmEnvironment> | false;
  panorama: Required<ZhudaFilmPanorama> | false;
}

/**
 * Look with every value filled in: the preset (if any) first, then the
 * scene's own fields. Without a preset, shadows, atmosphere and fog stay off
 * unless the scene turns them on.
 */
/** Fills in the shaft defaults of a resolved light fog. */
function lightFogOf(fog: Required<ZhudaFilmLightFog> | false): ZhudaResolvedFilmLook['lightFog'] {
  if (!fog) return false;
  const shafts = fog.shafts;
  return {
    ...fog,
    shafts:
      shafts && typeof shafts === 'object'
        ? {
            strength: shafts.strength ?? 1,
            anisotropy: shafts.anisotropy ?? 0.6,
            distance: shafts.distance ?? 60,
            steps: shafts.steps ?? 40,
          }
        : false,
  };
}

export function resolveZhudaFilmLook(
  look: ZhudaFilmLook = ZHUDA_FILM_ABSENT_LOOK,
): ZhudaResolvedFilmLook {
  const preset = look.preset ? ZHUDA_FILM_LOOK_PRESETS[look.preset] : null;
  const d = ZHUDA_FILM_DEFAULT_LOOK;
  const base = preset ?? {
    sky: [...d.sky] as ZhudaFilmVec3,
    ambient: [...d.ambient] as ZhudaFilmVec3,
    sun: { ...d.sun, color: [...d.sun.color] as ZhudaFilmVec3 } as Required<ZhudaFilmSun>,
  };
  const sky = look.sky ?? ([...base.sky] as ZhudaFilmVec3);
  const merge = <T extends object>(
    value: T | false | undefined,
    fallback: Required<T> | false,
    blank: Required<T>,
  ): Required<T> | false => {
    if (value === false) return false;
    if (value === undefined) return fallback ? { ...fallback } : false;
    return { ...(fallback || blank), ...value } as Required<T>;
  };
  const atmosphere = merge<ZhudaFilmAtmosphere>(look.atmosphere, preset?.atmosphere ?? false, {
    thickness: 1,
    skyTint: [0.5, 0.5, 0.5],
    groundTint: [0.37, 0.35, 0.33],
    exposure: 1.3,
    sunSize: 0.04,
  });
  const fog = (() => {
    if (look.fog === false) return false as const;
    const from = look.fog ?? (preset?.fog || undefined);
    if (!from) return false as const;
    return {
      color: from.color ?? (preset?.fog ? preset.fog.color : sky),
      start: from.start,
      end: from.end,
    } as Required<ZhudaFilmFog>;
  })();
  // Fog saturates to its own colour toward the horizon, so by default it takes
  // the colour the sky has there. One fixed dark blue suited night only: by
  // day it drew a black band along the horizon.
  const horizon: ZhudaFilmVec3 =
    preset && atmosphere && !(look.panorama && typeof look.panorama === 'object')
      ? ([...preset.horizon] as ZhudaFilmVec3)
      : ([...sky] as ZhudaFilmVec3);
  return {
    preset: look.preset ?? null,
    sky,
    ambient: look.ambient ?? ([...base.ambient] as ZhudaFilmVec3),
    ambientGround:
      look.ambientGround === false
        ? false
        : look.ambientGround
          ? ([...look.ambientGround] as ZhudaFilmVec3)
          : preset?.ambientGround
            ? ([...preset.ambientGround] as ZhudaFilmVec3)
            : false,
    sun: {
      azimuthDeg: look.sun?.azimuthDeg ?? base.sun.azimuthDeg,
      elevationDeg: look.sun?.elevationDeg ?? base.sun.elevationDeg,
      intensity: look.sun?.intensity ?? base.sun.intensity,
      color: look.sun?.color ?? ([...base.sun.color] as ZhudaFilmVec3),
    },
    shadows: merge<ZhudaFilmShadows>(look.shadows, preset?.shadows ?? false, {
      distance: 60,
      softness: 'soft',
      strength: 1,
      resolution: 2048,
      cascades: 2,
    }),
    atmosphere,
    fog,
    grade: merge<ZhudaFilmGrade>(look.grade, false, {
      exposure: 1,
      contrast: 1,
      saturation: 1,
      bloom: 0.1,
      ao: 0.5,
      aoRadius: 0.5,
      grain: 0,
      vignette: 0,
      fringe: 0,
      antialias: 'msaa',
    }),
    lightFog: lightFogOf(
      merge<ZhudaFilmLightFog>(look.lightFog, false, {
        density: 0.012,
        falloffMeters: 8,
        baseY: 0,
        color: horizon,
        scatter: 1,
        shafts: false,
      }),
    ),
    screenReflections: merge<ZhudaFilmScreenReflections>(look.screenReflections, false, {
      strength: 1,
      wetness: 0.5,
      distance: 30,
      steps: 32,
      sky: 0,
      skyColor: horizon,
    }),
    autoExposure: look.autoExposure
      ? resolveZhudaAutoExposure(look.autoExposure === true ? {} : look.autoExposure)
      : false,
    depthOfField: look.depthOfField ? resolveZhudaDepthOfField(look.depthOfField) : false,
    motionBlur: look.motionBlur
      ? resolveZhudaMotionBlur(look.motionBlur === true ? {} : look.motionBlur)
      : false,
    clouds: look.clouds
      ? ((({ sunToward: _t, sunColor: _c, skyColor: _s, ...own }) => own)(
          resolveZhudaClouds(look.clouds === true ? {} : look.clouds),
        ) as Required<ZhudaFilmClouds>)
      : false,
    bounceLight: look.bounceLight
      ? {
          spacing: look.bounceLight.spacing ?? 3,
          strength: look.bounceLight.strength ?? 1,
          visibility: look.bounceLight.visibility ?? false,
          ...(look.bounceLight.min && look.bounceLight.max
            ? { min: [...look.bounceLight.min], max: [...look.bounceLight.max] }
            : {}),
        }
      : false,
    panorama:
      look.panorama && typeof look.panorama === 'object'
        ? {
            asset: look.panorama.asset,
            exposure: look.panorama.exposure ?? 1,
            rotationDeg: look.panorama.rotationDeg ?? 0,
          }
        : false,
    environment:
      look.environment && typeof look.environment === 'object'
        ? {
            position: [...look.environment.position] as ZhudaFilmVec3,
            reflection: look.environment.reflection ?? 1,
            ambient: look.environment.ambient ?? 1,
            reflectionOnly: look.environment.reflectionOnly ?? false,
            box: look.environment.box
              ? {
                  min: [...look.environment.box.min] as ZhudaFilmVec3,
                  max: [...look.environment.box.max] as ZhudaFilmVec3,
                }
              : false,
          }
        : false,
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

/**
 * What changing a running look from `from` to `to` has to rebuild, or `null`
 * when every difference can be set in place: the sun (direction, colour,
 * intensity), sky and ground light colours, the flat sky colour, the values
 * of the procedural sky and of distance fog, shadow distance, strength,
 * softness, resolution and cascades, the strengths of the grade (exposure,
 * contrast, saturation, bloom, ambient occlusion, grain, vignette, fringe),
 * the light fog's density, falloff, height, colour, scatter and reach, the
 * strength and spread of its shafts, and the sun they follow. Anything else
 * names the first part that differs: switching shadows, sky, fog, grade,
 * light fog or sky-and-ground light on or off, switching bloom, ambient
 * occlusion, the lens finish or the shafts on or off, or the shafts'
 * distance, resolution or step count. `environment` and `panorama`
 * need assets or a capture; a running look cannot change them at all.
 */
export function zhudaFilmLookRebuildReason(
  from: ZhudaResolvedFilmLook,
  to: ZhudaResolvedFilmLook,
):
  | 'environment'
  | 'panorama'
  | 'shadows'
  | 'atmosphere'
  | 'fog'
  | 'ambientGround'
  | 'grade'
  | 'lightFog'
  | 'screenReflections'
  | 'autoExposure'
  | 'depthOfField'
  | 'motionBlur'
  | 'clouds'
  | 'bounceLight'
  | null {
  const json = (value: unknown) => JSON.stringify(value);
  if (json(from.environment) !== json(to.environment)) return 'environment';
  if (json(from.panorama) !== json(to.panorama)) return 'panorama';
  if (json(from.bounceLight) !== json(to.bounceLight)) return 'bounceLight';
  if (!from.shadows !== !to.shadows) return 'shadows';
  if (!from.atmosphere !== !to.atmosphere) return 'atmosphere';
  if (!from.fog !== !to.fog) return 'fog';
  if (!from.ambientGround !== !to.ambientGround) return 'ambientGround';
  // The HDR chain is built with or without each effect; their strengths are set in place.
  const grade = (look: ZhudaResolvedFilmLook) =>
    look.grade
      ? json([
          look.grade.bloom > 0,
          look.grade.ao > 0,
          look.grade.grain > 0 || look.grade.vignette > 0 || look.grade.fringe > 0,
        ])
      : 'off';
  if (grade(from) !== grade(to)) return 'grade';
  // The fog's values are set in place; the light shafts' picture and loop are built.
  const fog = (look: ZhudaResolvedFilmLook) =>
    look.lightFog
      ? json(
          look.lightFog.shafts ? { ...look.lightFog.shafts, strength: 0, anisotropy: 0 } : 'plain',
        )
      : 'off';
  if (fog(from) !== fog(to)) return 'lightFog';
  // Built or not built; its values are set in place.
  if (!from.screenReflections !== !to.screenReflections) return 'screenReflections';
  if (!from.autoExposure !== !to.autoExposure) return 'autoExposure';
  if (!from.depthOfField !== !to.depthOfField) return 'depthOfField';
  if (!from.motionBlur !== !to.motionBlur) return 'motionBlur';
  if (!from.clouds !== !to.clouds) return 'clouds';
  return null;
}

/**
 * The box a scene's bounce light fills by default: its objects and lights
 * (not the ground, a box used as ground, a reflector or water), widened by
 * 2 m around and 1.5 m above, down to the ground. Null when there is nothing
 * to light.
 */
export function zhudaFilmBounceBox(
  scene: ZhudaFilmScene,
): { min: ZhudaFilmVec3; max: ZhudaFilmVec3 } | null {
  const low = [Infinity, Infinity, Infinity],
    high = [-Infinity, -Infinity, -Infinity];
  const take = (x: number, y: number, z: number, reach: number, height: number) => {
    low[0] = Math.min(low[0], x - reach);
    low[1] = Math.min(low[1], y);
    low[2] = Math.min(low[2], z - reach);
    high[0] = Math.max(high[0], x + reach);
    high[1] = Math.max(high[1], y + height);
    high[2] = Math.max(high[2], z + reach);
  };
  for (const node of scene.nodes) {
    const n = node as unknown as Record<string, any>;
    const [x, y, z] = (n.position ?? [0, 0, 0]) as number[];
    // A slab wider than 10 m and lower than 0.3 m is ground, not an object.
    if (n.type === 'box' && !(n.size[1] < 0.3 && Math.hypot(n.size[0], n.size[2]) > 10))
      take(x, y, z, Math.hypot(n.size[0], n.size[2]) / 2, n.size[1]);
    else if (n.type === 'lathe')
      take(
        x,
        y,
        z,
        Math.max(...n.profile.map((p: number[]) => p[0])),
        Math.max(...n.profile.map((p: number[]) => p[1])),
      );
    else if (n.type === 'extrude')
      take(x, y, z, Math.max(...n.outline.map((p: number[]) => Math.hypot(p[0], p[1]))), n.height);
    else if (n.type === 'sweep') {
      const reach = Math.max(...n.profile.map((p: number[]) => Math.hypot(p[0], p[1])));
      for (const point of n.path) take(x + point[0], y + point[1], z + point[2], reach, reach);
    }
    // Props and models: about the size of a shipping container around their place.
    else if (n.type === 'prop') take(x, y, z, 3.5, 3);
    else if (n.type === 'model') {
      const scale = n.scale ?? 1;
      for (const place of n.placements ?? [{ position: n.position }])
        if (place.position)
          take(place.position[0], place.position[1], place.position[2], 2 * scale, 3 * scale);
    } else if (n.type === 'light' && !n.fogOnly) take(x, y, z, 0.5, 0.5);
  }
  if (!Number.isFinite(low[0])) return null;
  const base = Math.min(0, low[1]);
  return {
    min: [low[0] - 2, base, low[2] - 2],
    max: [high[0] + 2, Math.max(high[1] + 1.5, base + 2), high[2] + 2],
  };
}
