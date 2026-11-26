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

Since 2.0.0 the folder also holds the routes the game centre workspace kept beside the engine
(their modules are in [`prefabs/`](../prefab-library.md)) and one route written from each game of
the workspace's `games/` folder; those games are outside this repository, and their routes say
what the games' own records show, with dates.

Two kinds. A **workflow** is a path every project of its kind takes, whatever the
scene. A **scene** route is one kind of scene built end to end by a reference
consumer. Most tasks take one or two workflows and, when one fits, a scene route.

## Workflows

| Id                                                  | For                                                                                                                              | Checked on                                |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| [new-game-project](new-game-project.md)             | Starting any game or app on the engine: project shape, engine pin, build, Doctor                                                 | desktop CI; no phone                      |
| [game-2d](game-2d.md)                               | A 2D game or a game's 2D interface: scaffold, layout, time, input, prefabs, Spine, tile maps, ready 2D effects, audio            | desktop WebGL; no phone                   |
| [good-looking-3d-scene](good-looking-3d-scene.md)   | Any 3D scene that must look good: look settings in order, each with its check                                                    | desktop WebGL and WebGPU                  |
| [film-as-data](film-as-data.md)                     | A scene, still or film as JSON through the MCP film tools: nodes, materials, terrain, grass, queries, packs, render              | desktop WebGL and WebGPU                  |
| [interactive-film-viewer](interactive-film-viewer.md) | A film scene shown live on a page (an architecture walk-round, a product viewer): the three calls a frame, the lens, views, quality levels, mounting again | desktop WebGL and WebGPU; no phone |
| [papercraft-diorama](papercraft-diorama.md) | A pop-up book or paper diorama scene made of code alone: the marks of the look, six paper structures, folding without clipping, rules against flicker, light presets (from an outside skill; not built here) | nothing drawn here |
| [film-fight-that-lands](film-fight-that-lands.md) | A fight film as data where every hit touches: contact measured on the rig, aimed punches, spacing solved per shot, strike-frame boards, hit-stop, a library track cut to the story | desktop WebGPU; no phone |
| [film-ink-lines](film-ink-lines.md) | Thin storybook ink lines on a film render: flat-colour line passes, edges drawn on the beauty, no lines along shadows, faded on motion and with distance | desktop WebGPU; no phone |
| [model-from-dcc](model-from-dcc.md)                 | A model from Blender or another DCC tool: export, inspection, skins, levels of detail, mounting                                  | desktop WebGL and WebGPU                  |
| [visual-content-prefab](visual-content-prefab.md)   | Anything a player sees in a game: prefab first, checked alone, then composed                                                     | desktop WebGL                             |
| [single-html-page](single-html-page.md)             | A prototype or embed that must be one HTML file                                                                                  | desktop WebGL and WebGPU                  |
| [mini-game-build](mini-game-build.md)               | Packaging for WeChat, Douyin and other mini-game hosts                                                                           | macOS static builds; no host              |
| [laya-ide-project-cli-web](laya-ide-project-cli-web.md) | Running someone else's LayaAir IDE project in the browser with the official CLI, without the IDE window | desktop WebGL; no phone |
| [smooth-character-motion](smooth-character-motion.md) | A 3D character that must move as smoothly as a commercial game's showcase: clips, helper bones, clock order, cross-fades, props, cloth timing | desktop WebGL; no phone |
| [high-quality-character](high-quality-character.md) | A 3D character that is looked at closely: what its rig and clips must hold, raising one with Blender and the repository's tools, the measured bar, what a person judges | desktop WebGPU; Blender headless; no phone |
| [game-rules-first](game-rules-first.md)             | Any small game: rules as tested TypeScript, bots for balance, a thin view, a recorded run with real input                        | desktop WebGL in software; no phone       |
| [ui-test-by-probe](ui-test-by-probe.md) | A regression test of an interface as JSON: clicks on controls found by name or label through a probe of the Laya stage, an expectation after every step, the same result every run on a virtual clock | desktop headless Chrome at three shapes; no phone |
| [hunting-action-3d](hunting-action-3d.md)           | Third-person melee against one large monster: frame-data moves, dodge frames, part breaks, crafting                              | desktop WebGL in software; no phone       |
| [tower-defence-3d](tower-defence-3d.md)             | Tower defence on a path through a 3D place: pooled models, DOM markers tied to world positions                                   | desktop WebGL in software; no phone       |
| [idle-gacha-2d](idle-gacha-2d.md)                   | A portrait idle game with summons at published rates, offline earnings and an upgrade economy                                    | desktop WebGL in software; no phone       |
| [survivors-2d](survivors-2d.md)                     | A 2D game with hundreds of moving things at a steady draw count: one sprite redrawn from one atlas                               | desktop WebGL in software; no phone       |
| [merge-2d](merge-2d.md)                             | A drag-and-merge board with item chains, orders, energy and levels                                                               | desktop WebGL in software; no phone       |
| [platformer-2d](platformer-2d.md)                   | A tile platformer: `ZhudaTerrain2D` levels, variable jump, coyote time, jump buffering                                           | desktop WebGL in software; no phone       |
| [match-three-2d](match-three-2d.md)                 | A swap-and-match board with cascades and special pieces, played back round by round                                              | desktop WebGL in software; no phone       |
| [rhythm-2d](rhythm-2d.md)                           | Anything judged against music: a song mixed in the page, one clock, tap windows, calibration                                     | desktop WebGL in software; no phone       |
| [rigged-phone-character](rigged-phone-character.md) | A skinned, animated character as one textured GLB with two levels of detail                                                      | desktop WebGL in software; no phone       |
| [humanoid-from-shapes](humanoid-from-shapes.md)     | A human figure and what it wears made from code: shapes on a skeleton, meshed, cut into parts, skinned, animated by poses        | desktop WebGL in software; no phone       |
| [outfit-swap-3d](outfit-swap-3d.md)                 | A character dressed at run time: parts bound to the body's skeleton, covered regions hidden, colours by tint                     | desktop WebGL in software; no phone       |
| [clip-free-garments](clip-free-garments.md)         | Garments and objects made in number from a few numbers each, hidden skin under them, and two measures that nothing comes through | measured in Node; drawn in software WebGL |
| [game-to-prefabs](game-to-prefabs.md) | Retiring a game: its scenes, characters, systems and assets become prefab modules, proved pixel for pixel, before the game is removed | desktop WebGPU; no phone |
| [prototype-to-center](prototype-to-center.md) | Bringing a prototype from outside into the workspace as a game pinned to the engine, its pictures through the prefab gates first | desktop WebGL; no phone |
| [go-game-server](go-game-server.md) | A Go authoritative server for a round game: replaceable randomness, a wallet seam, JWT, an HTTP API, replay, an RTP simulator, a round format shared with the client | local Go; not deployed |
| [online-lockstep-match](online-lockstep-match.md) | The server of a two-player real-time versus mode: Go matchmaking and input relay, room codes, delay from round-trip time, hash comparison, bots, going live | local Go; live behind a tunnel; two headless Chromes; no phone |
| [pose-atlas-motion](pose-atlas-motion.md) | A realistic 2D character from a key-pose atlas made continuous without a skeleton: pins, a timetable, baked in-betweens, mesh warp | desktop WebGL; no phone |
| [low-poly-character-from-shapes](low-poly-character-from-shapes.md) | A low-poly rigged character GLB from one reference picture: shapes on bones, clips that cross-fade | desktop headless Chrome; no phone |
| [mobile-always-landscape](mobile-always-landscape.md) | A landscape web game that is landscape on a phone held upright, without a turn-your-phone prompt | phone emulation in headless Chrome; no real phone |
| [mobile-web-fullscreen](mobile-web-fullscreen.md) | Any web game on a phone or in WeChat: no zoom on a double tap or a pinch, full screen on Android, the iPhone's limits | phone emulation in headless Chrome; no real phone |
| [screen-fit-game-box](screen-fit-game-box.md) | Making a landscape web game fit every window and screen shape without cutting off or overflowing anything: the box, the units, the bars, touch coordinates, a check over twelve shapes | desktop headless Chrome at twelve shapes; phone emulation; no real phone |
| [key-art-to-animated-title](key-art-to-animated-title.md) | Turning a flat key art into a layered title screen that fits 4:3 to ultra-wide and moves: cutting the characters out, an empty background plate, placing the layers, entrance and idle animation | desktop headless Chrome; no real phone |
| [apocalypse-survival-3d](apocalypse-survival-3d.md) | A single-player 3D survival shooter on WebGPU from heavy GLB assets: prefab gate, particles, voiced story shots, a Go session service, an Electron package | desktop WebGPU; no Windows GPU, no phone |
| [story-counting-2d](story-counting-2d.md) | A 2D web game that opens and closes as a voiced visual novel and plays as an idle counting game, in three languages, packed for several portals | desktop WebGL; vivo V40 |
| [action-adventure-3d-minigame](action-adventure-3d-minigame.md) | A landscape 3D action adventure as a WeChat mini-game: bosses as data, story scenes, rigged characters with cloth, the package limits | WeChat host on an iPhone 14, a vivo V40 and cloud phones; desktop WebGL |
| [drop-merge-2d-minigame](drop-merge-2d-minigame.md) | A portrait drop-and-merge game on circle physics for WeChat, several skins from one code base | desktop headless Chrome at phone sizes; no host run, no phone |
| [raft-brawl-3d-minigame](raft-brawl-3d-minigame.md) | A landscape 3D WeChat mini game where characters knock each other off a shrinking raft: seeded rules with bots, a 4 MB main package | Node rule tests; an iPhone in WeChat (load and title only) |
| [isometric-mystery-2d](isometric-mystery-2d.md) | A short isometric investigation game: a baked multi-level map, a torch that relights it, characters from one atlas, clues and an accusation as data | desktop WebGL; vivo V40 |
| [platform-fighter-2d](platform-fighter-2d.md) | A two-player fighting game identical on two machines: an integer simulation, moves as frame data, a computer opponent, the client side of lockstep | desktop WebGL; phone emulation; no real phone |
| [pole-rescue-arcade-3d](pole-rescue-arcade-3d.md) | A one-screen 3D arcade game: a pointer moves a tool's tip over a plane, targets are taken in a short window and carried to a goal | desktop WebGPU and WebGL; phone emulation; no phone |

## Scenes

| Id                                                | For                                                                                                                                                    | Checked on                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| [floating-island](floating-island.md)             | A small island above a sea of cloud: grass a body presses down, pond, weather, a passing day, a character that is picked up and thrown; a frame budget | desktop WebGL and WebGPU            |
| [layered-cloth-on-body](layered-cloth-on-body.md) | A realistic modelled body in layered clothing that is pulled and torn: sheer stockings, trousers, skirts as cloth                                      | desktop WebGL and WebGPU; vivo V40  |
| [spine-character](spine-character.md)             | A 2D Spine character from generated art that the hand changes: IK, Spine physics, tearing by attachment swaps                                          | desktop WebGL and WebGPU            |
| [underwater](underwater.md)                       | A camera under water: sea floor, fading view, caustics, sunbeams, the surface from below                                                               | desktop WebGL and WebGPU            |
| [outdoor-landscape](outdoor-landscape.md)         | A mountain, ridge or dune landscape on terrain nodes, with rock by slope, grass and things placed by query                                             | desktop WebGL in software; no phone |
| [astral-minimal-film-look](astral-minimal-film-look.md) | A minimalist sunset set (孤旅大氣分層風): flat colour fields, a low sun behind the cameras, shadow bands from off-camera slabs, a painted dusk panorama, fog equal to the horizon | desktop WebGPU; no phone |
| [shared-islands](shared-islands.md) | A game, a picture or a film on one of the three finished islands of the prefab library | desktop WebGPU; no phone |
| [dungeon-line-slot](dungeon-line-slot.md) | A portrait payline slot that plays each round as a dungeon fight, every picture through the prefab gate | desktop WebGL; no phone |
| [cascade-slot](cascade-slot.md) | A pay-anywhere slot with cascades, multipliers and free games: a client and a Go authoritative server | desktop WebGL, local Go; no phone |
| [side-view-duel](side-view-duel.md) | A realistic side-view one-on-one duel: a key-pose atlas, footwork by distance, hits along the blade, a 120 Hz simulation | desktop WebGL; phone emulation |
| [third-person-town-3d](third-person-town-3d.md) | A town walked on foot from behind the player: the place as a model prefab, walking rules, a camera that stays out of walls, people to inspect, a passing day | desktop headless Chrome; vivo V40 (frame rate only) |

## Which route for which task

| The task                                     | Read, in this order                                                                                                                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A new 3D game                                | `new-game-project`, `good-looking-3d-scene`, `visual-content-prefab`, then a scene route if one fits                                                                                         |
| A new 2D game or UI                          | `new-game-project`, `game-2d`, `visual-content-prefab`; `spine-character` for a rigged character                                                                                             |
| A film, a still, or a level laid out as data | `film-as-data`, `good-looking-3d-scene`                                                                                                                                                      |
| A film scene a visitor looks round on a page (a building, a room, a product) | `film-as-data` for the scene, then `interactive-film-viewer` |
| A pop-up book, a papercraft world, a paper diorama, or a 3D scene with no asset files | `papercraft-diorama` for the style, then `film-as-data` and `good-looking-3d-scene` |
| A fight or action film where every hit must touch (打到, not 隔空打) | `film-as-data`, `film-fight-that-lands`; for a drawn look `film-ink-lines` (細墨線) and `astral-minimal-film-look` (極簡黃昏) |
| A character, prop or building model          | `model-from-dcc`, then `film-as-data` or `visual-content-prefab` to show it                                                                                                                  |
| An outdoor scene with hills and grass        | `film-as-data` (terrain, grass, triplanar), `good-looking-3d-scene`, `floating-island` for grass a body moves                                                                                |
| A game of a kind someone already built       | `new-game-project`, `game-rules-first`, then the genre: `platformer-2d`, `match-three-2d`, `rhythm-2d`, `merge-2d`, `idle-gacha-2d`, `survivors-2d`, `tower-defence-3d`, `hunting-action-3d` |
| A character that changes clothes             | `humanoid-from-shapes` (or `model-from-dcc`) for the parts, `clip-free-garments` for clothes that cannot clip, then `outfit-swap-3d`                                                         |
| A quick prototype in one file                | `single-html-page`                                                                                                                                                                           |
| A LayaAir IDE project someone handed over (`.laya`, `.ls`, regClass scripts) to build and look at | `laya-ide-project-cli-web` |
| A character that looks stiff or jitters, or must look as smooth as a commercial game's (流暢) | `smooth-character-motion`, then `model-from-dcc` for the rig and clips |
| A character that must be high quality (高品質角色): a hero, a showcase, anything the camera comes near | `high-quality-character` (the bar and the tools), with `smooth-character-motion` for why |
| A mini-game release                          | `new-game-project`, `mini-game-build`                                                                                                                                                        |
| A game that is retired, or a prototype brought into the workspace | `game-to-prefabs`, `prototype-to-center` |
| Anything on one of the finished islands | `shared-islands`, then `floating-island` for how the island is made |
| A slot, or another game of one button and one round | `new-game-project`, `game-2d`, then `cascade-slot` or `dungeon-line-slot`; with a server that decides the result, `go-game-server` |
| Two players in real time over the network | `platform-fighter-2d` (the simulation and the client), `online-lockstep-match` (the server) |
| A web game that will be opened on a phone | `mobile-web-fullscreen` always; `mobile-always-landscape` and `screen-fit-game-box` for a landscape game |
| A game that must fit any window or screen shape (適配: tall desktop windows, tablets, ultra-wide, fold phones) | `screen-fit-game-box` |
| A title screen from one flat picture that must fit other shapes or move (動態) | `screen-fit-game-box`, then `key-art-to-animated-title` |
| A realistic 2D character without Spine, or a side-view fight | `pose-atlas-motion`, `side-view-duel` |
| A low-poly rigged character without a modelling tool | `low-poly-character-from-shapes`; a dressed human figure: `humanoid-from-shapes` |
| A WeChat mini-game | `new-game-project`, `mini-game-build`, then the one nearest: `drop-merge-2d-minigame` (2D), `raft-brawl-3d-minigame` (3D, small), `action-adventure-3d-minigame` (3D, large) |
| A game like one the workspace already shipped | Its route: `isometric-mystery-2d`, `story-counting-2d`, `third-person-town-3d`, `apocalypse-survival-3d`, `pole-rescue-arcade-3d`, `platform-fighter-2d`, and the three mini-games above |
| A test of an interface that clicks named controls and asserts each step, without a model | `ui-test-by-probe` |
| Something several games will share | [The prefab library](../prefab-library.md): look in `prefabs/catalog.json` first, add a module there, not in a game |
| Changing the engine itself                   | Not a route: `AGENTS.md`, then [agent development](../agent-development.md)                                                                                                                  |

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
