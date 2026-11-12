# Film scenes for agents

An agent builds a film scene as data, changes it under revision checks, looks
at the result and renders final stills or MP4, without writing engine code.
The workflow follows the agent loop of
[67js](https://github.com/codepawl/67.js) (MIT); the implementation is our
own, on the Laya-backed renderer and the existing
[cinematic capture](cinematics.md). No 67js source is included.

Every image, from a one-sample preview to a final 4K frame, goes through
`ZhudaCinematicCapture` with a physical lens, so what the agent previews is
what the job renders, only with fewer samples.

Everything is drawn by Laya 3.4.2: the scene through `Laya.Scene3D` and an
offscreen `RenderTexture`, the review sheet through `Laya.Sprite`,
`Laya.Text` and `drawToRenderTexture2D`. The page returns raw pixels and the
Node side encodes PNG; no DOM canvas, second renderer or extra
`AudioContext` is involved. A review cell is pixel-identical to a single
preview of the same camera (checked by `verify:film`).

## Start the MCP server

```sh
npx zhuda-laya-mcp --film-output ./films
```

Film scenes are drawn with WebGL by default. `--film-renderer webgpu` (or
`ZHUDA_FILM_RENDERER=webgpu`) draws them with Laya's WebGPU backend instead:
the same scenes, tools and capture path, on the `3d-gltf-webgpu` bundle. It
needs a hardware WebGPU adapter and fails rather than falling back; a shader
or pipeline the device rejects fails the call with the device's message.
Pixels differ slightly between the backends, so compare images within one.
`npm run verify:film-webgpu` runs every film verification on WebGPU.

The server needs a local Chrome (set `CHROME_BIN` if it is not in the usual
place) and, for MP4, `ffmpeg` and `ffprobe`. The browser starts on the first
image request and closes with the server. Render jobs write only into the
`--film-output` directory and never overwrite a file.

## The loop

1. `film_scene_create` with a scene. The reply lists the props and recipes the
   host can build.
2. `film_scene_preview` returns a PNG of the current revision.
3. `film_scene_apply` with `expectedRevision` and a patch. Add `preview: true`
   to get the new image in the same call. A stale revision or an invalid change
   is refused and the scene stays as it was.
4. `film_scene_review` puts one to four labelled shots of one revision into a
   single PNG, for example wide, side, low and top.
5. `film_render_job` with `kind: "still"` (anti-aliasing and depth of field,
   16 samples by default) or `kind: "video"` along a camera path.

`film_scene_get` reads the scene and its revision; `film_scene_close` discards
the session. Sessions hold data only and are dropped least recently used first
when more than 16 are open.

## Scene format

```json
{
  "schemaVersion": 1,
  "id": "container-yard",
  "camera": { "eye": [11, 5.5, 14], "target": [0, 1.4, 0], "focalLengthMm": 35, "fStop": 4 },
  "look": {
    "sky": [0.55, 0.65, 0.78],
    "ambient": [0.3, 0.3, 0.32],
    "sun": { "azimuthDeg": -50, "elevationDeg": 35, "intensity": 1.3 }
  },
  "materials": {
    "red-paint": { "recipe": "painted-steel", "tint": [0.75, 0.25, 0.2, 1] },
    "plaster": { "color": [0.8, 0.78, 0.72], "roughness": 0.9 }
  },
  "nodes": [
    { "id": "ground", "type": "ground", "size": [80, 80], "material": "asphalt" },
    { "id": "c1", "type": "prop", "prop": "container20", "position": [0, 0, 0], "seed": 1 },
    {
      "id": "c2",
      "type": "prop",
      "prop": "container20",
      "position": [0, 0, 3.2],
      "yawDeg": 180,
      "params": { "paint": "red-paint" }
    },
    {
      "id": "wall",
      "type": "box",
      "size": [6, 2.4, 0.3],
      "position": [0, 0, -6],
      "material": "plaster"
    }
  ]
}
```

- Units are metres and degrees; Y is up and the ground top is at y = 0.
- `camera`: `eye` and `target`; `focalLengthMm` (default 35, full-frame
  equivalent), `fStop` (default 8) and `focusDistanceM` (default: the
  eye-target distance) drive depth of field in final renders.
- `look`: colours are linear RGB 0..1. The sun turns about +Y by `azimuthDeg`
  (at 0 it travels toward -Z) and rises by `elevationDeg`.
- `materials`: a baked [texture recipe](procedural-assets.md) by name or
  inline, with optional `tint` and bake `size`, or a flat PBR `color`. A node
  may also name a host recipe directly (`"material": "asphalt"`).
- `nodes`: `prop` places a registered procedural prop (its `params` and `seed`
  as in the prop factory); `box` is a box resting on `position`; `ground` is a
  plane at y = 0. Ids are unique; unknown fields are rejected.

Props are merged into one mesh per material, so a yard of containers costs a
handful of draws.

A patch has `camera` and `look` (merged), `materials` (a `null` value removes
one), `remove` (node ids, applied first) and `upsert` (nodes replaced by id or
added). The whole result is validated before it is accepted.

## Look: time of day, shadows, sky, fog and lights

`look.preset` picks a time of day (`day`, `dawn`, `dusk`, `night`,
`overcast`). Every other look field overrides the preset; a scene without a
preset keeps the plain look (flat sky colour, no shadows, sky or fog).

```json
"look": {
  "preset": "night",
  "sun": { "elevationDeg": 30 },
  "shadows": { "softness": "soft", "distance": 60 },
  "atmosphere": { "thickness": 0.6, "exposure": 0.4 },
  "fog": { "color": [0.05, 0.065, 0.11], "start": 25, "end": 170 }
}
```

| Field                                   | Native Laya 3.4.2 feature                                                               |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| `shadows` (`false` to turn off)         | `DirectionLightCom` shadow maps, two cascades; every mesh casts and receives            |
| `atmosphere` (`false` for a flat `sky`) | `SkyProceduralMaterial` on a `SkyDome`; the sun disk follows the sun                    |
| `fog` (`false` to turn off)             | Linear scene fog                                                                        |
| `grade` (off unless given)              | The existing `ZhudaFilmicPipeline`: HDR, ACES tone mapping, bloom and ambient occlusion |
| `light` nodes                           | `PointLightCom` / `SpotLightCom` (at most 32, `Config3D.maxLightCount`)                 |
| `emission` on a flat material           | PBR emission, for lamp heads and signs                                                  |

```json
{ "id": "lamp", "type": "light", "kind": "point", "position": [4, 2.5, 6],
  "color": [1, 0.45, 0.2], "intensity": 2.6, "range": 9 }
{ "id": "spot", "type": "light", "kind": "spot", "position": [0, 6, 4],
  "target": [0, 0, 2], "spotAngleDeg": 40 }
```

```json
"grade": { "exposure": 1.7, "contrast": 1.06, "saturation": 0.96, "bloom": 0.3, "ao": 1.1 }
```

`grade` also takes what a real camera adds, each 0..1 and off by default:
`grain` (film grain, the same for a frame however often it is rendered),
`vignette` (darker corners) and `fringe` (colour fringing toward the
corners). A rendered frame without them is cleaner than any photograph.

With a grade, lamps and lit windows can be brighter than white and glow
instead of clipping; without one the render is the plain SDR output. The film
host uses the `3d-gltf` browser bundle, which carries the post-process module.

`lightFog` adds fog that sits near the ground and is lit by the scene's
lights: halos around lanterns, a glow in a candle-lit room, streets that sink
into haze. It needs `grade` and is off unless given.

```json
"lightFog": { "density": 0.015, "falloffMeters": 6, "baseY": 0, "color": [0.02, 0.03, 0.05], "scatter": 1.5 }
```

- `density` is how much light a metre of fog takes away at `baseY`;
  `falloffMeters` is the height over which the fog thins to about a third.
- `color` is what the fog adds by itself (moonlight in the air); `scatter`
  scales the glow from lights.
- Every point `light` node shines into the fog, out to its `range` (default
  12 m): a view ray that passes farther from the light gets no glow from it,
  so many lamps do not add up to a wash over the sky. A light with
  `"fogOnly": true` lights only the fog and no surface: use it for lamps
  whose light is already in a lightmap. Fog-only lights do not count against
  the real-time lights; a scene holds up to 128 point lights (the ones that
  shine into the fog) in all. Spot lights do not shine into the fog.
- The glow of lamps is not shadowed: a wall beside a lamp does not cut its
  halo; only what the camera's own ray hits ends it. The mirrored view of a
  `reflector` has no fog.
- `shafts` lets the sun or moon (`look.sun`) shine into the fog, cut by
  whatever stands in the light: beams between trees, under eaves and through
  window bars.

  ```json
  "lightFog": { "density": 0.02, "falloffMeters": 12, "shafts": { "strength": 2, "anisotropy": 0.7, "distance": 80 } }
  ```

  `strength` scales the beams; `anisotropy` (0..0.95) makes them brightest
  when the camera looks toward the light; `distance` is how far from the
  camera they are drawn (the depth picture of the light covers that stretch,
  so a shorter distance gives sharper edges); `steps` (8..96) trades speed
  for smoothness. Final stills average the step noise away over their
  samples; a one-sample preview shows it as fine grain. The beams use their
  own depth picture, so they work with `shadows: false` as well.

`panorama` draws a photograph as the sky instead of the procedural one:

```json
"panorama": { "asset": "sky/night.jpg", "exposure": 1, "rotationDeg": 0 }
```

The picture is a 2:1 panorama (equirectangular: the top row is straight up,
the bottom row straight down) in the asset directory, `.png` or `.jpg`.
`rotationDeg` turns it about the vertical axis to put the moon or the sun
where the shot wants it. It is a backdrop: it does not light the scene by
itself, but an `environment` probe sees it and reflects it.

`environment` captures the scene around one point when the scene is loaded
and uses it as the environment of the whole scene:

```json
"environment": { "position": [0, 1.5, -40], "reflection": 1, "ambient": 1 }
```

- Glossy and metallic surfaces reflect what is around the probe: roof tiles
  catch the lanterns, lacquer and brass get highlights. This also works on
  lightmapped models, which otherwise have no highlights at all.
- Surfaces without a lightmap (characters, props, boxes) get ambient light
  with the colour and direction of the surroundings instead of the flat
  `ambient` colour. `"reflectionOnly": true` keeps the flat `ambient` colour
  and takes only reflections from the capture: under a canopy or between
  walls the captured ambient light is as dark as the surroundings.
- `ambientGround` (a look field beside `ambient`) gives the ambient light a
  direction without a capture: `ambient` shines from above as sky light and
  `ambientGround` from below as the light the ground throws back. Shadows
  and undersides then take the colour of the ground instead of one flat
  tone. With `reflectionOnly` the probe keeps this ambient light.
- There is one probe. Reflections are right at `position` and approximate
  elsewhere, so put it near the subject of the shot. It is captured once:
  things that move during a shot are in it where they were at time 0.
- A reflector's mirrored view and the fog are not in the capture.

`resolveZhudaFilmLook(look)` returns the values a scene will actually use.

## Your own props and recipes

The host ships the neutral starter set. The person who starts the server can
add packs: modules that export `props` (prop definitions) and `recipes`
(texture recipes), written against the public API.

```sh
npx zhuda-laya-mcp --film-output ./films --film-pack ./my-city/pack.mjs
```

```js
// my-city/pack.mjs
import { createZhudaBoxMesh } from 'zhuda-laya-engine';
export const recipes = {
  'stone-paving': {
    /* ZhudaTextureRecipe */
  },
};
export const props = [
  {
    id: 'lamp-post',
    size: [0.4, 3, 0.4],
    defaults: {},
    build() {
      /* … */
    },
  },
];
```

Packs are trusted like server code; an agent only names what they provide,
and `film_scene_create` lists every prop and recipe the host can build. In the
page, `zhuda-laya-engine` resolves to the loaded browser SDK, so a pack adds no
second engine copy. Duplicate ids across packs are refused.

## Models and baked global illumination

A `model` node places a self-contained `.glb` by logical asset id. The person
who starts the server chooses the directory the ids resolve in:

```sh
npx zhuda-laya-mcp --film-output ./films --film-assets ./my-city/assets
```

```json
{
  "id": "street",
  "type": "model",
  "asset": "city/street.glb",
  "position": [0, 0, 0],
  "yawDeg": 0,
  "scale": 1,
  "lightmap": "city/street.hdr",
  "lightmapIntensity": 1
}
```

`film_scene_create` lists the `.glb` and `.hdr` files in the directory; a
scene that names anything else is refused, and without `--film-assets` model
nodes are refused. Ids never contain a path outside the directory, a URL or a
query. Models load through the engine's model library and asset provider, so
an edited scene does not download or parse an unchanged model again; a file
rewritten on disk is picked up by the next mount. Up to 64 models per scene.
A model keeps the transforms, materials and textures in its file; animations
are not played in film renders.

`lightmap` is how a film scene gets global illumination. It is a Radiance
`.hdr` picture of the diffuse light that reaches the model's surfaces, both
direct and bounced, baked offline (for example with Blender's Cycles, bake
type Diffuse with Direct and Indirect and without Color). The engine draws it
with Laya's native lightmap path:

- Every mesh in the model needs a second UV set (`TEXCOORD_1`) that does not
  overlap; glTF's convention applies, so UV (0, 0) is the picture's top-left
  texel. One picture covers the whole model.
- Values are scene-linear. They are stored as 8-bit RGBM, so light above
  about 34 is clamped and very dark texels lose precision; keep the bake's
  exposure sensible and use `lightmapIntensity` (0..16) to scale it.
- A lightmap replaces the flat `ambient` on that model. The sun and `light`
  nodes still add their own direct light on top, so a light that is already
  in the bake should not also be a `light` node (or it counts twice). For a
  fully baked scene set the sun intensity to 0.
- The picture holds diffuse light only. Glossy highlights from baked lights
  and reflections of the surroundings are not part of it.

Props, boxes and the ground are not lightmapped; they keep the flat ambient.

**Mixed lighting.** A lightmap does not have to hold all the light. Laya adds
real-time lights on top of a lightmap, so the usual split is: bake what
bounces and what is far away, and keep as real-time lights what should cast
sharp shadows and make highlights. The sun (or moon) with `shadows` gives
crisp shadows and highlights everywhere; `shadows.cascades: 4` keeps them
sharp near the camera over a long `distance`. One spot light per scene may
cast shadows (`"castsShadow": true`); point lights cannot. A scene may hold up
to 128 real-time lights when the runtime was booted with `maxLights` (the MCP
film host is; Laya's own default is 32, and a scene asking for more than the
runtime has is refused when it is mounted). A light that is both baked and
real-time counts twice: lower one of the two.

A lightmap alone lights every pixel as if the surface were flat, so normal
maps show nothing and stone or brick looks smooth. `lightmapDirection` fixes
that: a second `.hdr` picture, on the same UV set, whose RGB is the
world-space unit vector toward the dominant light as `d * 0.5 + 0.5`. The
engine then lights a pixel with `lightmap * (0.5 * max(0, n . d) + 0.5)`,
where `n` includes the normal map (Laya's native directional lightmap). So
that flat surfaces stay as baked, the baker stores
`light / (0.5 * max(0, N . d) + 0.5)` in the colour picture, `N` being the
geometric normal. Directions are in world space: a model with a direction
picture must keep `yawDeg` 0. This is a half-Lambert response, not a
physically exact one.

## Characters: clips, movement and lights that follow

A `model` node can play one of the clips in its file and move during a shot.
Both are functions of shot time, so a frame is the same however often it is
rendered.

```json
{
  "id": "watchman",
  "type": "model",
  "asset": "characters/watchman.glb",
  "position": [0, 0, -60],
  "yawDeg": 180,
  "animation": { "clip": "Walk", "loop": true, "speed": 1, "offsetSec": 0 },
  "motion": [
    { "time": 0, "position": [0, 0, -60] },
    { "time": 6, "position": [0, 0, -56.4] }
  ]
}
```

- `animation.clip` names an animation in the GLB; `film_scene_create` does
  not know the clips, so an unknown name is refused when the scene is first
  drawn, with the names the model has. The clip time is
  `offsetSec + time * speed`; `loop` (default true) repeats it, otherwise the
  last frame is held. One clip at a time: no blending and no events.
- `motion` moves the model in straight lines between keys (the first at
  time 0) and turns it the short way; it holds the last key afterwards. The
  clip does not move the model: match the walking speed to the clip yourself.
  A model with a lightmap cannot move.
- A point light with `"follows": { "node": "watchman", "offset": [0.3, 0.4, 0.5] }`
  stays at that offset in the model's own frame (+Z is its front), turning
  with it: a lantern that lights the character and the ground around it. It
  also shines into `lightFog`.
- Previews, review shots and stills take `time` (seconds) to look at a
  moment of the shot; video jobs run time from 0. Final renders sample
  several times inside each frame, so moving things blur slightly.

Characters are lit by real-time lights and the flat `ambient`; a lightmap
lights only the model it was baked for. A character in a baked scene needs a
light of its own (the lantern it carries, or a `light` node near it).

## Reflections: wet ground and still water

A `reflector` node is a horizontal rectangle that mirrors the scene above it:
lanterns, lit windows, buildings and the sky appear in wet paving or a pond.

```json
{
  "id": "wet-street",
  "type": "reflector",
  "position": [0, 0.065, -38],
  "size": [15, 100],
  "strength": 1,
  "wetness": 0.45,
  "roughness": 0.35,
  "ripple": 0.4,
  "patternMeters": 3,
  "resolution": 1024,
  "hides": ["street", "earth"]
}
```

- `position` is the centre; its `y` is the mirror height. Put it a few
  millimetres above the surface it covers.
- The reflection is added on top of what is under it, so the paving keeps
  its material and lightmap. It is strongest at grazing angles (Fresnel).
- `wetness` is the share that is standing water and mirrors sharply; the
  rest is damp, dimmer, blurred by `roughness` and broken up by `ripple`.
  `patternMeters` sizes the puddles.
- `hides` lists `model` nodes the mirror must not draw: the ground under the
  reflector, which would otherwise block the view from below. Boxes, the
  `ground` node and props cannot be hidden; keep them out from under a
  reflector or accept that they block it.
- One reflector per scene. It is a second render of the scene for every
  sample of every frame, at `resolution` pixels wide.

This is how a scene lit only by lightmaps gets highlights: a lightmap holds
diffuse light, and the reflector adds the mirror image of the lights.

## Nature: many copies, leaves and running water

A `model` node can stand in many places at once. `placements` lists one
`[x, y, z, yawDeg, scale]` per copy, relative to the node's `position`: a
forest floor of ferns, stones along a bank, trees. The copies share the
model's meshes and materials. A node holds up to 20 000 copies and a scene
60 000; a model with placements has no lightmap, animation or motion.

```json
{
  "id": "ferns",
  "type": "model",
  "asset": "nature/fern.glb",
  "position": [0, 0, 0],
  "translucent": true,
  "placements": [
    [4.2, 0.31, -7.5, 130, 0.9],
    [5.0, 0.28, -6.1, 15, 1.2]
  ]
}
```

`"emission": 0` on a model node puts out what its materials give off by
themselves (lit windows, lanterns), and other values scale it (0..8): a
town built for night can stand in a daytime shot without a second copy.

`"translucent": true` lets light through leaves: the cut-out (alpha-tested)
materials of the model glow in their own colour when the sun or a lamp is
behind them, instead of going black. Bark and other opaque materials of the
same model are unchanged. Leaves in the shadow of other leaves stay dark.

A `water` node is clear running water on a horizontal rectangle:

```json
{
  "id": "river",
  "type": "water",
  "position": [0, 0, 0],
  "size": [170, 130],
  "flow": [0.9, 0.15],
  "color": [0.03, 0.3, 0.26],
  "clarity": 1.1,
  "waveMeters": 0.8,
  "waves": 0.4,
  "foamDepth": 0.1
}
```

- `position[1]` is the water level. The ground and stones are ordinary
  models that cross the rectangle; water shows only where it lies above them.
- The bed is seen through the water, bent by the waves (`refraction`) and
  fading into `color` with depth: `clarity` is the depth in metres at which
  about a third of the bed's light is left. `glow` (0..4, default 0.25) is how
  much deep water shines in that colour by itself: raise it for luminous jade
  water, lower it for a dark pool.
- The surface mirrors the scene above it (`reflection`, softened as moving
  water does), glints in the sun of `look.sun` and carries trains of waves
  along `flow` (metres per second, driven by shot time). A soft line of foam
  follows banks and stones where the water is shallower than `foamDepth`.
- The mirrored view is cut at the water level, so the bed and the sunk part
  of stones do not show in it. `hides` takes models out of it if needed.
- Water needs `grade`. A scene has one mirror: one `water` or one
  `reflector`. The rectangle is flat and level: no waterfalls or slopes.

## The same look in a game

`ZhudaSceneLook` puts a film look on a game's own `Scene3D` and camera: the
sun and its shadows, sky and ground light, the procedural sky, distance fog,
ground fog with beams, and the HDR grade.

```ts
import { ZhudaSceneLook, ZhudaQualityGovernor } from 'zhuda-laya-engine';

const look = new ZhudaSceneLook(scene, camera, {
  preset: 'day',
  ambient: [0.78, 0.86, 1],
  ambientGround: [0.3, 0.3, 0.17],
  shadows: { distance: 60, resolution: 4096, cascades: 4 },
  grade: { exposure: 1.15, bloom: 0.3, ao: 0.55 },
  lightFog: { density: 0.006, shafts: { strength: 0.8, distance: 60 } },
});
const governor = new ZhudaQualityGovernor({ budgetMs: 1000 / 60 });

runtime.start((dt) => {
  // ... move the camera ...
  look.update(eye, target, fieldOfViewDeg, aspect);
  const level = governor.sample(dt * 1000);
  if (level !== undefined) look.setQuality(level);
});
```

- `setQuality(3)` is the look as authored. Level 2 drops ambient occlusion,
  halves the steps of the beams and caps shadow maps at 2048; level 1 drops
  the beams and the lens finish and uses two shadow cascades; level 0 drops
  the HDR chain altogether and draws one small shadow map. Sky, ground light
  and distance fog stay at every level. `zhudaLookForQuality` is that table
  as a pure function.
- `ZhudaQualityGovernor` holds a frame budget: it steps down as soon as a
  window of frames averages over the budget, tries the next level up after a
  calm stretch, and waits twice as long before retrying a level that failed.
  It decides; the caller applies the level, to the look and to whatever else
  it wants to scale.
- The depth picture of the beams follows the camera in steps and is redrawn
  only when the camera has left its box, since a game's scenery stands still.
  Call `ZhudaLightFog.invalidateShafts()` (through your own handle) when
  scenery changes; things that move do not cut the beams until the next redraw.
- A panorama sky and `environment` need assets or a capture and are refused.
- `look.setLook(next)` changes the look while it runs, with the same rules as
  a film stage (below); the level set by `setQuality` still applies to it.
- With water: `ZhudaWaterSurface` takes `mirrorShadows: false` so the mirror
  uses the shadow maps of the main view, and its `render()` is called once per
  frame by the game (the engine's loop no longer draws the mirror itself).

## Changing the look while it runs

`stage.setLook(look)` (on a mounted film stage) and `ZhudaSceneLook.setLook`
take a whole new `look` and return what they had to do:

```ts
const day = scene.look;
const dusk = {
  ...day,
  sun: { elevationDeg: 8, azimuthDeg: 70, intensity: 0.7, color: [1, 0.55, 0.3] },
  ambient: [0.12, 0.1, 0.14],
  fog: { ...day.fog, color: [0.35, 0.25, 0.25] },
  grade: { ...day.grade, exposure: 0.8 },
};
stage.setLook(dusk); // 'updated': nothing was rebuilt
stage.setLook({ ...dusk, lightFog: false }); // 'rebuilt'
```

- **Updated in place** (cheap enough for every frame of a day passing or of
  weather turning, about 0.04 ms on a desktop GPU): the sun's direction,
  colour and intensity; sky and ambient colour; shadow distance, strength,
  softness, resolution and cascades; the procedural sky's tint, thickness,
  sun size and exposure; fog colour, start and end; the strengths of the
  grade (exposure, contrast, saturation, bloom, ambient occlusion, grain,
  vignette, fringe); the light fog's density, falloff, base height, colour,
  scatter and reach, and the strength and spread of its beams; the direction
  and colour of the beams; and the sun that water reflects. The HDR chain and
  the sky material stay the same objects. With `ambientGround` set, the
  sky/ground light is recoloured in its existing texture
  (`prefilterZhudaHemisphere` mixes two prefiltered bases), about 0.2 ms.
- **Rebuilt**: turning shadows, the procedural sky, fog, `ambientGround`,
  `grade` or `lightFog` on or off; switching bloom, ambient occlusion, the
  lens finish (grain, vignette and fringe all zero, or not) or the beams on
  or off; and the beams' distance, resolution or step count. Only the look
  is rebuilt; nodes, models and lights stay. Resources do not grow over
  repeated rebuilds.
- **Refused**: a different `panorama` or `environment` (mount the scene
  again), and any look that would not validate with the scene's nodes (for
  example water without `grade`). A refused look throws and leaves the frame
  as it was; a rebuild that fails puts the previous look back.
- `stage.look` and `stage.scene` report the look now on the stage.

### Quality on a stage

`stage.setQuality(level)` draws the authored look at a lower cost, with the
levels of `zhudaLookForQuality` (3 as authored, down to 0), and returns
`'updated'`, `'rebuilt'` or `'unchanged'`. `setLook` keeps taking the authored
look: the level stays on top of it, so a day-night cycle and a quality
governor do not have to know about each other. A scene with a water surface
keeps a bare HDR chain at level 0 (tone mapping only; no bloom, ambient
occlusion or lens finish), because the water draws in HDR. `stage.look` is
the look in use at the current level; `stage.quality` is the level.

### Lights that change

`stage.setLight(id, { enabled, intensity, color, range })` changes a `light`
node while the stage runs: a lamp switched on or off, a flame that flickers.
Values left out stay as they are. The light's glow in the light fog follows.
A light that is off gives no light but keeps its place, so switching it does
not rebuild anything.

## Camera paths

A video job takes `cameraPath`: two or more keys `{ time, camera }`, the first
at 0 and times increasing. The camera eases in and out between keys
(smoothstep) and holds the last key afterwards. `durationSec` defaults to the
last key time; `durationSec × fps` must be a whole number of frames, and a job
is limited to 1800 frames. Frames pass the existing film gate before encoding,
so the MP4 has exactly the frames that were rendered.

## In code

The same pieces are public:

```ts
import {
  validateZhudaFilmScene,
  applyZhudaFilmScenePatch,
  sampleZhudaFilmCameraPath,
  mountZhudaFilmScene,
  loadZhudaFilmScene,
  ZhudaFilmAssets,
  ZhudaFilmRenderer,
  composeZhudaFilmReview,
} from 'zhuda-laya-engine';
import { ZHUDA_STARTER_PROPS, ZHUDA_STARTER_TEXTURES } from 'zhuda-laya-engine/demo';

const stage = mountZhudaFilmScene(context.rootScene, scene, {
  props: ZHUDA_STARTER_PROPS,
  recipes: ZHUDA_STARTER_TEXTURES,
});
const renderer = new ZhudaFilmRenderer(stage, context.runtime); // pauses the runtime
const frame = await renderer.render({ width: 1920, height: 1080, samples: 16 });
const sheet = await composeZhudaFilmReview([
  { label: 'Wide', frame },
  { label: 'Close', frame: await renderer.render({ camera: close, width: 1920, height: 1080 }) },
]); // Laya 2D sheet, top-left RGBA
renderer.dispose(); // restores the pause state
stage.dispose();
```

A game passes its own props and recipes; the starter set is a neutral sample.

Scenes with `model` nodes load assets first, through any `AssetProvider`:

```ts
const assets = new ZhudaFilmAssets(provider); // one per host; the provider is borrowed
const stage = await loadZhudaFilmScene(context.rootScene, scene, { assets, signal });
// … render …
stage.dispose(); // releases its model instances and lightmap textures
assets.dispose(); // after every stage
```

Cancelling `signal`, a timeout or a failed asset rejects, releases what was
already loaded and adds nothing to the scene. `decodeRadianceHdr`,
`encodeZhudaLightmapRgbm` and `createZhudaLightmap` are public for tools.

## Verification and limits

`npm run verify:film` drives the real MCP stdio server through create,
preview, refused changes, apply with preview, a four-shot review, two
identical still jobs (byte-identical PNGs) and an MP4, and checks the MP4 with
`ffprobe`. See the [verification record](plans/records/film-scene-loop/verification.md).

`npm run verify:film-look` switches each look feature on and off on a real GPU
and asserts the pixel change (shadows darken and never brighten, the sky has a
vertical gradient, fog and a point light change the frame), remounts nine
looks in a row and draws a prop from a pack. See the
[look verification record](plans/records/film-look/verification.md).

`npm run verify:film-model` generates a GLB and an HDR lightmap, draws them on
a real GPU and checks that the lit regions follow the second UV set at the
encoded brightness, that scale and yaw apply, that a missing asset and a model
without `TEXCOORD_1` are refused, that a direction picture scales the light
by the stated factor, that a panorama sky shows its top above and turns with
`rotationDeg`, that 30 mounts leave one instance and that a
rewritten lightmap is picked up. See the
[model verification record](plans/records/film-model-gi/verification.md).

`npm run verify:film-reflector` puts a lit box above a reflector on a real GPU
and checks that its mirror image appears at the projected pixel with the same
colour and nowhere else, that strength and dampness scale it, that a ground
model blocks it unless hidden and that the frame is identical after 30 mounts.
See the [reflector verification record](plans/records/film-reflector/verification.md).

`npm run verify:film-fog` puts a fog-only light in a dark scene on a real GPU
and checks that it glows at its projected pixel in its own colour and fades
with distance, that nothing changes without `lightFog`, that a far wall takes
more fog than a near one, that a wall on the ray cuts the glow and that the
frame is identical after 30 mounts. See the
[light fog verification record](plans/records/film-light-fog/verification.md).

`npm run verify:film-animation` generates a skinned GLB with one clip and
checks on a real GPU that the pose follows shot time (and speed and offset),
that an unknown clip is refused with the model's clip names, that a moving
model is where its keys say and that a following light moves and turns with
it. See the
[animation verification record](plans/records/film-animation/verification.md).

`npm run verify:film-environment` checks on a real GPU that a mirror-like box
shows a lamp exactly where a mirror would (behind the camera, to the side,
above, straight up, from the east) and never one placed at the mirrored-wrong
side, and that a rough white box is lit by a coloured lamp on the side that
faces it. See the
[environment verification record](plans/records/film-environment/verification.md).

Not yet: several probes or box projection, blending between clips, shadowed halos of point lights in the fog,
animated look or light tracks, real-time shadows from point lights
(bake them into a lightmap), reflections on walls or slopes, reflection probes, real-time
global illumination, animated models, spline camera paths, shot lists, path
tracing and audio in render jobs. Previews and renders are desktop evidence (WebGL, and WebGPU on
Apple Metal hardware); mobile is not covered.

## Baking textures ahead of a mount

`mountZhudaFilmScene` takes `bakeCache`, a map of baked texture sets. To bake before mounting (in a worker, or behind a progress bar), store each result under `zhudaBakeKey(recipe, size)`:

```ts
import { bakeZhudaTextureSet, zhudaBakeKey } from 'zhuda-laya-engine';
const cache = new Map();
cache.set(zhudaBakeKey(recipe, 256), bakeZhudaTextureSet(recipe, { size: 256 }));
```

The key does not depend on the order of a recipe's properties.
