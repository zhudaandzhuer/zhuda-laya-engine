# Runtime hardening contracts

The runtime hardening APIs make the six high-risk paths explicit without taking
ownership of a consumer game's rules. They are exported from
`zhuda-laya-engine/runtime3d` and from the package root.

## One frame and two time channels

`ZhudaRuntimeSession` owns one RAF update path. Set `timeScale` once and read the
second callback argument for both channels:

```ts
const runtime = new ZhudaRuntimeSession(canvas, { timeScale: 0.25 });
runtime.timers.scheduleOnce(0.1, () => openHitWindow(), { channel: 'scaled' });
runtime.timers.scheduleOnce(0.1, () => closeCinematic(), { channel: 'unscaled' });
runtime.start((unscaledDeltaTime, time) => {
  simulate(time.scaledDeltaTime);
  updateUi(time.unscaledDeltaTime);
});
```

Use `scaled` for gameplay and hit-stop windows. Use `unscaled` for UI,
cinematics and recovery that must continue while gameplay is slowed. Timer
handles can be cancelled individually or by owner, and `dispose()` clears every
pending callback. Browser `setInterval` and `setTimeout` must not drive gameplay.

`ZhudaSimulationClock` keeps fixed-step replay deterministic and now exposes the
same scaled and unscaled measurements. Its default `timeScale` is `1`.

## Scene mutations

`ZhudaSceneMutationQueue` accepts public operations and applies only the batch
that existed at the start of `flush()`. A callback that adds, removes or destroys
another node queues that operation for the next boundary:

```ts
const mutations = new ZhudaSceneMutationQueue();
mutations.deferDestroy(() => node.destroy(true));
// Call once after update and late-update have finished.
mutations.flush();
```

Do not access Laya private child arrays or patch its renderer. The queue is an
adapter boundary; the consumer still owns the actual Node operation.

## Render spaces

`ZhudaRenderSpace` dispatches `onRenderLocal`, `onRenderWorld` and
`onRenderOverlay` separately. The context labels the coordinate space and carries
the consumer-supplied matrix. The API never applies a transform itself, so a
component cannot accidentally translate twice or mirror overlay text. Provide
`localToWorld`/`worldToLocal` with reusable output objects when a node adapter has
them.

## Defensive Graphics

Wrap a Laya `Graphics` instance with `ZhudaGraphicsGuard` at the consumer boundary.
It rejects non-finite coordinates, clamps negative sizes/radii and bounds rounded
corners to the rectangle. It does not monkey-patch Laya or silently change color
or blend semantics.

## Pool lifecycle

`ZhudaObjectPool` has explicit `acquire()`/`release()` ownership and optional
`onSpawn`, `onDespawn`, `reset` and `dispose` hooks. Capacity is bounded and a
duplicate release is rejected. Node transforms, event listeners and external
resources are reset only when the consumer supplies the corresponding hook.

## Combat candidates

`ZhudaCombatWorld` provides deterministic 2D AABB hitbox/hurtbox candidates,
layer masks, active windows, socket/procedural rectangle samplers and per-swing
deduplication. `queryHitbox()` returns candidates; it never applies damage,
knockback, health or network authority. The consumer must resolve the returned
hit using its own rules.

These contracts are covered by deterministic Node tests. A passing test does not
claim that a particular Laya browser backend or mobile device renders identical
pixels; those checks remain consumer acceptance work.
