# Post quality: curves, colour tables, edges, occlusion, flare

What the HDR chain (`ZhudaFilmicPipeline`, and a look's `grade`) can do
beyond LayaAir 3.4.2's own effects. All of it is drawn on WebGL and on WebGPU
by `npm run verify:post-quality`, and was run on a phone (the numbers below).

| What                                   | Class or field                                 | Passes it adds                         |
| -------------------------------------- | ---------------------------------------------- | -------------------------------------- |
| AgX, neutral and no tone curve         | `toneMapping`                                  | none                                   |
| White balance, lift, gamma, gain       | `temperature`, `tint`, `lift`, `gamma`, `gain` | none                                   |
| A colour table from a `.cube` file     | `ZhudaColorLut`, `grade.lut`                   | one                                    |
| Edge smoothing by the shape of an edge | `ZhudaSmaa`, `antialias: 'smaa'`               | three                                  |
| Ambient occlusion by horizons          | `ZhudaGroundTruthAO`, `aoMethod: 'gtao'`       | two (LayaAir's: four and a scene pass) |
| Lens flare that a wall hides           | `ZhudaLensFlare`, `look.lensFlare`             | a copy, one pixel, a quad an element   |
| Bloom's threshold, knee, shape, dirt   | `bloomThreshold` and the fields beside it      | none                                   |

## Tone curves

```ts
const film = new ZhudaFilmicPipeline(camera, { toneMapping: 'agx' });
film.setGrade({ toneMapping: 'neutral' }); // while it runs
```

- `aces` (default): LayaAir's filmic curve. Strong contrast; a bright red
  turns toward orange before it whitens.
- `agx`: bright colours fade to white without changing hue; softer contrast.
- `neutral` (Khronos PBR Neutral): a colour whose brightest channel is below
  0.76 comes out as it went in, less a lift of 0.04 at most taken off its
  darkest channel. For a material that must match its swatch.
- `none`: no curve; above white is cut off.

A curve costs no pass. LayaAir's grade looks each pixel up in a small table
it draws once; with `agx`, `neutral` or `none` that lookup pass is this
engine's and works the curve out for each pixel after the table. Its table
starts at black and holds the graded light in the encoding it is looked up
by, so a grade that changes nothing changes nothing: on a chart of 21
patches (greys from black to 32 times white, colours, one colour beyond the
table) the screen is within 0.6 of 255 of the curve's arithmetic, and black
is 0. LayaAir's own table holds plain light and is up to 1.2 % off between
its entries; `aces` is LayaAir's path, untouched.

`zhudaAgxToneMap`, `zhudaNeutralToneMap` and `zhudaToneMap` are the same
arithmetic on the CPU, for tools.

## White balance, lift, gamma, gain

```ts
film.setGrade({ temperature: 20, tint: -5, lift: [0, 0, 0.02], gain: [1.1, 1, 0.95] });
```

- `temperature`, `tint`: -100..100. Above 0 `temperature` is warmer, `tint`
  toward magenta; below 0 cooler, toward green.
- `lift`, `gamma`, `gain`: three numbers each for red, green and blue, on the
  scene's light before the curve, as `(colour * gain + lift) ^ gamma`.
  `gamma` above 1 darkens the middle. With `none` as the curve the screen
  shows exactly that arithmetic (within 0.5 of 255).

They are LayaAir's own grading, switched on when a value differs from its
default, and cost nothing a frame.

## A colour table

```ts
import { parseZhudaCubeLut, ZhudaColorLut } from 'zhuda-laya-engine';

const table = new ZhudaColorLut(parseZhudaCubeLut(text), { intensity: 1 });
const film = new ZhudaFilmicPipeline(camera, { finishEffects: [table.effect] });
table.setIntensity(0.5); // half of the table's colour
table.setLut(another); // another table in place
```

- `parseZhudaCubeLut` reads the Adobe `.cube` format (`TITLE`,
  `LUT_3D_SIZE` 2 to 256, `DOMAIN_MIN`, `DOMAIN_MAX`, comments, and the
  `LUT_3D_INPUT_RANGE` line some tools write). Anything else is refused with
  its line number: a one-dimensional table, a wrong number of entries.
- The table is applied to the finished picture, on the colours the screen
  shows, which is what a grading tool exports it for. Put it first in
  `finishEffects`.
- Up to 65 entries an edge are drawn with (the slices lie in rows of one
  texture: 585 by 520 for 65). Sixteen-bit floats where the device blends
  between them, else eight bits.
- `zhudaSampleCubeLut(table, colour)` is the lookup on the CPU.

In a film scene: `look.grade.lut: { asset: 'looks/dusk.cube', intensity }`.
The file is loaded with the scene (`loadZhudaFilmScene`; `ZhudaFilmAssets`
keeps parsed tables in `colorTables`). A game's `ZhudaSceneLook` loads
nothing: the game reads its own file and hands the table over with
`sceneLook.setColorTable(parseZhudaCubeLut(text))`; until then the picture is
as without a table. A running look can change `intensity`, not the asset.

## Edge smoothing by shape (SMAA)

```ts
const smaa = new ZhudaSmaa({ quality: 'high' });
const film = new ZhudaFilmicPipeline(camera, { finishEffects: [smaa.effect] });
```

Where the picture steps, the method follows the step to both ends, works out
how much of each pixel the true edge would have covered, and mixes each
pixel with its neighbour by that much.

Distance from the true coverage, as a share of white, mean over the pixels an
edge crosses and those beside them (a hard-edged white half-plane on black,
480 by 300):

| Edge at              | 4°    | 12°   | 27°   | 45°   | 63°   | 83°   |
| -------------------- | ----- | ----- | ----- | ----- | ----- | ----- |
| not smoothed         | 0.085 | 0.083 | 0.082 | 0.063 | 0.082 | 0.084 |
| `ZhudaEdgeSmoothing` | 0.034 | 0.098 | 0.106 | 0.032 | 0.106 | 0.045 |
| `ZhudaSmaa` (`high`) | 0.010 | 0.017 | 0.037 | 0.012 | 0.038 | 0.011 |

- What is not an edge is left as it was: one colour, a slow ramp and grain
  fainter than an edge came through with no pixel changed (on the phone 202
  of 144 000 pixels of the grain were 1 of 255 off: a pass more rounds once
  more there). FXAA changed 56 591 pixels of the grain.
- `quality`: how far an edge is followed and what counts as one. `low` 8
  pixels to each side, `medium` 16, `high` 32 (default), `ultra` 64 and a
  finer threshold. Only long, shallow steps need the reach (at 4° `low` is
  twice as far off as the others).
- `cornerRounding` (default 0): a level or upright edge that ends in a
  corner is left as it is. The reference rounds such corners by 0.25, which
  lays a faint ramp along the edge: round a white box that changed 256
  pixels by up to 15 of 255; at 0, 8 pixels by 2.
- It reads no depth and works after the curve; pixels are mixed as light.

Limits: it does not look for diagonal patterns, so edges near 30° and 60°
keep more of their steps (the table). A line thinner than a pixel is not
recovered. Three passes and two pictures of the frame's size at eight bits.

The method and its two lookup tables are SMAA 2.8 (Jimenez and others, MIT);
see `vendor/threejs-post/README.md`.

## Ambient occlusion by horizons (GTAO)

```ts
const film = new ZhudaFilmicPipeline(camera, { aoMethod: 'gtao', aoRadius: 0.5 });
film.groundAO.set({ slices: 3, steps: 6 });
```

Round each pixel a few slices are cut through the depth picture, the horizon
is found to both sides of each, and the share of an evenly lit sky that still
reaches the point is worked out for that slice.

Light left, 1 is all of it (white surfaces under a white sky, radius 0.5):

| Distance from the foot of a wall | 0.04 | 0.1  | 0.2  | 0.3  | 0.45 and more | open floor | sky  |
| -------------------------------- | ---- | ---- | ---- | ---- | ------------- | ---------- | ---- |
| `gtao`                           | 0.74 | 0.87 | 0.97 | 0.99 | 1.00          | 0.99       | 1.00 |
| `gtao`, half size                | 0.76 | 0.83 | 0.95 | 0.98 | 1.00          | 0.99       | 0.99 |
| `sao` at 0.65 (LayaAir's)        | 0.51 | 0.52 | 0.53 | 0.54 | 0.55          | 0.84       | 0.87 |

- Open ground, an open wall and the sky are left as they are. LayaAir's own
  darkens all three.
- `aoIntensity` is a power, 0..4: 1 is what the geometry hides (the default
  with `gtao`), 2 squares it.
- It reads the depth picture only and takes the surface normal from it.
  LayaAir's needs the scene drawn once more for normals.
- Sixteen turns of the slices are spread over every four by four pixels and
  the second pass averages exactly those: nothing of the pattern is left on
  a flat surface.
- `aoHalfSize` works the occlusion out at half size: softer contact.
- As any occlusion laid over a finished picture, it darkens direct light as
  well as ambient light: keep it mild in sunlit scenes.

In a look: `grade.aoMethod: 'gtao'`.

## Lens flare

```ts
const flare = new ZhudaLensFlare(); // the flare made for a low sun
const film = new ZhudaFilmicPipeline(camera, { sceneEffects: [flare.effect] });
flare.setLight({ toward: [0.3, 0.5, -0.8], color: [1, 0.95, 0.85] }); // or { position }
```

A glow round the light, a streak through it, and ghosts along the line from
the light through the middle of the picture. Each element is a shape drawn
by arithmetic (`glow`, `disc`, `ring`, `polygon`), so a flare needs no
pictures.

- **It is hidden by what hides the light.** Sixteen points round the light
  are looked up in the depth picture and the flare is as strong as the share
  of them that nothing stands in front of: behind a wall nothing is drawn,
  with the wall's edge through the sun about half. A lamp (`position`) is
  hidden by what is nearer than it. LayaAir 3.4.2's own `LensFlareEffect`
  draws through everything.
- Outside the frame the flare fades over a third of the frame's width;
  behind the camera there is none.
- An element: `shape`, `at` (0 on the light, 1 in the middle of the picture,
  2 as far beyond), `size` (its width as a share of the picture's height),
  `stretch` (width over height), `color`, `strength`, `rotationDeg`,
  `follow`, and for the shapes `sides`, `softness`, `width`.
  `ZHUDA_LENS_FLARE_SUN` is the default list; `validateZhudaLensFlare`
  checks one without the runtime.
- It adds light to the scene before bloom and the curve.

Limit: clouds and fog drawn after the scene are not in the depth picture.
Lower `strength` under an overcast sky.

In a look: `lensFlare: true` or `{ strength, occlusionRadius, elements }`;
its place and colour follow the look's sun.

## Bloom

`bloomThreshold` (a display value: 1.2 is light above 1.55 of white),
`bloomSoftKnee` (0 a hard start, 1 gradual), `bloomAnamorphic` (-1..1:
stretched upright or sideways), `bloomDiffusion` (1..10: each step more
doubles the reach), and a picture of the marks on a lens that lights up
where the bloom falls on it:

```ts
film.setBloomDirt(texture, 2); // null takes it away; the texture stays the caller's
```

LayaAir 3.4.2 lays a dirt picture over the frame correctly only when their
shapes differ; the pipeline sets the cover for equal shapes.

## What it costs

A vivo V40 (Adreno 720), a picture of 823 by 1749, 36 balls and a floor
under a shadowed sun, median of 60 frames each drawn to the end, three runs:

| Chain                        | ms a frame       |
| ---------------------------- | ---------------- |
| graded, ACES                 | 19.6, 17.4, 16.6 |
| AgX                          | 19.9, 15.0, 16.2 |
| neutral                      | 21.5, 20.5, 19.4 |
| FXAA                         | 19.9, 20.9, 20.5 |
| SMAA `low`                   | 21.8, 22.0, 22.6 |
| SMAA `high`                  | 21.9, 21.9, 21.9 |
| colour table, 33             | 20.8, 19.2, 20.6 |
| occlusion: LayaAir's         | 36.7, 36.9, 37.6 |
| occlusion: by horizons       | 25.7, 25.2, 25.5 |
| occlusion: by horizons, half | 23.3, 21.5, 23.2 |
| lens flare                   | 20.7, 20.3, 19.9 |

The plain chain varies by 3 ms between runs, so differences under that are
not told apart here: the curves, the table and the flare are within it.
SMAA is 1 to 2 ms over FXAA. Occlusion by horizons is about 11 ms a frame
cheaper than LayaAir's, and at half size about 14. One phone, one scene.

The same page ran its checks on that phone with the same results as on the
desktop GPU. WebGPU on a phone and iPhone are not measured.
