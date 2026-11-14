# Verification record: game-services

Task document: `docs/plans/records/game-services/task.md`\
Commit: the commit that adds this file, on top of `9c91a26`\
Date: 2026-11-14

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the repository's `chromeFixture`. WebGL: `ANGLE (Apple, ANGLE Metal
  Renderer: Apple M4)`. WebGPU: the WebGPU build of the browser SDK, LayaAir
  `WebGPURenderEngine` on the `apple` / `metal-3` adapter (not a fallback
  adapter). Audio: Chrome's `OfflineAudioContext`, 48 kHz stereo.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `9c91a26`; no consumer.
- DPR, viewport and network mode: DPR 1; 960 by 540; loopback only.
- Evidence (outside the repository): `EV` =
  `~/Library/Application Support/Claude/side-session-notes/local_a205c175-47c6-4f56-9eb8-a180c0efb2ac/game-services-evidence/`

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build, types, declarations, doctor, tests | `npm run verify` | PASS, 555 of 555 (27 new: 9 audio, 7 picking, 11 geometry) | `EV/verify.log` |
| Format, lint, whitespace | `npm run format:check`, `npm run lint`, `git diff --check` | PASS | `EV/format.log`, `EV/lint.log` |
| Spatial audio, real render | `npm run verify:spatial-audio` | PASS | `EV/spatial-audio/evidence/report.json`, `EV/spatial-audio.log` |
| Geometry and picking, WebGL | `npm run verify:geometry` | PASS | `EV/webgl/evidence/report.json`, `geometry-*.png` |
| Geometry and picking, WebGPU | `GEOMETRY_RENDERER=webgpu npm run verify:geometry` | PASS | `EV/webgpu/evidence/report.json`, `geometry-*.png` |
| Existing extrude and lathe film draw (cap filler replaced) | `npm run verify:film-shapes` (WebGL) | PASS | scratch run, not kept |
| Spatial audio on a device, speakers or headphones | not run | UNAVAILABLE | none |

### Spatial audio (measured on Chrome's own render)

The adapter is given an `OfflineAudioContext` subclass that reports itself
running; everything else is the browser SDK's `IframeSoundAdapter` playing a
loaded noise sample. Balance is (R − L) / (R + L) over the rendered channels.

- Source 2 m to the right, left, ahead of the default listener: HRTF 0.596,
  −0.599, 0.000; equal power 1, −1, 0.
- Listener turned to face +X: the source at +X is ahead (0.000), the one at
  −Z is on the left (HRTF −0.599, equal power −1).
- Half way through a render: `setVoicePosition` from (2, 0, −1) to (−2, 0, −1)
  takes the balance from 0.560 to −0.556 (HRTF) and 0.618 to −0.618 (equal
  power); `setListener` turning round takes it from 0.560 to −0.614 (HRTF).
- Distance, equal power ahead: at 4 m a quarter of 1 m (inverse, 0.2500);
  linear from 2 to 10 m at 6 m is half (0.5000); a source facing away with
  a 60/120° cone and outer gain 0.2 is at 0.2000.
- The gain fallback (no `createPanner`) against a real equal-power
  PannerNode, five places including elevation and other distance models: the
  same left and right levels to five decimals; a move half way through flips
  it from 0.618 to −0.618.
- One AudioContext made per adapter; a plain sample has no spatial voice and
  balance 0.

### Geometry and picking (drawn)

Five shapes, each in its own colour, under one sun with PBR materials: a
2.2 by 1.7 m wall piece 0.2 m thick with a square and a round window and a
four-step rounded bevel top and bottom (1248 vertices, 964 triangles), a
torus (6144 triangles), a trefoil knot as a closed Catmull-Rom tube through
12 points (8400 triangles), a washer and a flat ring. Each node has a
position and a yaw; its `ZhudaTriangleBvh` takes the node's LayaAir world
matrix. On a grid of every third pixel, a pixel away from an edge (the picks
three pixels off on each side are the same entity) is coloured as the BVH's
nearest entity:

| View | Pixels counted | Per shape: found / right |
| --- | --- | --- |
| front | 53 647 | wall 1809, torus 761, tube 445, washer 296, ring 113 picks; 1.000 / 1.000 for every shape and the grey |
| panel (close, oblique) | 54 184 | wall 11 751, torus 806; 1.000 / 1.000 |
| above | 53 487 | wall 3075, torus 1190, tube 893, washer 638, ring 533; 1.000 / 1.000 |

- Through both windows and the torus's hole the backdrop shows, and the BVH
  finds the backdrop; from above the floor shows through the washer and the
  ring, and the BVH finds the floor. The wall, the torus's tube, the
  washer's top and the ring's band are drawn where they should be.
- Close up, flat face pixels average 71.1 luminance and the upward steps of
  the bevel 87.8 (499 pixels): the bevel is drawn with its own normals.
- The torus spans 47 to 147.5 luminance (5th to 95th percentile).
- The torus's LayaAir mesh read back through `readZhudaLayaMeshTriangles`
  picks the same triangle at the same distance as its source data on all 518
  rays that hit.
- WebGL and WebGPU give the same numbers; their pictures differ in 2 of
  518 400 pixels (front view) and not at all in the other two.

Pictures looked at: `EV/webgl/evidence/geometry-{front,panel,above}.png`,
`EV/webgpu/evidence/geometry-{front,panel,above}.png`.

### Unit tests (node)

- Audio: node has no `OfflineAudioContext`, so a recording context is used;
  left/right is computed from the recorded panner and listener values with
  the Web Audio equal-power formula, written again in the test. Graph order,
  one context, untouched channel/master gains, HRTF default, the fallback
  (gain and stereo pan; gain only without StereoPannerNode), the old
  `setPosition`/`setOrientation` API, a listener set before the context
  exists, a voice queued before unlock, disconnection on end and dispose, and
  15 refused option sets and 7 refused poses.
- Picking: random triangle soups (1, 7, 300 and 2000 triangles, leaves of 1
  to 8) and a torus under rotation, uneven scale and mirroring, 400 random
  rays each, some with a distance limit, against brute force: same distance
  (1e-7 relative), same triangle (or a tie on a shared edge), barycentrics to
  1e-6, the point from the barycentrics. Front and back faces for clockwise
  and counter-clockwise winding, the outward normal under mirroring, layer
  masks and nearest entity through `ZhudaSceneQueries`, and refused inputs.
  Informally on this machine: a 32 768-triangle torus builds in about 50 ms
  and a ray takes about 1 µs (not a gate).
- Geometry: watertight (each welded edge used once each way) with outward
  normals and the expected volume for the wall with windows, 60 random
  star-shaped outlines with random holes on a 5 by 5 grid (each cell holds
  one with chance 0.45), the top's area exact, holes in a row on one
  line with outline corners, a comb of deep notches, three bevel settings and
  a bevelled L, open and closed curve tubes, a torus (volume within 1 % of
  2π²Rr²), a washer and a coin. Curves pass within 2 cm of their points with
  even spacing (2 %); a `CurvePath`-shaped object feeds a closed sweep.
  Failing inputs name the hole, point or option.

## Lifecycle and failure cases

- A spatial voice's panner (or fallback gain and stereo pan) is disconnected
  when the voice ends, is stopped and on `dispose`; a refused option set
  makes no node. A queued voice starts at the position it was asked for.
- A BVH's mesh moves with `setMatrix`; a matrix that cannot be inverted or
  is not affine is refused. A LayaAir mesh without a CPU copy is refused
  with that reason (tested on a stand-in, not on a real unreadable mesh).

## Limits and decision

- Not verified: speakers, headphones, phones and mini-game hosts (the
  fallback for hosts without PannerNode was rendered in desktop Chrome by
  removing `createPanner`); how HRTF sounds to a person; Safari and Firefox.
- Not built: spatial tones and streams, spatial cues in `renderOffline`,
  picking skinned or morphing meshes, triangle sweeps, film nodes for the new
  shapes, partial arcs, a check that a tube's radius fits its bends.
- Picking cost in a running game and frame times: not measured.
- Art approval: the pictures are for the owner to judge.

Decision: **Accepted within scope** for desktop Chrome; device checks stay
unavailable.
