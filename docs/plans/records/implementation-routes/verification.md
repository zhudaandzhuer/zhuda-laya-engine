# Verification record: implementation-routes

Task document: `docs/plans/records/implementation-routes/task.md`  
Commit: branch `docs/implementation-routes` from `main` at `c076610` (not yet committed)  
Date: 2026-11-15

## Environment

- OS / browser / device: macOS (Apple M4); no browser or device needed (documents and a contract audit).
- Node and package manager: Node v26.12.0, npm (the main checkout's `node_modules`).
- Engine commit: `c076610`. Consumer evidence quoted by the route: `games/stocking-tear`.

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build, types, declarations, Doctor, tests | `npm run verify` | PASS (816/816 tests, Doctor HEALTHY) | local log |
| Route tests | `node --test tests/implementation-routes.test.mjs` | PASS (3/3; the broken fixture reports `ROUTE_LINK_BROKEN`, `ROUTE_UNLISTED`, `ROUTE_SECTION_MISSING` with hints) | local log |
| Lint | `npm run lint` | PASS | local log |
| Format | `npm run format:check` | PASS | local log |
| Whitespace | `git diff --check` | PASS | — |
| Real WebGL/device | — | UNAVAILABLE (not applicable: no runtime change) | — |

The first `npm run verify` failed one existing test: the published-package fixture copied
only the required files, and the routes index links to a route file. The npm package ships
all of `docs/`, so the fixture now copies `docs/routes` as the package does.

## Limits and decision

- The route's measurements are the consumer's (desktop WebGL/WebGPU, one vivo V40); they
  were not re-measured in this repository.
- No MCP tool returns routes as data; the contract names the index file.
- No simplified-Chinese version of the routes.

Decision: **Implemented within scope.**
