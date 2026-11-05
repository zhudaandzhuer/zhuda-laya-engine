# Verification record: consumer-runtime-hardening

Task: [task.md](task.md)  
Date: 2026-11-05  
Source: the commit containing this record, based on
`f6726e7b3cd8e166a6afa21df038af22e2fc838a`; package version 1.4.0.

## Environment

- macOS Darwin 27 arm64, Node 26.12.0; Chrome 156.0.8078.80.
- Independent consumer: `/Users/yaowei/Desktop/zhuda-runtime-acceptance-20261105`.
- Consumer installed an npm-packed SDK, without source aliases or private imports.
- Candidate tarball SHA-256: `d6732f01b0684090ad7ba25612fc256ea6af70aa085fa3cd7d0e96e7ba63621d`.
  The later checker-only Label guard ran from this checkout; the runtime bundles
  were unchanged. This tarball is retained as the tested candidate, not a registry release.
- Local HTTP; checker measured viewport 640×360, DPR 1, backing 640×360.
  Interactive scene also ran at browser DPR 2 with render DPR capped at 1.

## Checks

All paths below are relative to the independent consumer unless absolute.

| Check | Command / procedure | Result | Artifact |
| --- | --- | --- | --- |
| Engine build, types, Doctor, regressions | `npm run verify` in engine | PASS, 143/143 tests | `engine-verify.log` |
| Consumer build, strict types, Doctor | `npm run verify` in consumer | PASS; Doctor scanned 3 consumer sources | `verify.log` |
| Public exports | ESM/CJS and strict consumer tests in engine verify | PASS | `engine-verify.log` |
| Doctor negative cases | missing/empty roots, cwd selection and actual bad import fixtures | PASS (reject invalid inputs with location) | same log |
| Real 3D draw | Open consumer index and isolated body; switch idle → turned | PASS on desktop | `evidence/scene-idle.png`, `scene-turned.png`, `preview-body.png` |
| Pixel comparison | command below, after reference inspection | PASS, 0 differing pixels | `evidence/body-pass.json` |
| Deliberately wrong state | replace `state=turned` with `state=idle` | Expected FAIL, 6867 differing pixels | `evidence/body-negative.json` |
| Audio | gesture unlock; WAV → MP3 crossfade; stop/unload, 30 cycles | PASS for decode/voice lifecycle | `evidence/audio-wav.json`, `audio-mp3.json`, `audio-cycles.json` |
| Prefab lifecycle | 30 create/dispose cycles | PASS | `evidence/prefab-cycles.json` |
| Repository hygiene | `git diff --check`; `git status --short` | PASS; intended source/generated changes | commit diff |
| Physical iOS/Android, audible speaker output | unavailable in this run | UNAVAILABLE | no device claim |

Reproduce the comparison with the consumer server running (port may differ):

```sh
node /absolute/path/to/engine/packages/compiler/prefab-check.mjs \
  '--url=http://127.0.0.1:51866/prefab-preview.html?id=neutral%2Fassembly&state=turned&node=Pivot%2FBody&width=640&height=360&dpr=1&cycles=30' \
  --baseline=evidence/body-reference.png --output=evidence/body-pass.json
```

## Lifecycle and failures

Regression fixtures cover provider/decode failure and retry, independent caller
cancellation, timeout, late decode, dispose, queue cancellation, invalid offsets,
PCM/voice limits, replacement capacity, focus cleanup and 30 load/unload cycles.
The browser finished with zero samples, pending loads, retained PCM and voices.
WAV and MP3 each decoded to 48000 mono frames (192000 retained PCM bytes).

3D create/dispose tests cover invalid paths, transactional state validation,
restoration, sockets, provenance and cancellation before allocation. Browser
resource counts matched before/after 30 cycles: 4 meshes, 12 textures, 4 render
targets, 29 total resources, estimated 2024484 bytes. Vendor counters are not a
physical GPU heap measurement. Context-loss recovery was not newly qualified.

## Prefab evidence

`neutral/assembly`, `Pivot/Body`, state `turned`, definition hash
`0106018c153bb64426458dc83683f9dae7104e406259350a6e004ded33067dcc`.
Reference was visually inspected: isolated blue box, rotated 45° with its parent;
unrelated floor, cone and marker hidden. It is a neutral authored fixture, not an
external art-fidelity claim. Reference capture initially returned FAIL as required;
only the subsequent comparison passed. Scene and preview instantiate the same
definition through `ZhudaPrefabLibrary`. The report records payload fingerprint,
image hashes, requested and measured environment independently.

## Limits and decision

**Implemented for the desktop scope; cross-device acceptance remains deferred.**
No claim for mobile audio codecs/autoplay, physical speakers, mobile GPU drivers,
streaming/spatial audio or exact GPU memory. Primitive trees do not provide
external textures, arbitrary factories or spline meshes. Full vendor declaration
repair and selective evidence dependency tracking remain deferred. `skipLibCheck`
continues to isolate the documented vendor debt while consumer code is strict.
