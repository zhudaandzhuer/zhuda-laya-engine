# Verification record: consumer-review-reliability

Task document: `docs/plans/records/consumer-review-reliability/task.md`

Verification source: `0127bd214752383b785193e6d940f61d0a89b5c8` plus the changes in the commit introducing this record; checks ran before commit/publication

Date: 2026-11-04

## Environment

- macOS 27.0.1 (26A434), Node 26.12.0, npm 11.20.0.
- Browser: Chrome 156.0.8078.80, headless desktop, SwiftShader fallback allowed.
- Root declaration audit: TypeScript 5.9.3, `types:[]`; independent starter
  strict application check uses its pinned TypeScript 5.6.3 with `skipLibCheck:true`.
- Engine source identification: `/tmp/zhuda-consumer-reliability/source-hashes.json`.
- Neutral consumer: `/tmp/zhuda-consumer-reliability`; no BDLthe consumer source,
  production assets, pins or evidence were modified.
- Requested/measured environments: 1024×576/DPR 1, 1024×576/DPR 2,
  360×640/DPR 2; loopback HTTP, CDP desktop emulation. Physical mobile: UNAVAILABLE.

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Root build/types/Doctor/regressions | `npm run verify` | PASS, 133/133 tests | `/tmp/zhuda-consumer-reliability-verify.log` |
| Publication/environment/watch/CLI fixtures | `node --test tests/compiler-cli-entry.test.mjs tests/consumer-build.test.mjs tests/consumer-publication.test.mjs tests/prefab-environment.test.mjs tests/prefab-watch.test.mjs` | PASS; included again in root verify | `/tmp/zhuda-consumer-reliability-focused.log` |
| Real Prefab/Scene WebGL | `PREFAB_FIXTURE_DIR=/tmp/zhuda-consumer-reliability node scripts/verify-prefab-browser.mjs` | PASS, measured environment and negative fixtures | `/tmp/zhuda-consumer-reliability/evidence/summary.json` and `/tmp/zhuda-consumer-reliability-browser.log` |
| Independent packaged consumer | `npm pack --ignore-scripts --pack-destination /tmp/zhuda-consumer-reliability`; generate `installed-final` with the init CLI; inside it run `npm install --ignore-scripts --no-audit --no-fund --no-save /tmp/zhuda-consumer-reliability/zhuda-laya-engine-1.3.0.tgz`, then `npm run verify` | PASS, build + strict consumer types + Doctor; generated starter has 0 game tests, not a gameplay acceptance | `/tmp/zhuda-consumer-reliability-installed-final-verify.log` |
| Installed init binary | From `installed-final`: `node_modules/.bin/zhuda-laya-init /tmp/zhuda-consumer-reliability/bin-generated-final --engine 1.3.0` | PASS, actually creates package/source files through the bin symlink | `bin-generated-final/package.json` under the fixture root |
| Full declaration audit | `npm run audit:declarations -- --output /tmp/zhuda-consumer-reliability/declaration-audit.json` | FAIL, exit 1; 506 existing vendor diagnostics | `/tmp/zhuda-consumer-reliability/declaration-audit.json` |
| Diff and links | `git diff --check`; resolve relative Markdown links in changed docs | PASS | local command output |
| Physical iOS / Android | No physical device run | UNAVAILABLE | none |

The temporary fixture paths are outputs, not project dependencies. The checked-in
script recreates all neutral input assets and browser evidence. The tarball test
uses a local unpublished package with `--no-save`; it does not claim an npm/tag
release of these working-tree changes.

## Lifecycle and failure cases

- Compile failure, missing evidence, stale evidence and a one-byte package limit
  leave accepted HTML, app JS, payload manifest, report and ZIP hashes unchanged.
  Watcher HTTP continues serving ACCEPTED rather than the failed REJECTED page.
- A halfway publication rename error restores all old artifacts. Two builds
  sharing a parent cannot publish concurrently. Unrelated files survive; staging
  and the lock are removed after normal success/failure.
- Full verify initially exposed watcher close racing a queued build. The final
  implementation drains its active build and prevents work after close. The
  initial failure log is `/tmp/zhuda-consumer-reliability-verify-initial-failure.log`.
- An allowlist keeps a new unrelated game's assets out of web and ZIP, including
  assets arriving through `public/assets/`. Invalid/missing include paths fail.
- The preview uses the shared factory and existing resource scope/cache/leases;
  30 load/unload cycles report zero entries, references and instances after each
  unload. These are logical counters, not a GPU memory measurement.
- Correct manifest SHA works in preview and Scene; changing the fixture texture
  makes both fail integrity. Explicitly updating the expected manifest permits
  loading but the original image baseline still rejects the wrong color.
- The checker cannot be turned into PASS by a Scene report containing
  `passed:true`. Baseline candidate generation stays failed until a comparison
  is rerun. Old schema 1 and mismatched measured schema 2 evidence fail the build.

## Prefab evidence

Neutral fixture `amount-plate`, named nodes `plate` and `value`, states `short`
and `long`. `src/prefabs.ts` supplies the same definition and provider factory
to the preview and Scene in the temporary consumer. Reference images are neutral
regression captures, not consumer-art parity references.

| Selection | Evidence and comparison | Result |
| --- | --- | --- |
| Root / short | `evidence/pass.json`, `scene.json`, corresponding reference/actual/diff PNGs | PASS, same provenance and zero differing pixels |
| `value` / short; root / long | `child.json`, `long.json`; DPR 2 child in `child-dpr2.json` | PASS |
| 1024×576 / DPR 1 and 2 | `1024x576-dpr1.json`, `1024x576-dpr2.json` and `*-scene.json` | PASS; DPR 2 backing measured as 2048×1152 |
| 360×640 / DPR 2 | `360x640-dpr2.json` and `*-scene.json` | PASS; backing measured as 720×1280 |
| Browser DPR 2 / renderer capped at 1 without declaring cap | `wrong-backing.json` | Correctly FAIL; expected 1280×720, measured 640×360 |
| Changed SHA, shifted label, wrong color, substituted root | `integrity-failure.json`, `scene-integrity-failure.json`, `shift.json`, `wrong-texture.json`, `substitute.json` | Correctly FAIL |

Requested DPR 2 with measured DPR 1 is also an explicit unit fixture. It rejects
the reported review mismatch independently of pixel equality.

## Limits and decision

The two reported reliability defects and the provider/asset-selection seams are
implemented and measured within the scope above. Version metadata now agrees
at 1.3.0; this does not publish a release. The consumer's complete migration and device
acceptance remain **In progress**; this engine work does not accept its game gates.

Publication is staged and rollback-capable, not power-loss/SIGKILL atomic across
multiple paths or a snapshot guarantee for other-process readers. Provider
factory identity is an integration responsibility, verified here only for the
neutral Scene. Evidence still hashes the full payload; selective dependency
invalidation is not implemented. MP3/BGM mixer ingestion and the 506 vendor
declaration diagnostics remain open, with explicit Proposed work in
`docs/plans/consumer-delivery-followups.md`. Physical phone compositor, input,
audio and performance checks remain UNAVAILABLE.
