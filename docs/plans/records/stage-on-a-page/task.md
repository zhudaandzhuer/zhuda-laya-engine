# Agent task: stage-on-a-page

Status: Done within scope (desktop WebGL and WebGPU, one machine; no phone; one reported error not reproduced) ([verification](verification.md))\
Owner: the repository owner (2026-11-26: "開始修", on the review of an outside agent's report)\
Last reviewed: 2026-11-26

## Source requirement

An outside agent (Antigravity, Gemini 4 Hydrogen) built an interactive 3D scene, a waiting hall
with view presets and a cut-away, on the tagged 2.0.0 by following the routes, and wrote what
went wrong. The owner passed the report on; the session on the owner's Mac checked every item
against the code, and the owner said to fix what was confirmed and to write the documents and
the route the report asked for. The report itself is outside this repository; its items are
restated below.

## Goal

A film scene drawn live on a page behaves as its data says, without calls a newcomer cannot
know of:

1. `stage.setCamera` and `stage.prepare` alone give the camera the field of view of the focal
   length (reported: every focal length drew at the camera's default angle).
2. A quality governor may take any scene to level 0 and back (reported: a scene with bounce
   light threw `setLook cannot change the bounceLight` a few seconds in).
3. The other items of the report are each confirmed, closed, or written down as not reproduced,
   with the check that says so.
4. The path is a route: `interactive-film-viewer`.

## Invariants

- A film rendered offline is the same picture as before: `ZhudaFilmRenderer` and
  `ZhudaCinematicCapture` are not changed, and `prepare` leaves the lens alone while a capture
  holds a sample of the aperture.
- An authored look still cannot change what was fixed at mount (panorama, environment, bounce
  light, another colour table): the refusal and its message stay.
- `zhudaLookForQuality` stays a pure function with the levels it documents.
- Nothing is claimed about a phone.

## Dependencies

- `packages/core/film/FilmStage.ts`, `FilmScene.ts`, `LookQuality.ts`;
  `packages/core/runtime3d/PhysicalCamera.ts`, `CinematicCapture.ts`.
- The real-browser check `scripts/verify-live-look.mjs` with `tests/fixtures/live-look.ts`.
- The reference games that draw a film scene every frame: `games/zhuda-wardrobe`,
  `games/zhuda-hunt`, `games/zhuda-guard` (each called `stage.lens.apply` by hand).

## Scope

### Engine

- `ZhudaPhysicalCameraRig.sampling` (new, read-only); `prepare` applies the lens unless a
  sample is held.
- `zhudaFilmLookFixedReason` (module function, not in the package's main entry); a stage draws
  a quality level with the bounce light it was mounted with, and lets a look stop using the
  loaded colour table and name it again.
- `chromeFixture`: `evaluate` and `waitFor` take a function as well as text
  (`zhudaPageExpression`); `screenshot` returns the PNG bytes and the file is optional.
- Doc comments of `transformZhudaMesh` and `createZhudaExtrudeMesh`: which way a positive
  angle turns, where an extruded piece stands.

### Consumer or adapter

- The three reference games drop their `stage.lens.apply(aspect)` line.
- Documents: `docs/film-scenes.md` (a page's frame loop; quality on a stage),
  `docs/consumer-tooling.md` (a `chromeFixture` example), the route
  `docs/routes/interactive-film-viewer.md` and its rows in the routes index.

## Non-goals

- A camera-on-an-orbit helper, limits of an orbit in a room, a helper for mounting again.
- A lint rule against `screenReflections` with multisampling: the error was not reproduced.
- A release: the fixes are on `unified` after 2.0.0; whether to tag is the owner's.

## Acceptance checks

1. `npm run verify:live-look` on WebGL and with `LIVE_LOOK_RENDERER=webgpu`: the page checks
   fail before the change in the two reported ways and pass after it.
2. `npm run verify`, `npm run lint`, `npm run format:check`, `npm run verify:games`,
   `npm run verify:prefabs`.
3. Every item of the report has a line in the verification record.

## Evidence to attach

- Test/build output: `verification.md` beside this file.
- Browser/WebGL or device report: `local-results/stage-on-a-page/`. No phone is asked for.

## Unverified limits

- A phone, touch, a camera a visitor turns, mounting again with `bakeCache`.
- The outside project's own scene: it is not here, so "works for it" is not claimed.

## Rollback

Revert the commit. The three games then need their `stage.lens.apply(aspect)` line back.
