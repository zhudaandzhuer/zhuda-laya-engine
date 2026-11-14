# GPU depth: compute passes, wider shaders, surface pictures, object motion

What LayaAir 3.4.2 can do on the GPU that the engine did not reach, behind
the engine's own API. All of it is drawn on WebGL and on WebGPU by
`npm run verify:gpu-depth`.

| What                                                 | Asked with                                   | WebGL             |
| ---------------------------------------------------- | -------------------------------------------- | ----------------- |
| A step for many things on the GPU                    | `ZhudaComputePass`                           | a JavaScript step |
| A draw of copies whose places a step writes          | `ZhudaComputedInstances`                     | the same draw     |
| Integer, matrix, array and cube-map uniforms         | `ZhudaShaderSpec.uniforms`                   | yes               |
| Hash, noise, fractal noise, triplanar                | `common: true` (`ZhudaCommon.glsl`)          | yes               |
| Reflections by each surface's normal and roughness   | `ZhudaScreenReflections({ surfaces: true })` | yes               |
| A moving thing's velocity for temporal anti-aliasing | `ZhudaObjectMotion`                          | yes               |

## Compute passes

```ts
import { ZhudaComputePass, ZhudaComputedInstances } from 'zhuda-laya-engine';

const pass = new ZhudaComputePass({
  name: 'ZhudaSparks',
  // Called once for every index of a dispatch.
  code: `void zhudaStep(uint index){
    vec4 state=zhudaStates[index];
    state.y-=u_ZhudaStep.x;
    zhudaStates[index]=state;
    uint at=index*5u; // a copy's matrix, column by column, then vec4(1,0,0,0)
    zhudaPlaces[at]=vec4(0.05,0.0,0.0,0.0); zhudaPlaces[at+1u]=vec4(0.0,0.05,0.0,0.0);
    zhudaPlaces[at+2u]=vec4(0.0,0.0,0.05,0.0); zhudaPlaces[at+3u]=vec4(state.xyz,1.0);
    zhudaPlaces[at+4u]=vec4(1.0,0.0,0.0,0.0);
  }`,
  buffers: {
    zhudaStates: { type: 'vec4', length: 100000 },
    zhudaPlaces: { type: 'vec4', length: 500000, vertex: true },
  },
  uniforms: { u_ZhudaStep: { type: 'vec4', value: [1 / 60, 0, 0, 0] } },
  // The same step in JavaScript, for a backend without compute.
  step: (index, buffers, uniforms) => {
    /* … */
  },
});
pass.write('zhudaStates', states);
const sparks = new ZhudaComputedInstances(scene3D, mesh, material, pass, 'zhudaPlaces', 100000, {
  bounds: { min: [-20, 0, -20], max: [20, 20, 20] },
});
// every frame
pass.dispatch(100000);
```

- A buffer is an array of `float`, `vec4` or `uint` under its own name
  (`zhudaStates[index]`); a uniform is a `float`, a `vec4` or an `int` under
  its name. `u_ZhudaCount` is how many indices the dispatch has. The
  layout, the buffer and uniform declarations and `main` are the engine's.
- `pass.backend` is `'webgpu'` or `'cpu'`. Compute exists on WebGPU only. On
  WebGL a pass runs its `step` in JavaScript, with the same buffers and the
  same draw; a pass without one refuses with `COMPUTE_UNAVAILABLE`.
- One index reads and writes its own elements. On the GPU all indices run
  at once, in JavaScript one after another: a step that reads what another
  index of the same dispatch writes is not the same on both.
- `ZhudaComputedInstances` draws a mesh once for every place the step wrote,
  from a buffer declared with `vertex: true`. The step and the draw share
  that buffer: nothing is read back. The copies are culled by the box given
  as `bounds`, since nothing else knows where they are.
- `await pass.read(name)` copies a buffer out, for a check or a save. A draw
  does not need it.
- `pass.dispose()` after the draws that use its buffers.

What a step of the check's particles costs (Apple M4, a step for each
particle: gravity, a bounce, a matrix written):

| Particles | WebGPU, the call | WebGPU, until the GPU is done | The same step in JavaScript |
| --------: | ---------------: | ----------------------------: | --------------------------: |
|    20,000 |          0.01 ms |                        0.1 ms |                      0.6 ms |
|   200,000 |          0.01 ms |                 0.4 to 0.6 ms |               5.4 to 5.9 ms |
| 1,000,000 |          0.01 ms |                 2.2 to 2.5 ms |                 26 to 30 ms |

After sixty steps of 20,000 particles the GPU's positions are within
0.00002 of the JavaScript step's.

## More kinds of uniform

`ZhudaShaderSpec.uniforms` took `float`, `vec2`, `vec3`, `vec4` and
`texture2D`. It also takes:

```ts
uniforms: {
  u_ZhudaMode: { type: 'int', value: 3 },
  u_ZhudaTint: { type: 'mat4', value: [/* sixteen, column by column */] },
  u_ZhudaStops: { type: 'vec4', length: 4, value: [/* four vec4 */] }, // u_ZhudaStops[i]
  u_ZhudaLevels: { type: 'float', length: 3 },
  u_ZhudaSky: { type: 'textureCube' }, // zhudaSample_u_ZhudaSky(direction)
}
```

- An array is `float`, `vec2`, `vec3` or `vec4`, 2 to 64 elements;
  `setUniform` takes all of its numbers one after another.
- A cube map is the caller's LayaAir `TextureCube`, given like a
  `texture2D`; `zhudaSample_<name>(vec3)` reads it.
- `ZhudaLitSurfaceMaterial` keeps to the five it had.

## The common functions

`common: true` in a 3D `ZhudaShaderSpec` lets the surface call:

| Function                                    | Gives                                              |
| ------------------------------------------- | -------------------------------------------------- |
| `zhudaHash(vec2)`, `zhudaHash(vec3)`        | 0..1 from a cell                                   |
| `zhudaHash2(vec2)`                          | two of them                                        |
| `zhudaNoise(vec2)`, `zhudaNoise(vec3)`      | value noise, 0..1, smooth between unit cells       |
| `zhudaFbm(vec2)`, `zhudaFbm(vec3)`          | five octaves of it, 0..0.97                        |
| `zhudaTriplanarWeights(vec3 normal)`        | three shares that sum to 1                         |
| `zhudaTriplanar(sample, p, weights, scale)` | a texture laid on from three sides without stretch |

```glsl
vec3 w=zhudaTriplanarWeights(n);
vec4 rock=zhudaTriplanar(zhudaSample_u_ZhudaRock,p,w,0.5);
float patchy=zhudaFbm(p.xz*0.3);
```

The hash uses no sine and no integer operation: one expression for GLSL ES
and WGSL. `zhudaHash2D`, `zhudaNoise2D`, `zhudaFbm2D` and
`zhudaTriplanarWeights` are the same arithmetic in JavaScript, for placing
things where a shader will draw them. On the GPU measured the drawn hash
and the JavaScript one agree to 0.03 over 256 cells; another GPU may round
a cell differently.

## Reflections by each surface

`ZhudaScreenReflections` let the whole view reflect alike, because a
forward renderer keeps no roughness or normal. LayaAir 3.4.2 can draw them
into pictures of their own while it draws the opaque things. With
`surfaces: true` (`"screenReflections": { "surfaces": true }` in a look):

- the ray leaves a surface by the surface's own normal, so a normal map
  bends the reflection;
- a rough surface reflects little and a smooth one much;
- a metal reflects strongly head-on;
- `wetness` polishes: at 1 everything is as smooth as water on it.

In the check, a bright wall mirrored in three strips of floor, mean
brightness of the mirrored patch (0..255):

|                          | Rough PBR | Smooth PBR | Rough, glTF material |
| ------------------------ | --------: | ---------: | -------------------: |
| no reflections           |        13 |         27 |                   13 |
| alike (`surfaces` off)   |       128 |        129 |                  128 |
| `surfaces`               |        93 |        160 |                   95 |
| `surfaces`, `wetness: 1` |       171 |        174 |                  175 |

LayaAir's standard PBR material writes the pictures; the shader glTF models
are drawn with did not. `ZhudaEngine.boot` teaches it to
(`installLaya342SurfaceBuffer`), with LayaAir's own code. A material that
writes nothing (a custom `ZhudaShaderMaterial`, a `ZhudaLitSurfaceMaterial`)
is reflected as before. The cost is two more pictures drawn in the opaque
pass; no pass is added.

## A moving thing's velocity

LayaAir's temporal anti-aliasing (`temporalAA` of `ZhudaFilmicPipeline`)
reads how far each pixel moved, and that picture is written from the
camera's motion alone: a thing that moved is in it as if it stood still, and
what is on it smears while it moves.

```ts
import { ZhudaObjectMotion } from 'zhuda-laya-engine';

const motion = new ZhudaObjectMotion();
const car = motion.track(carNode); // it and everything under it that draws
// every frame, after things have moved and before the frame is drawn
motion.update();
// a cut, a teleport
motion.reset();
car.remove();
motion.dispose();
```

A striped box crossing the view four pixels a frame, against the same box
drawn without smoothing (mean difference, 0..255): 62 as LayaAir writes it,
0 tracked; 0 standing still either way.

- A skinned mesh is given its node's motion. The motion of its bones is not
  kept (that needs every bone of the frame before).
- Copies drawn as instances (`ZhudaInstancedMesh`, `ZhudaComputedInstances`)
  are written without velocity, as LayaAir writes them.
- A custom `ZhudaShaderMaterial` writes no velocity at all.

## Limits

- One desktop GPU (Apple M4). No phone: compute on a phone's WebGPU, the
  cost of the surface pictures on a phone, were not measured.
- Compute is what LayaAir's compute shader takes: GLSL, buffers of `float`,
  `vec4` and `uint`, no textures, no indirect dispatch.
- A step's JavaScript twin is the game's to keep the same as its GLSL.
- `textureCube` was drawn with one colour a face; `texture3D` and texture
  arrays are not offered.
- The surface pictures are not written through transparent things, and
  screen reflections do not blur with roughness: a rough surface reflects
  less, not wider.
- Motion blur by velocity is not built; the camera's own
  (`ZhudaMotionBlur`) is unchanged.
