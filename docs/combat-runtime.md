# Combat runtime contracts

The runtime exposes deterministic building blocks for action games without
owning movement, damage or network authority. A consumer translates platform
events into action IDs, authors frame data in its own assets, and adapts model
bone poses to the declared sockets.

## Layered time

`ZhudaLayeredClock` is one real-time source with named scaled channels. The
default layers are `world`, `player`, `enemy`, `vfx` and `ui`. Freeze an enemy
hit-stop or slow only the world while UI and presentation continue:

```ts
const clock = new ZhudaLayeredClock();
const timers = new ZhudaTimerScheduler();

clock.setPaused('enemy', true).setTimeScale('world', 0.5);
timers.scheduleOnce(0.055, () => endHitStop(), { layer: 'enemy' });

clock.advance(realDeltaSeconds);
timers.advance(
  clock.unscaledDeltaTime,
  clock.unscaledDeltaTime,
  clock.scaledDeltas,
);
simulateEnemy(clock.sample('enemy').scaledDeltaTime);
updateUi(clock.sample('ui').unscaledDeltaTime);
```

Layer timers use the supplied map and do not create browser timers. A missing
layer delta advances by zero, which keeps a frozen or deliberately omitted
layer safe.

## Action frame data and sockets

`ZhudaActionFrameSpec` uses half-open `[from, until)` frame windows. Startup,
active and recovery must connect from frame zero through `frameCount`. Events
are ordered by frame, cancel windows list legal target action IDs, and sockets
declare stable IDs mapped to consumer model bones.

```ts
const light = new ZhudaActionStateMachine({
  id: 'light-1', frameRate: 60, frameCount: 24,
  startup: { from: 0, until: 6 },
  active: { from: 6, until: 10 },
  recovery: { from: 10, until: 24 },
  events: [{ frame: 7, id: 'hitbox-on' }, { frame: 10, id: 'hitbox-off' }],
  sockets: [{ id: 'rHand', bone: 'hand_r' }],
});
light.play();
for (const event of light.advance(scaledDeltaTime)) dispatch(event);
```

The state machine reports phase, active state, cancel eligibility and socket
declarations. It never moves a model, applies damage or decides whether a
consumer may start an action. Feed socket-derived rectangles to the existing
`ZhudaCombatWorld.sampleRect()` adapter.

## Buffered input

`ZhudaInputBuffer` accepts stable action IDs from keyboard, touch or gamepad
adapters. It bounds capacity and age, rejects time going backwards, consumes an
action once, and can consume an ordered combo while allowing unrelated inputs
between steps:

```ts
const input = new ZhudaInputBuffer({ window: 0.12, capacity: 32 });
input.push('down', simulationTime);
input.push('forward', simulationTime);
input.push('light', simulationTime);
if (input.consumeSequence(['down', 'forward', 'light'], simulationTime)) {
  requestAction('light-1');
}
```

The buffer does not map physical keys, validate a move list or replace the
consumer's action state machine. Clear or dispose it on focus loss, round reset
and runtime teardown.

These contracts are public from the `zhuda-laya-engine` package root. Real model animation, browser input and device
latency still require consumer acceptance checks.
