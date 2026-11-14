# Agent task: phone-cost

Status: In progress; measured on one phone (vivo V40)  
Owner: Engine/toolchain  
Last reviewed: 2026-11-14

## Source requirement

Owner's goal of 2026-11-14: surpass three.js in every respect, phones first.
The city-walk game ran at 25 to 42 ms a frame at its medium setting on a
vivo V40 (Adreno 720, Chrome 156, WebGL2).

## Goal

What a frame costs on that phone is measured part by part, and the engine
gets what is needed to bring a consumer's medium setting to 60 frames a
second there without the picture falling apart.

## Invariants

- Every change follows a measurement on the phone and is measured again
  after; a number from the desktop is not evidence for the phone.
- A look keeps what it asked for at quality level 3. Lower levels may trade
  one technique for a cheaper one.
- LayaAir 3.4.2 vendor files are not modified.

## Scope

### Engine

Taken one at a time, each with its own commit:

1. Lighter versions of a model and models cut into squares; a model that
   casts no shadow (record: `docs/plans/records/model-simplify/`).
2. One-pass edge smoothing (`grade.antialias: 'fxaa'`,
   `ZhudaEdgeSmoothing`), used at quality level 1 in place of multisampling.
3. A reach that scales every level-of-detail and cull distance at once
   (`updateLod(eye, reach)`), and distance culling mesh by mesh for a model
   without copies.
4. Light fog and beams at a lower resolution (not started: the fog's edge
   handling and its own depth picture make it a larger change than the 3 to
   4 ms it costs at the medium setting).

### Consumer or adapter

- `films/river-town-prefab` applies each and is where the phone is measured.

## Non-goals

- Other phones, iOS, WebGPU on phones.

## Acceptance evidence

- `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.
- A GPU check for each engine change on desktop WebGL and WebGPU.
- Phone numbers before and after, with the method.
