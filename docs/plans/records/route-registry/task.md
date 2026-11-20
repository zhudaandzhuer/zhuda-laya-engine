# Agent task: every route in one place, in one format, found in two calls

Status: Implemented within scope ([verification](verification.md))\
Owner: Engine/toolchain\
Last reviewed: 2026-11-21

## Source requirement

The owner asked (2026-11-21) which stable routes the repository has and whether
any low-capability agent can follow it, and on the answer (four scene routes in
`docs/routes/`, seven guides elsewhere that are routes in all but form, an entry
buried under two hundred lines of release notes, and the scene-format features of
the same week absent from the tool text and the quality route) asked for the gaps
to be filled and all routes to become formal documents: one kind of document, in a
fixed place, that an agent is shown quickly ("補齊，並且將所有路線整合成正規文件，
而不是零散不同類型的文件，正規且放在固定位置，能被agent快速揭露").

## Goal

An agent that knows nothing of the repository finds the route for its task in two
tool calls, and every route reads the same way.

## Change

- **One place, one format.** Every route is `docs/routes/<id>.md` with the same
  header (`Id`, `Kind`, `For`, `Checked on`, `Status`, `Reference consumer`,
  `Engine version`) and the same eight sections in the same order. `Kind` is
  `workflow` (a path every project of its kind takes) or `scene` (one kind of
  scene built by a reference consumer). The page is the only source: the listing
  is read from its header.
- **Seven workflow routes written**, from the guides that were routes in all but
  form: `new-game-project`, `good-looking-3d-scene`, `film-as-data`,
  `model-from-dcc`, `visual-content-prefab`, `single-html-page`,
  `mini-game-build`. Each gives the order, the commands and the pitfalls, and
  links its guide for the API. The guides stay where they are: other documents,
  the scaffold and tests link to them.
- **The four scene routes** got the header lines; nothing else in them changed
  except one link to a renumbered step.
- **Found in two calls.** MCP tools `list_routes` (one line a route, workflows
  first, optional `kind`) and `get_route { id }` (the page and its header as
  data); `get_agent_contract` carries the list as `routes`. `AGENTS.md` and
  `README.md` open with a "Start here" table; the scaffold's agent rules name the
  two tools.
- **Audited.** `auditImplementationRoutes` now also refuses a page without the
  header lines or one of the eight sections, an id that is not its file name, and
  an unknown kind (`ROUTE_ID_MISMATCH`, `ROUTE_KIND_INVALID`). Tests hold the
  header order, the section order, the index rows under the right heading, and
  that a link to a section of a guide names a heading that exists.
- **The week's features reach an agent.** `film_scene_create`'s description names
  prop distance settings, material blend, detail and triplanar, terrain and grass
  nodes and the query. The quality route has two more steps (`ground-and-plants`,
  `distance`), in its data and its page, and says that bounce light carries glow.
  Its statement that `Zhuda3D.createMaterial` defaults to Blinn-Phong was wrong
  (it is physically based unless given a `shininess`) and is corrected in the
  data; the page already said so.

Files: `packages/compiler/agent-contract.mjs`, `packages/mcp-server/index.mjs`,
`packages/mcp-server/quality-route.mjs`, `packages/mcp-server/film-tools.mjs`,
`packages/compiler/zhuda-init.mjs`, `docs/routes/*`, `docs/quality-route.md`,
`docs/agent-development.md`, `AGENTS.md`, `README.md`,
`tests/implementation-routes.test.mjs`, `tests/compiler-and-mcp.test.mjs`.

## Invariants

- No runtime code changes: documents, the contract module, MCP tool text and two
  read-only MCP tools.
- No guide is moved or deleted; every existing link resolves.
- A route claims only what its guide or its record already claims. Nothing new
  was drawn or measured for the seven workflow pages.
- Consumer content stays outside the repository.

## Non-goals

- New scene routes for an outdoor landscape and for a rigged phone character:
  they wait for a consumer that has built them on the current engine.
- Translating the routes (`docs/zh-CN/` has no routes).
- Merging the guides into the routes.

## Acceptance checks

1. `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.
2. `node --test tests/implementation-routes.test.mjs` (seven tests).
3. `npm run verify:quality-route` (the route's example scenes still draw).
4. `node packages/mcp-server/index.mjs --tool list_routes` lists eleven.

## Unverified limits

See the [verification](verification.md).

## Rollback

`1c8c08d` is the last commit without this. Reverting the commit removes the seven
pages, the two tools and the stricter audit together.
