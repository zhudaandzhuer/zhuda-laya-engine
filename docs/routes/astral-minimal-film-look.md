# Route: a restrained, layered dusk look for a film scene (Astral Minimalist)

The look asked for as 「孤旅大气分层风 Astral Minimalist」 (《Journey》 ×
《Firewatch》 × 《Monument Valley》): a few large clean colour fields, a low sunset
casting long slanted geometric shadows, strong air layering (dark foreground,
bright middle, airy pale distance) and very few fragments with strong silhouettes.
Built as a film scene with flat-colour materials, a sun placed against the camera
paths, a row of slabs off camera to cut shadow bands, a painted sky panorama and
fog matched to its horizon. Checked on a desktop with WebGPU.

- **Id:** `astral-minimal-film-look`
- **Kind:** scene
- **For:** A minimalist sunset set for a film or still as data: flat colour fields, a low sun behind the camera's shoulder, shadow bands cut by slabs placed off camera, a painted dusk panorama, fog equal to the horizon colour so distance turns pale.
- **Checked on:** desktop WebGPU (Apple M4, macOS 27.2.1, headless Chrome through the MCP server); no phone
- **Status:** 《黑與紅》 version 3 (2026-11-26): four look iterations at 960 and
  1280 px, then 29 shots rendered and every shot looked at in sampled frames. The
  user has not reviewed version 3 yet.
- **Reference consumer:** `films/black-red-duel` in the ZhudaGameCenter workspace
  (outside this repository): `scene3.mjs`, `tools/sky.py`, `lookdev.mjs`,
  `assets/sky/dusk3.png`; iterations in `frames/look3`, `look3b`, `look3c`, `look3d`.
- **Engine version:** zhuda-laya-engine 2.0.0, `unified` branch worktree (HEAD
  `44228176` on 2026-11-26).

## When to take this route

For a quiet, graphic, open-air setting at sunset or dawn where people must read
clearly as silhouettes or warm-lit figures: duels, journeys, title shots. Take
[film-as-data](film-as-data.md) for the format and render, and
[good-looking-3d-scene](good-looking-3d-scene.md) for the general order of look
settings. For a detailed, textured, realistic landscape take
[outdoor-landscape](outdoor-landscape.md); for a night or a wet street this look is
wrong. Add [film-ink-lines](film-ink-lines.md) for the storybook lines that the
brief paired with it.

## Tools

- MCP film tools with `--film-assets <dir>` (for the panorama picture):
  `film_scene_create`, `film_scene_preview`, `film_scene_review`, `film_render_job`.
- Python 3 with numpy 2.0.2 and Pillow 11.3.0 for the sky (`tools/sky.py`).
- `lookdev.mjs`: one preview frame of named shots at named times
  (`SHOTLIST=shots3.mjs DIR=look3 node lookdev.mjs v08-guard:0.5 v11-combo:0.76`),
  about 4 s a frame.

## Steps

1. **Put the sun behind the cameras' shoulder.** List where the cameras of the film
   look (here most look along -X from +X). Put the sun low behind and to one side of
   them: azimuth 150°, elevation 9° (`azimuthDeg` turns about +Y; at 0 the light
   travels toward -Z; at θ it travels toward `(-sin θ, -cos θ)`; so 150 puts the sun
   at +X, -Z). Figures get warm three-quarter light and shadows run away from the
   camera on a slant. A sun in front of the camera gives silhouettes and loses the
   red character's colour; use it only for chosen shots.
2. **Cut shadow bands with slabs the camera does not see.** On a line 13 m from the
   centre toward the sun, perpendicular to it, stand a few tall slabs
   (`box`, 7.5 to 10 m tall, 2.2 to 3 m wide, 1.4 m thick, yaw -30 so their face is
   to the sun). A ground point P is in a slab's shadow when `s = P · across` falls
   within that slab's width, where `across = (0.866, 0.5)` here; leave the range of s
   where the action happens free (here -2.3 to 2.5) so the fighters stand in a lit
   band. At 9° the shadow of a 10 m slab is 63 m long. Shadows: `distance 70`,
   `resolution 4096`, `cascades 4`, `soft`, `strength 0.92`, `blend true`.
3. **Large flat colours, few things.** Materials are plain colours, no recipes:
   sand `[0.86, 0.6, 0.43]` roughness 0.96, stone `[0.74, 0.47, 0.41]` roughness 0.9.
   One block behind the action (the second fighter's platform, which half catches a
   shadow band), a gate of two 15 m pillars and a lintel 24 m away in the main
   cameras' background, one leaning shard (`sweep` with a triangular profile), two
   four-sided cones far away (`lathe` with 4 segments: 42 m tall at 135 m), and three
   small fragments. Ground 140 m; beyond it a `terrain` of 520 m with dunes
   (`heightM 16`, `scaleM 95`) pressed under the ground in the middle 110 m.
4. **Paint the sky.** A 4096×2048 equirectangular PNG (`tools/sky.py`): zenith
   `[0.41, 0.45, 0.68]` → 60° `[0.52, 0.54, 0.75]` → 30° lavender `[0.75, 0.67, 0.82]`
   → 12° rose `[0.94, 0.73, 0.73]` → 4° peach `[0.99, 0.81, 0.71]` → horizon pale gold
   `[1.0, 0.87, 0.74]`; warmer toward the sun, a glow around it, and opposite the sun
   a pink band at 6 to 18° (the Belt of Venus) over a lilac earth shadow at 0 to 5°.
   Give it to the look as `panorama: { asset: 'sky/dusk3.png' }`. The panorama's
   orientation, measured with a four-colour test picture: u = 0 is +X, 0.25 is +Z,
   0.5 is -X, 0.75 is -Z; v runs from straight up to straight down. The sun of step 1
   is at u = 0.833, v = 0.45.
5. **Fog equal to the horizon.** `fog: { color: [1.0, 0.73, 0.51], start: 6, end: 140 }`
   (the horizon colour in linear values); `lightFog: { density: 0.012, falloffMeters: 7, scatter: 0, color: [1.0, 0.87, 0.74], shafts: { strength: 1.0, distance: 80 } }`.
   The middle (20 to 40 m) keeps its colour and gets brighter, the cones at 120 m are
   pale shapes, the near ground in shadow stays deep: dark front, bright middle,
   airy distance.
6. **Light the shadows cool.** `ambient [0.4, 0.4, 0.76]`, `ambientGround [0.46, 0.3, 0.32]`,
   sun `[1, 0.76, 0.58]` intensity 3.0, preset `dusk`. Grade: exposure 1.0, contrast
   1.1, saturation 1.0, bloom 0.28, ao 0.6 radius 0.4, grain 0.1, vignette 0.38;
   `lensFlare: true` for the shots that face the sun.
7. **Look at four kinds of shot before rendering**: a wide shot, a close fight shot,
   one into the sun, one from above. Preview frames at 960 px take about 4 s each.

## Pitfalls

1. **The `dusk` preset's sky is yellow-green.** Its procedural atmosphere, with the
   fog defaulting to the horizon colour, gave a greenish-yellow sky, also with the one
   `skyTint` tried (`[0.55, 0.42, 0.75]`, thickness 1.4). The painted panorama
   (step 4) gave the lavender-to-peach sky asked for.
2. **A light in the light fog becomes a visible orb.** The fighters' fill lights
   showed as purple balls in the yard shot (`lightFog.scatter` 0.6). Set `scatter: 0`;
   the sun shafts are separate (`shafts.strength`). A shot rendered before the change
   had to be rendered again.
3. **An orange sun turns a red figure orange.** Sun `[1, 0.66, 0.42]` made the red
   fighter read as orange; `[1, 0.76, 0.58]` keeps red red and the scene warm.
4. **Without a fog colour the middle distance stayed saturated.** With the first fog
   (`start 5`, `end 150`, colour by default), the gate 24 m away was as orange as the
   foreground: no layering. A fog colour equal to the painted horizon fixed it; a
   stronger fog (`end 95`) washed the middle out, `end 140` was the balance.
5. **Huge far shapes dominate.** A 70 m cone at 125 m filled a third of the frame
   height; 42 m at 135 m reads as distance.
6. **Slabs in front of a reverse shot.** A shot looking toward the sun sees the slab
   row as dark pillars; it works as a backlit silhouette shot, but a dark figure in
   front of them is lost.

## Engine gaps and their workarounds

| Gap | Workaround here |
| --- | --- |
| The panorama's orientation is not documented | Measured with a test picture (step 4) |
| The procedural sky cannot be pushed to a lavender dusk | A painted panorama |
| No gradient or painted sky other than a picture | `tools/sky.py` writes one from colour stops |

## Checks

- `lookdev.mjs` frames of four shot kinds after each change (`frames/look3`, `look3b`,
  `look3c`, `look3d`): sky lavender to peach, middle bright, far cones pale, near
  shadow cool and deep, red stays red.
- Sampled frames of all 29 rendered shots (`frames/chk3/all-*.jpg`): no orbs after
  `scatter: 0`, fighters in the lit band in the fight shots.

## Not checked

- Other times of day, other sun positions, or a camera plan that circles the action.
- Whether the look matches the references for a person: the user has not seen the
  finished version 3.
- Render cost alone: renders ran while another session used the GPU (about 1.8 to
  4.5 s a frame at 4 samples, 1280×720).
- Any phone or game use of this look.

## Boundaries

The set, the sky picture and the look values stay in the consumer. A documented
panorama orientation, and a sky made from colour stops without a picture, would be
the engine's.
