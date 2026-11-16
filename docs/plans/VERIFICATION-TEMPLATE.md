# Verification record: <task id>

Task document: `docs/plans/<task>.md`  
Commit: `<sha>`  
Date: YYYY-MM-DD  

## Environment

- OS / browser / device:
- Node and package manager:
- Engine and consumer commits:
- DPR, viewport and network mode:

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build | `npm run build` | PASS / FAIL / UNAVAILABLE | path or log |
| Types | `npm run typecheck` | PASS / FAIL / UNAVAILABLE | path or log |
| Doctor | `npm run doctor` | PASS / FAIL / UNAVAILABLE | path or log |
| Regression | `npm test` | PASS / FAIL / UNAVAILABLE | path or log |
| Real WebGL/device | procedure and duration | PASS / FAIL / UNAVAILABLE | report/media |
| Fly-through (3D, optional) | `npm run verify:flythrough -- <file>` on each backend; budget and device stated | PASS / FAIL / UNAVAILABLE (GPU time not measured) | `report.json`, poses, recording |
| Blind critic (3D, optional) | critic given only `critic-brief.md` and the pictures; `npm run flythrough:critic -- <report> --run <dir>` | MINOR-ONLY (proposed, a person accepts) / BLOCKED / INVALID | critic report |

## Lifecycle and failure cases

Record cancellation, timeout, stale completion, retry, malformed data,
context loss and repeated create/destroy results when the task touches them.

## Prefab evidence (visual work)

| Prefab ID / child path / state | Source and dependency revisions | Isolated replay command / environment | Reference / actual / diff | Result |
| --- | --- | --- | --- | --- |
| | | | | PASS / FAIL / UNAVAILABLE |

Record which parent and scene consume that revision and where their separate
integration results live. List changed dependencies and the affected entries
that must be revalidated before composition.

## Limits and decision

List every unverified limit. State whether the task is **Accepted**,
**In progress**, **Deferred** or **Rejected**, and why. A missing device or
consumer check keeps the decision from being Accepted.
