# Task: glTF vertex colours

Status: Implemented within scope; desktop WebGL and WebGPU verified.

## Source requirement

A consumer scene baked the shade of its rooms into `COLOR_0` (how much sky each
corner of a face sees). The rooms stayed as bright as the street: the colours
were never drawn. Earlier vertex-colour work in the same content (a wet band on
a river bank, wet rocks) had been dropped the same way without anyone noticing.

## Cause

LayaAir 3.4.2's glTF shader multiplies the vertex colour into the base colour
only for a material that carries `ENABLEVERTEXCOLOR`, and its loader never sets
that define. Its loader also hands a colour accessor to a four-float vertex
element as stored: normalized 16-bit colours (what Blender writes) arrive
65535 times too bright, and three-component colours are read out of step.

## Change

- `enableLaya342VertexColors(node)` (`runtime3d/Laya342Adapters.ts`): sets the
  define on the materials of every mesh in a model that has a colour channel.
  `ZhudaModelLibrary` calls it once per loaded model template.
- `prepareLaya342GltfResource` (`runtime3d/Laya342GltfAdapter.ts`): colour
  accessors are converted to RGBA floats in 0..1 (`zhudaGltfColors`), for
  `VEC3`/`VEC4` and float, normalized byte and normalized short storage.

## Invariants

- Engine/consumer scope: engine only. What the colours mean (shade, wetness,
  tint) is the consumer's content.
- No vendor file is modified; both changes act on one owned resource or model.
- A model without `COLOR_0` is drawn exactly as before.

## Non-goals

`COLOR_1` and later sets; vertex colours on materials that are not the glTF
PBR material; a switch to turn the behaviour off per model.

## Behaviour change to note

A model that already carried `COLOR_0` now shows it, as glTF specifies. Content
exported with an unintended colour set will look different; remove the set in
the source file.

## Acceptance evidence

See [verification](verification.md).
