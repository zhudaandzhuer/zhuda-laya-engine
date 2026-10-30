import test from "node:test";
import assert from "node:assert/strict";
import {
  ZhudaTerrain2D,
  validateTerrain2D,
} from "../packages/core/terrain/Terrain2D.ts";
import {
  ZhudaHeightfield,
  validateHeightfield,
  terrainNoise,
} from "../packages/core/terrain/Heightfield.ts";
import {
  validateShaderSpec,
  shaderRecipes,
} from "../packages/core/shaders/ShaderMaterials.ts";
import { ZhudaSceneQueries } from "../packages/core/runtime3d/SceneQueries.ts";
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
const tileSpec = () => ({
  schemaVersion: 1,
  dimension: 2,
  width: 33,
  height: 17,
  tileSize: 16,
  origin: [-32, -16],
  palette: [
    { id: 1, color: "#228833" },
    { id: 2, color: "#bb8844", blocked: true },
  ],
  layers: [
    { id: "ground", tiles: Array(33 * 17).fill(1) },
    { id: "objects", tiles: Array(33 * 17).fill(0) },
  ],
});
test("2D terrain edits, negative origins, layered flags and JSON roundtrip preserve independent data", () => {
  const spec = tileSpec(),
    map = new ZhudaTerrain2D(spec);
  let changes = 0;
  const off = map.onChange(() => changes++);
  map.paintRect("objects", { x: 15, y: 15, width: 3, height: 2 }, 2);
  assert.equal(changes, 1);
  assert.equal(map.isBlocked(16, 16), true);
  assert.equal(map.getTile("ground", 16, 16), 1);
  assert.equal(spec.layers[1].tiles[16 * 33 + 16], 0);
  assert.deepEqual(map.localToTile(-32, -16), { col: 0, row: 0 });
  assert.equal(map.localToTile(-32.01, 0), null);
  assert.deepEqual(map.localToTile(...Object.values(map.tileToLocal(32, 16))), {
    col: 32,
    row: 16,
  });
  assert.equal(map.localToTile(496, 0), null);
  const copy = new ZhudaTerrain2D(JSON.parse(JSON.stringify(map)));
  assert.deepEqual(copy.toJSON(), map.toJSON());
  assert.throws(() =>
    map.paintRect("ground", { x: 32, y: 0, width: 2, height: 1 }, 2),
  );
  assert.equal(changes, 1);
  off();
  map.setTile("ground", 0, 0, 0);
  assert.equal(changes, 1);
});
test("terrain JSON rejects missing arrays, duplicate IDs, nonfinite data and oversized allocations", () => {
  for (const patch of [
    { layers: null },
    { palette: [{ id: 1 }, { id: 1 }] },
    { width: 999999 },
    { layers: [{ id: "x", tiles: [999] }] },
    { origin: [NaN, 0] },
  ])
    assert.ok(validateTerrain2D({ ...tileSpec(), ...patch }).length);
  for (const s of [
    {},
    {
      schemaVersion: 1,
      dimension: 3,
      cellsX: 2,
      cellsZ: 2,
      cellSize: 1,
      heights: Array(9).fill(Infinity),
    },
    {
      schemaVersion: 1,
      dimension: 3,
      cellsX: 10000,
      cellsZ: 10000,
      cellSize: 1,
      heights: [],
    },
  ])
    assert.ok(validateHeightfield(s).length);
  assert.throws(() =>
    ZhudaHeightfield.generate({
      cellsX: 1e8,
      cellsZ: 1e8,
      cellSize: 1,
      seed: 1,
    }),
  );
});
test("heightfield sampling follows rendered triangle diagonal rather than bilinear interpolation", () => {
  const f = new ZhudaHeightfield({
    schemaVersion: 1,
    dimension: 3,
    cellsX: 1,
    cellsZ: 1,
    cellSize: 2,
    origin: [-1, -1],
    heights: [0, 0, 0, 4],
  });
  close(f.sample(0, 0).height, 2);
  close(f.sample(0.5, -0.5).height, 1);
  close(f.sample(-0.5, 0.5).height, 1);
  assert.equal(f.sample(1.01, 0), null);
  for (const [x, z] of [
    [-0.75, -0.2],
    [0.75, 0.1],
    [1, 1],
    [-1, -1],
    [0.2, 0.2],
  ]) {
    const s = f.sample(x, z),
      hit = f.raycast({
        origin: { x, y: 10, z },
        direction: { x: 0, y: -1, z: 0 },
      });
    close(hit.position.y, s.height);
    close(hit.distance, 10 - s.height);
    close(hit.normal.y, s.normal.y);
  }
  assert.equal(
    f.raycast({
      origin: { x: 3, y: 10, z: 0 },
      direction: { x: 0, y: -1, z: 0 },
    }),
    null,
  );
});
test("DDA rays hit analytic slopes from each side and use a bounded ray distance", () => {
  const heights = Array.from(
      { length: 81 },
      (_, i) => (i % 9) * 0.25 + Math.floor(i / 9) * 0.5,
    ),
    f = new ZhudaHeightfield({
      schemaVersion: 1,
      dimension: 3,
      cellsX: 8,
      cellsZ: 8,
      cellSize: 1,
      heights,
    });
  for (let i = 0; i < 80; i++) {
    const x = 0.1 + (i % 8),
      z = 0.1 + Math.floor(i / 10),
      o = { x: i % 2 ? -2 : 10, y: 6, z },
      d = { x: i % 2 ? 1 : -1, y: -0.6, z: 0 };
    const t = (0.25 * o.x + 0.5 * o.z - o.y) / (d.y - 0.25 * d.x),
      hit = f.raycast({ origin: o, direction: d });
    if (o.x + d.x * t >= 0 && o.x + d.x * t <= 8) {
      assert.ok(hit);
      close(hit.distance, t);
      assert.equal(f.raycast({ origin: o, direction: d }, t - 0.01), null);
    }
  }
  assert.equal(
    f.raycast({
      origin: { x: 2, y: 10, z: 2 },
      direction: { x: 0, y: 1, z: 0 },
    }),
    null,
  );
});
test("height brush and transactional patches notify seams; coarse samples and ray queries agree", () => {
  const f = ZhudaHeightfield.generate({
    cellsX: 64,
    cellsZ: 32,
    cellSize: 1,
    seed: 123,
    amplitude: 0,
  });
  const events = [];
  f.onChange((r) => events.push(r));
  f.brush(32, 16, 3, 4);
  assert.equal(events.length, 1);
  assert.equal(f.heightAtVertex(32, 16), 4);
  assert.ok(f.normalAtVertex(31, 16).x < 0);
  const saved = f.toJSON();
  assert.throws(() => f.applyPatch(63, 31, 3, 2, [1, 2, 3, 4, 5, 6]));
  assert.deepEqual(f.toJSON(), saved);
  for (const stride of [1, 2, 4])
    for (const [x, z] of [
      [30.3, 15.4],
      [32, 16],
      [33.4, 17.7],
    ])
      close(
        f.sample(x, z, stride).height,
        f.raycast(
          { origin: { x, y: 10, z }, direction: { x: 0, y: -1, z: 0 } },
          100,
          stride,
        ).position.y,
      );
  assert.deepEqual(
    new ZhudaHeightfield(JSON.parse(JSON.stringify(f))).toJSON(),
    f.toJSON(),
  );
  assert.equal(terrainNoise(123, -2.3, 4.5), terrainNoise(123, -2.3, 4.5));
  assert.notEqual(terrainNoise(123, -2.3, 4.5), terrainNoise(124, -2.3, 4.5));
});
test("query providers may return stable per-cell instance IDs", () => {
  const q = new ZhudaSceneQueries();
  q.register({
    entityId: "terrain",
    raycast: () => ({
      instanceId: "32:16",
      distance: 1,
      position: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 1, z: 0 },
    }),
  });
  assert.equal(
    q.raycast({
      origin: { x: 0, y: 1, z: 0 },
      direction: { x: 0, y: -1, z: 0 },
    }).instanceId,
    "32:16",
  );
});
test("all shader recipes have serializable, typed uniform contracts; invalid bodies fail structurally", () => {
  for (const spec of Object.values(shaderRecipes))
    assert.deepEqual(validateShaderSpec(JSON.parse(JSON.stringify(spec))), []);
  for (const patch of [
    { uniforms: { u_Wrong: { type: "float" } } },
    { surface: "uniform float u_ZhudaX; void main(){}" },
    { uniforms: { u_ZhudaX: { type: "vec3", value: [1, 2] } } },
    { dimension: 2, passes: { depth: true } },
    { fog: "false" },
  ])
    assert.ok(validateShaderSpec({ ...shaderRecipes.tint2D, ...patch }).length);
});

import { executeMcpTool } from "../packages/mcp-server/index.mjs";
test("agents receive terrain/shader validators and actionable public examples", () => {
  assert.equal(
    executeMcpTool("validate_terrain_spec", { terrain: tileSpec() }).passed,
    true,
  );
  assert.equal(
    executeMcpTool("validate_shader_spec", { shader: shaderRecipes.terrain3D })
      .passed,
    true,
  );
  assert.equal(
    executeMcpTool("validate_shader_spec", { shader: {} }).passed,
    false,
  );
  assert.ok(
    executeMcpTool("get_golden_example", {
      id: "terrain-3d-shader",
    }).result.code.includes("terrain.flush()"),
  );
});

import {
  buildTerrainShell,
  shellTriangleDistance,
} from "../packages/core/terrain/TerrainShell.ts";
import { resolveCameraBoom } from "../packages/core/runtime3d/CameraCollision.ts";
import { rayBox } from "../packages/core/runtime3d/SceneQueries.ts";
test("solid terrain is watertight with clockwise exterior faces at every LOD", () => {
  for (const stride of [1, 2, 4]) {
    const xs = [0, stride, stride + 1],
      zs = [0, stride, stride + 1],
      top = new Float32Array(9 * 8),
      topIndices = [];
    for (let z = 0; z < 3; z++)
      for (let x = 0; x < 3; x++)
        top.set(
          [xs[x], xs[x] * 0.2 + zs[z] * 0.1, zs[z], 0, 1, 0, xs[x], zs[z]],
          (z * 3 + x) * 8,
        );
    for (let z = 0; z < 2; z++)
      for (let x = 0; x < 2; x++) {
        const a = z * 3 + x,
          b = a + 1,
          c = a + 3,
          d = c + 1;
        topIndices.push(c, a, d, a, b, d);
      }
    const body = buildTerrainShell(top, xs, zs, 5),
      edges = new Map();
    const key = (v) => v.map((x) => x.toFixed(5)).join(",");
    const triangles = [];
    for (let i = 0; i < topIndices.length; i += 3)
      triangles.push(
        topIndices.slice(i, i + 3).map((j) => [...top.slice(j * 8, j * 8 + 3)]),
      );
    for (let i = 0; i < body.indices.length; i += 3)
      triangles.push(
        [...body.indices.slice(i, i + 3)].map((j) => [
          ...body.positions.slice(j * 3, j * 3 + 3),
        ]),
      );
    for (const tri of triangles)
      for (let i = 0; i < 3; i++) {
        const a = key(tri[i]),
          b = key(tri[(i + 1) % 3]),
          k = [a, b].sort().join("|");
        const e = edges.get(k) || { count: 0, balance: 0 };
        e.count++;
        e.balance += a < b ? 1 : -1;
        edges.set(k, e);
      }
    assert.ok(
      [...edges.values()].every((e) => e.count === 2 && e.balance === 0),
      "every welded edge has two opposite incidences",
    );
    const nearest = (ray) => {
      let t = Infinity;
      for (let i = 0; i < body.indices.length; i += 3) {
        const h = shellTriangleDistance(
          ray,
          body.positions,
          ...body.indices.slice(i, i + 3),
        );
        if (h !== null) t = Math.min(t, h);
      }
      return t;
    };
    close(
      nearest({
        origin: { x: 0.25, y: -10, z: 0.25 },
        direction: { x: 0, y: 1, z: 0 },
      }),
      5.075,
    );
    close(
      nearest({
        origin: { x: -3, y: -2, z: 0.25 },
        direction: { x: 1, y: 0, z: 0 },
      }),
      3,
    );
    assert.ok(body.normals[1] < 0);
    assert.throws(() => buildTerrainShell(top, xs, zs, 0));
  }
});
test("camera boom handles walls, near-plane grazing, layer masks and immediate release", () => {
  const queries = new ZhudaSceneQueries();
  queries.register({
    entityId: "wall",
    layer: 4,
    raycast: (r, d) =>
      rayBox(r, { x: 2, y: -1, z: -2 }, { x: 3, y: 1, z: 2 }, d),
  });
  const focus = { x: 0, y: 0, z: 0 },
    desired = { x: 5, y: 0, z: 0 };
  const a = resolveCameraBoom(focus, desired, {
    queries,
    radius: 0.25,
    clearance: 0.1,
    layerMask: 4,
  });
  close(a.position.x, 1.65);
  assert.equal(a.blocked, true);
  assert.equal(
    resolveCameraBoom(focus, desired, { queries, layerMask: 2 }).blocked,
    false,
  );
  const grazing = resolveCameraBoom(
    { x: 0, y: 1.15, z: 0 },
    { x: 5, y: 1.15, z: 0 },
    { queries, radius: 0.25 },
  );
  assert.equal(
    grazing.blocked,
    true,
    "offset probes catch an obstruction missed by center ray",
  );
  queries.clear();
  assert.deepEqual(
    resolveCameraBoom(focus, desired, { queries }).position,
    desired,
  );
  assert.throws(() =>
    resolveCameraBoom(focus, desired, { queries, radius: -1 }),
  );
});
