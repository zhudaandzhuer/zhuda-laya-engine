# Agent task: slot-symbol runtime switching and responsive inspector

Status: Implemented; browser evidence captured on macOS desktop Chrome
Owner: Engine examples and consumer tooling
Last reviewed: 2026-11-07

## Source requirement

The asset workbench must switch between the `.lh` Prefab and `.ls` Scene in
the same Laya runtime. Switching an asset must not reload the page or start a
second loading cycle. The hierarchy remains on the left, the Inspector stays
on the right above the preview surface, and both side panels can collapse.

## Invariants

- Prefab and Scene continue to use the public Laya/Zhuda runtime and the same
  Prefab definition; no HTML canvas replacement is introduced.
- Asset clicks update the URL with `history.replaceState` and do not navigate.
- The Scene Inspector owns Scene hierarchy data, while the shared UI owns one
  COPY and one collapse handler per button.
- Side panels remain above the preview at desktop and narrow CSS viewports.
- The bottom asset browser remains available for switching folders and files.

## Scope

### Engine example

- `examples/slot-symbol-prefab/src/Main.ts`
- `examples/slot-symbol-prefab/src/slot-machine-scene.ts`
- `examples/slot-symbol-prefab/public/index.html`

### Non-goals

- Changing game rules, payout logic, asset contents or the public runtime API.
- Claiming physical-device rendering from a desktop browser capture.

## Acceptance checks

1. Strict consumer typecheck and candidate build pass.
2. Prefab evidence gate remains green.
3. A real Chrome WebGL run can switch Scene → Prefab → Scene with one
   navigation entry, one app bundle request and the existing canvas/runtime.
4. At desktop and narrow CSS widths, the Inspector is above the preview and
   left/right collapse controls reduce each panel to a 48 px rail.
5. Scene COPY emits the Scene hierarchy through the shared button without a
   second event binding.

## Unverified limits

- Physical iOS/Android rendering and native packaging remain unverified.
- The browser capture uses macOS Chrome with SwiftShader/WebGL.
