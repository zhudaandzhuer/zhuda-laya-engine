# Agent task: prefab-library-split

Status: Done within scope (the split and this repository's side of it; not released, one Mac) ([verification](verification.md))\
Owner: the repository owner (2026-11-26: "開始拆", then "做第二步")\
Last reviewed: 2026-11-26

## Source requirement

The owner's direction, the same day the assets went to a repository of their own: three
repositories. Raw material in `zhuda-engine-assets`; what is assembled from the engine and the
material and can be used again, the prefab library, in a repository of its own; the engine and
the routes here. An agent is handed this repository, reads a route, and takes modules and
assets from the other two. The owner also asked that the engine and the library move forward
together, so that nothing breaks without notice.

## Goal

1. The prefab library is a public repository, `zhuda-engine-prefabs`, that stands alone: its own
   package and command, a released engine as its pinned dependency, its own checks and workflow.
2. This repository no longer holds or ships the library, and says where it is.
3. An engine change that breaks a module is seen before the engine is released.
4. A version rule that says which library goes with which engine.

## Invariants

- The modules' code and assets are not changed by the move: a game that synced from the engine
  package passes the library's `--check`.
- The engine's runtime and public API do not change. The runtime never depended on the library.
- What must stay private stays private: the git bundle of one module's source project.
- Records, and the older sections of the changelog and the handoff, keep `prefabs/` as written.

## The version rule

The library's first two numbers follow the engine line it was checked on: library 2.0.x on
engine 2.0.x, 2.1.x on 2.1.x. Within a line the library releases by itself (a new module, a
fix). When the engine is about to release a minor version, `npm run verify:library` runs the
library's checks on that engine; the library then releases the same minor with its pin moved.
A game pins a tag or a commit of each, never a branch. A branch is cut for an old line only
when it needs a fix.

## Out of scope

- The release: the tag `v2.1.0`, the release page, the browser SDK at 2.1.0, the library's
  2.1.0. Each is the owner's word.
- Moving the workspace's games to engine 2.1.0 and to the library's lock.
- Moving the models, pictures and sounds inside the library's modules to the asset repository.

## Acceptance

- In the library: `npm run verify:all -- --go` on the released engine 2.0.1; its workflow.
- Here: `npm run verify`, `lint`, `format:check`, `verify:games`, and `npm run verify:library`
  (the library on this checkout).
- A game's existing lock checked against the library; the library installed from GitHub into an
  empty project.
