// Neutral operator pack for verify:film-look: one prop and one recipe,
// written against the public API like any consumer pack.
import { createZhudaBoxMesh, transformZhudaMesh, mergeZhudaMeshes } from 'zhuda-laya-engine';

export const recipes = {
  'test-check': {
    schemaVersion: 1,
    id: 'test-check',
    tileMeters: [1, 1],
    seed: 1,
    base: { color: [0.6, 0.6, 0.62], roughness: 0.7, metallic: 0 },
    layers: [
      {
        mask: { type: 'bricks', columns: 2, rows: 2, mortar: 0.1 },
        color: [0.2, 0.2, 0.22],
        heightMm: -5,
      },
    ],
  },
};

export const props = [
  {
    id: 'test-kiosk',
    size: [2.2, 3.1, 2.2],
    defaults: {},
    build() {
      const body = createZhudaBoxMesh({ width: 2, height: 2.4, depth: 2, origin: 'bottom' });
      const roof = transformZhudaMesh(
        createZhudaBoxMesh({ width: 2.2, height: 0.3, depth: 2.2, origin: 'bottom' }),
        {
          position: [0, 2.6, 0],
        },
      );
      return {
        parts: [
          { name: 'body', material: 'test-check', mesh: body },
          { name: 'roof', material: 'roof-red', mesh: mergeZhudaMeshes([roof])[0] },
        ],
        colliders: [{ min: [-1, 0, -1], max: [1, 2.9, 1], surface: 'test' }],
      };
    },
  },
];
