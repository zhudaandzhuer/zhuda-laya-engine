# Implementation routes

A route is a way to build one kind of scene that has already been built on this
engine, end to end, by an agent, and checked on real devices: which tools, which
public APIs, in which order, which mistakes cost the most time, and what it measured.
Read the route for your scene **before** researching or designing one: the point is
to start where the last agent stopped, not where it started.

A route is not a plan (see [plans](../plans/README.md)) and not an API guide (each
guide in `docs/` owns its API). It links to those guides and adds what they do not
say: how the pieces were put together for one result, and what went wrong on the way.

## How to use a route

1. Find your scene in the table below. If two fit, read both: routes share steps.
2. Follow the steps in order. Each step names the public API or tool, the values
   that worked, and the check that says it worked.
3. Read **Pitfalls** before the first build: each one cost a previous agent hours.
4. Keep to **Boundaries**: what belongs in the consumer stays there.
5. Your result is not verified by a route. Run your own checks (the route's
   **Checks** section says which) and record them in your project.

## Routes

| Scene | Route | Evidence | Reference consumer |
| --- | --- | --- | --- |
| A realistic modelled body (legs, feet) in layered clothing that can be pulled and torn: sheer stockings, trousers, skirts as cloth; touch on phones | [Layered cloth on a modelled body](layered-cloth-on-body.md) | Desktop WebGL and WebGPU; vivo V40 (Chrome 156, WebGPU) | `games/stocking-tear` (outside this repository) |
| A 2D character from generated or painted art, rigged with zhuda-spine2D, that the hand changes: cloth lifted by IK and swung by Spine physics, a layer pulled and torn by swapping attachments | [Hand-driven Spine character](spine-character.md) | Desktop WebGL and WebGPU (not yet on a phone) | `games/stocking-tear-2d` (outside this repository) |
| A camera under water: a sea floor with a wreck, the view fading blue-green, caustics, sunbeams, the surface from below with the sky in its window | [A scene under water](underwater.md) | Desktop WebGL and WebGPU (not yet on a phone) | The engine's example scene `tests/fixtures/film/underwater.json` (no consumer game yet) |

## Engine guides that already are routes

These guides describe a whole path on their own; start there for their scenes.

| Scene | Guide |
| --- | --- |
| A new game project on the engine | [Consumer route](../consumer-route.md) |
| Any 3D scene, film or game that should look lit, grounded and deep | [Quality route](../quality-route.md) |
| New or changed visual content (UI, characters, models, effects) | [Prefab workflow](../prefab-workflow.md) |
| A model from Blender or another DCC tool into a game | [Model pipeline](../model-pipeline.md), then [model showcase](../model-showcase.md) |
| A film or a still authored as data, rendered to MP4 | [Film scenes](../film-scenes.md), [cinematics](../cinematics.md) |
| A single HTML page that loads the real runtime | [Browser SDK](../browser-sdk.md) |
| A WeChat, Douyin or other mini-game build | [Mini-game packaging](../minigame-packaging.md) |

## Adding a route

Write a route when you have built a scene end to end and checked it on the devices
you name, so the next agent can repeat it. Copy [TEMPLATE.md](TEMPLATE.md).

- Name only what was run. A step that was not checked is listed under **Not checked**.
- Numbers keep their device, browser, backend and date.
- Link the engine guide for each API instead of restating it; restate only the values
  and the order that worked.
- Put the consumer's own files (models, textures, game rules) in the consumer and
  point to them; never copy them here.
- When an engine change makes a pitfall or a workaround obsolete, update the route
  in the same change.
- Add the row to the table above.
