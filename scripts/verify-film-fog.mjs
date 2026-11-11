#!/usr/bin/env node
// Real WebGL check of `look.lightFog`: a fog-only light must glow at its
// projected pixel and fade away from it, distant surfaces must take more fog
// than near ones, a wall on the ray must cut the glow, and light shafts must
// be cut by what stands in the sun. Desktop GPU evidence only (WebGL, or
// WebGPU through verify:film-webgpu); not mobile or art approval.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';

const out = path.resolve(
  process.env.FILM_FOG_EVIDENCE_DIR || path.join(os.tmpdir(), 'zhuda-film-fog'),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const W = 480,
  H = 270;
const EYE = [0, 2, 6],
  TARGET = [0, 2, -8];
const LIGHT = [2, 3, -8];
const grade = { exposure: 1, contrast: 1, saturation: 1, bloom: 0, ao: 0 };
const scene = ({ lightFog, nodes = [], light = true, look = {} } = {}) => ({
  schemaVersion: 1,
  id: 'fog-check',
  camera: { eye: EYE, target: TARGET, focalLengthMm: 35 },
  look: {
    sky: [0, 0, 0],
    ambient: [0, 0, 0],
    sun: { intensity: 0 },
    shadows: false,
    grade,
    ...(lightFog ? { lightFog } : {}),
    ...look,
  },
  materials: { dark: { color: [0.02, 0.02, 0.02], roughness: 1 } },
  nodes: [
    ...(light
      ? [
          {
            id: 'lamp',
            type: 'light',
            kind: 'point',
            position: LIGHT,
            color: [1, 0.6, 0.3],
            intensity: 4,
            fogOnly: true,
          },
        ]
      : []),
    ...nodes,
  ],
});
function project(point) {
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const unit = (a) => a.map((v) => v / Math.hypot(...a));
  const forward = unit(sub(TARGET, EYE)),
    right = unit(cross(forward, [0, 1, 0])),
    up = cross(right, forward);
  const d = sub(point, EYE),
    depth = dot(d, forward),
    f = 35 / 12;
  return [
    Math.round((0.5 + (dot(d, right) / depth) * f * (H / W) * 0.5) * W),
    Math.round((0.5 - (dot(d, up) / depth) * f * 0.5) * H),
  ];
}
const patch = (img, [x, y]) => {
  const sum = [0, 0, 0];
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const i = ((y + dy) * W + x + dx) * 4;
      for (let c = 0; c < 3; c++) sum[c] += img.data[i + c];
    }
  return sum.map((value) => +(value / 25).toFixed(1));
};
const host = new ZhudaFilmHost();
const render = async (name, s) => {
  const { png } = await host.preview(s, { width: W, height: H });
  fs.writeFileSync(path.join(out, name + '.png'), png);
  return PNG.sync.read(png);
};
const AT = project(LIGHT),
  NEAR = project([LIGHT[0] - 1.2, LIGHT[1], LIGHT[2]]),
  FAR = project([LIGHT[0] - 4.5, LIGHT[1] - 1.5, LIGHT[2]]);
const fog = { density: 0.03, falloffMeters: 200, color: [0, 0, 0], scatter: 1 };
const report = { pixels: { AT, NEAR, FAR } };
try {
  await host.ready();
  // 1. No fog: a fog-only light changes nothing.
  const plain = await render('plain', scene());
  assert.ok(
    Math.max(...patch(plain, AT)) < 3,
    'a fog-only light does not light anything without fog',
  );

  // 2. Fog: the light glows where it is, fading with distance, in its colour.
  const lit = await render('light-fog', scene({ lightFog: fog }));
  report.glow = { at: patch(lit, AT), near: patch(lit, NEAR), far: patch(lit, FAR) };
  assert.ok(report.glow.at[0] > 150, 'glow at the projected light position');
  assert.ok(
    report.glow.at[0] > report.glow.near[0] && report.glow.near[0] > report.glow.far[0],
    'fades away from the light',
  );
  assert.ok(report.glow.far[0] > 2, 'still reaches a few metres');
  assert.ok(report.glow.near[0] > report.glow.near[2] * 1.5, 'keeps the warm colour');

  // 3. Scatter scales the glow; without lights the black fog adds nothing.
  const weak = await render('scatter-quarter', scene({ lightFog: { ...fog, scatter: 0.25 } }));
  report.weak = patch(weak, NEAR);
  assert.ok(report.weak[0] < report.glow.near[0], 'less scatter, less glow');
  const none = await render('no-lights', scene({ lightFog: fog, light: false }));
  assert.ok(Math.max(...patch(none, AT)) < 3, 'black fog without lights stays black');

  // 4. Fog colour builds up with distance: a far wall takes more than a near one.
  const walls = [
    { id: 'near-wall', type: 'box', size: [3, 6, 0.3], position: [-3, 0, -2], material: 'dark' },
    { id: 'far-wall', type: 'box', size: [40, 30, 0.3], position: [14, 0, -70], material: 'dark' },
  ];
  const hazy = await render(
    'haze',
    scene({
      lightFog: { density: 0.03, falloffMeters: 200, color: [0.2, 0.3, 0.5] },
      nodes: walls,
      light: false,
    }),
  );
  report.haze = { near: patch(hazy, project([-3, 2, -2])), far: patch(hazy, project([6, 2, -70])) };
  assert.ok(
    report.haze.far[2] > report.haze.near[2] + 30,
    'the far wall is hazier than the near one',
  );
  assert.ok(report.haze.far[2] > report.haze.far[0], 'haze has the fog colour');

  // 5. A wall on the ray, in front of the light, cuts most of the glow.
  const blocked = await render(
    'blocked',
    scene({
      lightFog: fog,
      nodes: [
        { id: 'wall', type: 'box', size: [6, 8, 0.3], position: [2, 0, 1], material: 'dark' },
      ],
    }),
  );
  report.blocked = patch(blocked, AT);
  assert.ok(
    report.blocked[0] < report.glow.at[0] * 0.5,
    'a wall in front of the light cuts the glow',
  );

  // 6. Thinner fog higher up: the same light glows less far above the base.
  const high = await render(
    'thin-above',
    scene({ lightFog: { ...fog, falloffMeters: 1, baseY: 0 } }),
  );
  report.thin = patch(high, NEAR);
  assert.ok(report.thin[0] < report.glow.near[0], 'fog that thins with height glows less at 3 m');

  // 7. 30 mounts with and without fog, then the first frames again.
  for (let i = 0; i < 30; i++) await host.mountReport(scene(i % 2 ? { lightFog: fog } : {}));
  assert.ok(
    (await render('light-fog-again', scene({ lightFog: fog }))).data.equals(lit.data),
    'identical after 30 mounts',
  );
  assert.ok(
    (await render('plain-again', scene())).data.equals(plain.data),
    'plain frame unchanged',
  );

  // 8. Light shafts: the sun is in the east at 30 degrees; a long wall at
  // x = 5 shades the fog below the line y = 6 - (5 - x) * tan(30). A ray that
  // stays under it gets no light, a ray that rises above it or runs out from
  // under it does. A wrong light direction or a mirrored depth picture fails.
  const wall = {
    id: 'wall',
    type: 'box',
    size: [0.3, 6, 80],
    position: [5, 0, -20],
    material: 'dark',
  };
  const sunny = {
    sun: { azimuthDeg: 90, elevationDeg: 30, intensity: 3, color: [1, 0.9, 0.7] },
  };
  const shaftFog = { density: 0.03, falloffMeters: 200, color: [0, 0, 0], scatter: 0 };
  const beams = await render(
    'shafts',
    scene({
      light: false,
      nodes: [wall],
      look: sunny,
      lightFog: { ...shaftFog, shafts: { strength: 4, distance: 30, steps: 64 } },
    }),
  );
  const UNDER = project([0, 1, -8]),
    ABOVE = project([0, 5, -8]),
    BEYOND = project([-6, 1, -8]);
  report.shafts = {
    under: patch(beams, UNDER),
    above: patch(beams, ABOVE),
    beyond: patch(beams, BEYOND),
  };
  assert.ok(
    report.shafts.under[0] < 12,
    `fog in the wall's shadow stays dark: ${report.shafts.under}`,
  );
  assert.ok(
    report.shafts.above[0] > report.shafts.under[0] * 3 + 20,
    `fog above the shadow is lit: ${report.shafts.above}`,
  );
  assert.ok(
    report.shafts.beyond[0] > report.shafts.under[0] * 3 + 10,
    `fog past the end of the shadow is lit: ${report.shafts.beyond}`,
  );
  assert.ok(report.shafts.above[0] > report.shafts.above[2], 'beams keep the colour of the sun');
  const open = await render(
    'shafts-open',
    scene({
      light: false,
      look: sunny,
      lightFog: { ...shaftFog, shafts: { strength: 4, distance: 30, steps: 64 } },
    }),
  );
  report.shaftsOpen = patch(open, UNDER);
  assert.ok(
    report.shaftsOpen[0] > report.shafts.under[0] * 3 + 20,
    `without the wall the same fog is lit: ${report.shaftsOpen}`,
  );
  const noShafts = await render(
    'shafts-off',
    scene({ light: false, nodes: [wall], look: sunny, lightFog: shaftFog }),
  );
  assert.ok(Math.max(...patch(noShafts, ABOVE)) < 3, 'no beams without shafts');
  for (let i = 0; i < 20; i++)
    await host.mountReport(
      scene(
        i % 2
          ? { light: false, look: sunny, lightFog: { ...shaftFog, shafts: {} } }
          : { lightFog: fog },
      ),
    );
  assert.ok(
    (
      await render(
        'shafts-again',
        scene({
          light: false,
          nodes: [wall],
          look: sunny,
          lightFog: { ...shaftFog, shafts: { strength: 4, distance: 30, steps: 64 } },
        }),
      )
    ).data.equals(beams.data),
    'shafts identical after 20 mounts',
  );

  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, gpu: host.info.gpu, out, ...report }, null, 2));
} finally {
  await host.close();
}
