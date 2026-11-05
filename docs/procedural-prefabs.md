# Primitive 3D Prefabs

`ZhudaPrefabLibrary` supports typed, serializable 3D
trees. Static 2D `.lh` definitions remain supported. Neither format requires
the LayaAir IDE. A tree is a source definition, not approved visual evidence.

```ts
import { DirectoryAssetProvider, ZhudaPrefabLibrary } from 'zhuda-laya-engine';
import type { Prefab3DDefinition, PrefabPreview3D } from 'zhuda-laya-engine';

export const definitions: Prefab3DDefinition[] = [{
  id: 'neutral/assembly', kind: '3d',
  tree: {
    materials: {
      pink: { type: 'unlit', albedoColor: [1, .4, .5, 1] },
      blue: { type: 'unlit', albedoColor: [.2, .4, 1, 1] },
    },
    root: { name: 'Assembly', children: [{
      name: 'Pivot', children: [{
        name: 'Body', mesh: { type: 'box', dimensions: { width: 1, height: 1, depth: 1 } },
        material: 'pink', localPosition: [0, .5, 0],
      }],
    }] },
    sockets: { top: 'Pivot/Body' },
  },
  states: {
    idle: {},
    turned: { Pivot: { localRotationEuler: [0, 45, 0] }, 'Pivot/Body': { material: 'blue' } },
  },
}];
export function createAssetProvider() {
  return new DirectoryAssetProvider({ baseUrl: './assets/' });
}
export const preview3D: PrefabPreview3D = {
  camera: { position: [0, 2, 6], rotationEuler: [-15, 0, 0], clearColor: [.08, .12, .18, 1] },
  ambientColor: [.4, .4, .4, 1],
  light: { rotationEuler: [-35, -30, 0], intensity: 1 },
};

// In the scene, import the same definitions and provider factory.
const provider = createAssetProvider();
const library = new ZhudaPrefabLibrary({ provider, definitions });
const instance = await library.instantiate('neutral/assembly', { state: 'idle' });
// scene3D.addChild(instance.root); // root is typed Laya.Sprite3D
instance.applyState('turned');
const attachment = instance.socket('top');
instance.dispose();
library.dispose();
provider.dispose();
```

`Zhuda3D.buildPrefabTree(tree)` (also exported as `buildPrefabTree`) is the
lower-level synchronous renderer. It returns `root`, `find`, `socket`, `apply`
and `dispose`. Use the library for definition hashes and instance provenance;
manually constructed trees do not acquire verified provenance automatically.

## Coordinates, materials and state

- Node paths are relative to the root; `''` selects the root. Sibling names
  must be unique and contain no `/`. Socket values are real node paths.
- `localPosition` uses scene units, `localRotationEuler` uses degrees, and
  `localScale` is a finite nonzero XYZ vector. 3D visibility uses `active`.
- Mesh kinds are box, sphere, plane, cone, cylinder and capsule. Torus and
  spline/extrude generation are not provided by this renderer.
- Material keys reference the definition's material table. State material
  replacement requires a mesh node; no untyped renderer access is necessary.
- A state is applied relative to the authored baseline. Returning to `idle`
  restores transforms, activity and material bindings; prior states do not leak.
- By default each instance owns its primitive meshes/materials. Optional shared
  ownership is described below. Destroy instances before their library/provider.
- The current tree format has no external textures, GLB factory, skeleton,
  animation controller or gameplay authority. Models use the existing model
  library; do not invent unsupported fields or put game rules in this renderer.

## Same-definition preview

Set `prefabPreview` to the module exporting `definitions` and include `3d` in
the consumer build features. The optional `preview3D` export configures the
isolated camera/light; omit it for the neutral default.

```text
/prefab-preview.html?id=neutral/assembly&state=turned&node=Pivot/Body&width=640&height=360&dpr=1
```

Selection retains parent transforms and hides unrelated siblings. The current
preview uses one camera/light configuration for all 3D definitions in that
module; configure it explicitly to match the intended reference.

Provenance includes `kind`, `definitionHash` (the entire serialized definition,
states and recipe), and provider `sources` hashes. Pure primitive trees have
no external source assets, so `sources` is empty. Renderer code is covered by
the whole-payload fingerprint by default; optional isolated component
fingerprints are described in [consumer tooling](consumer-tooling.md).

Follow [the prefab workflow](prefab-workflow.md) and
[schema 2 comparisons](consumer-tooling.md). A valid tree or a successful build
does not approve a baseline, prove reference-art parity, or qualify a device.

## Shared resources (1.5.0)

Opt in when instances use immutable authored geometry/materials:

```ts
export const libraryOptions = { share3DResources: true };
const library = new ZhudaPrefabLibrary({ provider, definitions, ...libraryOptions });
const a = await library.instantiate('neutral/assembly');
const b = await library.instantiate('neutral/assembly');
// State swaps change bindings on a; b is unaffected.
a.applyState('turned');
// Before changing a material property, obtain an instance-owned material.
const ownMaterial = a.makeMaterialUnique('Pivot/Body');
ownMaterial.renderQueue = 2000;
```

The official preview reads the same exported `libraryOptions.share3DResources`.
The library uses `ZhudaAssetCache` with no idle retention to lease a compiled
tree resource set. Identical tree recipes share each named node's mesh and
material slots across instances. Nodes/transforms/activity are always separate.
Identical sibling shapes keep distinct mesh identities to preserve single-tree
batch ordering at coplanar intersections. Compatible native shaders can batch
shared resources; this option is not a draw-call or FPS guarantee.

Treat shared meshes and materials as immutable. Use `makeMaterialUnique(path)`
before changing a material: it clones that slot for this instance, updates its
current bindings, survives state changes and is destroyed with the instance.
It does not mutate another instance or the library's original slot. Calling it
again returns the owned material. Non-mesh paths and 2D instances reject it.
For arbitrary mesh edits, use the compatible independent-ownership mode.

Cancelled/failed creation releases partial leases; disposal destroys nodes
before releasing the shared resources. The last lease destroys the resource
set. `library.report().shared3D` reports separate cache counts. The low-level
synchronous `buildPrefabTree()` keeps independent ownership.
