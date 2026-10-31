# Development plans

This directory contains proposed work that is not part of the current public
runtime contract. A plan becomes an implementation only after its entry criteria,
device checks and acceptance gates pass.

## Statuses

- **Proposed** — a decision and measurement plan exists; no implementation is promised.
- **In progress** — the plan is being implemented on a branch with tests.
- **Accepted** — the implementation and the plan's acceptance evidence passed.
- **Deferred** — the work remains useful but is waiting for a dependency or decision.
- **Rejected** — measurements or constraints ruled out the approach.

## Planned work

| Plan | Status | Decision it prepares |
| --- | --- | --- |
| [Deferred asset packaging](asset-packaging.md) | Proposed | Whether to keep plain assets, add CDN chunks, or introduce a packed/Rust/WASM provider after the project is stable |

Use [TEMPLATE.md](TEMPLATE.md) for new plans. Keep game-specific art, rules and
media in consumer repositories; this directory describes engine and delivery
contracts only.
