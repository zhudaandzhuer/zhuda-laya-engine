#!/usr/bin/env node
// Check that the film host draws the operator pack as it is on disk: the pack
// is edited while the host runs (a prop grows, a new parameter and a new prop
// appear), and the next session is built from the new one, with another
// fingerprint in its replies. The heights are asked with film_scene_query.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {
  configureFilmTools,
  executeFilmTool,
  closeFilmTools,
} from '../packages/mcp-server/film-tools.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-pack-reload-'));
const file = path.join(dir, 'pack.mjs');
const pack = (height, extra = '') => `import { createZhudaBoxMesh } from 'zhuda-laya-engine';
import { WIDTH } from './width.mjs';
export const recipes = {};
export const props = [
  {
    id: 'reload-post',
    size: [1, ${height * 2}, 1],
    defaults: { ${extra ? 'tall: 1' : ''} },
    build(params) {
      const h = ${height} * (params.tall ?? 1);
      return {
        parts: [{ name: 'post', material: 'concrete', mesh: createZhudaBoxMesh({ width: WIDTH, height: h, depth: WIDTH, origin: 'bottom' }) }],
        colliders: [{ min: [-0.5, 0, -0.5], max: [0.5, h, 0.5], surface: 'test' }],
      };
    },
  },${extra}
];
`;
const SECOND = `
  {
    id: 'reload-slab',
    size: [2, 0.5, 2],
    defaults: {},
    build() {
      return {
        parts: [{ name: 'slab', material: 'concrete', mesh: createZhudaBoxMesh({ width: 2, height: 0.5, depth: 2, origin: 'bottom' }) }],
        colliders: [{ min: [-1, 0, -1], max: [1, 0.5, 1], surface: 'test' }],
      };
    },
  },`;
const scene = (nodes) => ({
  schemaVersion: 1,
  id: 'pack-reload',
  camera: { eye: [0, 3, 10], target: [0, 1, 0], focalLengthMm: 35 },
  look: { preset: 'day' },
  materials: { earth: { color: [0.4, 0.35, 0.3], roughness: 1 } },
  nodes: [{ id: 'ground', type: 'ground', size: [50, 50], material: 'earth' }, ...nodes],
});
const data = (reply) => JSON.parse(reply.find((part) => part.type === 'text').text);
const heightOf = async (sessionId, at) =>
  data(await executeFilmTool('film_scene_query', { sessionId, heights: [at] })).heights[0];
const report = {};
try {
  fs.writeFileSync(path.join(dir, 'width.mjs'), 'export const WIDTH = 1;\n');
  fs.writeFileSync(file, pack(2));
  configureFilmTools({
    packs: [file],
    ...(process.env.ZHUDA_FILM_RENDERER ? { renderer: process.env.ZHUDA_FILM_RENDERER } : {}),
  });
  const POST = { id: 'post', type: 'prop', prop: 'reload-post', position: [0, 0, 0] };
  const first = data(await executeFilmTool('film_scene_create', { scene: scene([POST]) }));
  report.first = { packs: first.packs, height: await heightOf(first.sessionId, [0, 0]) };
  assert.ok(first.props.includes('reload-post') && !first.props.includes('reload-slab'));
  assert.match(first.packs.fingerprint, /^[0-9a-f]{16}$/);
  assert.equal(report.first.height.y, 2, 'the post as first written is 2 m');

  // The pack is edited: a taller post with a parameter it did not have, and a new prop.
  fs.writeFileSync(file, pack(3, SECOND));
  const second = data(
    await executeFilmTool('film_scene_create', {
      scene: scene([
        { ...POST, params: { tall: 2 } },
        { id: 'slab', type: 'prop', prop: 'reload-slab', position: [5, 0, 0] },
      ]),
    }),
  );
  report.second = {
    packs: second.packs,
    post: await heightOf(second.sessionId, [0, 0]),
    slab: await heightOf(second.sessionId, [5, 0]),
  };
  assert.ok(second.props.includes('reload-slab'), 'the new prop is offered');
  assert.notEqual(second.packs.fingerprint, first.packs.fingerprint, 'another fingerprint');
  assert.equal(report.second.post.y, 6, 'the edited post with its new parameter is 6 m');
  assert.deepEqual([report.second.slab.y, report.second.slab.node], [0.5, 'slab']);

  // A file the pack imports is edited: also loaded again (the post is half as wide).
  const edge = async (id) => (await heightOf(id, [0.4, 0])).node;
  assert.equal(await edge(second.sessionId), 'post', '0.4 m off the middle is still the post');
  fs.writeFileSync(path.join(dir, 'width.mjs'), 'export const WIDTH = 0.5;\n');
  const third = data(await executeFilmTool('film_scene_create', { scene: scene([POST]) }));
  report.third = { packs: third.packs, edge: await edge(third.sessionId) };
  assert.equal(report.third.edge, 'ground', 'the narrower post leaves that spot to the ground');
  assert.notEqual(third.packs.fingerprint, second.packs.fingerprint);

  // Untouched, the page stays: the same fingerprint and load time.
  const fourth = data(await executeFilmTool('film_scene_create', { scene: scene([POST]) }));
  assert.deepEqual(fourth.packs, third.packs, 'no reload without a change');
  report.status = 'pass';
} catch (error) {
  report.status = 'fail';
  report.error = String(error?.stack || error);
  process.exitCode = 1;
} finally {
  await closeFilmTools();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(JSON.stringify(report, null, 2));
}
