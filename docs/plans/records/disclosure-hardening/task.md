# Agent task: disclosure-hardening

Status: Accepted within engine scope  
Owner: Engine/toolchain  
Last reviewed: 2026-11-10

## Source requirement

User requests fixes for the reviewed security, CLI, typing, diagnostics, MCP,
packaging, CI and engineering findings, directly on main. Remove other branches
after preserving any unique work. Baseline SDK 1.15.0 / b8a174f; the preceding
isolated review confirmed the findings and corrected stale numeric claims.

## Goal

Reject unauthorized editor requests, provide working installed CLIs, report
truthful diagnostics, publish complete generated types and reproducible lean
packages, and run the corresponding regressions on a main-only repository.

## Invariants

- Consumer game data, rules, media and authored coordinates stay outside this patch.
- Normal editor selection, save/revision/backup, Play lifecycle and model loading work.
- Runtime assets retain provider ownership and disposal contracts.
- Published Node CLIs use built JS, never TypeScript stripping in node_modules.
- Every retained runtime export has a usable public declaration.
- No unique Git commits or user changes are discarded while removing branches.

## Dependencies

- Existing editor HTTP routes, browser fixtures, public declarations and the 301-test baseline.
- Release/build pipeline, package lock, packed-install and browser gates.
- Baseline review evidence is external; repository records contain portable paths.

## Scope

### Engine

- Shared editor HTTP validation/static serving and client capability requests.
- Shared CLI main detection/help, explicit build project validation.
- Strict expanded TS checks and Bounds/camera corrections.
- Runtime health, demo subpath, MCP protocol/version/assets, generated declarations.
- Deterministic relative-path reports, generated dist lifecycle, npm exclusions,
  minified SDK and audited sideEffects metadata.
- Lockfile CI, Windows full tests, registered/browser validation batches,
  targeted coverage, lint/format checks and current documentation.
- Delete non-main local/remote branches only after ancestry/preservation checks.

### Consumer or adapter

- None. Consumers adopt the release and verify it in their own repositories
  (scope narrowed by the user on 2026-11-10: the engine repository covers the
  engine only).

## Non-goals

- Game redesign, new gameplay, physical-device certification or rewriting Git history.
- Treating formatting differences as semantic declaration errors.

## Acceptance checks

1. Both servers reject malicious/missing Host, foreign/null Origin, missing or
   wrong capability and non-JSON writes; project routes expose only approved
   assets and reject hidden files, encoded traversal and escaping symlinks.
   Normal same-origin editor loads/saves/Play/model requests still pass.
2. Every npm bin responds to --help through symlinks and paths with spaces and
   Unicode; MCP stdio works. Empty-directory build fails without writes.
3. Strict TS includes compiler and examples; all generated public declarations
   match runtime exports and pass strict external consumer checks.
4. No fabricated module/WASM success, unknown asset fallback, notification
   response or successful unknown JSON-RPC method. Versions come from package.json.
5. Repeated builds do not dirty tracked files. Packed files contain no developer
   home paths, plan records or source maps; a clean tarball installation works.
6. Main SDK excludes legacy demo code; explicit demo entry retains examples.
   Minified exports load and audited tree shaking retains required behavior.
7. npm ci, npm run verify, lint/format, full Windows tests, registered browser
   batches, geometry/paint/input gates and a clean packed install pass.
8. Current README reports computed evidence; coverage adds meaningful facade,
   terrain and build failure-path checks without counting browser draws as unit coverage.
9. Local and remote branch inventories contain main only; working tree is clean.

## Evidence to attach

- Negative HTTP/CLI fixtures, protocol/export/package tests and exact commands.
- Full verification, coverage summary, browser reports and CI URLs.
- Packed-install evidence; portable repository records.
- Git branch/worktree inventories and retained ancestry.

## Unverified limits

- Physical devices and Windows GPU hardware remain separate from hosted CI.
- HTTP defenses are tested directly; browser-specific DNS/network permissions
  are not substitutes for the server checks.

## Rollback

Baseline b8a174f remains in main history. Revert scoped commits if necessary;
never re-enable insecure serving as an automatic fallback.

## Result

See [verification.md](verification.md). Hosted CI (including full Windows
tests) passes. Consumer adoption is consumer-owned.
