# Verification record: consumer-route-hardening

Task document: `docs/plans/records/consumer-route-hardening/task.md`

Verification source: working tree before the commit introducing this record; subsequent combined checks are in [consumer-review-reliability](../consumer-review-reliability/verification.md)

Date: 2026-11-04

## Environment

- OS / browser / device: macOS local shell; no device run for this tooling/doc change
- Node and package manager: Node.js 26.12.0, npm
- Engine and consumer commits: engine working tree; generated starter uses an exact engine version or Git SHA
- DPR, viewport and network mode: not applicable to static checks; starter defaults to 1280×720 and DPR cap 1.5

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Focused consumer route | `node --test tests/consumer-route.test.mjs tests/consumer-build.test.mjs tests/compiler-cli-entry.test.mjs` | PASS; 5 tests | test output |
| Task contract | `node packages/mcp-server/index.mjs --tool validate_task_spec ...` | PASS | command output |
| Markdown links | Node link scan over `AGENTS.md`, README files and `docs/*.md` | PASS; all checked links exist | command output |
| Build, types, Doctor and regression | `npm run verify` | PASS; 125 tests, 0 Doctor blockers | command output |
| Diff hygiene | `git diff --check` | PASS | command output |
| Consumer Doctor regression | `node packages/compiler/zhuda-doctor.mjs --project <external-evidence>/game1` | PASS; engine-backed static, pinned `8c630ad` | external consumer output |
| Real WebGL/device | target browser and mobile device procedure | UNAVAILABLE for this repository-only tooling change | none |

## Lifecycle and failure cases

The starter build was run through `runConsumerBuild` with the local engine
root. It produced four ordered Laya libraries, a seven-entry archive and the
`engine-backed-static` route report. The counterfeit fixture covers unpinned
dependency, Three.js import/script/renderer, fake facade, missing public SDK
import, missing boot and missing HTML markers. The existing consumer-build
fixture continues to cover source hashes, output isolation, archive validity,
asset exclusion and invalid output paths.

## Prefab evidence (visual work)

Not applicable. This change documents and guards the consumer route; it does
not author or change a consumer prefab.

## Limits and decision

Static guards prove public boundary configuration and generated build structure.
They do not prove a rendered frame, shader pixels, performance, touch behavior,
audio behavior or device support. The route is **implemented for static consumer
tooling**; consumer-side browser and device reports remain deferred. The engine
tooling portion is verified by the checks above.
