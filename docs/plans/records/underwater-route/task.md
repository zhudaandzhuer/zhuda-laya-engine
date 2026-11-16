# Agent task: underwater-route (AG6)

Status: Done; documentation, its numbers measured on a desktop
Owner: Engine/toolchain
Last reviewed: 2026-11-17

## Source requirement

Work package AG6 of
[Techniques from Abyssal Garden](../abyssal-garden-techniques/plan.md): after
AG1 is drawn and checked, an underwater route from `docs/routes/TEMPLATE.md`
with steps, pitfalls, measured cost and limits.

## Goal

`docs/routes/underwater.md` and its row in `docs/routes/README.md`, with
the cost of the water measured by the AG5 fly-through on both backends.

## Invariants

- Only what was run is claimed; the route says it was checked on a desktop
  and names what was not checked (no phone, no consumer game).
- Links resolve.

## Scope

- `docs/routes/underwater.md`, `docs/routes/README.md`,
  `tests/fixtures/flythrough/underwater.json` (the fly-through of the
  example scene the cost was measured with).

## Deviations from the template

The template asks for a reference consumer outside the repository and a
named device. There is no consumer game under water yet: the reference is
the engine's example scene, and the route says so in its status line and
under **Not checked**.

## Acceptance checks

1. The route's links resolve (checked by script).
2. The fly-through of the example, with and without water, on WebGL and
   WebGPU, twice each: the numbers in the route.
3. `npm run verify`, lint, format, `git diff --check`.

## Rollback

Documentation only; reverting the commit removes it.
