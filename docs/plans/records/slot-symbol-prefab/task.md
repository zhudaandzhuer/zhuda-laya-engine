# Agent task: slot-symbol-prefab

Status: Implemented; browser evidence accepted on macOS desktop  
Owner: Engine examples and consumer tooling  
Last reviewed: 2026-11-07

## Source requirement

User request: “假設美術要單獨做資產，應該是快速建立並且能用網頁預覽吧？你嘗試做一個 prefab 做 slot game symbol 的 prefab，把一個做好各種特效以後只要換圖就能持續重複使用特效。”

## Goal

Deliver a reusable `slot/symbol` Prefab whose `Art` asset can be replaced while
the frame, glow, shine, burst and state effects remain reusable, with a browser
preview and a reproducible acceptance command.

## Invariants

- The Prefab and Scene use the same `definitions` and `createAssetProvider`.
- Symbol files are addressed by logical IDs and verified by manifest bytes/SHA-256.
- The effect controller advances from the existing `ZhudaRuntimeSession` delta;
  it does not create a second gameplay clock or timer.
- A failed or incomplete candidate does not publish a release artifact.
- The example contains neutral sample art only; slot rules, payout and production
  assets remain consumer-owned.

## Dependencies

- Public SDK pinned to `zhuda-laya-engine` `1.14.0` in the example manifest.
- `ZhudaPrefabLibrary`, `DirectoryAssetProvider`, `ZhudaEffectDirector`, the
  candidate consumer build and browser Prefab checker.
- Generated sample asset: `assets/symbols/rocket.png` (transparent RGBA).

## Scope

### Engine

- No new runtime engine API. The example exercises the existing public Prefab,
  effect, asset manifest, candidate build and browser evidence contracts.

### Consumer or adapter

- `examples/slot-symbol-prefab/` sample consumer, isolated build scripts,
  Prefab definition, effects, responsive workbench and acceptance evidence.

## Non-goals

- Slot mathematics, paylines, payout authority, reel timing or production game UI.
- A promise that a static desktop browser capture proves every mobile device.
- Copying a patched engine or importing engine source paths into the sample.

## Acceptance checks

1. `npm run manifest` regenerates the checked-in manifest for
   `prefabs/slot-symbol.lh` and `symbols/rocket.png`; missing files fail.
2. `npm run typecheck` passes with strict consumer source checking and public
   SDK declarations.
3. `npm run build:candidate` builds an independent temporary consumer and
   leaves a runnable `dist/candidate/web/prefab-preview.html`.
4. `npm run check:prefab` runs the real Chrome checker at 480×480, DPR 1, with
   30 instantiate/dispose cycles for `Art`/idle, the full idle composition and
   the selected composition. Every report must have schema 2, measured
   environment PASS, provenance hashes, zero pixel differences and a complete
   lifecycle audit.
5. `npm run build` reruns the same isolated route in release mode and validates
   the evidence gate before copying the release artifacts for local inspection.
6. `index.html?scene=slot-machine` displays the same Laya runtime together with
   the Scene hierarchy, Inspector, design bounds and COPY payload; selecting
   `Background` reports `1280×720` bounds and `zhuda-prefab-editor` exposes the
   same `.ls` tree for editing.

## Evidence to attach

- `reference/slot-symbol-idle.png`
- `reference/slot-symbol-composite-idle.png`
- `reference/slot-symbol-composite-selected.png`
- Matching `evidence/*.json` reports and actual PNG captures.
- Candidate/release `consumer-build.json` and `payload-manifest.json` are local
  generated outputs under the ignored `dist/` directory.

## Unverified limits

- Physical iOS/Android rendering, native packaging and hardware GPU behavior.
- Artist-specific image composition or color approval beyond the checked-in
  rocket reference.
- Animated effect frame parity in the generic compiler Prefab preview; the
  complete animated workbench is the generated `index.html` Scene entry.

## Rollback

Remove `examples/slot-symbol-prefab/` and its record if the sample is not
accepted. The engine SDK and consumer build contracts remain unchanged.
