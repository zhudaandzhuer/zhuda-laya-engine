# Verification record: prefab-models

Task document: [task.md](task.md)  
Commit: the commit containing this record (base `fa7c7a9`)  
Date: 2026-11-12

## Environment

macOS, Chrome headless, Apple M4; WebGL through ANGLE Metal, WebGPU on
`apple metal-3`. Node v26.12.0.

## Checks

| Check                      | Exact command or procedure                                                                   | Result |
| -------------------------- | -------------------------------------------------------------------------------------------- | ------ |
| Model prefab, real browser | `npm run verify:prefab-models`                                                               | PASS   |
| Definition and converter   | `node --test tests/prefab-models.test.mjs`                                                   | PASS   |
| Existing prefabs           | `npm run verify:prefab-browser`                                                              | PASS   |
| Film after shared mounting | `npm run verify:film-webgpu`; `verify:film`, `:film-model`, `:film-animation`, `:film-water` | PASS   |
| Full gate                  | `npm run verify` (410 tests), `npm run lint`, `npm run format:check`, `git diff --check`     | PASS   |

`verify:prefab-models` builds a consumer with two generated GLB files and a
prefab of four models (three copies of one, one of the other), then, through
`zhuda-prefab-check`:

- the isolated preview matches its own reference on a second run;
- 30 load/unload cycles each end with no instance, and the frame is unchanged;
- the state that hides one node differs from the full prefab and matches its
  own reference;
- one node selected alone matches its own reference and differs from the
  whole;
- an unknown id and an unknown node are refused;
- after one copy is moved by 30 cm and the consumer rebuilt, the comparison
  fails.

## Unverified limits

- `verify:prefab-models` runs on WebGL only; the model prefab was not drawn
  on WebGPU by a test (the mounting code it shares with film scenes is).
- Provenance carries the definition hash but no per-model source hashes;
  integrity of model files rests on the provider's manifest.
- No level of detail or culling: a prefab of thousands of dense copies is
  instantiated in full. Frame rate was not measured here.
- States switch whole nodes on and off only.
- Mobile, Windows and other browsers: not run.
