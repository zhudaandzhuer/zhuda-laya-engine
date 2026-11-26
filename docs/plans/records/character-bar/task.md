# Agent task: character-bar

Status: Done on a desktop; not accepted (no device, no person)  
Owner: the repository owner (2026-11-26); carried out on the owner's Mac by Claude (Fable 5.2)  
Last reviewed: 2026-11-26  

## Source requirement

The owner, 2026-11-26, pointing at the session that had studied an outside LayaAir project's
characters ("SuisuiLaya 專案研究": why they move smoothly, written as the route
`smooth-character-motion`):

> 先處理另一個會話針對角色做了更完整的研究，你去整合成能夠讓opus fable能做出高品質角色的路線來

In English: take the other session's research on characters and make of it a route by which an
agent (Opus, Fable) can make high-quality characters.

## Goal

A route an agent follows to make or raise a 3D character that is looked at closely, in which
"high quality" is something it can measure on its own output before a person is asked: a tool
that takes the research's measures on any `.glb`, a tool that does the two heaviest items of
the research (motion inside the clips, helper bones), a page to look at the result in the engine,
and a plain list of what was not done.

## Invariants

- Nothing of the reference project enters the repository: it is read where it lies (its
  characters and clips look third-party).
- The other session's route and its findings are kept as they are; this work adds to them and
  says where it measured differently.
- No character of a game or a prefab module is replaced: the raised copies are evidence.
- The engine's API is not changed.
- A number in the route was measured here, or its line says whose it is.

## Dependencies

- The other session's route `docs/routes/smooth-character-motion.md` (uncommitted when this
  began) and its handoff outside the workspace.
- Blender 5.2.2 on the owner's Mac; Chrome on the graphics card through `games/tools/shot.mjs`.

## Scope

### Engine

- `docs/routes/high-quality-character.md` (new) and its rows in the route index; two pointers
  in `smooth-character-motion.md`.
- `games/tools/characters/motion-audit.mjs`, `games/tools/characters/blender/raise-rig.py` and
  `blender/examples/` (new); `games/tools/characters/README.md`.
- `tests/character-motion-audit.test.mjs` (new).
- `prefabs/viewer3d`: the preset `model-stand` and its scenario.
- `CHANGELOG.md`, `HANDOFF.md`, this record, `local-results/character-bar/`.

### Consumer or adapter

- None.

## Non-goals

- Making a new character; replacing the wardrobe's body or the pig; closing the engine gaps the
  two routes list (corrective bones, a long idle, props, face shadow, display interpolation).
- A phone run; a person's judgement.

## Acceptance checks

1. `npm run verify`, `npm run lint`, `npm run format:check`: exit 0.
2. `npm run verify:prefabs`: the library and both viewers, with the new preset.
3. The audit on the reference gives the numbers the other session took by hand.
4. Two of the repository's characters, raised, pass every must of the audit, load in the engine
   and are photographed beside themselves as they were.

## Evidence to attach

- Test/build output: [verification](verification.md).
- Browser/WebGL or device report: `local-results/character-bar/` (audits, reports, sheets,
  the scripts that took the pictures). No phone.

## Unverified limits

- No person judged a picture; the route's steps 1, 2, 6, 8 and 9 were not run.
- The bar's thresholds are choices set from one reference.

## Rollback

Remove the files named under Scope; nothing else depends on them.
