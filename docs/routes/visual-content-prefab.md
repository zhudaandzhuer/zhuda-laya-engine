# Route: visual content verified as prefabs before it enters a scene

New or changed visual content of a game (UI, characters, models, Spine, materials,
effects) is delivered as prefabs that load by a stable id on their own, reproduce a
named state, and are compared with their source, before they are composed into
panels and mounted in a scene. The preview and the scene instantiate the same
definition. Compared by real draws in a desktop browser.

- **Id:** `visual-content-prefab`
- **Kind:** workflow
- **For:** Adding or changing anything a player sees in a game: how to inventory the source art, author a prefab, check it alone, compose it and keep the evidence current.
- **Checked on:** desktop WebGL (headless Chrome); device runs are the game's
- **Status:** the checker, the candidate build and the acceptance command are run
  against independent consumers by `npm run verify:prefab-browser` and
  `npm run verify:prefab-models` on a desktop. Device results are each game's own.
- **Reference consumer:** the consumer built by `scripts/verify-prefab-models.mjs`;
  any game under `games/` with `prefabChecks` in its `zhuda.config.json`.
- **Engine version:** 1.18.0 (this checkout); evidence schema 2.

## When to take this route

Whenever a game's picture changes. Not for a film scene (its preview loop is
[film-as-data](film-as-data.md)) and not for engine demo fixtures, whose calibration
proves only those fixtures.

## Tools

- `zhuda-laya-build --candidate`, `zhuda-laya-accept` (and `--capture`),
  `zhuda-laya-watch --candidate` (with `prefabPreview` configured, as this route
  needs, every save runs the full build), `zhuda-prefab-check`.
- `zhuda-prefab-editor` for authoring by hand.
- MCP: `get_agent_contract` (`visualWorkflow`).

## Steps

The five gates, in full with the evidence table, are the
[prefab workflow](../prefab-workflow.md).

1. **Inventory the source.** A stable logical id for every texture, atlas, model and
   font, with its source revision, the expected look, the comparison baseline, the
   test states and the tolerance. Ids go through `AssetProvider`
   ([asset loading](../asset-loading.md)).
2. **Author the prefab** in the game's repository: dependencies, root, stable paths
   of the children that can be checked, size and anchor, the states that can be
   injected, and who releases what.
3. **Check one node alone.** On an isolated canvas select prefab, node path, state
   and time, draw it, and keep the actual picture, the expected one, the
   difference and the measurements. Fixed viewport, DPR, font, locale and seed.
4. **Compose from small to large.** Verified children into a panel that previews
   alone; passing panels into the scene. The scene owns position, layer, lights,
   input routing and data binding.
5. **Integrate in the game**: build at the pinned engine, test real input, overlap,
   scaling and DPR, state updates and teardown; target devices where behaviour
   differs. Scene evidence is kept apart from single-node evidence.
6. **When evidence is missing or stale**: `zhuda-laya-build --candidate`, then
   `zhuda-laya-accept`, which runs every `prefabChecks` entry in a real browser and
   publishes only the candidate it checked
   ([consumer tooling](../consumer-tooling.md#candidate-and-acceptance-commands-150)).

## Pitfalls

- **Only a whole-game entry.** A prefab that cannot be opened alone by id, node and
  state fails gate 2.
- **Capture is not approval.** `--capture` makes reference pictures for review; it
  publishes nothing.
- **Stale evidence after a dependency changed.** An asset, font, definition or
  renderer change marks the node and its parents for a new check; rerun against the
  old baseline first.
- **Thirty cycles that are not thirty.** `cycles=30` must really release and rebuild
  thirty times with equal resource snapshots.
- **Missing `<meta charset="utf-8">`** in the preview page changes font measurement
  between preview and game.
- **Proof by proxy.** A constant-true assertion, a search for a string in the code,
  a screenshot's file size, or the engine's own demo passing are not the game's
  evidence.

## Engine gaps and their workarounds

- A large file's nodes are not split into separately invalidated components
  automatically: declare `prefabComponents`, or the whole package is invalidated
  ([selective component evidence](../consumer-tooling.md#selective-component-evidence)).
- Evidence of schema 1 cannot be relabelled: measure again with the schema 2 checker.

## Checks

- In the game: `npm run accept:prefabs`; the scene's own acceptance report.
- In the engine: `npm run verify:prefab-browser`, `npm run verify:prefab-models`,
  `npm run verify:prefab-editor`.

## Not checked

A passing prefab says nothing about mobile support or game performance. Static
schema, package types, the single node, the scene and each device are recorded
separately, each with its real environment.

## Boundaries

Prefab definitions, source art, baselines, numbers, payout rules and media belong to
the game. The engine supplies the checker, the build and the lifecycle
(`AssetProvider`, cache, lease, release); it is never patched or deep-imported to
make a prefab pass.
