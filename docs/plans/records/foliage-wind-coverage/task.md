# Task: foliage that moves in the wind and stays full in the distance

Status: Implemented within scope; desktop WebGL and WebGPU verified
Owner: engine
Last reviewed: 2026-11-16

## Source requirement

The user, looking at a consumer game (豬大時空3D, Poly Haven trees through
the glTF loader), 2026-11-16: 「大樹很像真的了，但是樹葉以及他的樣子還不是那麼真」
— the big trees look nearly real, but the leaves and how they look are not.

Found on that game's pictures (high setting, desktop):

1. Nothing moves. Leaves, branches and shrubs stand still in a scene whose
   grass, water and clouds move.
2. Crowns at a distance break into a sparse dotted cloud with the pale sky in
   the gaps. A cut-out leaf picture loses coverage as it is minified: its
   smaller mipmaps average the alpha toward the background, and more of each
   leaf falls under the cut-off. The far levels of detail have fewer leaves
   to begin with.

## Goal

- Foliage wind for any material drawn with LayaAir 3.4.2's PBR shaders
  (`ZHUDA_WIND` on the material):
  - the whole plant leans and sways with gusts, more the higher up;
  - cut-out leaves also flutter;
  - the same displacement is applied in the visible pass and in the shadow
    and depth passes, so the leaves and their shadows move together.
  - A scene-wide `ZhudaFoliageWind` sets direction, strength and time.
- Coverage kept at a distance for cut-out materials of LayaAir's glTF shader
  (`ZHUDA_KEEP_COVERAGE`): the alpha that is tested is raised by the mip level
  the texture is read at (by a quarter a level), in the visible, shadow and
  depth passes.
- `zhudaMarkFoliage(root, options)` sets these on the materials under a node
  and takes them off again on dispose.
- Build time: `zhuda-laya-crown` (`packages/compiler/model-crown.mjs`) shades
  the inside of a tree's crown. It fits an ellipsoid round the cut-out leaves
  and writes a grey `COLOR_0`, darker toward the middle and the bottom.
  A leaf card is lit alone, so without this a crown is as bright inside as out.

## Invariants

- A material without the defines compiles to LayaAir's own code.
- The wind uses no clock of its own: the caller passes the seconds (the
  runtime's clock), like `ZhudaWaterSurface.setTime`.
- Shared materials: marking adds defines to the shared glTF materials of a
  model, so every copy of the model sways together. Dispose removes only the
  defines the mark added.

## Dependencies

- `Laya342Adapters`-style include patches: `Sprite3DVertex.glsl`,
  `ShadingVertex.glsl`, `DepthVertex.glsl`, `glTFMetallicRoughness.glsl`, and
  the glTF shader's depth passes through `SubShader.addShaderPass`.
- The `Scene3D` global uniform map (as `PointShadow`) for `u_ZhudaWind`.

## Non-goals

- Bending normals with the wind (the displacement is centimetres).
- Motion vectors of swaying leaves (TAA and motion blur see them still).
- New leaf geometry or textures; levels of detail stay the consumer's.

## Acceptance checks

1. Unit tests:
   - the TypeScript wind offset: none at the base, more with height, a
     flutter only on leaves, bounded;
   - each include patch applies, and a changed upstream is left alone;
   - mark and dispose add and remove exactly their defines.
2. A real draw on WebGL and WebGPU, through a fixture with an alpha-tested
   "tree" in the sun:
   - marked leaves move between two times and unmarked ones do not;
   - the shadow on the ground moves with them;
   - with coverage kept, a far cut-out keeps about the coverage it has near,
     and without it, it loses it.
3. `npm run verify`, lint, format and `git diff --check`.

## Unverified limits

- Phones other than the vivo V40 (measured: no cost against the rest of the
  frame; see `verification.md`); consumer art direction (strength and
  direction are the game's).
