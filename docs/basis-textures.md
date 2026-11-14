# KTX 2 / Basis textures

A PNG or JPEG is small to download and large in memory: it is decoded to
four bytes a pixel, so a 2048 by 2048 map with its mip levels takes 22 MB of
the graphics card. A KTX 2 texture with a Basis Universal payload is
transcoded on the device to a block format the card samples as it is:

| Target | Chosen when | Bytes a pixel | A 2048 map with mip levels |
| --- | --- | --- | --- |
| `astc-4x4` | the card has ASTC and the file is UASTC | 1 | 5.6 MB |
| `etc2-rgba` / `etc2-rgb` | the card has ETC2 | 1 / 0.5 | 5.6 / 2.8 MB |
| `bc3` / `bc1` | the card has S3TC (desktops) | 1 / 0.5 | 5.6 / 2.8 MB |
| `rgba8` | nothing fits | 4 | 22.4 MB |

LayaAir 3.4.2 reads KTX 1 and DDS and refuses KTX 2. Here the file is
transcoded by the Basis transcoder (`vendor/basis`, Apache-2.0) and handed
to LayaAir's own parsers, so the upload is LayaAir's on WebGL and on WebGPU.

## Bring the transcoder

The transcoder is 0.6 MB of script and WebAssembly. It is not in the engine
bundle: a game that uses KTX 2 textures asks its build for it.

```json
{ "basis": true }
```

in `zhuda.config.json` copies it to `libs/basis/` of the build, with its
licence in `zhuda-notices/`. In a page:

```ts
const transcoder = await loadZhudaBasisTranscoder(); // libs/basis/, once for the page
```

The script tag carries its integrity value and the WebAssembly bytes are
checked against their SHA-256 before they run. In a mini-game, or where the
script is bundled, hand both over yourself:

```ts
const transcoder = await ZhudaBasisTranscoder.create({ factory: BASIS, wasm: bytes });
```

## In a model

```ts
const library = new ZhudaModelLibrary({ provider, basisTranscoder: transcoder });
```

A texture with `KHR_texture_basisu` then loads its KTX 2 image. Without a
transcoder it loads its fallback image and the model's report carries
`BASIS_TRANSCODER_MISSING`; a model whose only image is KTX 2 is refused
with that report. Embedded images only, as for every model the library
loads.

## A texture by itself

```ts
const texture = createZhudaBasisTexture(transcoder, bytes, { role: 'color' });
material.albedoTexture = texture; // texture.zhudaBasis: { target, levels, bytes }
```

`role` says how the colours are read (`'color'` and `'emission'` as sRGB,
`'normal'` and `'data'` as they are); left out, the file says so itself.
`target` forces a format. `inspectZhudaKtx2(bytes)` reads a file's size,
levels, alpha and kind without a transcoder, and
`chooseZhudaBasisTarget(zhudaBasisSupport(), info)` is the choice made for it.

## What it does and does not do

- The file's own mip levels are uploaded: nothing is generated on the
  device. A file without them has one level and shimmers when drawn small.
- A width or height that is not a multiple of four has no block format and
  is uploaded as RGBA.
- UASTC goes to ASTC first (the same blocks), ETC1S to ETC2 first (its
  blocks are ETC1 blocks) and never to ASTC.
- An S3TC colour map with mip levels is given the graphics card's own sRGB
  decoding. LayaAir by itself reads such a texture raw and converts in the
  shader with a power of 2.2: dark colours came out darker (26 of 255 drawn
  as 19) and neighbouring texels were blended on encoded values.
- On WebGPU the engine now asks for the compressed-texture features the
  adapter has (LayaAir asks for none, and then reports no block format).
- Not read: BC7 (LayaAir has no such format), PVRTC, ETC1-only devices,
  cube, array and volume textures, HDR, external (not embedded) KTX 2 images
  of a model.
- No encoder is shipped. Textures are made with `basisu`, `toktx` or
  `gltf-transform`; `zhuda-laya-lod` does not write KTX 2 yet.
- Transcoding runs on the calling thread, behind the loading screen.

Checked with `npm run verify:basis-textures` on desktop WebGL and WebGPU and
on a vivo V40: every target against the same pixels uploaded uncompressed,
with and without alpha, the file's own mip levels, a Zstandard file, and a
model. The check's files are made of one-colour blocks: they prove the path,
not an encoder's quality, and their transcoding time flatters real textures.
[Record](plans/records/basis-textures/verification.md).
