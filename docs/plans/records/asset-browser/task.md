# Agent task: asset-browser

Status: Implemented within scope  
Owner: Engine tooling  
Last reviewed: 2026-11-07  

## Source requirement

The Web Prefab/Scene preview needs a Unity/Laya-style asset workspace: the
preview remains the main surface, while a lower panel exposes the consumer's
`assets/` directory tree and file cards. Selecting a `.lh` or `.ls` asset must
open that same definition in the real Laya preview; the slot-symbol example
also needs to switch its image slot from the asset card.

## Goal

Make the asset workspace reusable from the engine-provided editor and keep the
slot-symbol example as a runnable reference implementation.

## Invariants

- Asset metadata is read from the consumer project; game assets are not copied
  into the engine repository.
- Paths remain project-relative and traversal/symlink escapes are rejected.
- `.lh` and `.ls` previews instantiate the selected source definition through
  the public Zhuda/Laya runtime; the browser does not fake the canvas in HTML.
- Asset metadata does not bypass the existing save revision, validation or
  prefab evidence gates.
- Design coordinates, CSS pixels and backing pixels remain separate.

## Dependencies

- `zhuda-prefab-editor` server/client and its existing project static route.
- `AssetManifest` and the slot-symbol example's pinned manifest.
- Existing editor and consumer acceptance tests.

## Scope

### Engine

- `packages/compiler/prefab-editor-server.mjs`
- `packages/compiler/prefab-editor-client.ts`
- `tests/prefab-editor.test.mjs`
- `docs/prefab-editor.md`

### Consumer or adapter

- `examples/slot-symbol-prefab/` as the reference asset workspace.

## Non-goals

- A full Unity 3D, Spine or particle graph editor.
- Game rules, payout logic, deployment or consumer asset authoring.
- Removing Prefab/Scene evidence gates.

## Acceptance checks

1. A consumer project with nested files returns an asset inventory with stable
   project-relative paths, type, byte size and SHA-256; traversal is rejected.
2. The editor renders a lower Assets panel with a folder tree and cards; cards
   for `.lh`/`.ls` reopen the selected source in the same editor route.
3. The existing Prefab and Scene hierarchy/Inspector, drag, save, revision and
   backup behavior remain intact.
4. The slot-symbol page keeps its runtime asset switching and its manifest is
   generated from the declared asset root.
5. Focused tests, example typecheck/build and `npm run verify` pass.

## Evidence to attach

- Test/build output: `tests/prefab-editor.test.mjs`, example build/typecheck and
  root verification.
- Browser/WebGL: local editor URL with Prefab and Scene card switching; example
  URL with Scene and image switching.
- Resource/lifecycle: existing editor reload/dispose and Prefab acceptance.

## Unverified limits

- Native/mobile and 3D asset editing remain outside the editor contract.
- Browser visual checks require a local Chrome binary; unavailable runs remain
  unavailable.

## Rollback

If the generic panel fails, the CLI still opens the selected `.lh`/`.ls` using
the existing hierarchy/Inspector route; remove only the asset inventory UI and
routes to return to the accepted editor behavior.
