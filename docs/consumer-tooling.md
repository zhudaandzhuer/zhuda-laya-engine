# Consumer build and browser evidence

Use the public consumer compiler described in [3d-integration.md](3d-integration.md).
These contracts apply to independent consumers, including the watcher.

## Preserve the last successful build

The compiler generates the web directory, payload manifest, ZIP and build report
in a temporary directory beside the destination. It validates compilation,
Prefab evidence and package limits before publishing any of them. A compile,
missing/stale evidence, integrity or size failure leaves the previous output
unchanged. A later successful build replaces all the generated artifacts and
keeps unrelated files beside the output.

Publication holds a lock for the output parent (the ZIP/report share that
parent). A second build fails clearly rather than interleaving generations.
Caught publication errors restore the previous artifacts. If rollback itself
fails, the error names the retained recovery directory. An interrupted process
can leave `.zhuda-consumer-build.lock`; verify its recorded PID has exited before
removing the lock and retrying.

This is staged publication with rollback. Filesystem renames across the web
directory, ZIP and report are synchronous but are not one filesystem operation.
Power loss, SIGKILL during publication, external writers and readers in other
processes are not covered by an atomic snapshot guarantee. The watcher reloads
only after successful publication and shows failures in an overlay without
removing the displayed game.

## Explicit asset selection

```json
{
  "assetInclude": ["game305/runtime", "shared/fonts", "shared/palette.png"],
  "assetExclude": ["game305/runtime/source"]
}
```

Paths are files or directory prefixes relative to `assets/`. They must be
normalized, have no `..`, absolute paths, backslashes or glob patterns. An
explicit include must exist. Exclusions win over includes. An omitted include
retains the existing copy-all behavior; `assetInclude: []` copies no assets.
Selection also applies to `public/assets/`, preventing that path from silently
adding other games to the package. Files outside `assets/` in `public/` still
belong to the consumer's web shell.

Generate exact paths from the game's manifest/registry when appropriate. For
strict file-level delivery, list files rather than a broad parent directory.
`consumer-build.json` records the selection; `payload-manifest.json` records
the actual file paths, sizes and SHA-256 values. Consumers must audit this
manifest against their allowed game/shared assets. The engine does not infer a
game ID or know whether a given image belongs to a different game.

## Share the preview provider with the Scene

The consumer module named by `prefabPreview` exports `definitions` and may
export a synchronous `createAssetProvider(): AssetProvider`. Both the Scene
and preview should call that exact factory with the same manifest and policy.
For example, in the consumer's `src/prefabs.ts`:

```ts
import { DirectoryAssetProvider } from 'zhuda-laya-engine';
import type { AssetProvider, AssetManifest, PrefabDefinition } from 'zhuda-laya-engine';
import { manifest } from './asset-manifest'; // checked-in expected hashes

export const definitions: PrefabDefinition[] = [/* consumer definitions */];
export function createAssetProvider(): AssetProvider {
  return new DirectoryAssetProvider({
    baseUrl: './assets/', manifest: manifest satisfies AssetManifest,
    timeoutMs: 10_000, maxBytes: 10_000_000,
  });
}
```

The Scene imports both exports and constructs its library with the returned
provider. The generated preview does the same, owning and disposing its provider
with its library/session. Custom providers implement the existing public
interface, including cancellation/failure/disposal. Do not export a global
provider instance shared across owners with different lifetimes.

If the factory is absent, preview keeps the compatible default
`DirectoryAssetProvider({baseUrl:'./assets/'})`, which does not supply expected
hashes. Actual provenance hashes are observations, not integrity enforcement.
Directory provider validates hashes for declared manifest entries; consumers
requiring integrity must include every loaded ID and expected SHA or enforce
their stricter policy in the shared factory. A wrong declared SHA fails before
the Prefab is mounted. This factory does not prove the Scene actually used it;
retain Scene actual-instance evidence.

## Measured environment, evidence schema 2

```sh
zhuda-prefab-check \
  --url='http://127.0.0.1:8890/prefab-preview.html?id=ui/panel&width=1024&height=576&dpr=2' \
  --baseline=reference/panel-dpr2.png --output=evidence/panel-dpr2.json
```

Before navigation the checker sets Chrome's viewport and DPR through CDP. Design
canvas `width`/`height` and browser viewport are distinct: query parameters or
CLI `--viewportWidth=... --viewportHeight=...` can give the viewport a separate
size. CLI values override URL expectations. Default design/viewport is 640×360,
DPR 1. An intentional renderer cap can be declared as `--renderDpr=1` with
browser DPR 2; it must be no greater than the browser DPR. A cap declaration
does not modify the Scene: it defines what the checker expects to measure.

`environment.requested` records the requested viewport, design canvas, browser
DPR and rendering DPR. `environment.measured` reads `innerWidth`, `innerHeight`,
`devicePixelRatio`, canvas CSS bounds/backing dimensions and stage dimensions/
scale from the browser. An environment mismatch produces a failed JSON report
and fails even if image comparison would have zero differing pixels. Preview
bridge settings are stored separately as `previewEnvironment`.

The evidence gate requires schema 2 with a passing measured environment and
current payload/artifact hashes. Schema 1 reports, including old DPR claims,
must be regenerated; do not edit the JSON version or fingerprint to reuse them.
`--update-baseline` produces a candidate reference with `passed:false`; review
the image and rerun the actual comparison before it can become gate evidence.
This procedure proves deterministic regression of the neutral/current fixture,
not artistic parity with an external reference or physical mobile behavior.

## Candidate and acceptance commands (1.5.0)

```sh
zhuda-laya-build --candidate
zhuda-laya-watch --candidate --port 8890
```

Candidates use `<release-parent>/candidate/<web-directory>` (`dist/candidate/web`
by default), with their own ZIP, report and lock. Compilation, source guards and
package limits remain enforced; the evidence gate is deferred. The build report
says `unverified-candidate`. Release configuration and accepted output stay intact.
The watcher honors `outDir` and the candidate flag.

Declare the checks in `zhuda.config.json`:

```json
{
  "prefabPreview": "src/prefabs.ts",
  "prefabChecks": [
    { "id": "hero", "node": "Body", "state": "idle",
      "width": 640, "height": 480, "dpr": 1, "cycles": 30,
      "baseline": "references/hero-body.png", "output": "evidence/hero-body.json" }
  ]
}
```

`zhuda-laya-accept --capture` builds/serves a candidate and captures references;
reports remain failed and **no release is published**. Inspect the images and
retain prior references when changing an accepted design. Then run
`zhuda-laya-accept`: it builds a candidate, starts a temporary local server,
runs each real browser comparison, closes the server and rebuilds with the
normal evidence gate. Publication requires the **exact** candidate payload and
unchanged config. Failed checks or stale inputs preserve the prior release.

Normal `zhuda-laya-build` also requires every `prefabChecks[].output`, in addition
to legacy `prefabEvidence`. It verifies the configured selection, reference,
viewport/DPR, cycles and pixel tolerance. The acceptance command does not approve
references, run game rules/tests, measure physical devices or deploy a site.
Keep running consumer strict types, Doctor, game tests and Scene checks.

The preview now reports `lifecycleCheck.requestedCycles`, `completedCycles`,
status and before/after resource estimates. It becomes ready only when all
requested cycles finish. The checker verifies zero instance/reference/pending
counts after each disposal, matching resource snapshots and re-reads the final
report after comparison to catch late errors. Older previews without completion
evidence cannot pass nonzero cycles. Counts do not measure the GPU driver heap.

## Selective component evidence

Whole-payload validation remains the default. An isolated module must export
**exactly one matching definition**, with the same preview/provider/library
options and definition that the Scene uses:

```json
{
  "prefabPreview": "src/prefabs.ts",
  "prefabComponents": {
    "hero": { "entry": "src/prefabs/hero.ts", "assets": ["hero"] },
    "panel": { "entry": "src/prefabs/panel.ts", "dependsOn": ["hero"] },
    "tree": { "entry": "src/prefabs/tree.ts", "assets": [] }
  }
}
```

The existing preview URL routes by ID to its compiled component bundle. Its
fingerprint includes emitted code and imported renderer/SDK code, libraries,
preview shell, non-game public files (including fonts), selected assets and
child proof hashes. A changed child invalidates its parents. Cycles and missing
assets/children fail with config guidance. Omitted `assets` includes **all**
assets; `[]` declares no external assets. Paths are files or directory prefixes
relative to the output `assets/`.

A parent that limits `assets` must include the child assets it actually loads;
`dependsOn` adds child fingerprints, not an implicit union of asset allowlists.
Otherwise the observed child load falls back to whole-payload evidence.

A `dependencyProof` is recorded only when the matching bundle was loaded,
observed network resources are covered and provider provenance hashes match
included files. Unknown/external/undeclared loads retain whole-payload evidence.
Imported helper changes affect the emitted bundle; consumers cannot omit a
renderer source file through a manually maintained source allowlist.

This is a conservative module/component graph, not arbitrary JavaScript
inference. Importing one giant definitions file still invalidates its users
together. Split independently edited definitions into modules for granularity.
Unobserved states need separate checks. These proofs approve isolated previews;
changed Scene composition still needs integration checks. Remote freshness is
not proved by a local build; keep pinned provider integrity policies.

## Declaration scope

Keep the consumer's application code `strict:true`. The inherited Laya vendor
declarations still require `skipLibCheck:true` in the supported consumer check.
From the engine checkout, `npm run audit:declarations` independently runs the
full declaration check with `skipLibCheck:false` and exits nonzero on debt. Its
report is `dist/declaration-audit.json`; it is not part of a claimed zero-error
declaration release. Package/config versions now agree, but a source version
number alone is not evidence that a release tag was published.

## Primitive 3D definitions

The shared library and preview also accept typed `Prefab3DDefinition` recipes.
See [primitive 3D Prefabs](procedural-prefabs.md) for transforms, materials,
sockets, states, camera/light configuration and ownership. Static `.lh` remains
supported; Zero-IDE does not mean serialized assets are forbidden.

### DPR evidence migration in 1.7.0

The environment gate now checks stage design dimensions and stage scale as well
as viewport, reported DPR, CSS canvas size and backing resolution. Correct
backing pixels alone are insufficient: the former 198/99/66 CSS-pixel regression
at DPR 1/2/3 must fail. Rebuild candidates and recapture/review affected evidence;
do not re-label a pre-fix reference as approved. Default preview design units
match the requested CSS canvas dimensions. See [runtime sizing](platform-adapters.md)
for fixed-design consumers and [measured results](plans/records/astra-runtime-feedback/verification.md).

## Branding and neutral 2D starter (1.10.0)

Use `zhuda-laya-init --template 2d` for a strict 2D consumer. Explicit
`branding.mode` selects `engine` (default), `custom`, or `none`; notices remain
in the output. See [white-label, themes and recovery](white-label-themes.md) for the
validated schema and independent consumer verification command.

## Renderer axis (1.11.0)

`renderer: "webgpu"` in `zhuda.config.json` selects pinned GPU libraries and
SHA-verified, cancellable compiler WASM dependencies for both Scene and Prefab
preview. Omit it for WebGL. The package/ZIP contains the full relative payload.
A boot option must match the build; changing it alone does not load a backend.
See [WebGPU contract and measured boundaries](webgpu.md).
