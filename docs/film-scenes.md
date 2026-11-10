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
    { "id": "c2", "type": "prop", "prop": "container20", "position": [0, 0, 3.2], "yawDeg": 180,
      "params": { "paint": "red-paint" } },
    { "id": "wall", "type": "box", "size": [6, 2.4, 0.3], "position": [0, 0, -6], "material": "plaster" }
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
  ZhudaFilmRenderer,
} from 'zhuda-laya-engine';
import { ZHUDA_STARTER_PROPS, ZHUDA_STARTER_TEXTURES } from 'zhuda-laya-engine/demo';

const stage = mountZhudaFilmScene(context.rootScene, scene, {
  props: ZHUDA_STARTER_PROPS,
  recipes: ZHUDA_STARTER_TEXTURES,
});
const renderer = new ZhudaFilmRenderer(stage, context.runtime); // pauses the runtime
const frame = await renderer.render({ width: 1920, height: 1080, samples: 16 });
renderer.dispose(); // restores the pause state
stage.dispose();
```

A game passes its own props and recipes; the starter set is a neutral sample.

## Verification and limits

`npm run verify:film` drives the real MCP stdio server through create,
preview, refused changes, apply with preview, a four-shot review, two
identical still jobs (byte-identical PNGs) and an MP4, and checks the MP4 with
`ffprobe`. See the [verification record](plans/records/film-scene-loop/verification.md).

Not in this phase: sun shadows, physical sky, fog, look presets, spline camera
paths, shot lists, path tracing, audio in render jobs and glTF assets in film
scenes. Previews and renders are desktop WebGL evidence; WebGPU and mobile are
not covered.
