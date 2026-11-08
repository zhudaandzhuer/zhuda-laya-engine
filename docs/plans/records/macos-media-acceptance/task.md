# macOS WebView and Laya video acceptance

Status: Accepted
Owner: Zhuda engine
Last reviewed: 2026-11-08

## Source requirement

Verify that the Electron macOS host does not let a consumer WebView surface
silently block Laya UI, and that a decoder-mode `ZhudaVideoSurface` remains a
real Laya `VideoNode` when packaged as a macOS app.

## Goal

Provide a repeatable host-level acceptance switch that sends a real mouse
event, records the media fixture report, and checks lifecycle disposal. Serve
common video assets with their actual MIME types.

## Invariants

- `ZhudaVideoSurface` is tested in `decoder` mode and is attached to a Laya
  parent node.
- WebView remains an explicit consumer adapter surface; the host does not add
  an unowned iframe or a second renderer.
- UI input is accepted only when the adapter declares a non-intercepting
  surface (`pointer-events: none`) for this fixture.
- WebGPU renderer acceptance remains a separate check from media behavior.
- This desktop check does not claim iOS, Android, WebView2, or codec coverage.

## Scope

- `examples/windows-webgpu/main.mjs`: media report collection, real input
  probe, media lifecycle gates, and video MIME entries.
- A temporary external fixture supplies the consumer-owned video and adapter;
  no game assets are committed to the engine.

## Non-goals

- Implementing a native WebView adapter in the engine.
- Claiming autoplay, codec, or native mobile behavior from an Electron run.
- Changing the Laya video or WebView public contracts.

## Acceptance checks

1. Development and packaged macOS runs report `os: darwin` and
   `packaged: true` respectively.
2. The fixture receives a real host mouse event while the WebView iframe
   overlaps the Laya UI probe.
3. The fixture reports a decoder-mode `VideoNode` with a parent and
   `readyState >= 2`.
4. The WebView adapter is mounted, receives updates, declares
   `pointer-events: none`, and is disposed.
5. After disposal the video node is detached/destroyed and the adapter element
   is removed.

## Unverified limits

- Native iOS/Android WebView adapters, WebView2, and every browser codec remain
  consumer/device checks.
