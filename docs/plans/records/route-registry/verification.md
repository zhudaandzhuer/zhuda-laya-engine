# Verification record: every route in one place, in one format

Task document: [task](task.md)\
Commit: the one that carries this record, on `1c8c08d` (branch
`docs/route-registry`)\
Date: 2026-11-21

## Environment

macOS (Darwin 27.2), Apple M4, Node 26.13.1, Chrome 157 headless (for the one
draw check).

## Checks

| Check                  | Command                                                             | Result                         |
| ---------------------- | ------------------------------------------------------------------- | ------------------------------ |
| Verify                 | `npm run verify`                                                    | pass (963 tests)               |
| Lint, format           | `npm run lint`, `npm run format:check`, `git diff --check`          | pass                           |
| Route format and tools | `node --test tests/implementation-routes.test.mjs`                  | pass (7 tests)                 |
| Quality route          | `npm run verify:quality-route` (WebGL)                              | pass                           |
| Listing                | `node packages/mcp-server/index.mjs --tool list_routes`             | 11 routes: 7 workflow, 4 scene |

## What the tests hold

- Each of the eleven pages: the seven header fields present, in order, none
  empty; a summary paragraph; exactly the eight sections, in order; a row in the
  index under the heading of its kind.
- `list_routes` and `get_route` answer over `executeMcpTool`; an unknown id
  returns the known ids; the contract carries the same list.
- Twenty-odd links from routes to sections of guides each name a heading that
  exists (this caught one: the floating island's link to the quality route's
  frame-budget step, renumbered from 11 to 13 by the two new steps).
- A page whose id is not its file name, or of an unknown kind, is reported.

## Failures met on the way

- `npm run verify` failed once: the index test matched a table row by its exact
  spacing, and a formatter run over `docs/routes/` had padded the table. The
  test now ignores padding. The same formatter run had re-aligned tables in the
  four existing scene routes; those pages were restored and given only their
  header lines again.
- The quality route's data said `Zhuda3D.createMaterial` defaults to
  Blinn-Phong. The declarations (`packages/core/DeclarativeSDK.ts`) say it is
  Blinn-Phong only with `shininess` or `type: 'blinn-phong'`; the data was
  corrected, and a pitfall in a new route written from it.

## Unverified limits

- **No agent was run on the routes.** Whether a low-capability agent in fact
  follows them was not tested: only that the pages are uniform, listed and
  reachable.
- The seven workflow pages restate their guides. Their commands and option
  names were read from those guides and from `package.json`; none was run for
  this change except `list_routes`, `get_route` and the checks above. In
  particular no mini-game was built, no model exported and no project
  scaffolded by hand here (the engine's tests do scaffold and build one).
- One pitfall of `mini-game-build` (lowering a bundle to ES2017 for a host) comes
  from a game of the owner's, not from this repository, and is marked so.
- `Checked on` is free text taken from each page's own status; it is not
  compared with a device record.
- `verify:film-webgpu` was not run again: no runtime code changed.
- The Chinese README (`docs/zh-CN/README.md`) does not carry the new "Start
  here" table.
