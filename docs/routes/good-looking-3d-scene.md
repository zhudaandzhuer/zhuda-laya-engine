# Route: a 3D scene that looks lit, grounded and deep

The order in which a 3D scene is given its look, the same for a film scene (data,
through the `film_*` tools) and a game (`ZhudaSceneLook`): preset and grade,
physically based surfaces, light from the side, shadows, air, wet ground, bounced
light, finish, and a frame budget. Every step has a check an agent can read without
judging a picture. Drawn on a desktop with both backends.

- **Id:** `good-looking-3d-scene`
- **Kind:** workflow
- **For:** Any 3D scene, film or game, that must look good: which look settings to give, in which order, and how to tell from advice and metrics that each step worked.
- **Checked on:** desktop WebGL; desktop WebGPU; no phone
- **Status:** the two example scenes and every step's check are drawn by
  `npm run verify:quality-route` and the film checks on an Apple M4, WebGL and
  WebGPU. No phone.
- **Reference consumer:** the engine's example scenes (`get_golden_example`, ids
  listed by `get_quality_route`).
- **Engine version:** 1.18.0 (this checkout).

## When to take this route

For every 3D scene, beside the route for its kind. It decides the look, not the
content: for the format of nodes and materials take [film-as-data](film-as-data.md);
for a scene kind that has a route of its own ([underwater](underwater.md),
[floating-island](floating-island.md)) read that as well. Read "what is not built"
in the [quality route](../quality-route.md#not-built-yet) first when deciding
whether the engine can carry the scene at all.

## Tools

- MCP: `get_quality_route` (these steps as data, limits, advice rules, what is not
  built), `film_scene_create`, `film_scene_apply`, `film_scene_preview`,
  `film_scene_review`, `film_scene_lint`, `film_scene_query`.
- In a game: `ZhudaSceneLook`, `ZhudaQualityGovernor`, `zhudaQualitySteps`.

## Steps

The full text of each step, with its API, reason and check, is the
[quality route](../quality-route.md#the-steps); `get_quality_route` returns the same.

1. **Pick the surface**: a film scene (data) or a game (code). Both resolve one `look`.
2. **Start from a preset and a grade**: `look: { "preset": "day", "grade": {} }`.
3. **Physically based surfaces only**, sized for the camera: recipes at 256 pixels a
   metre or more where the camera stands; `detail` for close range; `projection:
"triplanar"` on steep ground, cones and rocks.
4. **Ground and plants**: a `terrain` node for ground with heights, a `grass` node on
   it or on level ground; ask `film_scene_query` for heights instead of working
   positions out by hand.
5. **Light from the side**, and say what the ground throws back (`ambientGround`).
6. **Shadows that carry**: cascades by day; the key lamp casts a shadow by night.
7. **Air**: ground fog in the sky's colour, shafts with a low sun.
8. **Wet ground and water**: one reflector or one water node.
9. **Bounced and baked light**: `bounceLight` for props, shapes and ground (it also
   carries the light of what glows); lightmaps for static models.
10. **Distance**: `cullMeters`, `castShadow` and levels on models and props that are
    many or far.
11. **Finish**: exposure, then bloom, then grain and vignette.
12. **Look at it**: preview after every change; advice empty, no metrics flag.
13. **Hold the frame budget** in a game with the governor.
14. **Final evidence**: a render job for a film; a real browser report for a game.

## Pitfalls

- **Blinn-Phong by accident.** `Zhuda3D.createMaterial` given a `shininess` (or
  `type: "blinn-phong"`) ignores the sky and the HDR chain: the scene looks flat
  whatever the look.
- **The sun behind the camera.** Shadows fall out of sight; advice
  `sun.behind-camera`.
- **A coarse ground texture.** A recipe bakes at 256 unless given `size`; advice
  `texture.density`.
- **Emission is not light.** A glowing surface lights nothing without
  `bounceLight` or lamps; advice `emission.lights-nothing`.
- **Fog darker than the sky** draws a band on the horizon; leave its colour alone.
- **Judging by one preview.** A preview is one sample on one GPU; use the review
  grid, and a render job for the final picture.

## Engine gaps and their workarounds

Listed, and kept current, in the quality route's
[what is not built](../quality-route.md#not-built-yet): real-time global
illumination, reflections of what is off screen, more than eight point-light
shadows, area lights, parallax, weather beyond one cloud layer.

## Checks

`npm run verify:quality-route` and the film checks listed under
[evidence](../quality-route.md#evidence); all of them on WebGPU with
`npm run verify:film-webgpu`.

## Not checked

No phone and no mini-game host. Frame time on a target device is the game's own
record: see the frame-rate tiers (`ZHUDA_FRAME_TIERS`) in
[film scenes](../film-scenes.md#the-same-look-in-a-game).

## Boundaries

The look is data the engine resolves; what the scene holds, and whether its picture
is approved, is the consumer's.
