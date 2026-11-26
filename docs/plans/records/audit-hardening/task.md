# Agent task: audit-hardening

Status: Done within scope (one Mac; two editor checks timed out in the batch and passed alone; no Windows or Linux) ([verification](verification.md))\
Owner: the repository owner (2026-11-26: "開始修", on the review of an outside audit)\
Last reviewed: 2026-11-26

## Source requirement

An outside agent (Gemini) read the public repository at `5ccc746` and wrote an audit of ten
findings, three of them marked high. The owner passed it on; the session on the owner's Mac
checked every finding against the code, reported which hold, and the owner said to fix those.
The audit itself is outside this repository; its findings are restated in the verification
record, each with its verdict.

## Goal

1. A caller of the MCP server cannot point a tool at a folder its operator did not allow.
2. A tool call whose arguments do not fit the tool's declared input schema is refused, with the
   argument named, before the tool runs.
3. The engine's own build is the engine's own build when its folder is named through a
   symbolic link, and its output folder cannot be configured out of the project.
4. `npm run lint` refuses an unused name, an empty block without a reason, an unknown name in
   plain JavaScript, and Node reached for from the code that runs in a browser. The tree passes.
5. The workflow's actions are pinned to commits.

## Invariants

- A consumer's build is what it was: `runConsumerBuild` already kept its output inside the
  project and off linked paths, and is not changed.
- `runBrandSplash` is written into every built page with `toString()`; its text is not changed.
- A `validate_*` tool still answers a malformed recipe with its own report.
- No public API of the engine changes; no new dependency.

## Out of scope

- `typescript-eslint`'s recommended set as a whole: about 1,900 uses of `any` would have to be
  typed first. Counted, not taken on.
- The timing tests that fail on a heavily loaded machine, the WebGPU gaps and the other open
  items the audit copied from `HANDOFF.md`: they stay where they are listed.
- The path `vendor/laya-3.4.2` written in eight files, the number of npm scripts, and
  `noUncheckedIndexedAccess`: true as the audit says, left as they are.
- `local-results/` stays in the repository: it is the evidence the documents link to, and it
  holds no path of anyone's machine.

## Acceptance

- `tests/mcp-arguments.test.mjs`, `tests/build-failure-paths.test.mjs`,
  `tests/workflow-pins.test.mjs`.
- `npm run verify`, `npm run lint`, `npm run format:check`, `npm run verify:games`,
  `npm run verify:prefabs`.
- The engine built through a symbolic link, before and after.
