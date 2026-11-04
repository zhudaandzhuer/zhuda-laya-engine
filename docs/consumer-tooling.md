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

For a stale production gate, build a separate candidate output using the same
consumer configuration and source, e.g. `dist/candidate`, without publishing it
over the accepted `dist/web`. Capture/review schema 2 evidence against that
candidate, then run the normal build with `prefabEvidence` enabled. The original
accepted output stays available until the new evidence and normal build pass.
The whole-payload fingerprint remains conservative; selective component
invalidation is [proposed](plans/consumer-delivery-followups.md), not implemented.

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
