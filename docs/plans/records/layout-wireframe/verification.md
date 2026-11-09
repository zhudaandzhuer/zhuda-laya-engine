# Verification record: layout-wireframe

Task document: [`task.md`](task.md)  
Commit: working tree (base `e50ff4e8d270b8d0f29504d9050c1da489c4afb7`)  
Date: 2026-11-07

## Environment

- OS / browser / device: macOS desktop; CLI and compiler fixtures use Node
- Node and package manager: Node 26.12.0, npm 11.20.0
- Engine and consumer commits: engine working tree; consumer test is an
  isolated temporary consumer using the public SDK route
- DPR, viewport and network mode: layout preview is responsive; coordinates
  are fixed at design/CSS pixels; no network dependency

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Layout unit and build-gate tests | `node --test tests/layout-contract.test.mjs` | PASS; 5 tests | test output |
| CLI smoke | `node packages/compiler/zhuda-layout.mjs --help`; isolated `from-svg`, `validate`, `preview` fixture | PASS | temporary JSON/SVG/HTML fixture |
| Public declarations | `npm run typecheck` | PASS | terminal output |
| Full engine regression | `npm run verify` | PASS; 268 tests, 0 failures | terminal output |
| Diff hygiene | `git diff --check` | PASS | terminal output |

## Contract evidence

The fixture proves a 4×4 design canvas with `hud.balance` and `hud.spin`
regions. SVG export/import preserves IDs and rectangles. The preview embeds the
source PNG and exposes node metadata without external requests. The consumer
candidate build records the valid contract and rejects a deliberately stale
source SHA before compilation/publication.

## Limits and decision

**Accepted within scope.** This tool does not infer boxes from pixels, validate
font metrics or replace the actual Prefab browser/device evidence. Consumers
must review the SVG, implement the named Prefab/Scene nodes and run
`zhuda-prefab-check` at their required viewports and DPRs.
