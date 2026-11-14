# Agent task: specular-aa

Status: Implemented within scope; desktop WebGL and WebGPU verified\
Owner: Engine/toolchain\
Last reviewed: 2026-11-14 (reworked after review, then made opt-in at the merge; see the end)

## Source requirement

The three.js gap audit of 2026-11-14 (`records/threejs-gap-audit/plan.md`,
WP2; finding `materials/core-pbr-brdf`): LayaAir 3.4.2 ships a GLSL
`specularAA(roughness, normalWS)` that nothing calls, so dense normal maps
sparkle, worst on phones. three.js widens roughness on every physical
material. WP2 asks for a text patch like `installLaya342Translucency` that
calls Laya's `specularAA` in the PBR surface set-up (PBR, glTFPBR,
`ZhudaLitSurface`) behind a `ZHUDA_SPECULAR_AA` define, and optionally a
`ZHUDA_DITHER` 8-bit dither.

## Goal

A ball with a dense, mipmapped normal map, seen from a few metres under a
camera that moves by less than a pixel, sparkles far less with the patch:
fewer pixels pop, and a pixel changes less from frame to frame, in light and
as shown under a sun that clips. Its light stays near that of the same ball
drawn with many samples to a pixel (the truth). A smooth ball's highlight is
nearer the truth's, not blurred beyond it. What the patch cannot repair is
left exactly as it was. The plan asked for it on by default; after the
review and the rework it is off until a scene asks (see the end).

## Invariants

- LayaAir 3.4.2 vendor files are not modified; the patch is applied to the
  text as LayaAir registers it (`Shader3D.addInclude`,
  `SubShader.addShaderPass`), installed before `Laya.init`.
- Every anchor in the two includes (`PBRFrag.glsl`, `PBRLighting.glsl`) is
  checked exactly once; a missing one changes nothing, leaves the define
  off, and says why (`zhudaSpecularAAStatus().reason`, one console
  warning). Half a patch is no patch.
- A physically based forward pass whose normal-map read the patch does not
  know keeps the curvature term alone, and is named:
  `zhudaSpecularAAStatus().normalMapSkipped`, one console warning each.
- The define gates everything new but the `inout` surface of `getPixelInfo`
  and one local in the forward pass; without it the shaders draw what they
  drew.
- Derivatives and the second read of the normal map are taken where
  WebGPU's uniformity rule allows: outside any branch.
- Left as they were, to the level of 8-bit rounding: a normal map without
  mipmaps, a map seen at one texel to a pixel or closer (away from the rim
  of a ball, where it is squeezed), a map at no strength, a map on a mesh
  without tangents, a flat ambient light's reflection.
- The sun's light on a ball, measured with no other light in the scene,
  stays within 12 % of the truth's and no further from it than unpatched.
  It is not conserved exactly, and the record says by how much.
- No claim beyond what a script drew: desktop WebGL and WebGPU on one Apple
  M4. Phones, frame cost and art approval are not part of this task.

## Dependencies

- LayaAir 3.4.2 `PBRFrag.glsl` (`getPixelInfo`), `PBRLighting.glsl`
  (`specularAA`, `specularLobe`), `BRDF.glsl` (`visibility`, `INVERT_PI`,
  `saturateMediump`), the `PBR` and `glTFPBR` forward passes; the engine's
  `LitSurfaceTemplates` forward pass.
- `Shader3D._configDefineValues`, which every new `Scene3D` copies;
  `Material.setTextureByIndex`, through which LayaAir's materials, its glTF
  loader and the engine's factories set a normal map.
- `scripts/lib/chrome-fixture.mjs`, the browser SDK build.

## Scope

### Engine

- `packages/core/runtime3d/Laya342Adapters.ts`: `installLaya342SpecularAA`,
  `zhudaPatchSpecularAA`, `zhudaPatchSpecularLobe`, `zhudaPatchNormalLength`,
  `zhudaSpecularAAStatus`, `setZhudaSpecularAA`, `ZHUDA_SPECULAR_AA_DEFINE`,
  `ZHUDA_NORMAL_NOMIPMAP_DEFINE`.
- `packages/core/DeclarativeSDK.ts`: installed with the other 3.4.2 patches.
- `packages/core/runtime3d/index.ts`: the two defines, the status and the
  scene switch are public; regenerated `packages/types`.
- `tests/specular-aa.test.mjs`; `scripts/verify-specular-aa.mjs` with
  `tests/fixtures/specular-aa.ts`; `npm run verify:specular-aa`.

### Consumer or adapter

None. A game turns it on for a scene with `setZhudaSpecularAA(scene, true)`.
A material that is given a normal map without mipmaps by a path the engine
does not see (a `.lmat` file sets its textures without
`Material.setTextureByIndex`) can add `ZHUDA_NORMAL_NOMIPMAP` itself.

## Decisions

- **Default on, through a define.** The define is added to LayaAir's
  configuration defines once both includes are patched, so every scene made
  after boot has it; a scene can drop it. A material can add it for itself in
  a scene that dropped it, not remove it in one that has it.
- **Laya's `specularAA` on the mesh's own normal.** As WP2 asks, but not on
  the shading normal, which a normal map has already turned: from one pixel
  to the next that is a noisy estimate, it turned a map without mipmaps into
  dense grain, and the map has a better measure of its own (below). three.js
  takes the mesh's normal too (`nonPerturbedNormal`).
- **The normal map's own filtering, at its full strength.** A mipmap
  averages the bumps under a pixel into a shorter normal (Toksvig; a von
  Mises-Fisher lobe of concentration kappa). Normals spread with variance
  1/kappa to each side widen a lobe to alpha² + 2/kappa. The first version
  added a quarter of that, which is why its picture stayed grainy. The
  length is read one mipmap level up (the bumps under the pixel and its
  neighbours: steadier), fades in from two texels to a pixel to four, and
  is used only where the map has mipmaps.
- **The shape of a widened highlight.** The share of the width that comes
  from curvature falls off as a Gaussian, not as GGX, whose long tail drew a
  halo and a rim line on polished balls. The share that comes from the map
  keeps GGX (steadier; drawn both ways) but takes its visibility term at the
  bumps that shine, not at the surface as a whole, which lit a bumpy ball to
  its edge.
- **The gain for light scattered more than once stays the material's.** The
  wider highlight stands for bumps under a pixel, each as smooth as the
  material; worked out from the widened roughness it made a bumpy metal ball
  half as bright again as the truth.
- **A material knows when its normal map has no mipmaps.** Shortness of an
  unfiltered normal is chance; the sparkle is in the texture read, and no
  roughness repairs it. A second read of the map cannot tell on its own:
  LayaAir filters such a map anisotropically (level 4), so two reads differ
  without any mipmap.
- **No dither.** The engine's looks draw into an HDR target and grade it
  (`Filmic.ts`); a dither in the lit fragment would add noise in linear
  light, not at the 8-bit write. It belongs in the grade's output pass,
  outside this package. Proposed, not built.

## Non-goals

- Clear-coat roughness, sheen and the iridescent lobe keep their own shape
  and roughness (anisotropy reads the widened base roughness, as GGX).
- Blinn-Phong and unlit materials.
- Mipmaps for normal maps made with `createSurfaceTexture` (its default is
  none): such a map is left as it was, sparkle and all.
- Normal maps between two and four texels to a pixel look different, not
  better: see the record.
- Phones, frame budgets, art approval.

## Acceptance evidence

- `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.
- `npm run verify:specular-aa` on WebGL and with
  `SPECULAR_AA_RENDERER=webgpu`: against the truth, in light and in shown
  values, with pictures a person can look at.
- Existing draws that use the PBR shaders still pass, with it on by default
  (the state the rework was checked in) and with it off until asked (the
  state that was merged).

## Review of 2026-11-14 and what changed

The first version (commit `7eb53c2`) was reviewed and reworked. Each point,
and what was done:

1. *Flicker fell only in linear light under a dim sun; as shown under a
   game's sun it rose on metal, most without mipmaps; nothing was asserted
   on shown values; no truth was drawn.* Right. The normal-map term was a
   quarter of its strength and applied to maps without mipmaps. Now: the
   full term, from one level up; maps without mipmaps left alone; a truth of
   256 samples a pixel at eight camera offsets; assertions on shown values
   under the game's sun, on pops, and against the truth. Where the shown
   change still rises (two texels to a pixel) it is recorded with the
   truth's own change beside it and bounded.
2. *"As much light" passed by cancellation with the ambient light; against a
   reference the patched ball was 35 % too bright.* Right. The scene now has
   no ambient light; light is compared with the truth over the whole ball.
   The excess came from the gain for multiple scattering following the
   widened roughness, and from the visibility term at the rim; both are
   changed. Metal: 4 % over the truth (unpatched 16 %).
3. *Smooth balls were checked at the one roughness and size where the effect
   is smallest, inside 0.85 of the disc, with an assertion that could not
   fail; polished and small balls changed visibly and a rim line appeared.*
   Right. Seven balls are now drawn with their truth, unclipped, rim
   included. The halo and the rim line came from GGX's tail on the widened
   lobe; the curvature share now falls off as a Gaussian. The highlight's
   peak is nearer the truth than unpatched in every case; a highlight
   narrower than a pixel still changes (that is the anti-aliasing), and the
   docs say so.
4. *A forward pass whose anchors do not match was skipped silently; no
   runtime threw a `TypeError`.* Fixed: named in the status and warned of
   once; `setZhudaSpecularAA` says LayaAir is not loaded.
5. *A normal map on a mesh without tangents roughened a surface it was not
   applied to.* Fixed (`#ifdef TANGENT`), and drawn. The same held for a map
   at no strength: fixed (the normal scale squared), and drawn.
6. *The docs said a map without mipmaps "has nothing to read"; the term was
   applied to it.* Right; it no longer is, and the docs say what happens.

Also corrected: the first record called the ball's map "about seven texels
to a pixel"; it is about four at the middle of the ball (0.0125 m of the
ball to a pixel, 326 texels to a metre).

## Decision at the merge: off until a scene asks

The rework left three things its own record lists as limits: between two and
four texels to a pixel a bumpy metal changes more from frame to frame with
the patch than without (14 to 23 of 255), its rim is brighter than the
truth's (27 of 255 against 6), and one more read of the normal map a pixel
has no frame cost measured, on a desktop or on a phone. A default that makes
one common viewing distance worse, changes the look of every normal-mapped
surface an existing game has already approved, and costs an unmeasured
amount on the devices the engine is aimed at, is not a default yet.

So the patch is installed as before and its text sits behind the define,
but the define is no longer added to LayaAir's configuration defines:
`setZhudaSpecularAA(scene, true)` turns it on for a scene, and
`installLaya342SpecularAA(Laya, { defaultOn: true })` for every scene made
afterwards. What would make it the default: the two-to-four texel range no
worse than without, and a phone measurement.
