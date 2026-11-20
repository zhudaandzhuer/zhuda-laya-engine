# Shader warm-up

LayaAir compiles a shader the first time something is drawn with it. A
scene that comes on screen, a look that changes level, a lamp that is
switched on and a model that changes level of detail each bring shaders
nobody has drawn yet, and the frame that compiles them is long. Measured on
a small scene (six materials on thirteen objects, one lamp, one look;
`npm run verify:shader-warm-up`, and the same page on a phone):

|                           | First frame         | Look to level 0    |
| ------------------------- | ------------------- | ------------------ |
| Desktop WebGL (Apple M4)  | 112 ms, 27 compiled | 40 ms, 4 compiled  |
| Desktop WebGPU (Apple M4) | 626 ms, 27 compiled | 132 ms, 4 compiled |
| vivo V40, WebGL 2         | 161 ms, 27 compiled | 43 ms, 4 compiled  |

With the warm-up below, the same frames compile nothing: 13, 177 and 43 ms
for the first frame, 4, 20 and 13 ms for the change of level. The pictures
are the same ones.

## Record once

In a development build, list what the game compiles. Make the recorder right
after boot, take the game through every state that brings new shaders (each
scene, each level of the look, night with its lamps, each level of detail
in view), and save the list:

```ts
const recorder = new ZhudaShaderVariantRecorder();
// ... mount the scene, draw; look.setQuality(2), draw; 1; 0; turn the lamps on, draw ...
const list = recorder.list(); // { version: 1, backend: 'webgl', variants: [...] }
recorder.stop();
download(JSON.stringify(list)); // ship it with the game
```

A list is for the backend it was recorded on: record one on WebGL and one
on WebGPU when the game ships both. `zhudaMergeShaderVariants(a, b)` joins
the lists of several scenes. The same set of variants always gives the same
list, so a list that changes in review changed for a reason.

## Warm up behind the loading screen

Make the scene and its look first (a material registers its shader when it
is made), keep the scene from being drawn, warm up, then show it:

```ts
scene.active = false; // a scene that is drawn compiles what it shows, a frame at a time
const report = await zhudaWarmUpShaders(list, {
  budgetMs: 8, // compiling a frame; the loading screen goes on being drawn in between
  signal, // a cancelled load rejects with the signal's reason
  onProgress: (done, total) => bar.set(done / total),
});
scene.active = true;
```

The report says what happened: `compiled`, `cached` (there already),
`missing` (a shader, sub-shader or pass of that name is not registered),
`failed` (it threw, or it was recorded without the scene's uniform sets),
`ms`, `longestMs` and `slices`. A warm-up never keeps a game from starting:
a list of the other backend, or something that is not a list, compiles
nothing and says why in `refused`.

The engine's own effects (edge smoothing, light fog, clouds, the lens
finish and the others) register their shader the first time one is made, so
a look that has not reached level 1 has never registered the one-pass
smoothing. The warm-up registers them all when it meets a name it does not
know; `registerZhudaEffectShaders()` does the same on request.

## What it does not do

- One shader cannot be compiled in parts: the longest single compile is the
  longest pause while warming up (`longestMs`: 10 ms on the two WebGL
  devices above, 175 ms on desktop WebGPU, whose first compile starts its
  compilers).
- On WebGPU the list covers the shader modules. The render pipeline is
  still made at the first draw, which is what is left of the first frame
  there (177 ms of 626).
- A variant the list does not hold is compiled when it is first drawn, as
  before. A list recorded on one device is not checked against another: a
  device that compiles other defines (no float textures, another shadow
  filter) needs its own recording.
- LayaAir's own `ShaderVariantCollection.compileAll()` must not be used for
  this. It does not keep the scene's uniform sets a shader was compiled for:
  run before the first frame it compiles shaders that take the scene's
  lights for the material's (every lit surface drawn dark on WebGL) or do
  not compile at all (WebGPU, and the failed compile breaks later ones).
  The recorder keeps those sets, and the node's uniform maps in their own
  order, and the warm-up puts them in force for each compile.

[Record](plans/records/shader-warm-up/verification.md).

## Warm up by drawing

A list covers shader modules. A first draw does more: on WebGPU it makes
the render pipeline and bind groups, and a pass of the game's own (a water
mirror, a reflection) compiles shaders a list recorded without it does not
hold. `zhudaWarmUpByDrawing` draws the scene behind the loading screen from
the places the game names, four ways round and once down from each, then
puts the camera back:

```ts
const report = await zhudaWarmUpByDrawing({
  camera,
  eyes: [
    [0, 2.2, 18],
    [0, 2.2, 50],
    [1.5, 2.2, 105],
  ], // where the player starts, the way it goes on
  beforeView: ({ eye, target }) => {
    lod.update(eye); // the game's own things, as that eye would see them
    mirror.update(eye, target); // and its own passes
    mirror.render();
  },
  onProgress: (done, total) => bar.set(done / total),
});
```

On the fixture scene the first frame then compiles nothing and takes 7 ms
on WebGL (306 ms cold, 30 ms after a list) and 32 ms on WebGPU (1252 ms
cold, 153 ms after a list). It warms only what its views see: turn on for
it what the game hides by distance, and name an eye near each place the
player will reach early. It costs whole frames (15 views: 0.3 s on desktop
WebGL, 1.2 s on desktop WebGPU; 30 views about 3 s on a vivo V40). Changes
of look level are still compiled when they come: a list covers those.

[Record](plans/records/draw-warm-up/verification.md).
