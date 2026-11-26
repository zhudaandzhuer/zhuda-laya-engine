# Release and version policy

The engine has one version source: the root [`package.json`](../package.json).
`package-lock.json`, `zhuda.config.json`, generated SDK banners and published
artifacts must carry the same version. A Git tag and GitHub release are created
for every public stable version.

## Current stable release

**v2.1.0** (2026-11-27) — the prefab library left this repository and this package for a
repository of its own, [`zhuda-engine-prefabs`](https://github.com/zhudaandzhuer/zhuda-engine-prefabs).
This is why the number is a minor one: the package no longer has `prefabs/` or the
`zhuda-prefab-sync` command, and a game takes modules with the library's `zhuda-prefabs-sync`.
The library's version follows the engine line it was checked on, and `npm run verify:library`
runs its checks on this checkout before a release. Also in it: MCP tools keep to the folders
their operator allowed and check a call against the tool's input schema, the engine's own build
works through a symbolic link, and a stricter lint with the tree cleaned up. No change to the
public API. The tag `v2.1.0` is on `main` of the engine's own GitHub repository
(`git+https://github.com/zhudaandzhuer/zhuda-laya-engine.git#v2.1.0`). Details in the
[changelog](../CHANGELOG.md).

**v2.0.1** (2026-11-26) — what came after 2.0.0 the same week: a film scene drawn
live on a page takes its lens from `prepare` and keeps what was fixed at mount
through the quality levels; the watcher answers a save of a script by rebuilding
`app.js` alone; interface tests by a probe of the stage; a consumer reached
through a link registers its classes; the hosiery modules; a bar for characters
that are looked at closely. No breaking change to the public API. The tag
`v2.0.1` is on `main` of the engine's own GitHub repository, and consumers pin
it there (`git+https://github.com/zhudaandzhuer/zhuda-laya-engine.git#v2.0.1`).
The work goes on in the owner's verification repository; what is published is
that tree without one outside model and its records, which are not the owner's
to publish. Details in the [changelog](../CHANGELOG.md).

**v2.0.0** (2026-11-26) — one repository: the prefab library ships in the package
(`prefabs/`, synced into a game with `zhuda-prefab-sync`), the route library holds
the game centre's routes and one route per workspace game, glTF clips cross fade
from one to the other, and `boot` takes a `layoutSize`. No breaking change to
the public API from 1.18.0, which was never tagged and is part of this release.
It was tagged in the owner's verification repository only and never published
on the engine's own; 2.0.1 is the first release there after 1.17.0.

**v1.17.0** — procedural asset pipeline (CPU-baked seamless PBR recipes,
geometry kit, props with colliders and per-material merging, synthesised
audio, generated assets behind `AssetProvider`) with a real WebGL draw gate.
Editors now refuse non-loopback binds unless `--allow-remote` is given, and
package `exports` no longer fall back to TypeScript sources.

**v1.16.0** — editor request hardening, working installed CLIs, generated
public declarations (Bundler/Node16/NodeNext), a lean reproducible package and
the full Windows test suite. Breaking: legacy samples moved from the main entry
to `zhuda-laya-engine/demo`.

**v1.15.0** — deterministic layout/text contracts, bitmap-font validation and
Laya-nested video surfaces, while retaining the official headless LayaAir 3.4.2
mini-game packaging from 1.14.0.

**v1.14.0** — official headless LayaAir 3.4.2 mini-game packaging, with the
previous WebGPU, cinematic, model, crowd, white-label and runtime work retained.
The matching tag points to the `main` commit that contains the package version.

## Historical releases

| Tag | Scope | Meaning today |
| --- | --- | --- |
| `v1.0.0` | Initial public fork | Historical baseline |
| `v1.1.0` | Prefab-first consumer workflow | Historical release; kept for reproducibility |
| `v1.14.0` | Older stable package | Keep only for pinned existing consumers |
| `v1.15.0` | Older stable package | Main entry still exports the legacy samples |
| `v1.16.0` | Previous stable package | Editors accept remote binds without `--allow-remote` |

The feature headings in the README (`1.7.0` through `1.17.0`) describe the
milestone that introduced each capability. They are not separate currently
installed versions. When a new stable release is cut, update `package.json`
and the lockfile, run the full verification gate, commit, tag the exact commit,
and publish the matching release notes.

Consumers should pin a released tag or commit, record the package version in
their own evidence, and never infer the current version from an old release
page or a feature heading.
