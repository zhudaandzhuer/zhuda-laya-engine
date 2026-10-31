# Agent development guide

This guide is the operational companion to the repository contract in
[`../AGENTS.md`](../AGENTS.md). It is written for an agent that has to change a
large engine without losing track of scope, lifecycle or evidence.

## Start with a bounded task

Copy [`plans/TASK-TEMPLATE.md`](plans/TASK-TEMPLATE.md) into the task record
and fill every required section before coding. The source requirement can be a
user request, issue, design note or migration report; quote the relevant file
or URL and keep the original wording available. Separate:

- **invariants** — behavior that must not change, such as consumer-owned
  damage rules or the `AssetProvider` release contract;
- **scope** — exact engine packages, public types and fixtures that may change;
- **non-goals** — adjacent work that must stay out of this patch;
- **acceptance** — observable checks with a command, input and expected result;
- **evidence** — the artifact produced by each check;
- **unverified limits** — what still needs a browser, device or consumer.

The MCP server exposes the same checklist:

```sh
node packages/mcp-server/index.mjs --tool get_agent_contract
node packages/mcp-server/index.mjs --tool validate_task_spec \
  --args '{"task":{"id":"asset-provider-retry","source":"docs/asset-loading.md","goal":"...","invariants":["logical IDs remain stable"],"dependencies":[],"scope":{"engine":["packages/core/runtime3d/AssetProvider.ts"],"consumer":[]},"nonGoals":["packed WASM"],"acceptance":["npm test"],"evidence":[],"unverifiedLimits":["real iPhone"]}}'
```

Before choosing a Laya API, call `search_api_guardrails` or retrieve a golden
example. Before changing a topology or migration, call the matching audit
tool. A tool result is evidence for its stated scope only.

## Understand the layers

The engine is organized as a set of public seams:

1. **Compiler and topology** — `packages/compiler/` turns a consumer entry
   point into an ordered, pruned build and reports errors.
2. **Public runtime** — `packages/core/` and `packages/types/` expose the
   stable API. Version-specific Laya repairs stay in adapters.
3. **Resource lifecycle** — `AssetProvider`, shared cache leases and scene
   lifecycle own loading, cancellation, decoding and destruction.
4. **Presentation contracts** — terrain, surfaces/shaders, particles, Spine,
   camera, queries and clocks describe rendering inputs and outputs. The
   consumer remains authoritative for gameplay.
5. **MCP and Doctor** — `packages/mcp-server/` provides machine-readable
   guidance; `packages/compiler/zhuda-doctor.mjs` blocks known mistakes.

When a request spans layers, make the boundary explicit. For example, a
height sampler can be provided by a game to the terrain renderer, but a new
engine heightfield must not quietly decide where a player's raft can move.

## Safe implementation loop

1. Read the relevant plan and public declarations.
2. Find a nearest existing implementation and test. Prefer extending a
   contract over adding a parallel helper.
3. Add a failing fixture for the new invariant or failure mode.
4. Implement the smallest change. Keep serialization deterministic and avoid
   hidden globals.
5. Test cancellation, timeout, stale async results, disposal and context
   loss whenever a resource or browser API is involved.
6. Add or update the public `.d.ts` and strict consumer fixture.
7. Run focused tests, then `npm run verify` from a clean working tree view.
8. Write the verification record and state what a real browser/device still
   has to prove.

For asynchronous resources, the expected state sequence is
`requested → downloading → verifying → ready` or a bounded error. An owner
that is disposed during any step must reject or cancel the request and ignore
the late completion. Do not leave an endless spinner, an unhandled rejection,
or a duplicate canvas/listener behind.

## Visual and 3D work

Asset migration precedes gameplay wiring. Inventory model/texture/atlas/Spine
versions and presentation states first, then validate shader and terrain data,
then connect the existing consumer rules. Use the visual migration and visual
contract audits before claiming parity. A validator, screenshot byte match or
synthetic frame benchmark cannot establish device performance or visual parity
by itself.

For terrain, compare CPU and GPU height/normal samples at fixed coordinates and
time; test top, side and underside queries, bounds, parent transforms and
camera collision. A heightfield cannot represent caves or overhangs. For
shaders, document color space, normal/metallic channels, blend/depth passes,
fog, instancing and fallback quality. For particles and Spine, test target
scope, event deduplication, mask restoration and repeated disposal.

## Evidence and handoff

Use [`plans/VERIFICATION-TEMPLATE.md`](plans/VERIFICATION-TEMPLATE.md) for the
final record. Each row must include the exact command, commit SHA, runtime
environment, pass/fail/unavailable result and an artifact path. Include:

- unit and strict type checks;
- compiler/MCP/Doctor output;
- browser/WebGL result when rendering changed;
- device, DPR, browser and duration for mobile checks;
- resource counts before/after repeated load and unload;
- known limits, fallback path and rollback point.

An acceptance report that says “looks good” is incomplete. If a check could not
run, write `UNAVAILABLE` with the reason and keep the capability unaccepted.
The next agent should be able to reproduce the result from the report without
reconstructing conversation context.
