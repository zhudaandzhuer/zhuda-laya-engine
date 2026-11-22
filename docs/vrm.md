# VRM 1.0 avatars

A `.vrm` file is a GLB with the VRM Consortium's extensions. The engine reads
VRM 1.0 (`VRMC_vrm`, `VRMC_springBone`, `VRMC_materials_mtoon`,
`VRMC_node_constraint`, as in `vrm-c/vrm-specification`) and applies it with
its own parts: the model library, the spring solver, the toon material and
the engine's clock. VRM 0.x (the `VRM` extension) is refused by name: convert
such a file with UniVRM or the VRM Add-on for Blender.

```ts
import { ZhudaModelLibrary, ZhudaVrm } from 'zhuda-laya-engine';

const library = new ZhudaModelLibrary({ provider });
const model = await library.instantiate('avatars/hero.vrm');
scene.addChild(model.node);
console.log(model.vrm?.meta.name, model.vrm?.meta.avatarPermission, model.vrmIssues);

const vrm = new ZhudaVrm(model); // before any clip plays: the pose now is the rest
const stop = vrm.runAfterAnimation(session.layers); // each frame, after LayaAir's animation
vrm.setExpression('happy', 1);
vrm.setExpression('blink', 0.6);
vrm.lookAt([camera.x, camera.y, camera.z]); // or vrm.setGaze(yawDeg, pitchDeg), or null
vrm.bone('rightHand'); // a humanoid bone's Laya node
// later
stop();
vrm.dispose(); // the model's own materials go back on
model.dispose();
```

## Loading

`ZhudaModelLibrary` reads the VRM data from the document it already parses,
before LayaAir parses it, and gives every copy:

- `vrm`: the data (`ZhudaVrmDocument`), or null for a file that is not VRM
  1.0 or that an error refuses (VRM 0.x, a missing required bone, `meta`
  without `name`, `authors` or `licenseUrl`);
- `vrmIssues`: each problem with its code, severity and JSON path
  (`$.extensions.VRMC_vrm.humanoid.humanBones.leftFoot`). A warning drops or
  approximates the part it names; the rest is read;
- `gltfNode(index)`, `gltfMaterialSlots` and `gltfTexture(index)`: the copy's
  nodes, renderer slots and textures by glTF index, for any extension a
  consumer reads itself.

`readZhudaVrm(document)` is the same reader without a renderer (tools, a
build step, an upload check). The compatibility report counts the four
extensions as the engine's.

## What `ZhudaVrm` applies

| VRM                                      | Engine                                                                                                                                                                                                    |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meta`                                   | passed through as the file states it, with the specification's defaults; the engine never decides whether a use is allowed                                                                                |
| `humanoid.humanBones`                    | `bone(name)`; the 15 required bones are checked, and that each lies under the bone the specification makes its parent                                                                                     |
| expressions: morph targets               | each `update` zeroes the targets the expressions move and adds each bind's share (`weight` × the expression's weight)                                                                                     |
| expressions: material colours            | rest + Σ (target − rest) × weight, on the toon materials (`color`, `emissionColor`, `shadeColor`, `rimColor`, `outlineColor`) and, on a copy of its own, a plain glTF material (`color`, `emissionColor`) |
| expressions: texture transforms          | the toon material's tiling and offset                                                                                                                                                                     |
| `isBinary`, `overrideBlink/LookAt/Mouth` | `zhudaVrmExpressionWeights`: the specification's and three-vrm's rules (block, blend, a binary overrider acts on its output, a lowered binary expression shows nothing)                                   |
| `lookAt` (`bone` or `expression`)        | `lookAt(point)` / `setGaze(yaw, pitch)`: the gaze space is the head's at rest, moved by `offsetFromHeadBone`; the range maps give each eye's turn (inner and outer) or the four gaze expressions          |
| `VRMC_node_constraint`                   | roll, aim and rotation, as the specification's examples, each after its source                                                                                                                            |
| `VRMC_springBone`                        | `ZhudaSpringBones` on the engine's solver, one set for each set of colliders the springs use; each joint has its own settings                                                                             |
| `VRMC_materials_mtoon`                   | a `ZhudaToonMaterial` for each MToon material, for this copy                                                                                                                                              |

`update(seconds)` runs, in three-vrm's order: gaze, expressions,
constraints, springs. `updateFrom(layers, layer)` takes a layer of the
engine's clock; `runAfterAnimation(layers)` calls it each frame once
LayaAir's animation has posed the model. There is no timer of its own.

### Spring settings

VRM gives a joint's settings per frame (UniVRM and three-vrm move each joint
once a frame). The solver works in rates a second at a fixed step
(`zhudaVrmSpringSetting`), chosen so a bone rests where VRM rests it:

- `stiffness` s pushes the tail s metres a second toward rest: the solver
  pulls s ÷ the bone's length of the way a second;
- `gravityPower` g along `gravityDir`: an acceleration of g ÷ step;
- `dragForce` d keeps 1 − d of the motion a frame, at 60 frames a second:
  −60 ln(1 − d) a second (the solver's most, 100, from d ≈ 0.81);
- `hitRadius` is the joint's radius against its spring's colliders.

A bone held level under gravity hangs, at rest, within a degree of VRM's
angle (`tests/vrm.test.mjs`). The motion is not UniVRM's frame for frame: it
does not change with the frame rate. A spring's `center` space is not used
(the spring moves in the world); a collider's offsets are taken in its
node's space without the node's scale.

### MToon as toon

`zhudaVrmToonPlan(mtoon)` gives the toon spec:

- lit and shade colours: two bands on 0.5 + 0.5·N·L, the edge where MToon
  has its middle (−`shadingShiftFactor`), as soft as `shadingToonyFactor`
  leaves it (`ZhudaToonShade`, see [stylized shading](stylized-shading.md));
- the shade colour: the base texture tinted by `shadeColorFactor ÷
baseColorFactor` when `shadeMultiplyTexture` is the base texture,
  `shadeColorFactor` alone when there is none;
- `giEqualizationFactor` is the ambient light's `flat`;
- the parametric rim: a rim band where MToon's reaches half its strength;
- the outline in metres (`worldCoordinates`) or in pixels of a picture
  `screenHeight` tall (`screenCoordinates`; default the stage's height);
- base, normal and emissive textures, alpha mode and cut-off, two sides, a
  blended material's queue offset.

Not drawn, each listed in `vrm.issues` when a material uses it: matcap, the
shading shift texture, the rim and outline width textures, the rim's and
outline's lighting mix, UV animation, a turned base texture, a shade texture
other than the base texture (drawn as the shade colour alone). Without
`mtoon: false` the toon materials replace the glTF ones on this copy only;
`dispose()` puts the glTF ones back.

## Not done

- VRM 0.x, `.vrma` animation clips (`VRMC_vrm_animation`), the extended
  colliders (`VRMC_springBone_extended_collider`), HDR emission
  (`VRMC_materials_hdr_emissiveMultiplier`); exporting VRM.
- First-person mesh annotations are read (`vrm.firstPerson`) and not applied
  to a camera.
- Humanoid retargeting of clips from another rig.

## Checked

`node --test tests/vrm.test.mjs` (the reader, deliberate failures with
their paths, the expression, gaze, spring, constraint and MToon arithmetic)
and `npm run verify:vrm` (a VRM 1.0 avatar made by the test itself, drawn on
WebGL). See the [verification record](plans/records/vrm-import/verification.md)
for what was measured and what was not (no phone, no WebGPU, no third-party
model).
