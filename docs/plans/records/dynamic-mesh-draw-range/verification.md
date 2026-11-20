# Verification record: a dynamic particle/ribbon mesh kept its first drawn index count

Task document: `docs/plans/records/dynamic-mesh-draw-range/task.md`\
Commit: the commit that adds this file; base `ba24ae4`\
Date: 2026-11-20

## Environment

- macOS, Apple M4, headless Chrome (`packages/compiler/chrome-host.mjs`).
- WebGPU: adapter apple / metal-3. WebGL: ANGLE Metal Renderer, Apple M4.
- Node v26.13.1, npm. Viewport 640×360, DPR 1, local HTTP.

## Checks

| Check                                             | Command                                  | Result                                                             | Artifact                                                                             |
| ------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Build, types, declarations, Doctor, tests         | `npm run verify`                         | build to Doctor PASS; tests 941 of 942, then `npm test` 942 of 942 | console                                                                              |
| Unit (Laya fake that draws only the copied range) | `node --test tests/particles3d.test.mjs` | PASS; FAIL with the change removed                                 | console                                                                              |
| Real draw, both backends                          | `npm run verify:ribbon-growth`           | PASS; FAIL with the change removed                                 | `$TMPDIR/zhuda-ribbon-growth/report.json`, `evidence/<renderer>-<step>-<points>.png` |

### `verify:ribbon-growth`

A white band along y = 0 on black. Each step sets the points, renders four
frames and reads the render element's draw parameters, then screenshots.
"Lit" is the bright run of the middle row as a fraction of the width;
"expected" is the band's ends through the camera (the ends fade over their
end segment, so lit sits up to one segment inside).

| Step (points) | Submitted indices | Drawn, before | Lit, before      | Drawn, after | Lit, after   | Expected     |
| ------------- | ----------------- | ------------- | ---------------- | ------------ | ------------ | ------------ |
| 3             | 12                | 12            | not recorded     | 12           | 0.141..0.183 | 0.138..0.186 |
| 54            | 318               | **12**        | **0.141..0.166** | 318          | 0.141..0.859 | 0.138..0.861 |
| 10            | 54                | **12**        | **0.142..0.192** | 54           | 0.142..0.377 | 0.138..0.378 |
| 40            | 234               | **12**        | **0.141..0.169** | 234          | 0.141..0.739 | 0.138..0.741 |

WebGPU and WebGL gave the same numbers, before and after. "Before" is this
check with the one new line removed; its first step's lit run was not
recorded (that step passed). Console errors: none.

The one test that failed in `npm run verify` was "decoder registry releases a
late result after timeout" (`tests/model-decoder.test.mjs`, a 25 ms timer,
unrelated to this change); it passed alone and in a second full `npm test`.

## Release note

Fixed: a 3D ribbon (`ZhudaRibbonPath3D`, `ZhudaRibbonTrail3D`) or particle
system whose point/particle count changes after its first draw kept drawing
the first count, on WebGPU and WebGL. Consumers that work around it by always
submitting a fixed point count can drop the workaround after re-pinning to a
commit with this fix.

## Limits and decision

- Desktop macOS only; not run on a phone or the Windows host. The change is
  backend-independent (the same LayaAir call on both), and both backends
  failed and passed the same way here.
- The consumer that found it was not rebuilt against this commit (outside
  this repository).
- Still version-pinned to LayaAir 3.4.2's private `SubMesh` methods, like the
  buffer uploads beside it.

Decision: **Implemented**; device and consumer checks open.
