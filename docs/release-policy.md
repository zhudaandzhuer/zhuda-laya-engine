# Release and version policy

The engine has one version source: the root [`package.json`](../package.json).
`package-lock.json`, `zhuda.config.json`, generated SDK banners and published
artifacts must carry the same version. A Git tag and GitHub release are created
for every public stable version.

## Current stable release

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
| `v1.15.0` | Current stable package | Use this version for new consumers |
| `v1.14.0` | Previous stable package | Keep only for pinned existing consumers |

The feature headings in the README (`1.7.0` through `1.15.0`) describe the
milestone that introduced each capability. They are not separate currently
installed versions. When a new stable release is cut, update `package.json`
and the lockfile, run the full verification gate, commit, tag the exact commit,
and publish the matching release notes.

Consumers should pin a released tag or commit, record the package version in
their own evidence, and never infer the current version from an old release
page or a feature heading.
