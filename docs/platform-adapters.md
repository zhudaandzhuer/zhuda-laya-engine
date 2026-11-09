# Platform adapters

## NoSleep

The SDK includes `NoSleepAdapter` for the browser Screen Wake Lock API. It is
an engine utility, so a consumer does not need to add a third-party NoSleep
package for supported browsers.

```ts
import { NoSleepAdapter } from 'zhuda-laya-engine';

const noSleep = new NoSleepAdapter({ autoEnableOnGesture: true });
// Or call `await noSleep.enable()` from the game's start button handler.
const diagnostics = noSleep.getDiagnostics();
// diagnostics.state is `enabled`, `unsupported`, `denied`, or `error`.
```

The adapter releases its sentinel on page hide and blur, reacquires it when a
visible enabled owner returns, ignores stale request results, and releases all
owned resources on `dispose()`. `autoEnableOnGesture` defaults to `true`; the
first pointer, touch, mouse or keyboard gesture is still an explicit browser
user gesture. Consumers must inspect diagnostics and keep the result
`unsupported` when a browser does not expose `navigator.wakeLock`.

The service does not override operating-system power policy or keep a hidden
background tab awake. Real mobile support requires a browser/device check; the
Node fixtures only verify lifecycle and failure behavior.

## FairyGUI

FairyGUI is intentionally not part of the engine package, topology or SDK
bundle. A consumer that needs it installs the FairyGUI runtime compatible with
its pinned LayaAir version and owns the adapter, package/atlas/font assets,
input routing and disposal. Those UI assets remain outside this repository and
must follow the consumer's prefab isolation workflow.

## Runtime sizing, drivers and recovery (1.7.0)

`ZhudaEngine.boot({container, dprCap})` uses responsive **CSS-pixel design units**.
The canvas backing size scales by `min(devicePixelRatio, dprCap)`; a 198-unit
control remains 198 CSS px at DPR 1/2/3. Native Laya retinal mode supplies the
matching stage and input transforms. The adapter composes browser canvas CSS
resampling with the native Retina transform once, while preserving the native
backing-to-page matrix for input. The version-specific adapter restores the
browser ratio descriptor after synchronous sizing. Container placement and
ancestor scrolling are reflected in Laya pointer conversion. DOM
`ZhudaPointerInput` coordinates remain client CSS pixels; 3D screen queries use
the canvas CSS rect plus backing dimensions.

For a fixed design that scales with the container, use
`designSize:{width:1280,height:720}` and optionally `scaleMode` (default show-all).
Boot `width` / `height` alone describe initial setup; they do not pin a responsive
container's design resolution. Remove old consumer compensation that multiplied
design coordinates by DPR, and recapture affected Prefab/Scene evidence. The
checker rejects a backing-correct canvas whose stage design dimensions shrink
content. The official preview uses responsive CSS units at its requested size;
fixed-design consumer captures must declare their own scaling expectations.

```ts
const context = await ZhudaEngine.boot({
  container: '#game',
  designSize: {width:1280, height:720},
  driver: new ZhudaWorkerFrameDriver({intervalMs:100, onError:console.error}),
  backgroundPolicy: 'continue',
  recoveryPolicy: 'bounded',
  maxFrameDeltaSec: .1,
  clearInput: () => inputs.clear(),
  onResume: report => console.log(report),
});
```

The default driver is `ZhudaRafDriver`; default policies remain background
`pause` and recovery `discard`. `continue` advances the **same** runtime clock,
layers, timers and update task when the driver can deliver a frame. A Worker
sends wake messages in the background and RAF runs in the foreground. It does
not run gameplay in the Worker or create a second clock. Layers may still pause
presentation independently. A background RAF alone offers no timing guarantee.

`bounded` proposes one recovery delta capped at `maxFrameDeltaSec` (default
0.1, valid range greater than zero through one second). `onResume` reports the
background duration, proposed next-frame `advancedSec`, and missed time that
will be discarded. The proposed delta can be cancelled by pause/dispose. It
never replays the full suspension. Manual pause survives focus transitions;
duplicate/nonmonotonic timestamps and obsolete driver generations are ignored.
Consumers reconcile server/offline state through their own authority.

A custom `ZhudaRuntimeDriver` implements monotonic-millisecond `now`, `start`,
`setBackground`, `stop`, and idempotent `dispose`. The session owns it after
successful option validation. Worker construction can throw when unsupported or
blocked by CSP; handle this before boot and explicitly choose RAF if appropriate.
Worker errors stop that driver's updates and invoke `onError`. Do not silently
claim background execution. Session disposal terminates the owned Worker and
removes listeners. `workerFactory` can supply a CSP-compatible owned Worker;
its message protocol is `{type:'start', generation, intervalMs}` / `{type:'stop'}`,
with replies `{generation}`. Late-generation replies must not be retained.

Browsers and operating systems can throttle or freeze **both** threads. Desktop
Chrome switching/freeze and deterministic long-gap tests are measured; physical
iOS/Android background longevity and battery behavior remain unavailable.

## WebGPU (1.11.0)

The same runtime owns WebGL context loss and WebGPU device loss. See
[renderer selection, diagnostics, cancellation and fresh-realm recovery](webgpu.md).
Windows browser availability depends on its GPU/driver; native packaging is a
separate capability. Do not interpret WebGL fallback as WebGPU acceptance.
