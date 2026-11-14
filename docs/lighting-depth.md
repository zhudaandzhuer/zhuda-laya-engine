# Lighting depth: falloff, penumbra, shadow width, cascades, contact shadows

What a scene's lamps and the sun's shadow can be told beyond LayaAir 3.4.2's
own. All of it is drawn on WebGL and on WebGPU by
`npm run verify:lighting-depth`, and was run on a phone.

| What                                  | Asked with                          | Cost                                   |
| ------------------------------------- | ----------------------------------- | -------------------------------------- |
| Falloff by the square of the distance | `falloff: 'physical'`               | none                                   |
| A spot's penumbra                     | `setZhudaSpotPenumbra(light, 0..1)` | a read of the light buffer a spot      |
| A wider soft shadow                   | `shadowSpread: 1..4`                | sixteen shadow reads for nine          |
| Cascades that meet without a line     | `cascadeBlend: true`                | a few operations a pixel               |
| Contact shadows                       | `contactShadows: 0.02..2`           | eight depth reads a lit pixel          |
| Point-light shadows kept up to date   | `ZhudaPointShadowSchedule`          | as many lamps a frame as it is allowed |

```ts
import { ZhudaLightingDepth, setZhudaSpotPenumbra } from 'zhuda-laya-engine';

const lighting = new ZhudaLightingDepth(
  scene3D,
  { falloff: 'physical', shadowSpread: 2, cascadeBlend: true, contactShadows: 0.3 },
  camera, // for contact shadows: it is asked for its depth picture
);
setZhudaSpotPenumbra(spotLight, 0.2);
lighting.set({ contactShadows: 0 }); // any value, while it runs
lighting.dispose();
```

A scene has one `ZhudaLightingDepth`. A look makes it by itself: see
[the look's fields](#in-a-look).

`ZhudaEngine.boot` changes LayaAir's lighting and shadow includes as text
before LayaAir compiles its shaders (`installLaya342LightingDepth`), as it
does for point-light shadows. Each change compiles to LayaAir's own
arithmetic until a scene switches it on: a scene that asks for nothing
draws as before.

## Falloff

LayaAir's lamp is as bright at its middle whatever its range, and its light
follows the share of the range, not the distance: a lamp of twice the range
is as bright at four metres as the other is at two.

With `falloff: 'physical'` a lamp's `intensity` is its brightness at one
unit of the scene: a white floor one unit under a lamp of 1 is drawn at 1.00
(0.996 measured). It is a quarter of that at two units and a sixteenth at
four, and a window brings it to nothing at the lamp's `range` (0.88 of what
the square says at half the range).

Light under a lamp of range 10, as a share of the light at one unit:

| Height        | 0.5  | 1   | 2    | 4    | 7    | 9.5  | 10.5 |
| ------------- | ---- | --- | ---- | ---- | ---- | ---- | ---- |
| LayaAir's     | 1.17 | 1   | 0.62 | 0.25 | 0.10 | 0.02 | 0    |
| by the square | 3.90 | 1   | 0.25 | 0.06 | 0.01 | 0    | 0    |

A lamp that should light a street from five metres as it did before needs
about 25 times its old number: that is what the square means. In a film
scene a light's `intensity` may be up to 2000 with it.

`zhudaPhysicalFalloff(distance, range)` and `zhudaLayaFalloff` are the
arithmetic on the CPU. The switch is for the whole scene, point and spot
lights alike. There are no photometric units: `intensity` stays a multiple
of white.

## A spot's penumbra

LayaAir's spot is fully bright inside half its cone's angle and soft from
there to the rim. `setZhudaSpotPenumbra(light, penumbra)` sets how much of
the cone is soft, a light at a time: 0 a hard rim, 1 soft from the middle
out, `null` LayaAir's own half again. `light` is the LayaAir spot light
component; it shows in scenes that have a `ZhudaLightingDepth`.

A cone of 60°: light at an angle from the axis as a share of a hard-rimmed
cone's (measured, and `zhudaSpotCone` beside it):

| Penumbra | 8°          | 15°         | 22°         | 27°         | 29°         |
| -------- | ----------- | ----------- | ----------- | ----------- | ----------- |
| 1        | 0.99 (0.99) | 0.84 (0.84) | 0.45 (0.44) | 0.10 (0.09) | 0.02 (0.01) |
| 0.5      | 1           | 1           | 0.68 (0.67) | 0.17 (0.16) | 0.03 (0.02) |
| 0.25     | 1           | 1           | 1           | 0.42 (0.40) | 0.08 (0.06) |

The number travels in the unused fourth texel of the light's row in
LayaAir's light buffer: nothing is added to the scene's uniforms.

## The sun's shadow

- **`shadowSpread`**, 1..4: how wide the soft edge is, in multiples of
  LayaAir's. At 1 it is LayaAir's own filter. Above 1 the edge is sixteen
  reads on a disc that is turned differently in every pixel: 7 pixels wide
  at 1, 15 at 2 and 26 at 3.5 in the check's view, a fine grain and no
  steps. (LayaAir's filter stretched over more texels shows steps; that was
  tried and dropped.) For soft shadows.
- **`cascadeBlend`**: in the last part of a cascade pixels take the next
  one more and more often, and past the last cascade the shadow fades out.
  Beside a long wall: without it the shadow is whole at 31 units, 0.97 at
  32, 0.68 at 33 and gone at 34; with it 0.98 at 31, 0.63 at 32, 0.17 at 33.
- **`contactShadows`**: how far toward the sun a lit point looks for
  something in its way, in scene units. Eight steps through the depth
  picture; only the sun's light is shaded, so nothing is darkened twice.
  They shade what the shadow map is too coarse to hold and reach beyond the
  shadow's distance. A kerb 0.12 high under a sun 45° up, beyond the map:
  the ground beside it is dark at 0.06 and at 0.1, and lit from 0.16 on,
  where without them it is lit everywhere. Flat ground does not shade
  itself. It works with and without an HDR chain, in a lens's view and a
  flat one.

The spread and the reach travel in the two numbers of LayaAir's
`u_ShadowParams` that it leaves unused. While a scene has a
`ZhudaLightingDepth`, LayaAir is handed a copy of that vector to write its
shadow strengths into: by itself it changes the scene's own in place, which
then counts as unchanged, and on WebGPU a new strength never reaches the
graphics card.

Limits: contact shadows see what the depth picture holds, so something
outside the frame or behind something else shades nothing, and a thing
thicker than half the reach is taken for thin. They need the sun's shadows
on (they are part of how a surface receives them). The camera's depth
picture is one more pass over the scene's opaque things if nothing else
asked for it.

## Point-light shadows on a schedule

A point light's shadow is six pictures of the scene
(`ZhudaPointShadow.render`), drawn when asked.

```ts
import { ZhudaPointShadow, ZhudaPointShadowSchedule } from 'zhuda-laya-engine';

const shadow = new ZhudaPointShadow(scene3D, { lights: 8 });
const schedule = new ZhudaPointShadowSchedule(
  (position, range, light) => shadow.render(position, range, light),
  { perFrame: 1 },
  (light) => shadow.clear(light),
);
lamps.forEach((lamp, i) => schedule.set(i, { position: lamp.position, range: lamp.range }));
// every frame, after lamps and casters have moved
schedule.set(3, { position: carried.position, range: 8 }); // a lamp that moved is out of date
schedule.touch(5); // something moved near lamp 5
schedule.update(); // draws one lamp, the one that has waited longest
```

- A lamp is out of date when it is new, when it moves by more than the
  tolerance or reaches another distance, when `touch` names it, and always
  for a lamp marked `moving` (a street with walkers): those take turns, so
  eight of them at one a frame each get new pictures every eighth frame.
- A lamp never drawn goes first; then the longest wait; of two that waited
  as long, the one told to be out of date.
- `flush()` draws all that are out of date at once (a cut, a loaded level).
- It has no clock and draws nothing itself: `update()` is one frame.

## In a look

```json
"lightFalloff": "physical",
"shadows": { "spread": 2, "blend": true, "contact": 0.3 }
```

and `"penumbra": 0.2` on a film scene's spot light. All of them change in
a running look. Quality level 1 drops contact shadows and the wide edge;
level 0 the blend as well; how lamps fall off stays at every level.

## What it costs

A vivo V40 (Adreno 720), a picture of 823 by 1749, 36 balls and a floor
under a soft-shadowed sun (2048, two cascades) and four lamps, graded;
median of 60 frames each drawn to the end, three runs:

| Scene                     | ms a frame       |
| ------------------------- | ---------------- |
| no `ZhudaLightingDepth`   | 28.7, 28.9, 28.4 |
| one that asks for nothing | 29.4, 29.0, 28.8 |
| `falloff: 'physical'`     | 29.0, 28.4, 28.8 |
| `shadowSpread: 2`         | 30.0, 28.3, 29.9 |
| `cascadeBlend`            | 29.2, 28.4, 29.7 |
| `contactShadows: 0.3`     | 31.6, 31.8, 32.3 |
| all four                  | 41.6, 38.5, 38.9 |

The first row is the scene measured after all the others. Measured first,
before them, it read 32.7, 31.3 and 31.2: the first case of a run reads
about 3 ms high. Contact shadows are about 3 ms; the others are inside the
spread of the runs one at a time. All four together are about 10 ms, more
than the parts add up to; why was not looked into. One phone, one scene.

The check's own page ran on that phone with the desktop's results.
