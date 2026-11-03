# Agent task: prefab-release

Status: Accepted

Owner: Engine tooling

Last reviewed: 2026-11-03

## Source requirement and goal

The maintainer requested implementation, verification and a pushed release of
the prefab-first improvements. Deliver the P0 static 2D slice with public
types, an external consumer preview, repeatable browser image checks and
evidence validation before composing a scene. Release as 1.1.0 on GitHub.

## Invariants, dependencies and scope

Reuse AssetProvider, cache leases, request cancellation and resource scopes.
The preview and consumer scene use the same prefab definition and library.
Preserve existing low-level instantiate behavior. Engine packages, public
types, compiler/MCP guardrails, neutral fixtures and documentation may change.
Art, math, production scenes and network authority stay in consumer projects.

## Non-goals

Full-game migration, a general visual editor, Yoga, new audio or video codecs.
3D/Spine procedural prefab previews remain separate follow-up work.

## Acceptance and evidence

- Strict consumer typecheck and ESM/CJS export tests cover UI and Prefab.
- An external consumer selects its own prefab and child path without Main.
- Actual browser draws reject shifted text and wrong same-sized visuals.
- Missing IDs, missing nodes, stale evidence, cancellation, timeout, failure
  and 30 create/dispose cycles have reproducible checks.
- Run npm run verify, git diff --check, independent consumer build and desktop
  WebGL checks. Record commands, commit, artifacts and device limits.
- Push the tested commit and version tag, publish the GitHub release and
  inspect its verification workflow outcome.

The completed record is [verification.md](verification.md).

## Limits and rollback

Baseline is dee5bcf82740a151ca77fe42e51c4037118cee34 plus the reviewed policy
changes. Real iPhone and Android evidence is unavailable until performed.
Rollback consumers to the previous pinned engine version.
