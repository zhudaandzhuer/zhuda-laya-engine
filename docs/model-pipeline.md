# Blender / glTF / Laya model pipeline

This guide is the engine-side contract for bringing a model from Blender or
another DCC into a Zhuda consumer. It prevents a valid WebGPU boot from being
mistaken for a visually correct asset. The consumer owns the source file,
materials, authored scene and acceptance images.

## Coordinate and unit contract

Export glTF 2.0 or GLB with **Y up**, a right-handed glTF scene and metres as the
unit. glTF uses +Y up and -Z forward; Blender's default Z-up scene therefore
needs the exporter to perform the axis conversion. Do not rotate the imported
root again in the consumer unless that rotation is part of the authored model
definition. A second correction commonly makes an upright character lie on its
side or face backwards.

Before export, apply object rotation and scale, keep the intended origin and
verify the forward direction with a named `Forward` marker or a neutral arrow.
Record the exporter's axis, unit and scale settings next to the asset SHA. The
engine does not infer whether a 100-unit scene means centimetres, metres or a
consumer-specific game unit.

## Package and inspect before mounting

Prefer one self-contained GLB with embedded buffers and images. Provider mode
rejects undeclared external buffer/image URLs. Run the public inspector before
allocating a native model:

```ts
import { inspectGltfAsset } from 'zhuda-laya-engine';

const report = inspectGltfAsset(bytes);
console.log(report.status, report.inventory.summary);
if (report.status === 'unsupported') throw new Error('Fix the model export first');
```

`inventory.summary` reports source counts for nodes, meshes, primitives,
vertices, indices, triangles, materials, textures, images and animations. It
is a preflight signal; it does not predict native upload time, shader compile
time or GPU memory. A model with 105 tiny meshes can cost more to parse and
upload than one mesh with the same triangle count. If a Windows or WebGPU
acceptance run times out, record these counts, the GLB bytes, decode duration,
native creation duration and the configured deadline before changing the model.

Use mesh joining, material consolidation and authored LODs when they preserve
the visual result. Keep independently selectable parts separate when the
product requires inspection, animation or material replacement. The engine
does not silently merge meshes because that would change node names, sockets,
material identity and animation ownership.

## Visual acceptance stages

1. Pass the importer report and the Khronos Validator.
2. Render the isolated Prefab/model at DPR 1, 2 and 3 in WebGL and WebGPU.
3. Check raw, gameplay and cinematic presentation with the same model instance.
4. Mount the verified model in the consumer Scene and repeat the target camera,
   lights, reflection probes, shadows, transparency and animation checks.
5. For Windows, retain the Electron development and installed-app reports,
   including GPU feature status and complete GPU information.

If a reflection probe disappears when visible objects change, preserve a
two-model minimal fixture with the exact vendor revision, renderer and
material setup. Treat it as a suspected fixed-vendor/runtime seam until that
fixture reproduces it outside the consumer workaround. Independent materials
and a stable model library are valid mitigations; they are not proof that the
underlying binding has been repaired.

## Boundaries

`supported` in the importer report means only that the shipped importer gates
passed. It does not certify seller assets, Unreal parity, Windows hardware,
complex PBR fidelity, reflection stability or movie output. Follow
[model showcase](model-showcase.md), [3D acceptance](3d-acceptance.md) and the
[Prefab workflow](prefab-workflow.md) for the evidence required by each claim.
