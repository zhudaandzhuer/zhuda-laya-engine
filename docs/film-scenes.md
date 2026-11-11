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

With a grade, lamps and lit windows can be brighter than white and glow
instead of clipping; without one the render is the plain SDR output. The film
host uses the `3d-gltf` browser bundle, which carries the post-process module.

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
by the stated factor, that 30 mounts leave one instance and that a
rewritten lightmap is picked up. See the
[model verification record](plans/records/film-model-gi/verification.md).

`npm run verify:film-reflector` puts a lit box above a reflector on a real GPU
and checks that its mirror image appears at the projected pixel with the same
colour and nowhere else, that strength and dampness scale it, that a ground
model blocks it unless hidden and that the frame is identical after 30 mounts.
See the [reflector verification record](plans/records/film-reflector/verification.md).

Not yet: animated look or light tracks, real-time shadows from point lights
(bake them into a lightmap), reflections on walls or slopes, reflection probes, real-time
global illumination, animated models, spline camera paths, shot lists, path
tracing and audio in render jobs. Previews and renders are desktop WebGL evidence; WebGPU and mobile are
not covered.
