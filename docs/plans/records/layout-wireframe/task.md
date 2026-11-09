# Agent task: layout-wireframe

Status: Accepted; CLI and consumer gate verified on macOS  
Owner: Engine compiler and Prefab workflow  
Last reviewed: 2026-11-07

## Source requirement

User request: “目前做 layout 的 wireframe 是依賴模型能力？還是我們能用 SVG 做外框定位，把一張圖的所有 UI 都用 SVG 框一遍，把位置都定位，然後才去實作 UI 圖？好，去做，這套要能用在任何 scene prefab 方便使用。”

## Goal

Provide a model-independent layout contract that lets an artist or agent mark
UI regions in SVG coordinates, preview them over the source screenshot, validate
their IDs and geometry, and carry the same contract into any consumer Scene or
Prefab build.

## Invariants

- Design coordinates are CSS/design pixels and remain independent of DPR backing
  pixels and browser viewport size.
- Every region has a stable logical ID, finite rectangle, explicit kind and
  optional anchor/safe-area/state metadata.
- The source image and layout contract retain SHA-256 provenance.
- SVG is a visual editing/proof representation; the JSON contract is the
  machine-readable authority consumed by tooling.
- No model, OCR result or screenshot pixel measurement is treated as accepted
  layout evidence without explicit contract validation.
- Existing Prefab, Scene, asset-provider and consumer boundaries remain intact.

## Dependencies

- Node.js 24+, the existing consumer compiler and public Prefab workflow.
- `sharp` is not required; source image metadata is read from PNG/JPEG/WebP
  headers and SVG remains text.
- Existing `zhuda-prefab-check` remains the runtime rendering gate.

## Scope

### Engine

- `packages/compiler/layout-contract.mjs` validation, SVG conversion and
  self-contained preview generation.
- `packages/compiler/zhuda-layout.mjs` CLI and package bin.
- `packages/types/zhuda-layout.*` public schema types.
- Optional `layoutContracts` consumer build gate and compiler tests/docs.

### Consumer or adapter

- Consumers own screenshots, SVG wireframes, layout JSON and the Prefab/Scene
  implementation that references the stable IDs.
- No game artwork, payout logic or production UI is added to this repository.

## Non-goals

- Automatic UI detection, OCR, image segmentation or claims that a model's
  guessed boxes are correct.
- Replacing `.lh` Prefabs or Scene composition with SVG at runtime.
- Pixel-perfect artistic acceptance from a wireframe alone; the actual Prefab
  still needs browser/device evidence.

## Acceptance checks

1. A valid layout JSON with source image, design canvas and stable nodes passes
   validation and reports source SHA-256.
2. `from-svg` imports SVG `<g data-layout-id>` / `<rect data-layout-id>` nodes,
   rejects duplicate IDs, malformed rectangles, viewBox mismatch and unsafe
   paths, and records the source SVG hash.
3. `to-svg` deterministically emits an overlay with the same viewBox, IDs,
   labels and rectangles; an import/export round trip preserves geometry.
4. `preview` emits a self-contained HTML page with the source image and SVG
   overlay, a node list, coordinate readout and responsive CSS without relying
   on a model or network.
5. A consumer with `layoutContracts` cannot build when its contract or linked
   SVG is invalid; a valid contract is recorded in the build report and does
   not affect consumers that do not opt in.
6. Run `npm run verify`, `git diff --check`, and an isolated CLI fixture with
   deliberate failing inputs.

## Evidence to attach

- CLI JSON reports and generated SVG/HTML fixture under `/tmp`.
- Unit tests for schema, SVG conversion, preview escaping and build gate.
- Full engine verification output and one independent consumer build report.

## Unverified limits

- Human artistic approval and device-specific visual appearance still require
  the consumer's Prefab evidence and real device checks.
- SVG filters, transforms, text layout and arbitrary paths are not imported as
  UI rectangles; only explicit data attributes are authoritative.

## Rollback

Remove the layout CLI, type declarations, compiler gate and documentation. The
existing Prefab/Scene route remains unchanged for consumers without
`layoutContracts`.
