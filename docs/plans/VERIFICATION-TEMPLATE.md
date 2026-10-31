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

## Lifecycle and failure cases

Record cancellation, timeout, stale completion, retry, malformed data,
context loss and repeated create/destroy results when the task touches them.

## Limits and decision

List every unverified limit. State whether the task is **Accepted**,
**In progress**, **Deferred** or **Rejected**, and why. A missing device or
consumer check keeps the decision from being Accepted.
