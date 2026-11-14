# Post-processing provenance: SMAA tables, and the constants of two tone curves

Nothing in this folder is loaded at run time. It records where three pieces
of `packages/core/runtime3d` come from, and carries their licences.

## SMAA lookup tables (`SmaaTables.ts`)

The area and the search table of SMAA 2.8 by Jorge Jimenez, Jose I.
Echevarria, Belen Masia, Fernando Navarro and Diego Gutierrez
([iryoku/smaa](https://github.com/iryoku/smaa), MIT), taken from the two
pictures that the npm package `three@0.187.0` (MIT) carries in
`examples/jsm/postprocessing/SMAAPass.js`:

| Source file | Bytes | SHA-256 |
| --- | --- | --- |
| `SMAAPass.js` | 50 379 | `1a96804b8cb33ba76a67f9a8e77f2d5e2bf47b1a5c9a8476901aa75e24acb85c` |

`node scripts/build-smaa-tables.mjs <three>/examples/jsm/postprocessing/SMAAPass.js`
decodes the two PNG pictures and writes `SmaaTables.ts`:

| Table | What is kept | Bytes | SHA-256 of the bytes |
| --- | --- | --- | --- |
| area | the first 80 by 80 texels of the 160 by 560 picture, red and green | 12 800 | `d6f73232a28d1261aa22173b223ccfca28c1eef17d470346aec26b1d4af20031` |
| search | the whole 66 by 33 picture, red | 2 178 | `e5d85ae5a659337e6d6654b85d2741a0b08a2c7d2eda200151fb0b3bd41e6966` |

SMAA 1x without diagonal patterns reads only that part of the area picture
(the orthogonal patterns of the first sub-sample row).
`tests/post-quality.test.mjs` checks the decoded bytes against these hashes
and this file against the constants in `SmaaTables.ts`.

## SMAA passes (`Smaa.ts`)

Written for this engine after the method of SMAA 2.8 (`SMAA.hlsl`), with
the WebGL port in `three@0.187.0`
`examples/jsm/shaders/SMAAShader.js` (SHA-256
`48ce320a6bf5c33806c4fa13ade7e3ab199f7856838d36b05ae82204db8a1c15`) read
alongside. The passes keep the reference's own picture coordinates and its
corner handling, and mix pixels as light; the port's changes of sign for
WebGL are not taken.

## Tone curve constants (`ToneCurves.ts`)

The matrices and the contrast polynomial of AgX and the constants of the
Khronos PBR Neutral curve are those of `three@0.187.0`
`src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js`
(SHA-256 `447958b93d07616c83d9273829ed810eb734d02ebbe60f12fc9bdda4f7928f44`).
three.js took AgX from Filament (Google, Apache-2.0), which follows Troy
Sobotka's AgX as used in Blender, and Neutral from the Khronos Group's
reference (Apache-2.0). The shader text and its CPU twin are this engine's.

## Licences

[LICENSE.txt](LICENSE.txt) holds the MIT licence of SMAA and of three.js.
The bundled SDK, consumer notices and the browser SDK preserve it.
