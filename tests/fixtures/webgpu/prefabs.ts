import { DirectoryAssetProvider, type AnyPrefabDefinition } from 'zhuda-laya-engine';
export const definitions: AnyPrefabDefinition[] = [
  { id: 'backend.2d', asset: 'panel.lh', states: { idle: {} } },
  {
    id: 'backend.3d',
    kind: '3d',
    tree: {
      materials: {
        blue: { type: 'pbr', albedoColor: [0.1, 0.6, 0.9, 1], metallic: 0.2, smoothness: 0.5 },
      },
      root: {
        name: 'Root',
        children: [
          { name: 'Body', mesh: { type: 'box' }, material: 'blue', localRotationEuler: [0, 20, 0] },
        ],
      },
    },
    states: { idle: {} },
  },
];
export const createAssetProvider = () => new DirectoryAssetProvider({ baseUrl: './assets/' });
export const preview3D = {
  camera: {
    position: [0, 2, 6] as [number, number, number],
    rotationEuler: [-15, 0, 0] as [number, number, number],
    clearColor: [0.08, 0.12, 0.18, 1] as [number, number, number, number],
  },
};
