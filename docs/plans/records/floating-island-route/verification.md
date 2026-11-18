# Verification record: floating-island-route

Task document: `docs/plans/records/floating-island-route/task.md`\
Commit: the commit that adds this file, on top of `e453b60`\
Date: 2026-11-18

## Environment

macOS 27.0, Apple M4, Node 24. No browser and no GPU were used: nothing was
drawn for this record.

## Checks

| Check                                     | Exact command or procedure                                                                                                                                                                 | Result                | Artifact |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- | -------- |
| The route is listed and complete          | `node --test tests/implementation-routes.test.mjs`                                                                                                                                         | PASS, 3 of 3          | —        |
| Links and anchors of the route            | a script over its relative links and their `#` anchors                                                                                                                                     | 15 links, all resolve | —        |
| The consumer's source against these types | `npx tsc --noEmit` with a tsconfig in the session's scratch folder: the consumer's own compiler options, `zhuda-laya-engine` mapped to `packages/types/index.d.ts`, its `src/**/*.ts` only | PASS, no errors       | —        |
| Build, types, declarations, doctor, tests | `npm run verify`                                                                                                                                                                           | PASS, 935 of 935      | —        |
| Whitespace                                | `git diff --check`                                                                                                                                                                         | clean                 | —        |

## What was not run

- The consumer itself: not built, not started, not drawn. Every frame, device
  and number in the route is the consumer's own record of 2026-11-16 (Apple
  M4, Chrome 157 headless, WebGL and WebGPU), read from its `README.md`,
  `HANDOFF.md` and `evidence/`.
- No phone, as in those records.
- The engine calls the route points to but the consumer does not use
  (`setRipples`, `ZhudaFoliageWind`, `ZhudaParticleSystem3D.burst`) were not
  tried in this scene; the route lists them under **Not checked**.

## Limits and decision

**Done** as documentation. The route carries the same limits in its status
line and under **Not checked**.
