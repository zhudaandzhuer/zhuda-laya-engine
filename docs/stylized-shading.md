# Stylized shading and the selection outline

Three ways to draw a surface that is not physically based, and a line round
what is selected. All of them are drawn on WebGL and on WebGPU by
`npm run verify:stylized-shading`.

| What                                   | Lights and shadows | Cost                                  |
| -------------------------------------- | ------------------ | ------------------------------------- |
| `ZhudaToonMaterial`                    | LayaAir's, banded  | as a physically based surface         |
| its outline                            | none               | the mesh drawn once more              |
| `shaderRecipes.matcap3D`               | none: a picture    | one texture read                      |
| `shaderRecipes.normalView3D`           | none               | nothing but the normal                |
| `ZhudaSelectionOutline` (post-process) | none               | the selected meshes again, and a pass |

## Toon material

```ts
import { ZhudaToonMaterial, zhudaToonRamp } from 'zhuda-laya-engine';

const toon = new ZhudaToonMaterial({
  name: 'ZhudaHeroToon',
  ramp: { edges: [0.3, 0.7], levels: [0.2, 0.55, 1], softness: 0.02 },
  highlight: { color: [1, 1, 1], sizeDeg: 12 },
  rim: { color: [0.4, 0.7, 1], width: 0.3, strength: 0.5 },
  outline: { color: [0.1, 0.1, 0.15], width: 2 },
  material: { color: [1, 0.55, 0.3, 1], textures: { albedo } },
});
renderer.sharedMaterial = toon.material;
// later, without compiling anything
toon.setRamp(zhudaToonRamp(4));
toon.setOutline({ color: [0, 0, 0], width: 3 });
```

It is the lit template (`ZhudaLitSurfaceMaterial`) with its lighting
replaced: the same `surface` and `vertex` hooks, custom uniforms, textures,
shadow and depth passes, skinning, instancing and fog.

- **The bands.** Each light gives a point `N·L` times its shadow, 0..1. The
  ramp cuts that into bands: `edges` (one to four, ascending) are where one
  band ends, `levels` (one more than the edges, not decreasing) how bright
  each band is. The first level is the side turned away and every cast
  shadow: a shadow has the same hard rim as the shaded side. `softness` is
  the width of the blend across an edge, in the same unit (0 is a hard
  step). `zhudaToonRamp(bands)` makes two to five even bands;
  `zhudaToonBand(ramp, lit)` is the shader's arithmetic, for tools.
- **Every light.** The loop is LayaAir's own: directional lights, and the
  clustered point and spot lights with their falloff. A band's level
  multiplies the light's colour, so a lamp fades with distance as it does on
  other surfaces while `N·L` is banded.
- **Ambient light** is the scene's, taken flat by default (the same on every
  side, as a drawing is shaded): `ambient: { strength, flat }`; `flat: 0`
  lets it fall on each side as it does on other materials.
- **Highlight**: a disc with a hard rim where `N·H` passes the cosine of
  `sizeDeg`, only on the lit side. **Rim**: a band at the silhouette,
  `width` of the way in. Both take a display colour and a `strength` (above
  1 it is bright enough to bloom).
- **Outline**: a second forward pass of the same material draws the back
  faces pushed out along the normals in one colour. `width` is in pixels of
  the picture being drawn (`space: 'screen'`, the default: the same at any
  distance) or in scene units (`space: 'world'`). It moves with the bones
  and with the vertex hook because it is the same vertex program. Whether a
  shader has the pass is fixed by the first material of its name;
  `setOutline` changes colour, width and space, and a width of 0 hides it.
- Metallic and roughness are not used: the whole base colour is banded.
- `validateZhudaToonSpec` and `validateZhudaToonRamp` list what is wrong
  without the runtime.

Limits:

- The outline needs smooth normals. A mesh with split normals (the corners
  of a cube) opens gaps in it.
- The outline is not in the depth texture: depth of field and fog by depth
  see what is behind the line. Scene fog (`FOG`) does fade it.
- With a render scale below 1 the pixels of a `screen` outline are those of
  the smaller picture.
- The bands are not anti-aliased by the shader. A `softness` of 0.02 softens
  an edge over a pixel or two on a curved surface; edge smoothing
  (`antialias: 'fxaa'`) does the rest.
- A lamp's falloff is not banded: only `N·L` and the shadow are.

## Matcap and normal view

```ts
import { ZhudaShaderMaterial, shaderRecipes } from 'zhuda-laya-engine';

const clay = new ZhudaShaderMaterial(shaderRecipes.matcap3D, { u_ZhudaMatcap: picture });
const normals = new ZhudaShaderMaterial(shaderRecipes.normalView3D);
```

- `matcap3D`: a picture of a lit ball stands in for the lighting. Each point
  takes the colour the ball has where it faces the same way, as the camera
  sees it; the top of the picture is the side facing up. The lookup follows
  the direction to the eye, so the picture stays upright on a mesh at the
  edge of a wide view. `u_ZhudaTint` multiplies it.
- `normalView3D`: the view-space normal as a colour (right is red, up is
  green, toward the camera is blue). Without a grade the screen shows the
  numbers as they are: `(n * 0.5 + 0.5) * 255`.

Neither is lit or shadowed, and neither casts a shadow.

## Selection outline

```ts
import { ZhudaSelectionOutline, zhudaOutlinePulse } from 'zhuda-laya-engine';

const selection = new ZhudaSelectionOutline({
  visibleColor: [1, 0.72, 0.1],
  hiddenColor: [0.2, 0.6, 1],
  width: 2,
});
const film = new ZhudaFilmicPipeline(camera, { finishEffects: [selection.effect] });
selection.select([unit]); // nodes; everything under each is outlined
// each frame, from the clock the scene runs on
selection.setStrength(zhudaOutlinePulse(seconds, 1.2, 0.35));
```

The selected renderers are drawn once more into a mask (a skinned mesh as it
is posed), and one pass over the picture draws a line just outside the mask.

- Where the selected thing is behind something else the line takes
  `hiddenColor` (default: the same colour) at `hiddenStrength`, and
  `hiddenFill` tints that part; `hiddenColor: null` draws no line there.
- `occlusion: false` draws one colour through everything and does not ask
  for the camera's depth texture. With occlusion the camera draws its depth
  texture if nothing else asked for it.
- `width` is 1 to 6 pixels of the picture. `set({...})` changes colours,
  width and fill; `setStrength` scales line and fill (0 draws nothing).
- In `finishEffects` the line keeps its colour: a display colour, as
  `SurfaceMaterialSpec.color` is. In `sceneEffects`, or in a camera's own
  post-process chain, it is graded with the scene.
- With nothing selected the effect copies the picture.
- A destroyed node leaves the selection by itself. `dispose()` after the
  effect has left its chain.

Limits:

- The mask holds one sample a pixel: the inner side of the line follows the
  mesh a pixel coarser than multisampled edges.
- A selected mesh drawn with a vertex hook (grass in the wind) is masked
  where it stands still.
- A thing thinner than a pixel may be met by the line only in places.

## What it costs

A vivo V40 (Adreno 720), a picture of 823 by 1749, 36 balls and a floor with
a shadowed sun, median of 60 frames each drawn to the end (two runs):

| Drawn as                            | ms a frame |
| ----------------------------------- | ---------- |
| physically based                    | 17.4, 17.5 |
| toon                                | 15.4, 18.2 |
| toon with an outline                | 17.2, 19.8 |
| graded chain, no selection          | 21.0, 22.0 |
| selection outline, nothing selected | 21.5, 21.8 |
| six balls selected                  | 25.1, 25.0 |
| six selected, no occlusion          | 24.3, 24.6 |

The banded light costs what the physical one does within the spread of two
runs; the outline pass is under 2 ms for 37 meshes; a selection is about
3 ms while something is selected and nothing measurable while nothing is.
One phone, one scene.
