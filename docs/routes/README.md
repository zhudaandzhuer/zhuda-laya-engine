# Implementation routes

Every way of building something on this engine that has been done end to end is a
**route**: one page in this folder, `docs/routes/<id>.md`, in one format. Read the
route for your task **before** researching or designing: the point is to start where
the last agent stopped, not where it started.

```sh
node packages/mcp-server/index.mjs --tool list_routes          # every route, one line each
node packages/mcp-server/index.mjs --tool get_route --args '{"id":"film-as-data"}'
```

Over MCP the same two tools are `list_routes` and `get_route`; `get_agent_contract`
carries the list as `routes`. From an installed package the pages are under
`node_modules/zhuda-laya-engine/docs/routes/`.

## The format

Every page has the same header and the same sections, in the same order
([TEMPLATE.md](TEMPLATE.md)); the audit behind `npm run verify` and the Doctor
refuses a page that lacks one.

| Part                                                                                        | What it tells you                                                                 |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Header: `Id`, `Kind`, `For`, `Checked on`, `Status`, `Reference consumer`, `Engine version` | Whether the route fits, and on which devices it was really checked                |
| When to take this route                                                                     | What it fits, what it does not, and which route to take instead                   |
| Tools                                                                                       | Commands, MCP tools and outside tools with their versions                         |
| Steps                                                                                       | The order, the public API or tool of each step, the values that worked, the check |
| Pitfalls                                                                                    | What cost a previous agent hours: what was seen, the cause, the fix               |
| Engine gaps and their workarounds                                                           | What the engine does not do yet, and what to do meanwhile                         |
| Checks                                                                                      | The commands and device steps that show the result works                          |
| Not checked                                                                                 | Everything the route does not claim                                               |
| Boundaries                                                                                  | What stays in the consumer and what belongs to the engine                         |

Two kinds. A **workflow** is a path every project of its kind takes, whatever the
scene. A **scene** route is one kind of scene built end to end by a reference
consumer. Most tasks take one or two workflows and, when one fits, a scene route.

## Workflows

| Id                                                | For                                                                                                                 | Checked on                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| [new-game-project](new-game-project.md)           | Starting any game or app on the engine: project shape, engine pin, build, Doctor                                    | desktop CI; no phone         |
| [good-looking-3d-scene](good-looking-3d-scene.md) | Any 3D scene that must look good: look settings in order, each with its check                                       | desktop WebGL and WebGPU     |
| [film-as-data](film-as-data.md)                   | A scene, still or film as JSON through the MCP film tools: nodes, materials, terrain, grass, queries, packs, render | desktop WebGL and WebGPU     |
| [model-from-dcc](model-from-dcc.md)               | A model from Blender or another DCC tool: export, inspection, skins, levels of detail, mounting                     | desktop WebGL and WebGPU     |
| [visual-content-prefab](visual-content-prefab.md) | Anything a player sees in a game: prefab first, checked alone, then composed                                        | desktop WebGL                |
| [single-html-page](single-html-page.md)           | A prototype or embed that must be one HTML file                                                                     | desktop WebGL and WebGPU     |
| [mini-game-build](mini-game-build.md)             | Packaging for WeChat, Douyin and other mini-game hosts                                                              | macOS static builds; no host |

## Scenes

| Id                                                | For                                                                                                                                                    | Checked on                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| [floating-island](floating-island.md)             | A small island above a sea of cloud: grass a body presses down, pond, weather, a passing day, a character that is picked up and thrown; a frame budget | desktop WebGL and WebGPU           |
| [layered-cloth-on-body](layered-cloth-on-body.md) | A realistic modelled body in layered clothing that is pulled and torn: sheer stockings, trousers, skirts as cloth                                      | desktop WebGL and WebGPU; vivo V40 |
| [spine-character](spine-character.md)             | A 2D Spine character from generated art that the hand changes: IK, Spine physics, tearing by attachment swaps                                          | desktop WebGL and WebGPU           |
| [underwater](underwater.md)                       | A camera under water: sea floor, fading view, caustics, sunbeams, the surface from below                                                               | desktop WebGL and WebGPU           |

## Which route for which task

| The task                                     | Read, in this order                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| A new 3D game                                | `new-game-project`, `good-looking-3d-scene`, `visual-content-prefab`, then a scene route if one fits          |
| A new 2D game or UI                          | `new-game-project`, `visual-content-prefab`; `spine-character` for a rigged character                         |
| A film, a still, or a level laid out as data | `film-as-data`, `good-looking-3d-scene`                                                                       |
| A character, prop or building model          | `model-from-dcc`, then `film-as-data` or `visual-content-prefab` to show it                                   |
| An outdoor scene with hills and grass        | `film-as-data` (terrain, grass, triplanar), `good-looking-3d-scene`, `floating-island` for grass a body moves |
| A quick prototype in one file                | `single-html-page`                                                                                            |
| A mini-game release                          | `new-game-project`, `mini-game-build`                                                                         |
| Changing the engine itself                   | Not a route: `AGENTS.md`, then [agent development](../agent-development.md)                                   |

A route is not a plan (see [plans](../plans/README.md)) and not an API reference:
each guide in `docs/` owns its API, and a route links to it for detail and adds the
order, the values and what went wrong.

## Adding or changing a route

Write a route when you have built something end to end and checked it on the
devices you name, so the next agent can repeat it. Copy [TEMPLATE.md](TEMPLATE.md) to
`docs/routes/<id>.md`.

- The `Id` line is the file name. `Kind` is `scene` or `workflow`.
- Name only what was run. A step that was not checked goes under **Not checked**.
- Numbers keep their device, browser, backend and date.
- Link the engine guide for each API instead of restating it; restate only the
  values and the order that worked.
- The consumer's own files (models, textures, game rules) stay in the consumer;
  point to them, never copy them here.
- When an engine change makes a pitfall or a workaround obsolete, update the route
  in the same change.
- Add its row to the table above. `npm run verify` fails on a page that is not
  listed, lacks a header line or a section, or whose id is not its file name.
