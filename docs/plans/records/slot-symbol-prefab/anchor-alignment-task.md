# Agent task: slot-symbol-anchor-alignment

Status: Implemented; browser evidence pending rerun  
Owner: Engine Prefab schema and slot-symbol example  
Last reviewed: 2026-11-07

## Source requirement

User visual review of the slot-symbol workbench: the Prefab size must be
obvious, Jackpot enlargement must distinguish the fixed design canvas from the
Art transform, and the anchor must be visible and correct when the Art scales.

## Goal

Make a 2D Prefab's anchor/pivot part of the public static hierarchy contract,
center the sample Art node for state scaling, and expose the live geometry in
the browser inspector.

## Invariants

- The Prefab root remains a fixed 480 × 480 design canvas.
- Jackpot changes only the `Art` node scale; it must not resize the root or the
  SVG design guide.
- The preview and Scene still instantiate the same `.lh` definition.
- `ROCKET` remains a vendor Laya `Label`; guide overlays remain SVG only.
- Anchor values are finite and normalized to 0–1; pivot values are finite design
  pixels and retain explicit ownership in the Prefab data.

## Dependencies

- Public `LayaHierarchyNodeData` and `PrefabNodePatch` declarations.
- LayaAir 3.4.2 `Sprite.anchorX/anchorY/pivotX/pivotY` runtime properties.
- `examples/slot-symbol-prefab` browser workbench and its existing acceptance
  reports.

## Scope

### Engine

- Add anchor/pivot fields to the public static hierarchy, Prefab state patch,
  hydrator, editor validation and editor inspector.

### Consumer or adapter

- Center the sample Art node, show the anchor marker and live transform metrics.

## Non-goals

- Changing slot payout rules or adding a second animation clock.
- Making the SVG guide part of the runtime Scene.
- Claiming physical-device rendering from the desktop browser capture.

## Acceptance checks

1. `tests/prefab-editor.test.mjs` accepts normalized anchor fields and rejects
   out-of-range anchors.
2. `examples/slot-symbol-prefab` typechecks and candidate-builds.
3. `npm run capture:prefab` and `npm run check:prefab` pass for the Art and
   composite idle/selected selections after the definition change.
4. The workbench visibly reports root size, Art rect, current Art scale,
   anchor percentage/pivot and keeps the anchor marker fixed while Jackpot
   animates the Art node around its center.
5. From the repository root, `npm run verify` and `git diff --check` pass.

## Evidence to attach

- `examples/slot-symbol-prefab/evidence/*.json`
- `examples/slot-symbol-prefab/reference/*.png`
- Typecheck, candidate build and root verify output.

## Unverified limits

- Native packaging and physical iOS/Android rendering remain unverified.

## Rollback

Revert the anchor/pivot schema and sample `.lh` changes; the previous sample
continues to render with top-left scaling but must not be presented as a
center-anchored Jackpot effect.
