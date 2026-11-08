# Layout, art text and video contracts

The public SDK now has one deterministic calculation path for common 2D layout.
`computeZhudaGridLayout` accepts CSS viewport pixels, a design resolution, safe
area insets and a grid definition. Its cells are returned in viewport pixels;
DPR is intentionally absent because it only changes the canvas backing buffer.
Use the same report in the Prefab preview and the Scene renderer.

`computeZhudaTextLayout` takes measured Laya text metrics (`textWidth`,
`textHeight` and baseline) and returns the aligned rectangle and baseline. It
can report overflow or shrink to a declared minimum scale; it never guesses a
font's metrics. This keeps font fallback and asset loading visible to the
consumer's evidence instead of hiding a one-pixel shift.

Bitmap art text is described by `ZhudaBitmapFontManifest`. Run
`validateZhudaBitmapFont(manifest, text)` before registration to catch duplicate
glyphs, missing characters without a declared fallback, invalid advances and an
invalid fallback glyph.
`measureZhudaBitmapText` returns deterministic width and line height from the
authored advances. The texture and font registration remain consumer-owned
assets and must go through the normal AssetProvider/Prefab gate.

`createZhudaBitmapFont` converts the same validated manifest into a vendor
`Laya.BitmapFont`, registers it through `Laya.Text.registerBitmapFont`, and can
be paired with `measureZhudaBitmapText` before a text node is shown. The
consumer still owns the texture lease and must unregister the font when the
scene is disposed.

`ZhudaVideoSurface` wraps the upstream LayaAir `VideoNode` and owns its parent
attachment and disposal. The default `decoder` mode captures frames into the
Laya hierarchy; `player` mode is a floating platform video and cannot be
treated as a child node. `ZhudaWebViewSurface` is intentionally different: it
mounts a consumer-provided native/DOM adapter beside a Laya anchor and sends
every frame, visibility and transform update to that adapter. This makes the
canvas boundary explicit and prevents an untracked iframe from stealing input.
Autoplay, codec support, mobile gesture requirements, WebView2 and native
platform behavior still require target-device evidence.
