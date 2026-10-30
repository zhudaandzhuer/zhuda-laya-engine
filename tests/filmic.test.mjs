import test from "node:test";
import assert from "node:assert/strict";
import { computeMeshTangents } from "../packages/core/runtime3d/Surfaces.ts";
import { createPrefilteredEnvironment } from "../packages/core/runtime3d/Filmic.ts";

test("normal map frames follow rotated and mirrored UVs, including vertical faces", () => {
  const mesh = {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
    indices: new Uint16Array([0, 1, 2]),
  };
  const t = computeMeshTangents(mesh);
  assert.deepEqual([...t.slice(0, 4)], [1, 0, 0, 1]);
  mesh.uvs = new Float32Array([0, 0, 0, 1, 1, 0]);
  const rotated = computeMeshTangents(mesh);
  assert.deepEqual([...rotated.slice(0, 4)], [0, 1, 0, -1]);
  mesh.uvs.fill(0);
  const fallback = computeMeshTangents(mesh);
  for (let i = 0; i < 3; i++) {
    assert.ok(
      Math.abs(Math.hypot(...fallback.slice(i * 4, i * 4 + 3)) - 1) < 1e-6,
    );
    assert.equal(fallback[i * 4 + 2], 0);
  }
  mesh.positions[0] = NaN;
  assert.throws(() => computeMeshTangents(mesh), /finite/);
});

test("HDR environment rejects missing mips, ambiguous offsets and nonfinite radiance before GPU allocation", () => {
  const spec = {
    size: 2,
    ambientSH: Array(27).fill(0),
    levels: [
      { size: 2, offset: 0, elements: 96 },
      { size: 1, offset: 96, elements: 24 },
    ],
  };
  assert.throws(
    () =>
      createPrefilteredEnvironment(
        { ...spec, levels: spec.levels.slice(0, 1) },
        new Float32Array(96),
      ),
    /Incomplete/,
  );
  assert.throws(
    () =>
      createPrefilteredEnvironment(
        {
          ...spec,
          levels: [spec.levels[0], { size: 1, offset: 384, elements: 24 }],
        },
        new Float32Array(120),
      ),
    /layout/,
  );
  const data = new Float32Array(120);
  data[40] = Infinity;
  assert.throws(() => createPrefilteredEnvironment(spec, data), /pixels/);
  assert.throws(
    () =>
      createPrefilteredEnvironment(
        { ...spec, ambientSH: Array(26).fill(0) },
        data,
      ),
    /descriptor/,
  );
});

test("environment uploads reorder public WebGL faces for every native Laya mip", () => {
  const saved = globalThis.Laya,
    uploads = [];
  class Cube {
    constructor() {
      this.destroyed = false;
    }
    setPixelsData(faces) {
      uploads.push(faces.map((f) => f[0]));
    }
    updateSubPixelsData(faces) {
      uploads.push(faces.map((f) => f[0]));
    }
    destroy() {
      this.destroyed = true;
    }
  }
  try {
    globalThis.Laya = {
      TextureCube: Cube,
      TextureFormat: { R32G32B32A32: 1 },
      RenderCapable: {
        TextureFormat_R32G32B32A32: 1,
        Texture_FloatLinearFiltering: 2,
      },
      LayaGL: { renderEngine: { getCapable: () => true } },
    };
    const pixels = new Float32Array(120);
    for (let face = 0; face < 6; face++) {
      pixels.fill(face + 1, face * 16, (face + 1) * 16);
      pixels.fill(face + 11, 96 + face * 4, 100 + face * 4);
    }
    const env = createPrefilteredEnvironment(
      {
        size: 2,
        ambientSH: Array(27).fill(0),
        levels: [
          { size: 2, offset: 0, elements: 96 },
          { size: 1, offset: 96, elements: 24 },
        ],
      },
      pixels,
    );
    assert.deepEqual(uploads, [
      [5, 6, 1, 2, 3, 4],
      [15, 16, 11, 12, 13, 14],
    ]);
    env.dispose();
    assert.equal(env.texture.destroyed, true);
  } finally {
    globalThis.Laya = saved;
  }
});
