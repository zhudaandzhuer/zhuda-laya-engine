# Agent task: implementation-routes

Status: Implemented within scope  
Owner: consumer-side agent (stocking bench), at the user's request  
Last reviewed: 2026-11-15

## Source requirement

The user (2026-11-15): put the implementation route of the stocking bench into the
engine repository as a reference for all agents; a directory of technical documents
on implementation routes for various scenes, telling any agent which mature routes
it can take directly, to cut development and research time.

## Goal

`docs/routes/` exists, is required reading in the agent contract, and holds a first
route (layered cloth on a modelled body) that an agent can follow step by step.

## Invariants

- No consumer assets, models or game code in this repository: routes point to them.
- A route states its devices, dates and what it does not claim.
- No runtime API changes.

## Dependencies

- `packages/compiler/agent-contract.mjs` (`REQUIRED_AGENT_FILES`, `getAgentContract`).
- Consumer evidence: `games/stocking-tear` (`HANDOFF.md`, `evidence/`), outside this repository.

## Scope

### Engine

- `docs/routes/` (index, template, first route); links from `AGENTS.md`, `README.md`,
  `docs/agent-development.md` and the consumer scaffold's agent notes
  (`packages/compiler/zhuda-init.mjs`).
- `packages/compiler/agent-contract.mjs`: the routes index and template become required
  agent files; `auditImplementationRoutes` (broken index links, unlisted routes, missing
  sections); `implementationRoutes` in the contract.
- `tests/implementation-routes.test.mjs`.

### Consumer or adapter

- None changed.

## Non-goals

- Moving the stocking bench's per-vertex layer code into the engine (a candidate, not done).
- An MCP tool that returns routes as data (the contract names the index file).
- A simplified-Chinese translation of the routes.

## Acceptance checks

1. `node --test tests/implementation-routes.test.mjs`: the index is required reading and
   linked from the entry documents; every route is listed, complete and its links resolve;
   a broken fixture reports `ROUTE_LINK_BROKEN`, `ROUTE_UNLISTED` and `ROUTE_SECTION_MISSING`
   with hints.
2. `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check` pass.

## Evidence to attach

- Test/build output: see `verification.md`.

## Unverified limits

- The route's numbers are the consumer's (desktop and one vivo V40); they are not re-measured here.
