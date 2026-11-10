# Agent task: lifecycle-feedback-hardening

Status: Implemented; desktop verified; physical devices unavailable  
Owner: Engine runtime and consumer tooling  
Last reviewed: 2026-11-05

## Source requirement

User: 「去優化」, accepting the preceding four priorities from the Dawn Realm
integration: premature lifecycle PASS, official candidate workflow, selective
evidence invalidation and shared primitive Prefab resources.
Reproduction: external consumer `<external-evidence>/consumer`,
`evidence/lifecycle-hero.json` (requested 30, captured zero lifecycle entries)
and `evidence/final-browser-campaign.json` (180 instances, 860 meshes).

## Goal

A pinned consumer can build candidates, compare isolated components, publish
only current evidence, and opt into shared immutable primitive resources,
without a private engine patch or repeated allocations for identical trees.

## Invariants

- No consumer game content or rules in the engine.
- Requested lifecycle cycles must complete before PASS. Missing counts, leaks,
  wrong selection and late errors fail independently of a pixel match.
- Candidate output is separate from release; failed checks preserve the last
  release. Baseline capture never approves itself.
- Selective evidence requires an isolated component build with automatically
  tracked code, SDK, library, preview and asset dependencies. Unknown/dynamic
  dependency scope keeps whole-payload fallback; parents include child hashes.
- Default resource ownership stays compatible. Shared resources use the
  existing ZhudaAssetCache leases; no second cache or global owner. State
  bindings and private material edits cannot affect another instance.

## Dependencies and scope

Engine: compiler preview/check/build/watch/CLI, Prefab library/tree, public
declarations, existing resource scope/cache, neutral tests and documentation.
Consumer: independent packed-SDK acceptance and Dawn Realm using public APIs;
all game screenshots and build artifacts remain outside this repository.

## Non-goals

Full vendor declaration repair, commercial MMO content, networking, new game
rules, physical-device claims, arbitrary dynamic dependency inference and a
universal automatic draw-call batching guarantee.

## Acceptance checks

1. Focused regression fixtures: slow/incomplete/failed 30-cycle previews fail;
   completed cycles and stable resource snapshots pass; final errors are read.
2. Official candidate and acceptance commands exercise successful publication,
   deliberate image/evidence failure, source changes during validation, and
   preserve the prior release on all tested failures.
3. Dependency tests: changing a leaf invalidates its parents but preserves an
   unrelated component; renderer/SDK/provider/font/asset changes invalidate;
   undeclared or unverifiable asset loads and unknown edges fail/fall back.
4. Shared tree tests: identical meshes/materials reused, states/unique material
   edits isolated, cancellation/failure/disposal and 30 cycles release leases.
   Strict consumer types, ESM/CJS exports and public runtime remain aligned.
5. `npm run verify`, `git diff --check`, `git status --short`.
6. Independent installed package: real WebGL isolated preview, 30-cycle report,
   and comparison against existing neutral/Dawn Realm references. Run the game
   replay and compare resource counts before/after. Record unavailable devices.

## Evidence and limits

Attach command logs, exact SDK/consumer revisions, dependency invalidation
results, real browser reports, before/after resource counts and screenshots.
Physical mobile, audible output and long-duration GPU performance remain
UNAVAILABLE unless actually measured. Lower allocation counts do not prove FPS.

## Rollback

Last known good SDK: `5ab0ff592dac027f1ad3754c402902d9c2e13d94` (1.4.1).
Keep legacy whole-payload evidence and independent resource ownership available.
Do not replace a successful consumer release when a new candidate fails.

Verification: [verification.md](verification.md). All four scoped changes are implemented; physical-device and long-duration performance claims remain unavailable.
