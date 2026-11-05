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
| [Prefab isolation and consumer tooling](prefab-toolchain.md) | In progress | P0 consumer Prefab preview and evidence gate delivered in 1.1.0; P1/P2 UI, lifecycle, media and device work remains |
| [Deferred asset packaging](asset-packaging.md) | Proposed | Whether to keep plain assets, add CDN chunks, or introduce a packed/Rust/WASM provider after the project is stable |
| [Consumer delivery follow-ups](consumer-delivery-followups.md) | In progress | Original sample/BGM audio in one mixer, component dependency evidence and full vendor declaration repair |
| [Slot factory foundation](records/slot-factory-foundation/task.md) | Implemented; desktop verified | White-label, immutable themes, result presentation recovery and measured neutral 2D pilot; customer/native/device acceptance separate |
| [Asset showcase hardening](records/asset-showcase-hardening/task.md) | Implemented; desktop verified | Required glTF gates, Morph repairs, public inspector and same-instance presentation; seller/device limits explicit |
| [Crowd runtime hardening](records/crowd-runtime-hardening/task.md) | Implemented; desktop verified | Shared animation/model lifecycle, presentation LOD, VFX admission, GPU/raw profiler and independent skinned benchmark |
| [Astra runtime feedback](records/astra-runtime-feedback/task.md) | Implemented; desktop verified | DPR, streams, voice retirement, driver/recovery, backend seam and clean declarations; physical devices unavailable |
| [Browser SDK delivery](records/browser-sdk-delivery/task.md) | Implemented; desktop verified | Versioned browser bundles, SRI, hosted examples and cross-origin HTML; mobile unavailable |
| [RPG integration feedback](records/rpg-feedback-hardening/task.md) | Implemented; desktop verified | Lifecycle completion, official candidate acceptance, component proofs and leased primitive resources; physical devices unavailable |

Use [TEMPLATE.md](TEMPLATE.md) for new decision plans. For an implementation
delegated to an agent, copy [TASK-TEMPLATE.md](TASK-TEMPLATE.md) and finish the
result with [VERIFICATION-TEMPLATE.md](VERIFICATION-TEMPLATE.md). Keep
game-specific art, rules and media in consumer repositories; this directory
describes engine and delivery contracts only.
