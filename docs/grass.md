# Grass

`ZhudaGrassField` grows grass a player walks through: narrow curved blades in
clumps, moved by the wind, lit and shadowed like the ground they stand on,
over turf in the colours of the grass so that earth does not show between
blades seen from above.

```ts
import { ZhudaGrassField } from 'zhuda-laya-engine';

const grass = new ZhudaGrassField(scene3D, {
  area: { minX: -46, maxX: 46, minZ: -80, maxZ: 20 },
  // The game says where the ground is and where nothing grows.
  ground: (x, z) => heightfield.heightAt(x, z), // or null where there is none
  grows: (x, z, y) => y > waterLevel && !onRoad(x, z),
});
// Every frame, with the camera's position and the session's time:
grass.update([eye.x, eye.y, eye.z], seconds);
// When the level closes:
grass.dispose();
```

## How it works

- The land is cut into square patches (`patchM`, 6 m). Only patches within
  `distanceM` (60 m) of the eye have a mesh. `update` makes the meshes the
  eye needs, nearest first, about 6000 blades a call (its third argument),
  and drops the ones left behind. A large mesh is made over several calls
  and shown when it is whole; `fill` makes them all at once, for a first
  frame or a picture.
- Within `fullDensityM` (a twelfth of `distanceM`) every blade is drawn.
  Further off fewer are, each wider, so the cover looks the same: at four
  times that distance an eighth of them. A patch keeps its blades in five
  meshes by rank: far away it has the first only (a sixteenth of its
  blades), and each further one is made as the eye comes nearer and dropped
  as it goes. Blades leave one at a time, shrinking into the ground: nothing
  pops. The last 15 % of the distance shrinks everything.
- The vertex program stands each blade up from its middle line, bends it in
  the wind (gusts cross the land the way the wind blows; each blade flutters
  on its own) and thins it. Nothing is updated per blade on the CPU.
- A blade is lit almost like the ground under it, on both its sides
  (`backFaces: 'same'` of `ZhudaLitSurfaceMaterial`), so a field reads as one
  soft surface. It takes shadows and casts none.
- The same seed, area and options grow the same grass every time.
- The turf is a sheet 2 cm over the ground in half-metre squares. Where
  grass stops growing its edge is cut raggedly. `turf: false` leaves it out.

## Options

| Option               | Default                                          | Meaning                                                                 |
| -------------------- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| `area`               | required                                         | The land grass may cover, world metres                                  |
| `ground`             | required                                         | Height of the ground at a place, or `null`                              |
| `grows`              | everywhere                                       | False where nothing grows; asked once a clump and at the turf's corners |
| `density`            | 400                                              | Blades on a square metre close to the eye, 20..1500                     |
| `heightM`            | `[0.14, 0.34]`                                   | Shortest and tallest blade                                              |
| `widthM`             | 0.03                                             | Width of a blade at its foot                                            |
| `distanceM`          | 60                                               | How far from the eye grass is drawn, 10..300                            |
| `fullDensityM`       | `distanceM / 12`                                 | Within this every blade is drawn                                        |
| `patchM`             | 6                                                | Side of a patch of land, 2..32                                          |
| `tip`, `root`, `dry` | greens, a straw yellow                           | Display colours, as a colour picker shows them                          |
| `dryness`            | 0.3                                              | How much of the grass is dry, in drifts                                 |
| `wind`               | `{ directionDeg: 30, strength: 0.35, speed: 1 }` | `setWind` changes it in place                                           |
| `seed`               | 1                                                | The same seed grows the same grass                                      |
| `turf`               | true                                             | The sheet under the blades                                              |

`validateZhudaGrass` lists what is wrong with a set of options;
`grass.stats` says how many patches, blades and vertices the field holds and
how many patches are waiting.

## Cost

The defaults hold about 700 000 blades and 3.7 million vertices round an eye
in the middle of open land (`npm run verify:grass` prints the numbers). Scale
`density` and `distanceM` to the device: both cut the work directly. A field
too thin to cover the ground looks worse than bare earth; leave it out there
rather than thin it further.

## Limits

- Desktop WebGL and WebGPU only have been drawn (`npm run verify:grass`, and
  with `GRASS_RENDERER=webgpu`). Phones are untested and frame times are not
  measured by the engine's checks.
- Blades are not pushed aside by a foot and cast no shadow. Light does not
  pass through a blade.
- Blades are geometry, without a texture: far grass is thinned, not faded,
  and it ends at `distanceM` (the turf sinks into the ground there).
- The turf lies 2 cm over the ground the game reports: where that differs
  from the drawn ground by more, it shows or hides.
- Film scenes have no grass node; a film places model copies (`placements`).
