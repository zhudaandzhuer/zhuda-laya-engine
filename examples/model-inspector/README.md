# Neutral model inspection fixture

`asset.gltf` is an engine-authored triangle with one animated Morph. No seller or
third-party artwork is included. The browser compiler embeds this same document
in its isolated and composed model inspector; it is not a separate model copy
for each presentation mode.

Run `npm run build`, then `npm run build:browser -- --out /tmp/zhuda-browser-1.9`
and serve that output over HTTP. Open `example-3d-gltf.html`, or select
`?node=Probe&state=weighted&mode=raw` for isolated replay. The
[network SDK example](../browser-sdk/3d-gltf.html) uses the fixed hosted bundle.

See [public contracts and limits](../../docs/model-showcase.md). A triangle
regression proves importer semantics and repeatability, not commercial-model
quality, complete PBR conformance or Unreal Engine parity.
