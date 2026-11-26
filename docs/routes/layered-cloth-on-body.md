# Route: layered cloth on a modelled body

Two realistic legs and feet, modelled in Blender, in sheer stockings (fifteen kinds,
from 8 denier to opaque, fishnets, lace tops), with a skirt (the engine's cloth),
shorts or trousers over them. Mouse or touch pulls the layer on top, a hard pull tears
it, and through a hole in a garment the stocking below can be pulled in turn. The
stocking is see-through head on and denser toward the edge, thins where it is
stretched, and ladders from a tear.

- **Id:** `layered-cloth-on-body`
- **Kind:** scene
- **For:** A realistic modelled body (legs, feet) in layered clothing that is pulled and torn by mouse or touch: sheer stockings, trousers, skirts as cloth.
- **Checked on:** desktop WebGL; desktop WebGPU; vivo V40 (Chrome 156, WebGPU, real touch)
- **Status:** checked on desktop WebGL and WebGPU (Chrome, Apple M4) and on a vivo V40
  (Android 16, Chrome 156, WebGPU, real touch), 2026-11-15, as the game `stocking-tear` on engine
  1.18.0. Re-checked on 2026-11-26 as the prefab module `3d/layered-hosiery` on this repository's
  engine (2.0.0 and what came after it): desktop WebGPU and WebGL on the graphics card with a
  real mouse. Not re-checked on a phone.
- **Reference consumer:** the prefab library's module `zhuda-engine-prefabs/3d/layered-hosiery/`, opened by
  `zhuda-engine-prefabs/viewer3d` at `?scene=layered-hosiery`. It was the game `stocking-tear`, which left the
  game centre workspace on 2026-11-25; its programs and its body were moved into the library on
  2026-11-26 and shown to draw the same pictures (see Checks). The files named below are the
  module's: `source/export_legs.py`, `meshleg.ts`, `layered-hosiery.ts`, `shaders.ts`,
  `patterns.ts`, `bottoms.ts`; the game's own record is `source/HANDOFF-2026-11-15.md`.
- **Engine version:** made on `zhuda-laya-engine` 1.18.0 at `ed1ddbc`; the module runs unchanged
  on 2.0.0 and after (re-checked at `e4ba0212` with this module's own commit on top).

## When to take this route

- A realistic body part with a layer of clothing that must react: stockings, tights,
  gloves, a sleeve, trousers; a skirt or a cape as cloth over it.
- Not for stylised (anime) characters: start from the [model pipeline](../model-pipeline.md)
  with a VRM or glTF character and [stylized shading](../stylized-shading.md).
- Not for clothing that only animates with a skeleton and never deforms by hand:
  skin it in the DCC tool and use [spring bones](../spring-bones.md) for loose parts.

## Tools

| Tool | Version | Where from | Licence and what may be committed |
| --- | --- | --- | --- |
| Blender | 5.2.2 LTS | blender.org | Run headless (`blender -b`). Nothing of it is committed. |
| MPFB (MakeHuman for Blender) | 2.0.18 | extensions.blender.org (`add-on-mpfb-v2.0.18.zip`, sha256 `c075b3e9…2dad`) | The add-on is GPL-3: use it as an external tool, never vendor it into the engine (MIT), the prefab library or a consumer bundle. The MakeHuman base mesh and what MPFB generates are CC0. |

Install once: `blender --command extension install-file -r user_default -e add-on-mpfb-v2.0.18.zip`.
Run a script with the add-on enabled:

```sh
blender -b --factory-startup -noaudio \
  --python-expr "import bpy; bpy.ops.preferences.addon_enable(module='bl_ext.user_default.mpfb')" \
  --python export_legs.py -- out.json 1.115
```

## Steps

### 1. The body, in Blender (reference: `source/export_legs.py`)

1. **Generate** with `HumanService.create_human(mask_helpers=False, detailed_helpers=True,
   extra_vertex_groups=True, feet_on_ground=True, scale=0.1, macro_detail_dict=...)`.
   The macro values that gave a slim adult woman: gender 0, age 0.5, muscle 0.45,
   weight 0.35, proportions 0.85, height 0.55.
2. **Bake the shape** (`TargetService.bake_targets`, then clear shape keys), and only
   then measure joints (the vertex groups `joint-l-ankle`, `joint-l-knee`, ...).
3. **Cut** to the part you need from the `body` vertex group (here: below the waist,
   no arms), keep the largest connected island.
4. **Stance:** MakeHuman stands with the feet ~44 cm apart. Bring them in with a
   horizontal shear that starts just below the crotch (the thighs keep their gap, the
   soles stay flat); measure the crotch above the knees.
5. **No anatomy:** smooth the crotch region (`bmesh.ops.smooth_vert`, 40 rounds, a box
   7.5 cm either side of the midline) into a plain form.
6. **Subdivide once** (Subdivision Surface, applied): silhouettes stay round on a phone.
7. **The clothing layer as a shape key:** copy the object; Displace along normals by the
   layer's distance (2.3 mm here); Smooth (40 rounds) weighted to where the layer must
   span a hollow (the toes); Shrinkwrap `OUTSIDE`, offset 2.3 mm, **limited to that same
   vertex group**; copy the result into a shape key `sock` on the body.
8. **Split** into left and right at x = 0 (`bisect_plane`), triangulate, and export per
   vertex: position, the normal of the whole body before the cut (on the cut, with x = 0),
   the layer position from the shape key; and the indices. Here: JSON, ~8,000 vertices and
   16,000 triangles a leg, 1.1 MB. Convert Blender's Z-up to Y-up and its -Y forward to +Z.

### 2. Surfaces in the game (reference: `meshleg.ts`)

1. **One `ZhudaDynamicMesh` per surface:** the skin, and each layer (stocking, garment),
   sharing the skin's indices and texture coordinates; a layer's rest shape is the
   exported layer position (or the skin pushed out along its normals).
2. **Winding:** LayaAir's front faces are wound the other way from Blender and glTF;
   reverse each triangle on import. Picking (`ZhudaTriangleBvh`, default `cw`) then works
   with `side: 'front'`.
3. **Per vertex, once:** the angle round the leg's axis (the axis is the mean of the
   vertices in height bands) and the height. Every rule that a grid did by rows and
   columns (where a pull reaches, where a tear starts, the cloth's bodies) works from
   these two numbers.
4. **Texture coordinates:** u round the leg (the seam at the back), v up. Triangles that
   cross the seam get copies of their low vertices with u + 1; a copy follows its
   original every frame (position and summed normal).
5. **Stretch:** for each vertex, the mean ratio of its edges' lengths now to their rest
   lengths, squared, minus one; written to the vertex colour's alpha (divided by its
   maximum, 2.8). Normals are recomputed from the triangles after every move.

### 3. The stocking material (reference: `HOSIERY` in `shaders.ts`, `stockingMaterial` in `layered-hosiery.ts`)

A [lit surface](../filmic-rendering.md#lit-shader-hooks) with `sheen`, `blend: 'alpha'`,
`doubleSided: false`, and a hook that:

1. Samples a knit tile (RG slope, B coverage, A half the squared slope, so mipmaps keep the
   roughness of a far knit) at `uv * (302, 272)`.
2. Writes `s.alpha = 1 - exp(-depth * yarn / (pow(path, 0.52) * (1 + 0.5 * strain)))`,
   with `path = max(0.23, abs(dot(normalize(n), s.viewDirection)))` and the stretch from
   `s.vertexColor.a`: sheer head on, dense at the edge, thinner where pulled.
3. Writes `s.normalTS` from the knit slope, raises roughness with the slope variance and
   the tension, and dims `s.sheenColor` where stretched.
4. Cuts tears: a ragged hole, ladders running from it (rungs about a millimetre apart,
   drawn as their average where finer than a pixel), loose yarn at the lip.
5. On the foot draws the knit as its average (the cylindrical mapping cannot follow a
   foot); adds a reinforced toe from the vertex colour and a denser panty top above the
   crotch.

### 4. Pull and tear (reference: `pull`, `tearOrigin` in `meshleg.ts`; the spring and the tear in `layered-hosiery.ts`)

The pull of the three.js study this consumer started from (a single local HTML page,
not in this repository): a spring-driven amount, a narrow peak on a wide tent of fabric,
limited above by the skirt's hem, kept off the skin; here per vertex. Drive the amount on the engine's clock (`context.runtime.start`, the `world`
layer's delta), never with timers. A tear starts at the most stretched vertex near the
grip; its shape goes to the material. Through a hole in a garment, pick the layer below.

### 5. Skirts as cloth (reference: `buildSkirt` in `layered-hosiery.ts`)

1. `createZhudaClothTube`, then lay each ring round the hips (the support of the legs'
   vertices in that direction), its particles evenly along it, and **recompute every
   constraint's rest length**. Pressed pleats: four columns a pleat (outer crease, face,
   inner crease, face) and a stiff bend (compliance 2e-5).
2. Bodies: one [`table`](../cloth.md) per leg, its radii read off the skin in bands and
   sectors round a fixed axis.
3. Damping: `drag` 4.5 for wool (still within 0.7 s after a lift), 2.5 for chiffon.
4. Lifting: pin a 3 × 3 pinch with `pin`/`movePin` and move it toward the finger at most
   1.6 m/s; the cloth makes the fold.

### 6. Look and phones (reference: `hosieryLook`, `mountHosieryStudio`, `frameHosiery` in `layered-hosiery.ts`; the phone settings in `zhuda-engine-prefabs/viewer3d/src/presets/layered-hosiery.ts`)

1. [`ZhudaSceneLook`](../quality-route.md) with the sun from above the camera, AgX tone
   mapping, SMAA; `ZhudaHdrEnvironment` with `zhudaStudioEnvironment()` for the room's
   light; rim lights dimmer than the sun (see Pitfalls).
2. Phones: `dprCap: 2` and `look.setRenderScale(0.75, { upscale: 'fsr' })` with SMAA
   (FSR is skipped under FXAA). On the V40 this kept the knit visible at ~55 fps idle;
   a 1.5 cap was blurry, the native 2.625 ran at ~23 fps.
3. Frame from the waistband to the soles; a floor in the background's colour faded by
   the look's `fog`, so there is no horizon line.

## Pitfalls

| Seen | Cause | Fix |
| --- | --- | --- |
| Jagged see-through walls on the feet | Joints were measured on MPFB's base mesh before the shape was baked; the stance shear moved the feet across the midline and the left/right split sliced them | Bake first, then measure joints; check the feet's x range clears the midline |
| A layer pushed against the other foot | Shrinkwrap targeted the whole body | Limit Shrinkwrap to the vertex group it is for |
| Stair-step slabs in a see-through layer | Double-sided alpha blending on a concave mesh draws its inside over its outside in triangle order | `doubleSided: false` for a blended layer |
| Smoothing landed on the knees | With the legs together the inner knees also reach the midline | Find the crotch above the knees (above the hip joint minus 25 cm) |
| A seam down the middle of the body | Normals recomputed after the cut differ on the two halves | Take normals from the whole body before the cut; on the cut set x = 0 |
| Zebra stripes in a tear on a phone | Ladder rungs drawn 9 mm apart (24 a unit) | Rungs ~1 mm apart and drawn as their average below a pixel |
| A hook that works on WebGL loses its tears on WebGPU | `fwidth`/`dFdx` inside a branch or a function called from one: WGSL demands uniform control flow | Compute derivatives at the top of the hook and pass them in |
| Moire on fine weaves on a phone | A weave finer than a pixel | Fade it out by `fwidth` of its phase |
| The sun's shadow disappears | LayaAir gives the shadow to the brightest directional light | Keep added lights' intensity below the sun's; put strength in their colour |
| Two materials of one shader name fail ("different contract") | The lit surface's name contract included each uniform's starting value (fixed in the engine on 2026-11-17: only the types count) | On an engine before the fix: create every material with neutral values, then `set()` its own |
| The first press does nothing in a test | The start splash takes the pointer for ~2.2 s and leaves 450 ms later | `await whenZhudaSplashGone()` (after 2.0.0) before the page says it is ready; on 2.0.0 and before, wait for `window.__ZHUDA_SPLASH__.completed` and half a second more |
| A held skirt jitters | Each hand of the engine's cloth waits on its own stretch | Pin a small pinch and move the pins smoothly |

## Engine gaps and their workarounds

| Gap | Engine plan | Workaround in the reference consumer |
| --- | --- | --- |
| The lit surface takes no uniform arrays | WP21 | Twelve tears as 24 named `vec4` uniforms and twelve unrolled calls |
| The scene look's sun loses its shadow to a brighter light | WP22, done 2026-11-17: a light that casts no shadow no longer takes it | On an engine before it: added lights dimmer than the sun |
| A failed hook compile stops drawing on WebGPU | WP23, done 2026-11-17: its objects are left out, the rest is drawn | Check `renderer.errors` after every shader change |
| The cloth's hand holds one particle | WP24 | A pinned 3 × 3 pinch moved with `movePin` |
| No body-to-layer helper (offset shell, per-vertex pull, stretch, tear) | not scheduled as an engine API; since 2026-11-26 a prefab module | `meshleg.ts` of `zhuda-engine-prefabs/3d/layered-hosiery` (`npx zhuda-prefabs-sync . 3d/layered-hosiery`) |

## Checks

As the game, 2026-11-15 (engine 1.18.0):

- `npm run verify` in the consumer (build, types, Doctor, the catalogue's tests).
- Desktop: headless Chrome through the engine's `chromeFixture` with real mouse events
  (`Input.dispatchMouseEvent`), on the WebGPU and the WebGL build: tear both legs, hold a
  pull, tear trousers and the stocking through the hole, lift each skirt.
- Phone (vivo V40): `adb reverse tcp:<port> tcp:<port>` for the page, `adb forward
  tcp:9333 localabstract:chrome_devtools_remote` to read state and frame times from the
  page; touch with `input motionevent DOWN/MOVE/UP` (on this phone `input swipe` stopped
  reaching page content part way through a session).
- Measured on the V40, WebGPU: ~55 fps idle with the modelled legs, feet, floor and fog;
  skirt cloth 64 × 14 ~6 ms a frame.

As the prefab module, 2026-11-26 (Apple M4, Chrome 158 on the graphics card, this repository at
`e4ba0212` with the module on top; pictures in `zhuda-engine-prefabs/3d/layered-hosiery/preview/`, the record in
`local-results/hosiery-modules/`):

- **The move changed no picture.** The game's sources, unchanged, build against this engine;
  the game and the module were driven by one script, twice each (WebGPU, 1280 × 720, real mouse):
  as worn, both thighs torn, the lace top, jeans, the long skirt, fishnets under ripped shorts.
  In each of the six pictures the share of pixels that differ by more than 8 of 255 is 0.000%;
  two of the pictures are identical; the largest single difference (26) is of the size of the
  game's own difference between its two runs (18).
- `zhuda-engine-prefabs/3d/layered-hosiery/source/look-book.mjs` through `games/tools/shot.mjs --gpu --hook
  __SCENE__`, on the WebGPU build and on the WebGL build, 39 pictures each: no renderer error,
  no page error. By real mouse: a tear on each thigh; jeans torn (tears `[0,0,1,0]`: two
  stockings, two garments) and the fishnet under them torn through the same hole
  (`[1,0,1,0]`); the long skirt's hem lifted from a mean height of 0.285 m to 0.435 m and back
  at 0.286 m 1.2 s after letting go. All fifteen kinds and all thirteen bottoms were drawn on
  both backends (this closes "the WebGL build after the switch to the modelled legs").
- `zhuda-engine-prefabs/tests/layered-hosiery.test.mjs`, nine tests without a browser: the catalogue, the body
  file, the hooks' three rules (no derivative under a branch among them), and the per-vertex
  layer run on the real body (pull, relax, where a tear starts, a garment layer, the cloth's
  bodies).
- `zhuda-engine-prefabs/viewer3d`: `npm run verify`; `node tools/play.mjs scenarios/layered-hosiery.json
  "scene=layered-hosiery"` tears both thighs by `drag` steps.

## Not checked

- Anything on a phone since the move into the library: the V40 numbers above are the game's,
  on engine 1.18.0.
- Frame times on the phone while a pull is dragged on the modelled legs (on the earlier
  hand-built mesh of 31,000 vertices a leg: ~37 fps on WebGPU).
- What a frame costs on the desktop, measured on a quiet machine. On 2026-11-26 the Mac was
  busy (load average about 6): with a skirt the cloth took about 5 ms a frame in one run at
  60 fps and over 30 ms in runs where frames were slow and each made up more steps; the game's
  own sources gave the same spread. `Cloth.ts` did not change between the two engine versions.
- Every stocking kind with every garment on the phone; battery and heat over long use.
- Other bodies (gender, size) from the same script; other body parts (arms, torso).
  `export_legs.py` was not run again (it needs MPFB installed): the body file is the game's.
- iPhone / Safari.
- No person has looked at the module's pictures.

## Boundaries

- The prefab module owns the body, its parameters, the export script, the stocking catalogue,
  the pull and tear rules and its evidence (`zhuda-engine-prefabs/3d/layered-hosiery/`). A game takes them with
  `zhuda-prefabs-sync` and writes only its own rules and interface on top.
- MPFB is not in the repository and must not be: it is GPL-3. Its output (the body file) is CC0.
- The engine owns the APIs this route uses. The generic part of `meshleg.ts` (an offset layer
  over any mesh that can be pulled, measured for stretch and torn) is a candidate engine
  feature; it is not one yet.
- The catalogue is adult styles on an adult body, and has no school-uniform skirt: the game
  left it out on purpose, and the module keeps it so.
