# SVG layout wireframes

Layout work does not depend on a model guessing coordinates. A consumer can
author a screenshot wireframe in SVG, convert its marked rectangles into a
versioned JSON contract, and use the same IDs while implementing Prefabs and a
Scene.

The contract uses design/CSS pixels. It is independent from browser DPR,
backing pixels and the final responsive viewport. The source screenshot is
reference material; the JSON contract is the machine-readable authority.

## Workflow

Create an SVG with a `0 0 WIDTH HEIGHT` viewBox. Mark each UI rectangle with a
stable `data-layout-id`; optional data attributes describe the component:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
  <rect data-layout-id="hud.balance" data-kind="text"
        data-anchor="top-left" x="48" y="32" width="220" height="56" />
  <rect data-layout-id="hud.spin" data-kind="button"
        data-anchor="bottom-right" data-states="idle,pressed,disabled"
        x="1010" y="590" width="220" height="86" />
</svg>
```

Use the public CLI from the consumer root:

```sh
zhuda-layout from-svg \
  --root . \
  --svg layouts/home.svg \
  --source reference/home.png \
  --id scene/home \
  --output layouts/home.json

zhuda-layout validate --root . \
  --layout layouts/home.json --svg layouts/home.svg

zhuda-layout preview --root . \
  --layout layouts/home.json \
  --output dist/layout-home.html
```

Open `dist/layout-home.html` in a browser. It is self-contained: it embeds the
source image, draws the SVG overlay, lists every stable node, and shows the
selected rectangle's coordinates. No network or model is needed.

## Contract and Prefab integration

The generated JSON contains the source image path, byte count, dimensions and
SHA-256, the design canvas, stable node IDs, rectangles, anchors, parents,
states and optional safe areas. A consumer can put the contract and SVG under
version control and opt into the build gate:

```json
{
  "layoutContracts": [
    { "layout": "layouts/home.json", "svg": "layouts/home.svg" }
  ]
}
```

The build verifies the source image hash and dimensions, the layout schema,
parent references and cycles, and that every SVG rectangle matches the JSON.
An invalid or stale wireframe stops the build before the Scene is published.

Prefab code should use the IDs as its mapping layer. For example,
`hud.balance` can map to a `Label` Prefab node and `hud.spin` to a Button
Prefab. The SVG does not replace the Prefab, Laya renderer or runtime input;
it makes the intended geometry explicit before those are implemented. After
the Prefab is built, use `zhuda-prefab-check` for actual rendered evidence at
the required viewport and DPR.

## Limits

Only explicit rectangle metadata is imported. Arbitrary SVG filters, paths,
text metrics and transforms remain artwork and are not treated as layout
geometry. A model or OCR tool may suggest initial rectangles, but the accepted
SVG/JSON contract must be reviewed and committed by the consumer.
