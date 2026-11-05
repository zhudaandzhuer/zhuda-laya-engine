# White-label and H5 factory foundations (1.10.0)

This release supplies reusable presentation contracts, not a complete Slot
Factory. Customer rules, RNG, payouts, wallet, backend authority, artwork and
certification stay in the consumer. Use the same pinned SDK, core and Prefab
workflow for every theme. [Verification and limits](plans/records/slot-factory-foundation/verification.md).

## Branding is independent of theme

No configuration keeps the responsive **豬大 × LayaAir** splash. In
`zhuda.config.json`, opt into one of these exact contracts:

```json
{"branding":{"mode":"custom","brandId":"client-a","logo":"brand/logo.svg","title":"Client A","caption":"PLAY"}}
```

`{"branding":{"mode":"none"}}` disables the visual splash. `engine` is the
default. Custom build logos are normalized, project-relative SVG/PNG/JPEG/WebP
files, at most 2 MB. Symlinks, traversal and remote build paths fail explicitly.
The compiler embeds the logo before asset allowlisting; unknown fields fail,
including the old proposed `showEngineCredit` option. Title/caption are plain
text, not HTML. The responsive layout, safe areas and reduced-motion behavior
remain shared. Duration is the existing 2180 ms; `none` immediately completes
`__ZHUDA_SPLASH__` without leaving startup code waiting.

For the official **1.10.0+** browser bundle, before its script tag:

```html
<script>
window.ZhudaBranding = {mode: 'custom', brandId: 'client-a',
  logo: './brand/logo.svg', title: 'Client A', caption: 'PLAY'};
</script>
```

Browser logos may use relative images, HTTPS or base64 image data URLs. They
must obey the host CSP. Set this once before loading the bundle; changing it
later does not replace a running splash. `mode:'none'` also works. Keep bundle
SRI and a fixed release URL. Do not inject a reserved `#zhudaLogoSplash` node.
Types: `ZhudaBrandingConfig` and `zhuda-laya-engine/browser`.

Visual branding does not remove licenses. Consumer ZIPs always include
`zhuda-notices/LICENSE.txt` and `branding.json`; browser distributions retain
`LICENSE.txt`. Ship those notices with redistributed bundles. Optional
third-party runtimes retain their own terms as documented in LICENSE.

## Theme mapping and preparation

`ZhudaThemeManifest` v1 identifies a theme, revision and exact consumer
`contractId` (include layout/schema revision in that ID). Each asset declares a
stable logical ID, provider-relative source, bytes, SHA-256, kind and optional
formatVersion. A contract requires IDs/kinds/formats and download/decoded
estimate budgets. Duplicate IDs, missing requirements, malformed hashes,
incompatible contracts and budget failures reject before use.

```ts
import {ZhudaThemeController, ZhudaPrefabLibrary} from 'zhuda-laya-engine';
const themes = new ZhudaThemeController(sourceProvider, contract, 32_000_000);
const changed = await themes.replace(themeManifest, async (provider, signal) => {
  const library = new ZhudaPrefabLibrary({provider, definitions});
  try {
    const instance = await library.instantiate('panel', {signal});
    // Run consumer-specific decoded validation before returning.
    return {value: instance, dispose: () => library.dispose()};
  } catch (error) { library.dispose(); throw error; }
}, {signal, timeoutMs: 15000});
if (changed) scene.addChild(themes.current!.value.root);
// On teardown: themes.dispose(); then sourceProvider.dispose?.().
```

Preparation is off-scene. A failed/aborted/timed-out preparation keeps the old
active object. A newer request cancels the previous preparation, and late
prepared resources are disposed. Always obey the supplied signal and clean up
partial failures. On successful replacement the controller retires the old
presentation; attach the newly selected object synchronously after the await.
A stale `replace` returns false: do not attach its old requested theme. Cleanup
errors propagate; after a retirement error the new current remains owned/live.
Do not dispose `current.value` separately from its controller.

The controller borrows the source provider. `ZhudaThemeAssetProvider` verifies
loaded bytes itself and returns the **logical** ID required by Prefab texture
replacement. It does not create another cache. Use one library/cache per
immutable provider; when using an external shared cache, namespace keys with
`provider.cacheKey(id)` and resolve keys to their matching provider. Never swap
mappings under a live cache keyed only by `icon.png`. Theme identity alone is
not proof of asset integrity; every entry's hash is checked.

The initial provider maps byte assets (including sample audio). Native streaming
URLs are not part of this theme schema; retain the existing stream provider and
mixer contract for long BGM. Decoded Spine animations/skins/slots/events must
pass the existing `SpineVisualContract` inside preparation. Fonts, locale
fallback and layout constraints are defined by the consumer's exact contract,
not inferred from a filename. The manifest validator does **not** certify pixels,
Spine contents, font coverage or GPU allocation.

`estimatedDecodedBytes` and the old+new transition ceiling are declared estimates;
they do not measure VRAM or enforce native allocations. Peak memory must be
measured on the target device. Failed source loads, stale results and 100
replacements are tested separately from commercial memory/performance budgets.

## Authoritative result / presentation recovery

`ZhudaResultPlayback<T>` accepts JSON result envelopes with schemaVersion,
gameId/sessionId/epoch, roundId, monotonically increasing sequence,
resultVersion and payload. Caller `validate` authenticates/validates the data;
engine scope/sequence checks do not authenticate a network sender.

Provide an explicitly owned `ZhudaPlaybackStore` and `ZhudaResultRecovery`:

```ts
const playback = new ZhudaResultPlayback({
  scope: {gameId, sessionId, epoch}, store,
  validate: validateServerResult,
  validateCursor: validatePresentationCursor
});
await playback.recover({reconcile: (saved, signal) => backend.resume(saved, signal)});
// Only now enable input / resume the existing RuntimeSession.
if (playback.accept(serverResult) === 'accepted') {
  // Apply an idempotent visual state driven by RuntimeSession.layers.
  playback.advance(serverResult.sequence, nextCursor, completed);
}
```

A new instance starts locked even with a saved checkpoint. Recovery compares
against authoritative state before unlocking: same result preserves cursor;
a newer authoritative result may bridge a sequence gap and resets cursor;
regression/conflict fails and remains locked. `accept` accepts only the next
sequence after completed presentation, treats an identical result as duplicate,
ignores older sequences, and rejects conflicting payloads/gaps/reused current
round IDs. All scopes must match; a new session/epoch owns a new storage key.
The store keeps one last-result checkpoint, **not** a full transaction journal.

Writes must be atomic, synchronous and exclusively owned per key (for example,
one host-owned persisted snapshot). An exception preserves prior in-memory
state. Multiple tabs/processes require consumer coordination; an async store
must use a host/backend recovery adapter, not pretend fire-and-forget persistence
is durable. A browser storage fallback in an opaque sandbox is memory only.

On blur/context loss, `suspend()`, pause the existing session and cancel consumer
visual jobs. Rebuild the runtime/assets using the existing host or consumer
lifecycle; `recover()` before resuming. The coordinator supplies no second RAF,
AudioContext or gameplay clock. It does not repair lost WebGL contexts itself.
Cancellation, stale recovery, timeout, malformed storage, conflict and failed
persistence stay explicit errors. `dispose()` cancels recovery and locks input.

Presentation checkpoints are not exactly-once effects: a crash between applying
visual state and saving its cursor may replay that state. Keep visual updates
idempotent; backend idempotency keys, RNG, retries, wallet and settlement must
never depend on `advance()` or an in-memory EventGate. Network authentication,
server sequence policy and checkpoint migration remain consumer contracts.

## Reproduce the neutral pilot

```sh
node packages/compiler/zhuda-init.mjs /absolute/consumer --template 2d --engine 1.10.0
npm run verify
FACTORY_OUT=/absolute/evidence node scripts/verify-slot-foundation.mjs
```

The 2D scaffold uses an isolated `src/prefabs.ts` shared by preview and Scene,
`core/2d/ui`, strict declarations (`skipLibCheck:false`) and the existing build,
Doctor/candidate/accept route. It is a neutral panel, not a Slot rules kit.

The verification script packs the SDK and compiles a separate consumer through
its public compiler. One core builds two themes × engine/custom/no-splash;
DPR 1/2/3 use real Chrome WebGL with CDP emulation. Neutral symbol children are
rendered independently before the grid. Reference captures are explicitly
fixture calibration, followed by exact independent replay and provenance
comparison. They are not customer-art approval. It exercises 100 replacements,
1000 known-result presentations and recovery, reporting raw frame samples and
resource inventories. This is separate from a 60-minute low-end phone test.

## Remaining roadmap

A real customer pilot supplies licensed art, target device budgets, backend
result fixtures and distribution requirements. Complete that failure/device
matrix before claiming commercial adoption. Skin Editor, AI configuration,
Slot/Board kits and multi-game Factory CLI build on those stabilized contracts.
Android/iOS signed delivery is a separate track requiring a target/native
sample and signing resources. These product capabilities are not claimed by
this foundation release.
