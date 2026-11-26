# Route: a film scene shown live on a page

A scene written as data (`ZhudaFilmScene`: a room, a building, a product on a stand) is
mounted on a page and drawn every frame, with views the visitor switches between, a
camera they turn, and a look that gives parts up when the machine is slow. It sits
between a still or a film rendered offline and a whole game. Driven by mouse or touch.
The frame order, the lens and the quality levels are drawn on a desktop with both
backends; the camera a visitor turns and mounting again are not.

- **Id:** `interactive-film-viewer`
- **Kind:** workflow
- **For:** Showing a film scene live on a web page (an architecture walk-round, a product viewer, a diorama): mounting it, the three calls a frame, the lens, switching views, quality levels with a governor, and mounting again for another state.
- **Checked on:** desktop WebGL; desktop WebGPU; no phone
- **Status:** the three calls a frame, the lens (17 mm and 50 mm) and quality levels 3 to 0 and
  back, with bounce light and with screen reflections, are drawn by `npm run verify:live-look`
  on an Apple M4, WebGL and WebGPU, 2026-11-26. An orbit camera with limits, and mounting
  again for a cut-away view, come from an outside project's report and are not drawn here.
- **Reference consumer:** the engine fixture `tests/fixtures/live-look.ts` (`pageCheck`); the
  reference games that draw a film scene every frame (`games/zhuda-wardrobe`,
  `games/zhuda-hunt`, `games/zhuda-guard`); an outside project, a waiting hall with view
  presets and a cut-away, built on 2.0.0 by an outside agent, whose report asked for this route.
- **Engine version:** 2.0.0 with the change of 2026-11-26 on `unified` (`prepare` applies the
  lens; quality levels keep what was fixed at mount). On the tagged 2.0.0 see "Engine gaps".

## When to take this route

For a scene that is looked at, not played: view presets, a camera on an orbit, a state or
two (lights on and off, a wall cut away). Author and check the scene first with
[film-as-data](film-as-data.md) and [good-looking-3d-scene](good-looking-3d-scene.md): this
route starts where a scene already previews well. For a character that walks through the
scene take [third-person-town-3d](third-person-town-3d.md); for a still or a video only, stay
with `film-as-data` and render it.

## Tools

- `zhuda-laya-init`, `zhuda-laya-build`, `zhuda-laya-watch --candidate` (a save of a script
  is ready to reload in about 0.15 s).
- In the page: `ZhudaEngine.boot`, `mountZhudaFilmScene` (or `loadZhudaFilmScene` when the
  scene has models), `ZhudaFilmStage` (`setTime`, `setCamera`, `prepare`, `setQuality`,
  `setLight`, `setLook`, `raycast`, `worldToScreen`, `dispose`), `ZhudaQualityGovernor`.
- For the scene itself: the MCP film tools of `film-as-data` (`film_scene_preview`,
  `film_scene_lint`, `film_scene_query`).
- For checks: `chromeFixture` from `zhuda-laya-engine/compiler/chrome-host`
  ([its use](../consumer-tooling.md#a-headless-chrome-of-your-own-and-a-clock-that-does-not-drift-200)).

## Steps

1. **Finish the scene as data first.** Preview it with the film tools until the advice is
   empty and the views you will offer look right; every view is a `ZhudaFilmCamera`
   (`eye`, `target`, `focalLengthMm`). The page mounts that same JSON.
2. **Boot and mount.** `ZhudaEngine.boot({ container, features: ['core', '3d', …] })`, then
   `mountZhudaFilmScene(context.rootScene, scene, { props, recipes })`. Mounting bakes what
   the scene asks for (bounce light draws six small pictures a probe), so do it behind the
   engine's splash; `await whenZhudaSplashGone()` before the first picture a check takes.
3. **Three calls a frame, in this order**, inside `context.runtime.start((dt) => { … })`:
   `stage.setTime(seconds)`, `stage.setCamera(view)`, `stage.prepare(aspect)` with
   `aspect = container.clientWidth / container.clientHeight`. `prepare` gives the camera the
   field of view of the focal length: 17 mm is 70.4 degrees high, 50 mm is 27.0
   (`verify:live-look` reads both).
4. **Views.** A preset is a camera object; to go from one to another over a second, mix
   `eye` and `target` and pass the mix to `setCamera` every frame. An orbit is `eye` worked
   out from a yaw, a pitch and a distance round a `target`; the focal length stays in the
   camera object, so a zoom is a distance or a focal length, never `camera.fieldOfView`.
5. **Quality.** `const level = governor.sample(dt * 1000); if (level !== undefined)
   stage.setQuality(level)`. Level 3 is the look as authored; 0 has no HDR chain. What was
   fixed at mount stays at every level: bounce light is kept, the colour table goes with the
   grade at 0 and comes back.
6. **Another state of the scene.** A lamp is `stage.setLight(id, { enabled })`; a time of
   day is `stage.setLook(look)` (the sun, the sky, fog and the grade change in place). What
   changes the scene's nodes (a wall cut away, other furniture) is a second scene: call
   `stage.dispose()` and mount the other one in the same frame callback, before the next
   `setCamera`. `bakeCache` keeps baked textures between the two
   ([film scenes](../film-scenes.md#in-code)).
7. **Check it in a browser.** Serve `dist/candidate/web`, open it with `chromeFixture`, wait
   for the page's ready flag and the splash, take a picture of each view, and fail on
   `chrome.errors`.

## Pitfalls

- **Every focal length looked the same (2.0.0).** `setCamera` stored the lens and nothing
  applied it on a page: the camera stayed at its default angle. Closed after 2.0.0 (`prepare`
  applies it); on 2.0.0 call `stage.lens.apply(aspect)` before `prepare`.
- **The page threw a few seconds in, on a slow machine (2.0.0).** A governor reached level 0
  on a scene with bounce light: `setLook cannot change the bounceLight`. Closed after 2.0.0;
  on 2.0.0 keep such a scene at level 1 or above (`Math.max(1, level)`).
- **`Cannot set properties of null` right after a view switch** (seen by the outside
  project). A stage was disposed and the frame callback still called it. Replace the variable in the same callback that
  disposes, and let nothing else hold the old stage.
- **A watermark in the first evidence picture.** `boot` resolves while the splash is still
  fading. Wait for `whenZhudaSplashGone()` (after 2.0.0) or build the checked pair with
  `{"branding":{"mode":"none"}}`.
- **A check script that cannot find its own files** (seen by the outside project). In a folder whose name has spaces or
  Chinese in it, `new URL(…, import.meta.url).pathname` is percent-encoded; use
  `fileURLToPath`.
- **`evaluate` took only text (2.0.0).** `chromeFixture` is not Playwright: on 2.0.0 pass
  an expression as a string; after it a function is called in the page too.

## Engine gaps and their workarounds

- On the tagged 2.0.0: no lens on a page (`stage.lens.apply(aspect)` before `prepare`), and
  `setQuality(0)` throws with bounce light or with a colour table and no water (stay at 1 or
  above). Both are closed on `unified` after 2.0.0; no release carries them yet.
- No camera-on-an-orbit helper for a film stage: the page works `eye` out itself. To keep
  the eye inside a room, cast `stage.raycast(target, towardsEye, distance)` and stop short of
  the hit. Not drawn by an engine check.
- The outside report saw `Camera opaque MRT does not support MSAA` with `screenReflections`
  and the default `grade.antialias`. Not reproduced: the engine's reflection check and
  `verify:live-look` draw that pair on WebGL and WebGPU, through levels 3, 2, 1, 0 and back,
  with no error, and the engine never sets a camera's `opaqueMRT` by hand, which is what
  LayaAir's message is about. A scene that shows it is wanted.
- The same report saw speckled shadow from a `point` light with `castsShadow` in a closed
  room, and none with a wide `spot` from the ceiling. Not reproduced in a plain room here
  (one lamp, a pillar, a bevelled box); a spot lights only its cone, so it is not a
  replacement for the lamp that lights the ceiling.

## Checks

- `npm run verify:live-look` (and with `LIVE_LOOK_RENDERER=webgpu`): on a page, a 17 mm
  camera is 70.44 degrees high and 50 mm 26.99 after `prepare` alone; a scene with bounce
  light goes to level 0 (rebuilt, no HDR chain, bounce light kept), to 1 and back to 3 with
  the first frame again (mean difference 0); an authored change of the bounce light is still
  refused; screen reflections with multisampling go through 2, 1, 3, 0, 3 and come back
  (0); no page, console or renderer error.
- `node --test tests/bounce-light.test.mjs tests/cinematic-capture.test.mjs`: what a mounted
  stage refuses and what a quality level may do; the lens says when a sample is held.
- `npm run verify:games`: the three reference games draw their film scene through
  `prepare` alone.

## Not checked

- A phone; touch; a camera a visitor turns; the limits of an orbit in a room.
- Mounting a second scene after `dispose` with `bakeCache`, and how long that takes.
- The outside project itself: its scene is not in this repository.
- Whether a viewer of this kind holds 60 frames a second on anything.

## Boundaries

The scene, its views, the orbit and its limits, the page's buttons and what a state means
belong to the consumer. The stage, the lens, the look and its quality levels belong to the
engine; a consumer does not set `camera.fieldOfView`, post-processing or shadow settings on
the stage's camera by hand.
