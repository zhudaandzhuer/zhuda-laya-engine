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
