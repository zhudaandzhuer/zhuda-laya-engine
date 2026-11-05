# Public cinematic consumer fixture

`Main.ts` imports only `zhuda-laya-engine`. It demonstrates native bone/Morph
sampling, a neutral multi-depth lens chart, physical camera, exact offscreen
pixels, Filmic exposure and the existing mixer's offline score. The model and
chart objects in isolated checks are the same objects used in the final movie.

From an engine checkout:

```sh
npm run build
npm run verify:cinematic
```

The runner packs the SDK into `/tmp/zhuda-cinema/consumer`, copies the authored
neutral `tests/fixtures/gltf-review` assets, generates test PCM and a short
harmonic score, strictly checks public declarations and builds WebGL/WebGPU
through the installed compiler. It requires Chrome, FFmpeg and ffprobe. Override
`CINEMA_OUT` for evidence location and `CHROME_BIN` for the browser executable.
`CINEMA_BACKEND=webgl` limits a diagnostic run; it does not establish both-backend
acceptance. `CINEMA_SKIP_ENCODE=1` explicitly skips the video step.

Outputs include isolated/repeated images, depth/motion checks, DPR 1/2/3 output,
30 capture cycles, audio timing/gain checks, 4K24 PNGs, float WAV, encoded MP4 and
ffprobe metadata. Source/tarball hashes and actual adapter identity are recorded.
These are engineering fixtures, not a production scene or customer-art approval.
See [the full contract](../../docs/cinematics.md) and its explicit SDR/HDR limits.
