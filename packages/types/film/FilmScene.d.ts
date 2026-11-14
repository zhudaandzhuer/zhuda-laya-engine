// Generated from TypeScript source; run npm run types:generate.
import { type ZhudaTextureRecipe } from '../procedural/TextureRecipe.js';
import { type ZhudaDecalShape } from '../runtime3d/Decals.js';
import { type ZhudaAutoExposureOptions, type ZhudaDepthOfFieldOptions, type ZhudaMotionBlurOptions } from '../runtime3d/CameraEffects.js';
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
    /**
     * When the shadow maps are drawn again (default 'every'): 'every' frame;
     * 'interval': every `interval` frames, receivers keep the last maps in
     * between, so a moving caster's shadow follows it in steps; 'manual': when
     * the game asks (`ZhudaSceneLook.redrawShadows`) and when a new look
     * changes the sun or the shadow settings, for a still camera over still
     * casters. Stills and videos of a film draw them for every sample
     * whatever this says. The maps are kept for the look's camera: a water's
     * mirror left at its defaults reads them, and any other camera that draws
     * the scene with shadows of its own makes the look's camera draw its maps
     * again. See `ZhudaShadowUpdates`.
     */
    update?: 'every' | 'interval' | 'manual';
    /** Frames from one drawing to the next with `update: 'interval'`, 2..30 (default 3). */
    interval?: number;
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
     * `msaa` multisamples the HDR target (default); `fxaa` smooths edges in one
     * pass over the finished picture, far cheaper on a phone and a little
     * softer; `none` leaves edges as they fall. Stills and video average their
     * samples as well, with any value.
     */
    antialias?: 'msaa' | 'fxaa' | 'none';
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
    box?: {
        min: ZhudaFilmVec3;
        max: ZhudaFilmVec3;
    } | false;
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
export type ZhudaFilmMaterial = {
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
} | {
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
export type ZhudaFilmNode = {
    id: string;
    type: 'prop';
    /** Id in the prop registry the host was given. */
    prop: string;
    position: ZhudaFilmVec3;
    yawDeg?: number;
    seed?: number;
    params?: Record<string, unknown>;
} | {
    id: string;
    type: 'box';
    size: ZhudaFilmVec3;
    /** Centre of the underside. */
    position: ZhudaFilmVec3;
    yawDeg?: number;
    bevel?: number;
    /** A scene material, or a recipe name the host knows. */
    material: string;
} | {
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
} | {
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
} | {
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
} | {
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
} | {
    id: string;
    type: 'ground';
    /** Width (X) and depth (Z) in metres; the top surface sits at y = 0. */
    size: [number, number];
    material: string;
} | {
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
} | {
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
} | {
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
} | {
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
    follows?: {
        node: string;
        offset?: ZhudaFilmVec3;
    };
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
export declare function sampleZhudaFilmMotion(keys: readonly ZhudaFilmMotionKey[], time: number, baseYawDeg?: number): {
    position: ZhudaFilmVec3;
    yawDeg: number;
};
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
export declare const ZHUDA_FILM_LIMITS: Readonly<{
    nodes: 512;
    materials: 64;
    extent: 10000;
    idLength: 64;
    /**
     * Real-time lights a scene may ask for. The runtime must have been booted
     * with at least as many (`maxLights`; Laya's default is 32).
     */
    lights: 128;
    /** Point lights one `lightFog` can hold, fog-only lights included. */
    fogLights: 128;
    /** Point lights that may cast shadows (one spot light may as well). */
    pointShadows: 8;
    models: 64;
    /** Copies of one model node; a scene holds at most `placementsTotal` in all. */
    placements: 20000;
    placementsTotal: 60000;
}>;
/** What a scene that gives no `look` at all is drawn with. */
export declare const ZHUDA_FILM_ABSENT_LOOK: Readonly<ZhudaFilmLook>;
/** The bare look of a `look` without a preset (phase 1 behaviour). */
export declare const ZHUDA_FILM_DEFAULT_LOOK: Readonly<{
    sky: ZhudaFilmVec3;
    ambient: ZhudaFilmVec3;
    sun: Readonly<{
        azimuthDeg: 50;
        elevationDeg: 40;
        intensity: 1.2;
        color: ZhudaFilmVec3;
    }>;
}>;
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
/** Starting points for a time of day; any look field overrides them. */
export declare const ZHUDA_FILM_LOOK_PRESETS: Readonly<Record<ZhudaFilmLookPreset, PresetLook>>;
/** Lists every problem with a path; an empty list means the scene is valid. */
export declare function validateZhudaFilmScene(scene: unknown, context?: ZhudaFilmValidationContext): string[];
/** Throws with every problem listed; returns a detached copy otherwise. */
export declare function parseZhudaFilmScene(scene: unknown, context?: ZhudaFilmValidationContext): ZhudaFilmScene;
/** Applies a patch atomically: the input is untouched and an invalid result throws. */
export declare function applyZhudaFilmScenePatch(scene: ZhudaFilmScene, patch: ZhudaFilmScenePatch, context?: ZhudaFilmValidationContext): ZhudaFilmScene;
/** Camera with every default filled in. */
export declare function resolveZhudaFilmCamera(camera: ZhudaFilmCamera): Required<ZhudaFilmCamera>;
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
    lightFog: (Required<Omit<ZhudaFilmLightFog, 'shafts'>> & {
        shafts: Required<ZhudaFilmLightShafts> | false;
    }) | false;
    screenReflections: Required<ZhudaFilmScreenReflections> | false;
    autoExposure: Required<ZhudaAutoExposureOptions> | false;
    depthOfField: Required<ZhudaDepthOfFieldOptions> | false;
    motionBlur: Required<ZhudaMotionBlurOptions> | false;
    clouds: Required<ZhudaFilmClouds> | false;
    bounceLight: (Required<Pick<ZhudaFilmBounceLight, 'spacing' | 'strength' | 'visibility'>> & Pick<ZhudaFilmBounceLight, 'min' | 'max'>) | false;
    environment: Required<ZhudaFilmEnvironment> | false;
    panorama: Required<ZhudaFilmPanorama> | false;
}
export declare function resolveZhudaFilmLook(look?: ZhudaFilmLook): ZhudaResolvedFilmLook;
/** Checks a keyed camera move: two to 256 keys, strictly increasing times from 0. */
export declare function validateZhudaFilmCameraPath(keys: unknown): string[];
/**
 * Camera at time `t` along keyed shots, eased in and out between keys
 * (smoothstep). Times outside the path hold the first or last key.
 */
export declare function sampleZhudaFilmCameraPath(keys: readonly ZhudaFilmCameraKey[], t: number): Required<ZhudaFilmCamera>;
/**
 * What changing a running look from `from` to `to` has to rebuild, or `null`
 * when every difference can be set in place: the sun (direction, colour,
 * intensity), sky and ground light colours, the flat sky colour, the values
 * of the procedural sky and of distance fog, shadow distance, strength,
 * softness, resolution, cascades and how often they are drawn, the
 * strengths of the grade (exposure, contrast, saturation, bloom, ambient
 * occlusion, grain, vignette, fringe),
 * the light fog's density, falloff, height, colour, scatter and reach, the
 * strength and spread of its shafts, and the sun they follow. Anything else
 * names the first part that differs: switching shadows, sky, fog, grade,
 * light fog or sky-and-ground light on or off, switching bloom, ambient
 * occlusion, the lens finish or the shafts on or off, or the shafts'
 * distance, resolution or step count. `environment` and `panorama`
 * need assets or a capture; a running look cannot change them at all.
 */
export declare function zhudaFilmLookRebuildReason(from: ZhudaResolvedFilmLook, to: ZhudaResolvedFilmLook): 'environment' | 'panorama' | 'shadows' | 'atmosphere' | 'fog' | 'ambientGround' | 'grade' | 'lightFog' | 'screenReflections' | 'autoExposure' | 'depthOfField' | 'motionBlur' | 'clouds' | 'bounceLight' | null;
/**
 * The box a scene's bounce light fills by default: its objects and lights
 * (not the ground, a box used as ground, a reflector or water), widened by
 * 2 m around and 1.5 m above, down to the ground. Null when there is nothing
 * to light.
 */
export declare function zhudaFilmBounceBox(scene: ZhudaFilmScene): {
    min: ZhudaFilmVec3;
    max: ZhudaFilmVec3;
} | null;
export {};
