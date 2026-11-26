# Route: a pop-up papercraft diorama, with no picture or model files

A scene that looks hand-made of card: a miniature world standing on the open pages of a
thick book, every piece a folded, slotted or layered sheet with a printed face and a cut
edge, lit softly and seen through a long lens from above. It is a style for 3D scenes,
small games, pages and animations whose every surface is drawn by code. The rules and
numbers come from an outside agent skill written for Three.js; this page restates them and
sets them against this engine. Nothing of it has been built here yet.

- **Id:** `papercraft-diorama`
- **Kind:** workflow
- **For:** A scene, mini-game or page in a handmade pop-up book style (paper diorama, origami or cardstock look) made of code alone: the six marks of the look, the six paper structures, folding shut without anything going through the page, the rules against misalignment and flicker, three light presets, and what this engine has for each.
- **Checked on:** nothing drawn here; the source skill targets Three.js in a desktop browser
- **Status:** 2026-11-26: written from the outside skill as the owner passed it on. The
  engine side is a reading of this repository's documents and API. Nothing here was built or
  drawn in this engine, so every "in this engine" line is a place to start, not a result.
- **Reference consumer:** the agent skill `xikhar/papercraft` on GitHub (MIT licence; Three.js
  and Canvas 2D) and a summary of it with field notes on alignment, folding and flicker that
  the owner passed on. Outside this repository: its rules and numbers are restated here, no
  file of it is copied.
- **Engine version:** zhuda-laya-engine 2.0.1, for the comparison only.

## When to take this route

When the request is a pop-up book, a papercraft world, a miniature paper model, or "a 3D
scene with no downloaded assets" that must not look like plain low-poly blocks. Take
[film-as-data](film-as-data.md) and [good-looking-3d-scene](good-looking-3d-scene.md) for the
scene and its look, [interactive-film-viewer](interactive-film-viewer.md) to show it on a
page, and [third-person-town-3d](third-person-town-3d.md) when a character walks in it. It
does not fit a realistic scene, or one built from authored models and photographs.

## Tools

- The source: `https://github.com/xikhar/papercraft` (MIT), an agent skill; it needs only a
  browser, Three.js, a 2D canvas for textures and the Web Audio API.
- In this engine, by reading (none drawn):

| The look needs | In this engine |
| --- | --- |
| Matte card: roughness 0.90 to 0.96, no metal | a flat material with `roughness` and `metallic: 0` (film scenes, `materials`) |
| Paper tooth and printed faces drawn by code | a texture recipe baked on the CPU ([procedural assets](../procedural-assets.md)); a file through `picture` is the other way and is not "code alone" |
| Sheets with thickness, cut edges, closed gables, arches with a hole | `box` with `bevel`, `extrude` with `holes`, `lathe`, `sweep`; `createZhudaExtrudeMesh` stands from y = 0 to its height and `transformZhudaMesh` turns it (a positive `pitchDeg` leans the top towards +Z) |
| Soft shadow tinted by the world | `look.shadows` (`softness: "soft"`, `resolution`, `spread`, `contact`) with `ambient` for the sky's colour and `ambientGround` for the ground's |
| A long lens from above with real blur in front and behind | `camera.focalLengthMm` 39 to 48 (a field of view 34 to 28 degrees high), `fStop`, `focusDistanceM`, and `look.depthOfField` |
| A height to walk on and boxes to bump into | `stage.raycast`, `stage.solids`, `film_scene_query` with `heights` |
| Sound made in the page | the engine's sound recipes ([procedural assets](../procedural-assets.md#sound-recipes)) |

## Steps

The source's order: look first, then structure, then the hard rules, then motion and light.

1. **The carrier.** The scene stands on the two pages of a thick hardbound book lying open on
   a table: a crease down the middle (the gutter), a printed double border, the table showing
   round it, and the shore of the scene crowded with small things (steps, lamps, posts,
   stalls). A scene that floats in nothing, or is sparse, does not read as a pop-up book.
2. **Card, not plastic.** Every material is matte: roughness 0.90 to 0.96, no metal, with
   paper tooth (random grain and short fibre strokes) drawn into its texture.
3. **Printed faces, one per side.** Each building, tree and ground piece is a drawing of
   layered colour blocks, window grids, tiles and fold lines. The front of a building and its
   sides and back are different drawings: a door on all four walls gives it away.
4. **Thickness and cut edges.** Every standing sheet and wall has real thickness (a box, or
   three sheets as a sandwich), a thin dark ink line round it, and the warm off-white of the
   paper's core (`#efe5d1`) on its cut edge. A sheet with no thickness vanishes from the side.
5. **Six structures, and nothing else.** Take every object apart into these, never a sphere
   or a cone:
   - *Slotted crosses*: two cut-out sheets through each other at 90 degrees, for trees,
     bushes, reeds, flowers, torches.
   - *Layered flats*: cut silhouettes set one behind another, for far hills, clouds, gates,
     shop signs, grass in front.
   - *Folded boxes and closed gables*: a box with eave flaps and a pitched roof whose two ends
     are closed by extruded triangles (a stepped gable with its cap tiles, for a water town),
     never left open; doors and window trim only on the side that faces the street or the
     water.
   - *Solid arches and curved folds*: a bridge is deck segments and rails, and on both sides
     an extruded wall with the arch cut out of it, reaching down to the water with its piers.
     A deck alone hangs like a ribbon.
   - *Water printed with a clear channel*: where a boat travels, the water's wave cards run
     along the two banks and leave the middle open, so the hull does not cut through cards
     that lie across it.
   - *Decks to walk on, and colliders made with the things*: bridges and steps are one
     continuous height function of x and z; a building's collision box is pushed into the
     list where the building is made, from its real place and size. Two hand-written copies
     of the same coordinates drift apart.
6. **Snap to the print.** When the ground is printed with tile joints in rows and columns,
   every building is turned by 0 or a multiple of 90 degrees, and its width, depth and centre
   are worked out from the rows and columns, so its foot runs along the joints, the bank and
   the gutter. No small angles "for life".
7. **Fold without going through the page.** Three mechanisms, by kind of piece:
   - *Hinge* for flat pieces (trees, hills, figures, lamps, wave cards): the hinge is the
     bottom edge at y = 0; lying flat, no part is below the page.
   - *Parallelogram* for boxes (houses, bridges, boats, stalls): never turn a box about its
     centre, which puts its back half through the table; collapse it like a parallelogram,
     its height scaled down to about 0.025 with a small slide along the fold.
   - *Float* for what is in the air (clouds, paper cranes): in the same fold state, coming
     down and closing as the book closes; nothing stays in the air over a shut book.
   The spring that opens the book ends with a lock: when the distance to the target is under
   0.0008, set the target, so no piece is left slightly tilted.
8. **No two faces in one plane.** Neighbouring or nested pieces never share a plane: leave
   0.02 or more (the deck narrower than the gap between the two arch walls, the piers
   narrower still), and give overlapping repeated segments (deck boards, rails) an
   alternating offset of 0.003. Otherwise stripes and shadow flicker appear as the camera
   moves.
9. **Light, in presets.** At least one set to switch between, never plain white or a blue
   gradient. The source's three, as Three.js values (the intensities are its units, not this
   engine's):

   | Preset | Background and fog | Key light | Sky / ground fill | Windows, lanterns, lamps |
   | --- | --- | --- | --- | --- |
   | Morning | `#e5dac7` | `#fff5e2`, 1.45 | `#fff7e8` / `#8d7a64` | low, 0.18 |
   | Golden dusk | `#dfc1a6` | `#ffad69`, 1.55, low angle | `#ffd2a8` / `#5f4959` | warm orange, 1.15 |
   | Lantern night | `#2b3242` | `#9eb6d9`, 0.55 | `#4a5a7a` / `#241e22` | strong amber, 2.35 |

   Shadows are soft, 2048 pixels, and take the fill's colour (warm brown, dusk violet, night
   indigo): never dead black, never jagged.
10. **A long lens from above.** A narrow field of view, 28 to 34 degrees, looking down at an
    angle, with what is nearest and farthest out of focus. The source fakes the blur with a
    CSS backdrop filter under a gradient mask at the top and bottom of the page; a wide lens
    or a dark vignette alone does not pass for it.
11. **Life.** A hero that is a thick card figure on a round paper base, turning to face the
    viewer, with a small sway and hop as it walks, tied to the height function and to what is
    walkable. Trees, hanging lanterns and clouds sway out of step with each other, by 0.03 to
    0.08. Sound is made in the page from filtered noise (a band-pass): a page turning, crisp
    paper footsteps, a card springing on a jump, a pentatonic note for a pickup; with a mute
    switch.
12. **Look again, at most twice.** Turn the view and check that every foot is on a joint,
    every gable closed, the bridge solid with its opening, no boat through a wave card; drag
    the camera and watch bridge sides, corners and stair joints for stripes; close the book to
    0 and check that nothing is under the page and that boats, water, clouds and pickups are
    flat; then keys, jump, the height across the bridge, the colliders' edges, the light
    presets and the mute switch.

## Pitfalls

Most costly first, as the source ranks them.

- **Low-poly blocks in paper colours.** Plain coloured materials without grain or print. The
  print is the look: step 3 before any geometry is refined.
- **A box folded by turning it about its centre.** Its back half goes through the page and
  the table. Use the parallelogram collapse.
- **Flicker along bridges and stairs.** Faces in one plane, or repeated segments exactly
  overlapping. Step 8.
- **Buildings a few degrees off the tile joints.** It reads as a mistake, not as charm.
- **Open roof ends.** Light shows through the gable; close both ends.
- **The same face on four sides.** A door and its decorations on every wall.
- **A bridge that is only a deck.** No side walls, no piers: a strip of paper in the air.
- **A boat cutting through water cards.** Leave the channel clear.
- **Things left in the air over a shut book.** Clouds and pickups belong to the fold state.
- **Blur faked by a vignette, or by a wide lens.** Neither is a long lens with a shallow focus.

## Engine gaps and their workarounds

None of these has been tried: each is what reading the engine suggests.

- **A printed face drawn at run time.** The source draws each face on a 2D canvas and uses it
  as a texture. Here a face would be a texture recipe (grain and tiles are in reach; a facade
  with its own windows and door as a recipe is not known to work) or a picture file, which is
  no longer "code alone". Open.
- **Folding.** A film scene is data and its boxes and shapes do not move by data (`motion` is
  for models). A fold needs the consumer's own nodes moved every frame, or one scene mounted
  for each state; neither is drawn here. Open.
- **The blur.** A CSS filter over the canvas is the source's trick. Here the camera's
  `fStop` and `focusDistanceM` with `look.depthOfField` give real blur by distance; it is
  dropped at quality level 1 and below.
- **Numbers that do not carry over.** The light intensities, the shadow bias (-0.0006) and
  the PCF shadow type are Three.js's. Start from the colours and set strengths by looking.

## Checks

None was run here. When a scene is built on this route, its checks are step 12, each with a
picture: every view turned once, the camera dragged along the bridge, the book at 0, 50 and
100, and the three light presets.

## Not checked

- Everything: no scene of this kind has been built or drawn in this engine.
- Whether the engine's shadows, at the settings above, give the soft tinted shadow the look
  asks for, and what the fold costs in frames.
- A phone; touch.
- The source skill itself was not run; its rules are taken as written.

## Boundaries

The scene, its structures, the fold state, the hero and the sounds are the consumer's. The
engine gives materials, shapes, light, the lens and the stage. If a papercraft scene is built
and holds up, its reusable parts (a card material with grain, the three folds, the book)
belong in the prefab library, with their own checks.
