# HDR panoramas and the studio room

A photograph of the whole surroundings (a Radiance `.hdr` panorama, twice as
wide as tall) lights a scene the way the place it was taken in would: its
sky from above, its ground from below, its sun as a highlight on every
glossy thing. An 8-bit panorama cannot: its sun is no brighter than a white
wall. `ZhudaHdrEnvironment` takes the photograph and makes it the scene's
reflections, its ambient light and its sky.

```ts
const panorama = decodeRadianceHdr(bytes); // from the game's asset provider
const environment = new ZhudaHdrEnvironment(scene3D, { panorama }, { camera });
// ...
environment.setRotation(30); // light and sky together; nothing is filtered again
environment.dispose(); // the scene has back what it had
```

| Option | Default | |
| --- | --- | --- |
| `size` | 64 | Side of the largest level of the light, a power of two 8..256 |
| `samples` | 64 | Directions sampled a texel for the blurred levels |
| `exposure` | 1 | Scales the panorama, light and sky alike |
| `maxRadiance` | 4096 | The largest value kept: a photographed sun otherwise flickers in rough reflections |
| `rotationDeg` | 0 | Turns the surroundings about the vertical axis; positive moves them to the right |
| `reflection`, `ambient` | 1 | Scale the two parts of the light, 0..8 |
| `sky` | a panorama: yes | Draws the panorama as the sky and sets the camera to clear with it |
| `skyBlur` | 0 | 0..1: the sky as a surface of that roughness would reflect it, a backdrop that does not compete |
| `skyWidth` | 2048 | Widest sky texture; a wider panorama is made smaller |
| `format` | the best the device filters | `'float'`, `'half'` or `'rgbd'` (below) |

The middle of the panorama lies toward -Z, +X a quarter of its width to the
right, as glTF viewers and three.js read an equirectangular picture.

## Without a photograph: the studio room

```ts
new ZhudaHdrEnvironment(scene3D, { cube: zhudaStudioEnvironment() }, { camera });
```

A room of plain walls with a wide soft lamp overhead, a cooler window to one
side and two smaller lamps, made by the engine and the same every time: what
a model viewer, a shop or a menu needs to give a metal something to reflect.
It draws no sky; the camera keeps its own background.

## Where the light is kept

| Format | Bytes a texel | Chosen when |
| --- | --- | --- |
| `float` | 16 | the device filters 32-bit float textures |
| `half` | 8 | it does not, and filters 16-bit ones (every WebGL 2 device) |
| `rgbd` | 4 | neither: 8 bits a channel with a divisor, values to 255, coarse above 1 |

`zhudaEnvironmentFormats()` lists what this device has, best first.
`ZhudaEnvironmentProbe` stores its capture the same way, and a probe volume
(bounce light) falls back from 32-bit to 16-bit floats. A format the device
does not have is refused when asked for by name, never replaced.

## Limits

- Making the light is done on the processor: about 0.1 s on a desktop and
  0.3 s on a vivo V40 at the default size, more at a larger `size` or with
  more `samples`. Do it behind the loading screen. Turning costs nothing.
- One environment for a scene: the light is right for the whole scene as
  seen from far away, and nothing in the scene is reflected. For a room or a
  street use `ZhudaEnvironmentProbe`, which photographs the scene itself.
- The sun of a panorama casts no shadow: add a directional light where the
  sun stands for that.
- The sky is the panorama stretched over a dome: it has no depth, and a
  panorama narrower than about 4096 shows its pixels behind a long lens.
- Film scenes (`look.panorama`) still take a PNG or JPEG; `.hdr` there is
  not wired in.
- Not built: a prefilter on the graphics card, EXR, a ground projection
  (the panorama's floor as a floor under the model).

Checked with `npm run verify:hdr-environment` on desktop WebGL and WebGPU
and on a vivo V40. [Record](plans/records/hdr-environment/verification.md).
