# Verification record: isosurface-density (AG3)

Task document: `docs/plans/records/isosurface-density/task.md`\
Commit: the commit that adds this file, on top of `9960539`\
Date: 2026-11-17

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the repository's `chromeFixture`. WebGL:
  `ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)` (no
  compute). WebGPU: apple / metal-3, not a fallback.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `9960539`; no consumer.
- Evidence (outside the repository): `EV` =
  `/Users/yaowei/Documents/ZhudaGameCenter/audits/isosurface-density-2026-11-17/`:
  `density-webgpu/`, `density-webgl/` (reports), the run logs, the
  `verify:gpu-depth` logs after the compute fix, `unit.log`, `verify.log`.

## Checks

| Check                                     | Exact command or procedure                                       | Result                                                       | Artifact             |
| ----------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------ | -------------------- |
| Build, types, declarations, doctor, tests | `npm run verify`                                                 | PASS, 903 of 903                                             | `EV/verify.log`      |
| Lint, format, whitespace                  | `npm run lint`, `npm run format:check`, `git diff --check`       | PASS                                                         | —                    |
| Geometry and load unit tests              | `node --test tests/isosurface-density.test.mjs`                  | PASS, 5                                                      | `EV/unit.log`        |
| Density volume, WebGPU                    | `DENSITY_RENDERER=webgpu npm run verify:density-volume`          | PASS                                                         | `EV/density-webgpu/` |
| Density volume, WebGL                     | `npm run verify:density-volume`                                  | PASS (the JavaScript density, no compute)                    | `EV/density-webgl/`  |
| Compute pass after the dispatch fix       | `npm run verify:gpu-depth`, and with `GPU_DEPTH_RENDERER=webgpu` | PASS on both (a million particles, 1.75 ms a step on WebGPU) | `EV/gpu-depth-*.log` |

## Geometry fixtures (Node)

- A slab on the box's floor with three loose specks: four closed pieces
  without `removeFloating`, one with it; every vertex then belongs to the
  slab, and the mesh is index for index the slab meshed alone.
- `'largest'` keeps the slab; a point anchor keeps the speck at it; an
  anchor outside every body, and a body with nothing on the floor, are
  refused with a message.
- A volume computed on the mesher's grid meshes to the same quads as the
  field sampled, vertices within 0.002 m on 0.1 m cells; the volume alone
  (interpolated) gives one closed piece with as many triangles.

## The rock field in the browser

225 × 96 × 225 = 4 860 000 grid points at 0.05 m.

|                                      | WebGPU                            | WebGL                       |
| ------------------------------------ | --------------------------------- | --------------------------- |
| Volume computed                      | on the GPU, 341 ms                | in JavaScript, 1 558 ms     |
| JavaScript volume (`backend: 'cpu'`) | 1 573 ms                          | 1 657 ms                    |
| Largest difference, points that flip | 9.5e-7, 0                         | 0, 0                        |
| Meshed, stones removed               | 120 220 vertices, 1 closed piece  | the same                    |
| With the stones                      | 123 824 vertices, 4 closed pieces | the same                    |
| Vertices of the two meshes           | as many, within 0.57 mm           | identical                   |
| Cancelled before; during             | AbortError; AbortError            | AbortError; AbortError      |
| Time limit of 1 ms                   | TimeoutError                      | TimeoutError                |
| GLSL another field                   | refused: differs by 1.26          | not run (no compute): loads |
| JavaScript density throws            | refused (`bad rock`)              | refused                     |
| GPU buffers live after the failures  | 0                                 | none made                   |
| 30 loads and releases                | 99 buffers made, 0 live after     | none made                   |

## Found on the way: large compute dispatches wrote nothing on WebGPU

The first GPU run returned zeros. `ZhudaComputePass.dispatch` asked for
`ceil(count / 64)` groups along x, and WebGPU refuses more than 65 535 along
an axis: any dispatch of more than 4 194 240 indices (the pass accepts up to
16 777 216) wrote nothing. Fixed in `ComputePass.ts`: past 32 768 groups the
dispatch is laid out in rows along y and `main` rebuilds the index; up to
2 097 152 indices the dispatch is one row, as before. The density check
caught it because a GPU result is compared with the JavaScript density
before it is used.

## Deviation from the plan

The JavaScript fallback runs the pass's step over the grid in slices
outside a `ZhudaComputePass`, a turn for the browser between slices, instead
of `ZhudaComputePass`'s own fallback, which runs a whole dispatch at once and
could not be cancelled or stopped by the time limit part way.

## Limits and decision

- Phone (added at the merge into `main`, vivo V40, Adreno 720, Chrome
  over `ZHUDA_PHONE_CHROME`): `verify:density-volume` PASS on WebGPU (the
  4.86-million-point field on the GPU in 780 ms against 2 065 ms in
  JavaScript, largest difference 1.2e-6, no sign flips) and on WebGL
  (JavaScript fill); `verify:gpu-depth` PASS on both after the dispatch
  change.
- The JavaScript heap was measured in the 30 cycles (lower after than
  before on both backends); GPU buffers were counted on WebGPU by wrapping
  `createBuffer` and `destroy`.
- Meshing a 4.9-million-point grid takes the CPU; not measured on a phone.

Decision: **Implemented**, accepted for desktop WebGL and WebGPU and on
one phone (vivo V40).
