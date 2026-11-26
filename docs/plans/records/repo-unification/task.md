# Task: one repository for the engine, its routes and their reference games

- Id: `repo-unification`
- Asked by: the owner, 2026-11-25 ("combine the two repositories into one; choose the games that
  can show what the engine does; keep the sponsor block; tidy the README and the structure")
- Base: `def94aa` (v1.18.0) with [round-9-consumer-fixes](../round-9-consumer-fixes/task.md) and
  [audio-sample-clock](../audio-sample-clock/task.md)

## Why

The engine and the repository that checks it lived apart. The games that routes were written from
pinned an engine commit, so an engine change could break them unseen; the routes were drafts in the
other repository; fixes travelled as patch files. The README had grown to 513 lines: the sponsor
block above the title, twelve releases' notes in no order, two "Start here" sections.

## Change

- `games/`: eight consumers and their shared models and textures (43 MB), each `private`, each
  depending on this checkout as `file:../..`; `games/tools/verify-all.mjs` behind
  `npm run verify:games`; a `games` job in CI. Chosen because each builds and tests here against
  this engine, each exercises a different part of it, and each is the reference of one route.
  Three other games of the verification repository were left out: they cannot be built in the
  container this was done in, and two of them carry 46 MB and 169 MB of art.
- `packages/compiler/consumer-build.mjs`: `consumerOutputConflicts` — for a project inside the
  engine repository the output must stay clear of the engine's own directories, not of the whole
  checkout. `packages/compiler/consumer-guards.mjs`: `isInRepoEngineDependency` — `file:` up to
  the engine root from a project inside it counts as a pin. Nothing else is newly accepted.
- `docs/routes/`: eleven routes moved in from the verification repository's drafts and listed.
- `README.md` rewritten as one page; the release sections moved unchanged to `CHANGELOG.md`, the
  feature tour to `docs/overview.md`; `docs/README.md` indexes every guide and maps the code;
  `docs/zh-CN/README.md` rewritten to match. The sponsor banner stays at the top and the wallet
  block is a section near the end, both as the owner wrote them.
- `AGENTS.md`: the repository boundary names `games/` as the one exception and says what keeps it
  one; `npm run verify:games` joins the checks. `HANDOFF.md`: a unification section with what is
  open.
- `tests/docs-index.test.mjs`: the index lists every guide, entry pages link to files that exist,
  every game is listed, private, and built against this checkout.

## Not in this change

- No source file under `packages/` moved. `packages/core/runtime3d/` holds 97 files and would read
  better split, but public declarations mirror those paths, consumers and routes name them, and the
  engine is still developed on the old layout elsewhere: a move belongs to a moment when both
  sides can take it at once.
- `docs/plans/` did not move to an internal folder as first proposed: its index and templates are
  required files of the agent contract.
- Two games were changed to use APIs added since they were written: `zhuda-beat` follows
  `getSamplePositionSec`, `zhuda-guard` places markers with `stage.worldToScreen`. `zhuda-hunt` still
  projects by hand and no game uses `durationSeconds`.
- Game pages (each game's README and AGENTS) stay in Traditional Chinese.
