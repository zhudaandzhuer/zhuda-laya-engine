# Verification: DPR CSS canvas sizing

Task: [task.md](task.md)  
Date: 2026-11-06  
Status: In progress until the rebuilt SDK is pinned by the consumer.

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Focused sizing regression | `node --test tests/runtime-sizing.test.mjs` | PASS | terminal output |
| Engine build | `npm run build` | PASS | `dist/sdk/`, `dist/build-manifest.json` |
| Full engine verify | `npm run verify` | IN PROGRESS | terminal output |
| Consumer WebGL | SwiftShader Chrome CDP, DPR 2 portrait/landscape and Go URL | PENDING rebuilt SDK | consumer `artifacts/browser/report.json` |

## Measured acceptance

The pre-fix consumer measurement was 390×844 CSS viewport, DPR 2, canvas
backing 780×1688 and CSS client 780×1688. The expected post-fix result is
backing 780×1688 with CSS client 390×844, and the landscape resize is backing
1688×780 with CSS client 844×390.

## Limits

This record does not approve physical mobile devices, native packages or WebGPU.
