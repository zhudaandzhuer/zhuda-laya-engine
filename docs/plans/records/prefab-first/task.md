# Agent task: prefab-first

Status: Accepted

Owner: Engine tooling

Last reviewed: 2026-11-03

## Source requirement

The maintainer's review of a consumer game on 2026-11-03 set the order:
「先出資產prefab，確認完單一節點沒問題，才去搞scene」. A future agent must
be able to reopen an individual prefab or named node and compare it with
the intended asset without starting the game scene.

## Goal and invariants

Give human and MCP clients the same staged authoring policy, the evidence
required to enter a scene, and a prioritized plan for the missing tools.
Game art, rules, recordings and reference images stay in the consumer.
Public typed APIs, logical asset IDs, shared leases and a single source of
presentation time remain the integration boundary.

## Dependencies and scope

Use the existing agent contract, Doctor, isolated engine workbench, external
consumer build and verification templates. Change agent guidance, its MCP
discovery and regression coverage. Consumer adoption instructions belong
in the policy; the consumer remains responsible for its own project rules.

## Non-goals

Game conversion, a new runtime API, building a general-purpose previewer,
changing CI release thresholds, and accepting unmeasured device behavior.

## Acceptance checks and evidence

1. A fresh agent can find the ordered gates from AGENTS.md and
   `node packages/mcp-server/index.mjs --tool get_agent_contract`.
2. The contract identifies how to select, compare and invalidate a child's
   evidence. Removing the policy must produce a diagnostic naming the file
   and the repair. Check this with the compiler/MCP regression suite.
3. Resolve the new local documentation links, run the repository verification,
   diff check and status. Record commands, environment, results and limits
   in [the verification record](verification.md).

## Unverified limits and rollback

Consumer previews, release gates and device measurements in the roadmap are
proposals. Baseline is `dee5bcf82740a151ca77fe42e51c4037118cee34`. The
policy and its discovery can be reverted together without migrating assets.
