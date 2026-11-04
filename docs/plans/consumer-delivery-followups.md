# Consumer delivery follow-ups: samples, dependency evidence and declarations

Status: Proposed

Owner: Engine runtime and consumer tooling

Last reviewed: 2026-11-04

## Objective

Close common engine integration gaps identified by the BDL review of `0127bd2`.
Let games supply original audio and precise visual dependencies through public
interfaces, without maintaining private engine patches or inventing PASS results.

## Scope

Engine: audio sample ingestion into the existing mixer, evidence dependency
tracking, public declaration repair. Consumers: asset IDs, original media,
cue timing, gameplay, required device matrix and actual Scene provenance.
Slot migrations do not acquire a combat requirement merely because the SDK
exports combat APIs; choose contracts appropriate to their gameplay.

## Current baseline

- [`audio.md`](../audio.md): one context/mixer and tone events only. No public
  AudioBuffer ingress, MP3 decoder, BGM streaming or replaceable backend port.
- [`prefab-toolchain.md`](prefab-toolchain.md): static 2D Prefab provenance and
  whole-payload evidence. Provenance is not a component dependency graph.
- [`consumer-review-reliability`](records/consumer-review-reliability/task.md):
  separate work for measured browser metrics, staged build publication,
  preview provider injection and explicit asset inclusion.
- `npm run audit:declarations`: reproduces 506 errors in
  `packages/types/vendor/LayaAir.runtime.d.ts` with TypeScript 5.9.3,
  `strict:true`, `skipLibCheck:false`, `types:[]`. Consumer strict typechecking
  with `skipLibCheck:true` does not establish clean vendor declarations.

## Design and alternatives

### Audio sample ownership (proposed; no such API ships yet)

The existing `IframeSoundAdapter` remains the only audio authority. Add sample
decoding/playing to that owner, sharing its channel gains, bounded event queue,
voice policy, unlock, focus and disposal. Source bytes come from `AssetProvider`
logical IDs and existing cache leases. A buffer source and an oscillator both
route through one voice gain, then one channel gain and one master gain.

The public contract needs cancellation/timeout while loading, stale completion
after decode (which may be non-cancellable), sample lease release, explicit
loop points, offset/resume policy, BGM replacement and channel-wide stop. Keep
logical event IDs distinct from sample IDs. Specify whether replacement
crossfades count as two voices, maximum overlap and behavior when capacity is
exhausted. Event deduplication must follow the existing event/epoch contract.
Do not emulate original MP3 assets with tones.

A replaceable backend is an alternative only if it implements all the same
operations and owns the entire event route. `audioContextFactory` is context
injection, not a playback-backend contract. `syncLayaSoundManager` mirrors
settings; it does not connect Laya voices to the mixer or prove asset lifecycle.
Decide the backend shape using a neutral sample fixture before exporting types.

### Component evidence graph (proposed; no selective invalidation yet)

Each proof node must include its selected Prefab ID/node/state, definition
hash, declared logical asset IDs and expected hashes, renderer/module version,
provider/integrity configuration, fonts, deterministic inputs and environment.
A parent includes child proof hashes plus composition transforms/masks. Scene
evidence includes actual mounted instance provenance and integration code.

Compute reverse edges to report the affected closure. A changed texture should
invalidate all of its users and their parents, while an unrelated package should
not invalidate them. Dependency declarations alone are insufficient: compare
them to build inputs and runtime provenance. Unknown/dynamic dependencies keep
the conservative whole-payload fallback. Do not remove the current fingerprint
gate before deliberate false-negative fixtures pass.

### Declaration debt (proposed repair)

Group diagnostics by missing platform types, duplicate vendor declarations and
incompatible inheritance/signatures. Preserve the actual vendor API; do not
replace it with `any`, blanket suppression or empty declarations. Add strict
public fixtures for repaired groups and validate ESM/CJS behavior. Maintain
the full failing audit alongside existing consumer checks until the debt is zero.

## Staged work

1. Public API gap fixtures and ownership/compatibility decisions.
2. Sample playback in one mixer; public types and strict consumer fixture.
3. Dependency schema, graph/diff explanations, incremental fixture and fallback.
4. Vendor declaration repairs by diagnostic category with type regressions.
5. Separate device/audio and Scene reports, versioned rollout and migration notes.

## Acceptance gates

- Audio: real decoded neutral MP3/WAV, original timing, loop/switch, bounded
  voices, one gain application, unlock/rejection, mute/focus/resume, replay
  deduplication, aborted decode, failure and 30 teardown cycles. Run desktop,
  iPhone Safari and Android; unavailable outputs stay unavailable.
- Graph: change one leaf and invalidate its parents, preserve unrelated proofs,
  reject undeclared texture/font/renderer changes and Scene substitutions,
  reject stale node/state/environment inputs. Keep actual browser comparisons.
- Declarations: full `skipLibCheck:false` audit, strict independent consumer,
  runtime tests and ESM/CJS exports. Do not claim all declarations are fixed from
  one group's progress.
- `npm run verify`, exact input revision, environment and reproducible artifact
  paths for every accepted capability.

## Risks and rollback

Media decoding, mobile autoplay and dynamic dependency edges can produce hidden
resource owners or missed invalidations. Keep these capabilities Proposed until
their gates pass. Retain tone playback and whole-payload evidence as the current
baseline; do not widen acceptance claims or patch consumer engine copies.
