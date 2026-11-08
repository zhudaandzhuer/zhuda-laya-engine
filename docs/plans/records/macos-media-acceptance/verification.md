# macOS WebView and video verification

## Environment

- Host: macOS 27.0.1, arm64 Apple M4
- Node: v26.12.0 (the repository example recommends Node 24 LTS for Forge)
- Electron: 36.9.5
- Chromium: 136.0.7103.177
- Engine: `v1.15.0` source checkout
- Implementation: commit `test: add macOS media acceptance to desktop host`

## Commands

Development host:

```sh
ZHUDA_WEB_ROOT=/tmp/zhuda-macos-media-fixture/web \
ZHUDA_ENTRY=index.html \
ZHUDA_WINDOWS_WEBGPU_OUT=/tmp/zhuda-macos-media-fixture/evidence \
node_modules/.bin/electron . --verify --verify-media
```

Packaged host:

```sh
ZHUDA_WINDOWS_WEBGPU_OUT=/tmp/zhuda-macos-media-fixture/packaged-evidence-final2 \
/tmp/zhuda-macos-media-fixture/ZhudaMacOSMediaAcceptance-final2.app/Contents/MacOS/ZhudaMacOSMediaAcceptance \
--verify --verify-media
```

The packaged app was assembled from the pinned Electron 36.9.5 macOS arm64
archive with `app.asar`; it reports `packaged:true`. Electron Forge and
Electron Packager did not complete under the host's Node 26 runtime, so this
run does not claim a Forge installer or signing result.

## Results

| Check | Result |
| --- | --- |
| macOS packaged app | PASS (`os: darwin`, `packaged: true`) |
| WebGPU renderer | PASS (`selected: webgpu`, `WebGPURenderEngine`, ready, non-fallback Apple Metal adapter) |
| WebView DOM boundary | PASS (probe point hit `layaCanvas`; adapter `pointer-events: none`) |
| Laya UI input under WebView | PASS (real host events produced 2 `MOUSE_DOWN`, 2 `MOUSE_UP` and 2 `CLICK` callbacks) |
| Laya video surface | PASS (`decoder`, attached to `MediaAcceptanceRoot`, `readyState: 4`, playing) |
| WebView adapter lifecycle | PASS (mount/update recorded; dispose count 1; element removed) |
| Video lifecycle | PASS (source cleared, detached, destroyed after dispose) |

The report is stored outside the engine repository at
`/tmp/zhuda-macos-media-fixture/packaged-evidence-final2/report.json`.

## Limits

This is a desktop Electron/macOS acceptance. It does not establish native
iOS/Android WebView behavior, WebView2 parity, every browser codec, autoplay
policy on mobile, code signing, notarization, or a consumer's own native
adapter. The Laya UI callback is consumer-specific; this gate checks the DOM
hit boundary and reports whether the real host input reached the canvas.
