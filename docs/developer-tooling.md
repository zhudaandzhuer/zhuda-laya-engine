# Developer tooling: what is in a scene, what it costs, what went wrong

Tools for a person or an agent looking at a scene that is wrong. None of
them runs unless asked for. All are drawn on WebGL and on WebGPU by
`npm run verify:developer-tooling`.

| What                                             | Asked with                              |
| ------------------------------------------------ | --------------------------------------- |
| Lines for axes, bounds, lights, a camera, bones  | `ZhudaDebugDraw`                        |
| What the sun's shadow map covers                 | `draw.shadowCascades()`                 |
| LayaAir's statistics panel                       | `showZhudaStats()`                      |
| Draws, triangles and GPU time, on either backend | `ZhudaRuntimeProfiler`                  |
| The lines of a shader that does not compile      | `context.renderer.errors`               |
| Moving, turning and scaling a node by its axes   | `ZhudaTransformGizmo`; the model editor |

## Lines that show what is there

```ts
import { ZhudaDebugDraw } from 'zhuda-laya-engine';

const draw = new ZhudaDebugDraw(scene3D);
draw.axes(null, 1); // the world's axes: red x, green y, blue z
draw.grid({ size: 10, divisions: 10 });
const box = draw.bounds(model.node); // the box round everything it draws
draw.light(sun.node); // an arrow; a point light's reach; a spot's cone
draw.camera(otherCamera); // its near and far rectangles
draw.shadowCascades(); // a sphere for each of the sun's cascades
// every frame while anything moves
draw.update();
box.remove();
draw.dispose();
```

- Each helper follows what it shows: `update()` draws all of them again
  from what their targets are now.
- Lines are hidden by what is in front of them. `new ZhudaDebugDraw(scene,
{ onTop: true })` draws over everything: for bones, which are inside what
  they move (`draw.skeleton(model.node)`), and for anything that must be seen
  through a wall.
- A light's lines take the light's colour. Colours are what is drawn, not
  scene-linear light; with an HDR chain they go through its tone curve like
  everything else.
- `draw.lines(() => [x0, y0, z0, x1, y1, z1, …], color)` draws segments of
  your own.
- A sheet keeps at most `maxLines` segments (8192 by default); what does
  not fit is left out and counted in `draw.dropped`.
- The geometry is plain arithmetic, usable without a GPU: `zhudaAxesLines`,
  `zhudaGridLines`, `zhudaBoxLines`, `zhudaCircleLines`, `zhudaSphereLines`,
  `zhudaConeLines`, `zhudaArrowLines`, `zhudaFrustumLines`,
  `zhudaSkeletonLines`, `zhudaWorldBounds`, `zhudaBonesOf`.

### The sun's shadow map

`draw.shadowCascades()` shows the spheres LayaAir fitted the sun's cascades
into at the last frame (`zhudaShadowCascades(scene)` gives the numbers). A
thing outside every sphere gets no shadow from the map; a thing in the far
sphere only gets the coarse one.

The map itself is not shown as a picture: it is a comparison texture, which
WebGL may not read as a colour and WebGPU refuses to bind as one.

## LayaAir's statistics panel

```ts
import { showZhudaStats } from 'zhuda-laya-engine';
const panel = showZhudaStats({ x: 10, y: 20 });
panel.hide();
```

LayaAir's own panel (frames a second, draw calls, triangles, counts of
what it submits, memory of its resources), drawn into the game's own
picture and refreshed once a second. The numbers are LayaAir's counters,
not measurements of the GPU. Its text makes LayaAir's text atlas (1024 by
1024), which LayaAir keeps after the panel is hidden.

## The profiler on both backends

```ts
import { ZhudaRuntimeProfiler } from 'zhuda-laya-engine';

const profiler = new ZhudaRuntimeProfiler();
const device = Laya.LayaGL.renderEngine.getDevice?.(); // WebGPU
if (device) profiler.attachWebGPU(device);
else profiler.attach(context.canvas.getContext('webgl2'));
profiler.enableGpuTiming(device ?? context.canvas.getContext('webgl2'));

profiler.beginFrame();
ZhudaEngine.flushRenderFrames(1); // or whatever draws the frame
profiler.endFrame(frameMs, cpuMs);
profiler.report(); // draws, triangles, percentiles, GPU ms
profiler.dispose(); // the browser's own methods are back
```

- **Draws and triangles.** WebGL: the context's draw calls. WebGPU: the
  draws of every render pass begun in the realm while attached (a render
  pass does not say whose it is). Triangles are counted for triangle lists
  and strips; a pipeline made before the profiler was attached counts as a
  list; indirect draws are counted as draws only.
- **GPU time.** WebGL 2: one disjoint timer query round the frame, where the
  browser has the extension. WebGPU: a pair of timestamps on each render
  pass begun between `beginFrame()` and `endFrame()`, summed. It needs the
  device's `timestamp-query` feature (the device LayaAir made on the
  desktop measured has it), times the first 32 render passes of a frame,
  and leaves compute passes and copies out. A frame's time arrives a frame or more
  later; until then, and whenever the GPU does not say, `gpuMs` is absent
  and `report().gpuTimeReason` says why. CPU time never stands in for it.
- `report().sources` says where each number came from.

In the check, ten more boxes are ten more draws and 120 more triangles on
both backends. 500 sheets of glass over the view take a frame's GPU time,
on an Apple M4 over six and five runs, from 0.3 to 1.6 ms up to 1.9 to
3.0 ms by WebGL's timer, and from 0.1 to 0.5 ms up to 3.9 to 9.0 ms by
WebGPU's timestamps.

## A shader that does not compile

LayaAir gives a failed compile's words to the console, without the source.
On WebGL the pass is then skipped, so a wrong shader is a thing that is
simply not drawn; on WebGPU the draw throws. `context.renderer.errors`
holds, on both, the compiler's log and the lines round the one it names:

```text
Shader compile failed (fragment): ERROR: 0:84: 'notDeclared' : undeclared identifier
82: vec4 zhudaSurface(vec2 uv,vec3 p,vec3 n){
83: float ok=1.0;
84: return vec4(notDeclared,ok);
85: }
```

Up to 64 entries. `zhudaShaderErrorExcerpt(log, source, stage)` is the
format; `reportZhudaWebGLShaderErrors(gl, errors)` is what `ZhudaEngine.boot`
puts on a WebGL context (it reads the compile status right after the
compile, which LayaAir does itself).

## The transform gizmo

```ts
import { ZhudaTransformGizmo } from 'zhuda-laya-engine';

const gizmo = new ZhudaTransformGizmo(scene3D, camera, {
  mode: 'translate', // 'rotate', 'scale'
  space: 'world', // or 'local'
  snap: { translate: 0.5, rotate: 15 },
  onChange: (node) => save(node),
});
gizmo.attach(node);

canvas.addEventListener('pointerdown', (event) => {
  const box = canvas.getBoundingClientRect();
  // true: a handle is under the pointer, and the pointer is the gizmo's
  if (!gizmo.pointerDown(event.clientX - box.left, event.clientY - box.top, box.width, box.height))
    startOrbit(event);
});
// pointermove -> gizmo.pointerMove(...), pointerup -> gizmo.pointerUp()
// every frame
gizmo.update();
```

- Three handles at the node, the same size on the screen however far it
  is (`size`, a share of the view's height): arrows to move along an axis,
  rings to turn about one, boxes to scale along the node's own.
- It listens to nothing and has no clock: the caller hands it the pointer
  in CSS pixels from the view's top left corner, and decides what else the
  pointer does.
- A drag moves the node as far as the pointer moved along the handle on
  the screen. `cancel()` puts the node back where the drag began.
- `gizmo.axis` is the handle being dragged or under the pointer (it is
  drawn yellow); `gizmo.dragging` says which.
- The arithmetic is usable alone: `zhudaPointerRay`, `zhudaRayAxis`,
  `zhudaAlongAxis`, `zhudaRayPlane`, `zhudaAngleRound`, `zhudaGizmoHit`.

### In the model editor

`zhuda-model-editor` has **Move**, **Turn** and **Scale** on the selected
node, its position, rotation and scale as numbers, and **Reset transform**.
The asset is not written: the numbers are for a prefab's placement.

Its view now turns with a drag and zooms with the wheel. It never did: the
editor did not keep its camera, so both did nothing.

## Limits

- One desktop GPU and one browser; no phone.
- WebGPU GPU time is the render passes' only, and at most 32 of them a
  frame. Chrome rounds timestamps to 0.1 ms.
- The WebGL timer needs `EXT_disjoint_timer_query_webgl2`; where a browser
  does not have it, `enableGpuTiming` returns false and says so.
- The gizmo has no plane handles, no screen-space handle and no handle for
  all three axes at once; a scale is always along the node's own axes.
- The film host has no gizmo: it has no pointer.
- Lines are one pixel wide.
