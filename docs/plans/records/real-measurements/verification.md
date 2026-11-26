# Verification: real-measurements

Run on 2026-11-25 in a cloud session (Node 24, no GPU, no npm registry).

| Check | Result |
| --- | --- |
| `games/zhuda-wardrobe`, `node tools/measure.mjs` | Body against ASTM D5585 size 8: 13 girths between 0.97 and 1.05 of the real ones (bust 87.2 of 88.9, waist 69.3 of 68.6, hip 92.5 of 95.3, neck 35.8 of 34.9, mid-thigh 52.2 of 50.2 cm), heights within 8 %, shoulder slope 25.4 against 23 degrees, foot 25.1 against 25.4 cm. Garments: 19 of 22 measurements inside the real range; outside are the T-shirt's hem over chest (1.14, real 0.9 to 1.05) and both skirts' hip ease (13.3 and 13.4 cm, real 4 to 10). |
| `games/zhuda-wardrobe`, `node tools/build-parts.mjs` | 32 parts over 153 poses: no skin through any of the 31 kit-made parts at 1 mm (3,189 vertices); of 91 overlapping kit pairs one clips (a high collar under long hair, 2.5 mm) and is kept apart, eight more are kept apart by their cut; the body stands out of none of the 17 parts with loose cloth at rest; nothing stands through the hat or the pack at rest (22 pairs). |
| `games/zhuda-wardrobe`, `node tools/look-report.mjs` | 32 parts alone and 24 sampled outfits, 1,066 views each, 501 s: kit-made, worst view 0.89 cm² seen through and 0.78 cm² of covered surface showing (limit 1 cm²). |
| `games/zhuda-wardrobe`, `npm run verify` | Build, typecheck, doctor and 11 tests pass. |
| Recorded run, `node ../tools/shot.mjs . --script tools/play.mjs` | Headless Chromium, real clicks: passes; the triangles the engine hides are the ones the mask files name. |

## Found on the way and kept as checks

- Skin outside a skirt's oval at rest was found by neither pose measure; only the picture showed
  it. Now measure three.
- A hair bun stood through the cone of the hat; hard objects are now checked at rest.

## Not verified

- No person compared the result with the photographs; the comparison is by measurement and by the
  author looking at software renders.
- Only the T-shirt, the trousers, two skirts, the hat and the pack were measured against
  specifications of their own; the other parts reuse their blocks.
- Four cuts at real lengths (a 43 cm skirt, three tops to the middle of the thigh) failed the
  pixel measure in the split kick and are not in the catalogue.
- No device, no GPU: software rendering and the kit's own rasteriser.
