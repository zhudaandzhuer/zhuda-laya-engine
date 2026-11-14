# Quality route: a 3D scene that looks good

One route, in order, from an empty scene to a frame that reads as lit,
grounded and deep. It is the same for a film scene (data, through the `film_*`
MCP tools) and for a game (TypeScript on the public SDK): both resolve the same
`look`.

The route is also data. `get_quality_route` on the MCP server returns these
steps with their API, reason and check, the defaults, the limits and what is
not built; a unit test keeps this page and that data in step, and
`npm run verify:quality-route` draws the two example scenes.

```sh
node packages/mcp-server/index.mjs --tool get_quality_route
```

What this route does not give you is listed at the end. Read that first if you
are deciding whether the engine can carry a scene at all.

## The steps

### 1. `pick-the-surface`

A still or a film is a [film scene](film-scenes.md): JSON, changed under
revision checks, previewed on a real GPU. A game is TypeScript with
`ZhudaSceneLook` on its own `Scene3D` and camera. A look tuned in film
previews carries over to the game unchanged.

For a game, start from the scaffold: `zhuda-laya-init <folder>` writes a
project whose first frame is already on this route (physically based
surfaces, a look with shadows, sky, fog and grade, a frame budget).

### 2. `start-from-a-preset`

```json
"look": { "preset": "day", "grade": {} }
```

The preset (`day`, `dawn`, `dusk`, `night`, `overcast`) brings the sun, soft
shadows, the procedural sky and distance fog. `grade` is the HDR chain: tone
mapping, bloom, ambient occlusion and multisampling; light fog and water need
it. A scene with no `look` at all gets the day preset without a grade; a
`look` with neither is the bare look that exists for tests: a flat sky colour
and no shadows.

### 3. `physically-based-surfaces`

Film: materials are recipes, sized for the camera.

```json
"materials": { "road": { "recipe": "asphalt", "size": 1024, "variation": 0.5 } }
```

A recipe bakes at 256 pixels unless told otherwise. On a two-metre tile that is
128 pixels per metre, which reads as blurred from a few metres. Aim for 256
pixels per metre or more on what the camera stands on; sizes go up to 2048
(about 6 s and 48 MB to bake on the CPU, so bake the large ones
[ahead of the mount](film-scenes.md#baking-textures-ahead-of-a-mount)).
A floor many tiles wide shows them as a grid, because every tile is the same:
`variation` lays slow changes of brightness, several tiles wide, over it.

Game: `createSurfaceMaterial`, `createZhudaProceduralMaterial`, or
`Zhuda3D.createMaterial({ albedoColor, smoothness })`, which is physically
based unless it is given a `shininess`: that one option still makes it
Blinn-Phong, which ignores the sky, the environment and the HDR chain.

### 4. `light-from-the-side`

```json
"look": { "sun": { "azimuthDeg": 160, "elevationDeg": 32 }, "ambient": [0.62, 0.63, 0.67], "ambientGround": [0.55, 0.52, 0.48] }
```

With the sun behind the camera, shadows fall out of sight behind what casts
them and every surface is evenly lit. Turn it to the side or a little ahead:
at azimuth `a` the light travels along `(-sin a, -cos a)` in X and Z.
`ambientGround` is the light the ground throws back; without it shadowed
sides are lit by one flat colour from every direction. Both are display
values like every colour. The day, dawn, dusk and overcast presets give both
(day: about a third of the sun's light from the sky above, the ground's
colour below); write your own to change them, or `"ambientGround": false`
for one flat colour.

### 5. `shadows-that-carry`

By day, four cascades at 4096 for anything wider than a room:

```json
"shadows": { "distance": 70, "resolution": 4096, "cascades": 4 }
```

At night the lamps are the key light. Up to eight point lights and one spot
light per scene can cast shadows: give the lamps that carry the scene
`"castsShadow": true`, or their light passes through walls.

### 6. `air`

```json
"lightFog": { "density": 0.003, "falloffMeters": 12 }
```

Ground fog gives depth and joins the ground to the sky. Leave its colour out
unless you have a reason: it takes the colour the sky has near the horizon. A
fog far darker than the sky it meets draws a dark band along the horizon. At
night lamps light the fog (halos); with a low sun, `shafts` cuts beams out of
it.

### 7. `wet-ground-and-water`

```json
{ "id": "wet", "type": "reflector", "position": [0, 0.01, 6], "size": [50, 24], "wetness": 0.5 }
```

A reflector mirrors the scene above it, a centimetre above the ground it
covers. What lies below the mirror is cut from the mirrored view, so a
`ground` node, a box or a prop under it does not block the reflection. A
`water` node is running water at the water line. A scene holds one reflector
or one water node.

For rain on everything else, `"screenReflections": { "wetness": 0.6 }` in the
look reflects what is on screen in walls, props and ground alike, by Fresnel.
It shows only what the frame holds, and not the sky.

### 8. `baked-light-for-models`

There is no real-time global illumination. Light bounced once off props,
boxes, shapes and the ground comes from `"bounceLight": {}` in the look:
probes over the scene capture their surroundings when it is mounted (a sunlit
red wall then tints what faces it; see
[bounce light](film-scenes.md#bounce-light)). It costs six small draws per
probe at mount, about a hundred probes for a yard. For static models, bake
light in Blender and give the model its `lightmap` (and `lightmapDirection`,
so normal maps keep their relief); mark lamps that are already in the bake as
`"fogOnly": true`. See
[baked light](film-scenes.md#models-and-baked-global-illumination).

### 9. `finish`

```json
"grade": { "exposure": 1.1, "bloom": 0.2, "ao": 0.7, "grain": 0.15, "vignette": 0.3 }
```

Exposure first: it decides what bloom and grain have to work with. Bloom at
0.4 or less. A lamp's `emission` is not a multiple of white: 2 is 5.3 times
white and 4 is 28 (see [colour values](film-scenes.md#colour-values)). A
coloured lamp keeps its colour on the lamp itself up to about 2; brighter, it
is drawn near-white and its colour shows in bloom and halo. Keep `antialias` at its default, `msaa`: it smooths edges in a
frame that is drawn once, as a preview and a game are.

In a game, three more belong to the camera, each off unless the look asks:
`autoExposure` (the picture's brightness follows what is in view, over a
second or so: give it where a walk leads from a dark place into a bright
one, and leave `grade.exposure` as the taste on top), `depthOfField`
(`focusDistanceM`, `fStop`, `focalLengthMm`: a conversation, a thing picked
up) and `motionBlur` (a fast turn or a run). Quality level 1 keeps automatic
exposure and drops the other two; level 0 drops all three. A film still or
video needs neither depth of field nor motion blur here: it gets them from
the camera's `fStop` and its samples.

### 10. `look-at-it`

Preview after every change. Each reply carries two things to act on.

`advice` lists what in a valid scene will still look wrong, each with its fix.
`film_scene_lint` returns it without drawing. The rules:

| Rule                      | Level | What it found                                             |
| ------------------------- | ----- | --------------------------------------------------------- |
| `look.plain`              | warn  | A look without a preset: flat sky, no shadows, no grade.  |
| `look.no-grade`           | warn  | No grade: no tone mapping, bloom, AO or edge smoothing.   |
| `look.no-shadows`         | warn  | The sun shines but nothing casts a shadow.                |
| `lightFog.dark-horizon`   | warn  | Ground fog far darker than the sky it meets: a dark band. |
| `surface.in-ground-plane` | warn  | Water or a reflector exactly in the plane of the ground.  |
| `sun.behind-camera`       | tip   | The sun is behind the camera: shadows fall out of sight.  |
| `ambient.flat`            | tip   | Shadowed sides are lit by one flat colour.                |
| `lights.unshadowed`       | tip   | Lamps are the key light and none casts a shadow.          |
| `emission.no-bloom`       | tip   | A material brighter than white, with bloom off.           |
| `emission.washes-out`     | tip   | A coloured lamp so bright that it is drawn near-white.    |
| `texture.density`         | tip   | A ground texture too coarse for a camera this close.      |
| `texture.repeats`         | tip   | A ground texture repeated many times, every tile alike.   |

An empty list means none of these traps applies, not that the picture is
good.

`metrics` describes the drawn frame in numbers, for an agent that cannot judge
a picture and as a check on one that can: luminance percentiles, the shares of
clipped and crushed pixels, strong hues (`vivid`), the share of hard edges,
and `flags`:

| Flag           | Raised when                                                      |
| -------------- | ---------------------------------------------------------------- |
| `underexposed` | Even the brightest 5 % of the frame is below 0.2.                |
| `burnt-out`    | More than 5 % of the frame is clipped to white.                  |
| `crushed`      | More than half of the frame is black.                            |
| `low-contrast` | Less than 0.2 between the darkest and the brightest 5 %.         |
| `hard-edges`   | Edges have no in-between pixels: nothing is anti-aliasing them.  |

A flag is a reason to look, not a verdict: a night scene is rightly dark.
`newHues` names strong hues that the previous preview of the session did not
have. A hue the scene has no source for is a defect, not a look. `glErrors`
lists WebGL errors raised while drawing; there should be none.

`film_scene_review` puts two to four cameras of one revision into one grid.

### 11. `hold-the-frame-budget`

In a game, `ZhudaQualityGovernor` decides the level and the look applies it:

```ts
const level = governor.sample(dt * 1000);
if (level !== undefined) look.setQuality(level as ZhudaLookQuality);
```

Level 2 drops ambient occlusion and halves the beams; level 1 drops the beams,
the lens finish and multisampling; level 0 drops the HDR chain. Sky, ground
light and distance fog stay at every level. Measure on the device the game is
for; this repository's numbers are from a desktop.

### 12. `final-evidence`

Film: `film_render_job` with `kind: "still"` (16 samples) or `"video"`; with a
grade the samples are averaged in scene-linear light, so lamps out of focus
and moving highlights keep their brightness. Game:
`npm run verify` in the consumer and a recorded browser run. A preview is one
sample on one GPU; declarations and unit tests prove no pixel. Write down what
was not verified.

## What the engine does for you

- Ground fog takes the colour of the sky near the horizon of the look.
- Mipmapped surface textures, and the textures of loaded models, use
  anisotropic filtering 8: a floor seen along its length keeps its detail.
- A look with a grade multisamples the HDR target.
- What lies below a reflector is cut from its mirrored view.

## Two scenes on the route

`get_golden_example` holds both as `film-scene-day` and `film-scene-night-wet`
(a container yard by day; the same yard at night with lamps, halos, one
shadow-casting spot and wet ground), and `scene-look-game` for a game. They
use only the starter props and recipes, so they mount on the bundled film
host without any asset. `npm run verify:quality-route` draws both and fails
if either gets advice, a metrics flag or a WebGL error, if the day scene
shows no shadow or the night scene no reflection.

## Limits

128 real-time lights and 128 fog lights; one shadow-casting spot light and eight
shadow-casting point lights; one reflector or water node; one environment
probe; material bake sizes 128, 256, 512, 1024 and 2048; shadow maps of 1024,
2048 or 4096 in 1, 2 or 4 cascades; 20 000 copies of a model per node; 512
nodes.

## Not built yet

- Real-time global illumination. `bounceLight` is captured when the scene is
  mounted; a game can capture it again a few probes at a time
  (`ZhudaProbeVolume.refresh`), which follows a change in seconds, not in
  frames. With `visibility` a thin wall no longer leaks; without it, it can.
- Reflections of things that are off screen: `screenReflections` shows what
  the frame holds, and with `sky` the sky's colour where a ray finds nothing
  (it cannot tell a roof off screen from open sky). One planar mirror, one
  environment probe; the probe is looked up at its room's walls with
  `environment.box`.
- Shadows from more than eight point lights and one spot light (LayaAir
  3.4.2 draws one spot shadow map). More than four point lights share their
  texture at half the sharpness.
- Motion blur of things that move by themselves: `look.motionBlur` smears
  only what the camera's own movement smears. `look.depthOfField` is one disc
  radius a pixel, without the shape of an aperture. A still or a video gets
  both exactly, by sampling.
- Decals that wrap round geometry (a `decal` node lies on one plane);
  parallax: LayaAir's PBR shader takes no height map. A texture's own fine
  repeat (`variation` hides the grid of tiles, not the pattern inside one).
  A `sweep` does not round its corners.
- Weather: `clouds` is one layer of one kind of cloud; it casts no shadow on
  the ground and nothing rains from it.
- Skin (light that passes through it), hair strands, and cloth sheen in a
  film scene. A flat material has `clearCoat` (lacquer, a wet sheen) and
  `anisotropy` (brushed metal, satin, a band of light on hair); LayaAir's PBR
  material has no subsurface term. Game code reaches sheen, thin films and
  glass through `createSurfaceMaterial({ type: 'physical' })` (LayaAir's
  glTF shader, [physical surfaces](filmic-rendering.md#physical-surfaces));
  a film material does not have them.

## Evidence

Everything above was drawn on desktop WebGL, and the same checks on desktop
WebGPU through `npm run verify:film-webgpu` (Apple M4). Phones and mini-game
hosts need their own records. The checks that draw:

```sh
npm run verify:quality-route   # the two example scenes: advice, metrics, shadow, reflection
npm run verify:film-remount    # a scene draws the same after being mounted again; no WebGL error
npm run verify:film-highlights # a lamp out of focus stays bright: samples averaged before tone mapping
npm run verify:film-reflections # a lamp beside a wall shows in the wall at the mirrored position
npm run verify:film-variation  # a ground of identical tiles stops being identical
npm run verify:film-point-shadow # a lamp's light stops at walls and boxes
npm run verify:film-shapes     # a lathe is round under the light; an extrusion has a top and sides
npm run verify:film-colours    # the same colour is the same light in ambient, ground light, fog and sky
npm run verify:film-bounce     # a sunlit red wall tints the shaded face of a cube beside it
npm run verify:film-look
npm run verify:film-fog
npm run verify:film-reflector
```

See the [verification record](plans/records/quality-defaults/verification.md)
for what was measured and on what.
