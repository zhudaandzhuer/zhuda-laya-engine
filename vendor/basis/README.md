# Basis Universal transcoder provenance

KTX 2 / Basis textures (`packages/core/runtime3d/BasisTexture.ts`) are
transcoded by the Basis Universal transcoder of
[Binomial LLC](https://github.com/BinomialLLC/basis_universal), Apache-2.0.

The two files here are the build that ships in the npm package
`three@0.187.0` (`examples/jsm/libs/basis/`), copied unchanged:

| File | Bytes | SHA-256 |
| --- | --- | --- |
| `basis_transcoder.js` | 57 529 | `8478b5b6d6b74e7d3082b89f6417321d8d1dc0307f2b30d4484bb11b441696a1` |
| `basis_transcoder.wasm` | 527 333 | `6cf17dc889352c42e9acf8897107978d127005fe3386c36a0e3845e27967630a` |

`tests/basis-texture.test.mjs` checks the bytes against these hashes and
against `ZHUDA_BASIS_WASM_SHA256`; `ZhudaBasisTranscoder.create` checks the
WebAssembly bytes it is given against the same hash before it starts them.

Nothing here is loaded by the engine by itself: a game that uses KTX 2
textures brings the script and the WebAssembly file (about 0.6 MB) and hands
them over. There is no runtime download from a CDN. No encoder is vendored:
textures are encoded with a tool of the game's choice (`basisu`, `toktx`,
`gltf-transform`).

The bundled SDK, consumer notices and browser SDK preserve [LICENSE.txt](LICENSE.txt).
