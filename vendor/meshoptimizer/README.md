# Meshoptimizer decoder provenance

Optional embedded glTF Meshopt preprocessing uses the MIT-licensed
[meshoptimizer 1.3.0](https://github.com/zeux/meshoptimizer/tree/v1.3) npm package.
The dependency and npm artifact integrity are pinned in package-lock.json.

Decoder entry: meshopt_decoder.mjs, SHA-256:
`10b313edaa0e322b0c1b46443f6c8b186b42139fe1eca189d50c09511d0ebedc`.
`tests/meshopt-model.test.mjs` checks the installed bytes against the adapter.
WASM is embedded in that module; there is no runtime CDN download. The encoder
is used only to generate authored regression fixtures.

The bundled SDK, consumer notices and browser SDK preserve [LICENSE.txt](LICENSE.txt).
