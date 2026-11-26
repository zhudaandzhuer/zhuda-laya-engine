# Route: thin hand-drawn ink lines on a film rendered as data

A storybook look (《Sable》, 《Valkyria Chronicles》): a very thin dark line along
every object's outline and hard edge, dark brown where the picture is bright and
dark navy where it is dark, no blur, no colour shift, fading with distance, and
never drawn along a cast shadow. The film scene has no outline feature, so each shot
is rendered twice more as a flat-colour "line pass", and a Python filter draws the
lines from it onto the finished frames. Checked on a desktop with WebGPU.

- **Id:** `film-ink-lines`
- **Kind:** workflow
- **For:** Ink outlines on any film-as-data render: a flat-colour line pass per shot (sharp and motion-blurred), edges found on it and drawn onto the beauty frames, faded on fast motion and with distance, without outlining shadows.
- **Checked on:** desktop WebGPU (Apple M4, macOS 27.2.1, headless Chrome through the MCP server); no phone
- **Status:** 《黑與紅》 version 3 (2026-11-26): 29 shots, 1173 frames, inked and
  looked at in sampled frames of every shot and at every strike frame. The user has
  not reviewed version 3 yet.
- **Reference consumer:** `films/black-red-duel` in the ZhudaGameCenter workspace
  (outside this repository): `scene3.mjs` (`lineSceneOf`), `shots3.mjs` (`PASS=lines`),
  `tools/ink.py`, `tools/assemble3.py`.
- **Engine version:** zhuda-laya-engine 2.0.0, `unified` branch worktree (HEAD
  `44228176` on 2026-11-26).

## When to take this route

For a drawn, comic or storybook look on a film or still made with
[film-as-data](film-as-data.md). It doubles render passes (the line passes are
cheap) and costs about 0.34 s of CPU per frame per process. Not for a running game:
a game wants an outline pass in the renderer, which the engine does not have (see
Engine gaps). Not for lines that change thickness like a brush: these are 1-pixel
lines at 1280×720.

## Tools

- MCP film tools: `film_scene_create`, `film_render_job`, `film_scene_preview` (to try one frame).
- Python 3 with OpenCV 5.0.0 (`cv2.Sobel`, `cv2.dilate`), numpy 2.0.2, Pillow 11.3.0;
  ffmpeg 8.1.1 to decode and encode raw RGB.

## Steps

1. **A line scene beside the real one.** The same nodes and camera, but:
   - every scene material replaced by a flat colour of its own (here hue by the
     golden ratio, `0.5 + 0.32 * cos(2π(h + k/3))` per channel, roughness 1);
     ground and terrain one grey 0.55, so the horizon gives no line;
   - only the `model` nodes kept from the shot: no effects, no lights;
   - the look `{ sky: [1, 1, 1], ambient: [0.62, 0.62, 0.62], sun: { azimuthDeg: 150, elevationDeg: 35, intensity: 1.1, color: [1, 1, 1] }, shadows: false, fog: { color: [1, 1, 1], start: 5, end: 80 } }`,
     no preset and no grade, so the picture is plain and lit faces differ enough to
     give creases;
   - the white fog is what fades lines with distance.

   (`scene3.mjs`, `lineSceneOf`; switched by `PASS=lines` in `shots3.mjs`.)
2. **Render the line pass twice** with the same camera path and frame count as the
   beauty: 1 sample per frame (sharp, about 3.5 min for 1173 frames) and 4 samples
   (motion-blurred like the beauty, about 5 min).
3. **Find the edges on the sharp pass.** `cv2.Sobel` (ksize 3) on all three
   channels, combined as Di Zenzo's structure tensor: strength
   `sqrt(λmax) / 4 / 1.3` and direction `½ atan2(2gxy, gxx - gyy)`; keep only pixels
   that are a local maximum across the edge (4 quantized directions), which makes the
   line one pixel wide. Line strength `smoothstep(0.04, 0.14, g)`.
4. **Fade lines on fast motion.** The same strength on the blurred pass, dilated
   3×3, divided by the sharp strength: a still or slow edge keeps about 1, a fast
   one is spread over the shutter and drops toward 1/4. Multiply the line by
   `clip((ratio - 0.35) / 0.35, 0, 1)`.
5. **Draw.** Line colour mixed by the beauty's luminance L from dark brown
   `[0.22, 0.13, 0.10]` (bright) to navy `[0.10, 0.12, 0.24]` (dark); opacity 0.85;
   `out = beauty * (1 - a) + colour * a`. Encode with libx264 CRF 12.
   (`python3 tools/ink.py beauty.mp4 lines.mp4 out.mp4 lines-blur.mp4`;
   `--png` for one frame.)
6. **Ink before the edit's effects.** Ink each shot before hit-stop, flash and shake,
   so the lines freeze, flash and shake with the picture. Six shots at a time in
   separate processes: 29 shots in about 2 minutes on an M4.

## Pitfalls

1. **Edges from the finished picture outline every shadow.** The first try ran the
   filter on the beauty frames: the long slab shadows across the ground got ink
   lines, which a drawn look never has. Edges must come from a pass without shadows.
2. **A motion-blurred line pass draws three or four rings.** With 4 samples, each
   sample's copy of a moving edge is its own edge: a punching arm or a snapping head
   got 3 to 4 concentric outlines.
3. **A sharp line pass alone lags the blurred limbs.** With 1 sample the line sits at
   one moment of the shutter: a fast arm's line was drawn a hand's width away from
   the blurred arm. Use both passes (step 4).
4. **Fading on colour difference between the passes is too strict.** Fading wherever
   the sharp and blurred passes differed removed every line on a character that moved
   at all. Compare edge strength, not colour.
5. **numpy's `@` on large arrays printed divide-by-zero and overflow warnings** on
   this Mac (Accelerate); write the luminance and dot products out as sums.
6. **Pure numpy Sobel took 0.65 s a frame**; OpenCV halves it, separate processes do
   the rest.

## Engine gaps and their workarounds

| Gap | Workaround here |
| --- | --- |
| No outline or ink feature in the film look | Line pass plus `tools/ink.py` in the consumer |
| `film_render_job` writes only the beauty picture: no object id, depth or normal pictures | A second and third render of the scene with flat colours, no shadows and white fog |
| Where in the shutter a 1-sample frame is taken is not documented | Fade lines on motion (step 4) so the offset is never seen |

## Checks

- `python3 tools/ink.py --png beauty.png lines.png out.png` on preview frames of a
  wide shot and a close fight shot: lines on pillars, slabs, fragments and the
  characters' outlines; none along shadows; far pyramid without a line.
- Sharp-pass against blurred-pass comparison at two strike frames
  (`frames/chk3/ink-s4-vs-s1.jpg`, `frames/chk3/ink-motion2.jpg`): no rings, still
  parts keep a single line.
- Sampled frames of every shot of the finished film (`frames/film3-sheet.jpg`).

## Not checked

- Resolutions other than 1280×720; at 1920×1080 the lines will look thinner.
- Line thickness that varies like a brush, or wobble: not done.
- A dark character against a dark area gets a line nobody sees: the black fighter's
  outline only shows against light ground.
- Whether a person finds the lines "restrained" enough: not asked yet.

## Boundaries

The line scene, the filter and its constants stay in the consumer. An outline pass,
or object-id and depth pictures from `film_render_job`, would be the engine's.
