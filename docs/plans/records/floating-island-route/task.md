# Agent task: floating-island-route

Status: Done; documentation, written from a consumer's source and records
Owner: Engine/toolchain
Last reviewed: 2026-11-18

## Source requirement

The owner (2026-11-18), on finding the engine worktree
`engines/zhuda-laya-engine-island` still on disk: the way the floating-island
game was built should be a route in this repository that others can follow.

The worktree is not the game. It is the branch `feat/sky-island-effects`, whose
three engine changes are on `main` from `a961cc6`
([record](../sky-island-effects/task.md)). The game is the consumer
`games/zhuda-sky-island`, outside this repository; no route described it.

## Goal

`docs/routes/floating-island.md` from `docs/routes/TEMPLATE.md`, and its row
in `docs/routes/README.md`: the order the scene was put together in, the
values that worked, what cost time, and what was never checked.

## Invariants

- Only what the consumer's records say was run is claimed, with its date,
  machine and browser. The route says it was written from source and records
  and that nothing was run again for it, apart from one typecheck.
- Nothing of the consumer is copied here: no model, texture, sound or rule.
- The consumer is read, not changed.
- Links resolve.

## Scope

- `docs/routes/floating-island.md`, `docs/routes/README.md`.

## Deviations from the template

The template expects a route by the agent that built and checked the scene.
This one was written two days later by another session, from the consumer's
`src/`, `tools/`, `README.md`, `HANDOFF.md` and `evidence/`. Its status line
and **Not checked** say so.

## Acceptance checks

1. `node --test tests/implementation-routes.test.mjs`: the route is listed,
   has every required section, and its links resolve.
2. Its anchors resolve (a script over its relative links).
3. The consumer's `src` typechecks against this repository's public types.
4. `npm run verify`, `git diff --check`.

## Rollback

Documentation only; reverting the commit removes it.
