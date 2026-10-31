# Agent contract for `zhuda-laya-engine`

This file is a binding repository contract for coding agents. Read it before
editing code. It is intentionally concrete: an agent must leave reproducible
commands and evidence, not a confidence statement.

## Repository boundary

`zhuda-laya-engine` is the reusable engine and toolchain. It owns public
runtime APIs, type declarations, compiler plugins, MCP tools, diagnostics,
fixtures and engine documentation.

Consumer repositories own game rules, network authority, payout/score rules,
scene-specific art, models, textures, audio, particle recipes, terrain data,
videos and deployment. A consumer may provide adapters and samplers through a
public interface; it must not require an engine source path or a private
implementation detail. Do not copy game assets into this repository to make a
test pass.

The `src/` showcase and `assets/` fixtures are engine examples and regression
fixtures. They are not a place for a consumer game's production content.

## Required reading before implementation

1. [`README.md`](README.md) for the public package boundary and current
   evidence limits.
2. [`docs/plans/README.md`](docs/plans/README.md) and the relevant plan. A
   `Proposed` plan is a decision/measurement document, not an implemented
   capability.
3. [`docs/agent-development.md`](docs/agent-development.md) for the task,
   failure and evidence workflow.
4. The relevant contract: [`docs/asset-loading.md`](docs/asset-loading.md),
   [`docs/terrain-shader.md`](docs/terrain-shader.md),
   [`docs/3d-integration.md`](docs/3d-integration.md),
   [`docs/3d-acceptance.md`](docs/3d-acceptance.md), or the package README.
5. The corresponding public declaration in `packages/types/` and an existing
   test before adding a new API.

Use `node packages/mcp-server/index.mjs --tool get_agent_contract` to retrieve
this workflow as machine-readable data. Use the other MCP guardrails before
guessing LayaAir APIs.

## Development protocol

### Before editing

- Write a task spec from [`docs/plans/TASK-TEMPLATE.md`](docs/plans/TASK-TEMPLATE.md).
- Name the source requirement, invariants, dependencies, engine/consumer
  scope, non-goals and acceptance evidence.
- Search the public types, implementation and tests. If the requirement is
  visual, inventory and map assets before connecting gameplay rules.
- Decide whether the change is engine, consumer or an adapter. Keep the
  consumer side outside this repository.

### While editing

- Keep public runtime code and public declarations in sync.
- Reuse the existing lifecycle, provider, clock, query, terrain, shader,
  Spine and particle contracts. Do not create a second cache, authority or
  time source for a single feature.
- Every asynchronous load must handle cancellation, timeout, stale results,
  failure and disposal. Every GPU/resource owner must have an explicit release
  path.
- Treat shader, terrain, Spine and particle validators as configuration
  checks only. A passing validator is not a real WebGL or device result.
- Keep proposed, measured and accepted behavior labelled. Never turn a plan,
  synthetic benchmark or a desktop-only check into a shipped capability claim.

### Before commit or handoff

Run from the repository root:

```sh
npm run verify
git diff --check
git status --short
```

For a consumer-facing change also run its independent consumer build and the
real WebGL/device checks described by its acceptance report. Store the report
outside this engine repository when it contains game assets or device media.

Complete [`docs/plans/VERIFICATION-TEMPLATE.md`](docs/plans/VERIFICATION-TEMPLATE.md):
record command, commit, environment, result and artifact path. List every
unverified limit. A failed or unavailable device check stays failed or
unavailable; it is never silently converted to pass.

## Guardrails that must remain true

- Stable logical asset IDs go through `AssetProvider`; scene code must not
  know whether delivery is a directory, CDN chunk, ZIP or future WASM provider.
- Shared assets use the existing cache/lease and release lifecycle. A closed
  panel or scene cannot re-add a late async result.
- Game movement, damage, collision authority, weather and network rules stay
  in the consumer. Rendering, particles, shaders and terrain queries may
  sample or adapt those rules but do not replace them.
- 2D tile terrain and 3D heightfields are data/render contracts. Empty tiles,
  blocking metadata, height, normals and bounds must be explicit. Caves and
  overhangs require authored meshes.
- Custom shaders declare attributes, uniforms, pass/depth needs and fallback
  behavior. `validate_shader_spec` does not compile GLSL or prove pixels.
- Spine 4.2, particle and effect events are scoped, deduplicated and disposed;
  visual masks must identify their target scope and restoration rule.
- Coordinates and time are explicit: CSS pixels vs backing pixels, DPR,
  parent transforms, simulation tick vs render time and snapshot interpolation.

## Change classification

| Change | Minimum regression evidence |
| --- | --- |
| Public API/type | strict consumer typecheck, runtime test, ESM/CJS export check |
| Asset/provider/lifecycle | provider conformance, cancellation/timeout/failure, 30 load/unload cycles |
| 2D/3D terrain/query | validator tests plus deterministic geometry/raycast fixtures |
| Shader/material/VFX | validator tests plus real draw or an explicit unavailable result |
| Input/camera/clock | resize/DPR, focus/cancel, multi-pointer and fixed-time tests |
| Compiler/MCP/Doctor | happy path and deliberate failing fixture with file/line guidance |
| Documentation/plan | links resolve, status is accurate, no unverified claim |

If a change crosses classes, satisfy every applicable row. Do not weaken a
guard to make an unrelated fixture pass; fix the fixture or document the
boundary instead.
