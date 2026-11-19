import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';

// A stand-in for the browser: it answers the host's page calls and keeps
// what each one was asked, so the test reads the options the page is given.
function fakeBrowser(calls) {
  return async () => ({
    send: async () => ({}),
    evaluate: async (expression) => {
      if (expression.includes('__ZHUDA_FILM__.info()'))
        return { ready: true, version: 'test', props: [], recipes: [] };
      const call = expression.match(/^window\.__ZHUDA_FILM__\.(\w+)\((.*)\)$/s);
      if (!call) return 'fake renderer';
      const args = JSON.parse(call[2]);
      calls.push({ method: call[1], args });
      if (call[1] === 'mount') return { batches: [], models: [], mountMs: 0 };
      const frame = (width, height) => ({
        rgba: Buffer.alloc(width * height * 4).toString('base64'),
        width,
        height,
        renderMs: 1,
        accumulation: 'display-linear',
      });
      if (call[1] === 'render') return frame(args.width, args.height);
      if (call[1] === 'review') return { ...frame(args.width, args.height), cells: [] };
      return null;
    },
    errors: [],
    glErrors: [],
    consoleMessages: [],
    close: async () => ({ errors: [] }),
  });
}

const scene = {
  schemaVersion: 1,
  id: 'timeout',
  camera: { eye: [0, 1, 5], target: [0, 1, 0] },
  nodes: [{ id: 'ground', type: 'ground', size: [10, 10], material: 'concrete' }],
};

test('the page is given as long to draw a frame as the host waits for it', async () => {
  const calls = [];
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-film-timeout-'));
  const host = new ZhudaFilmHost({ outputDir, chrome: fakeBrowser(calls) });
  try {
    await host.still(scene, { name: 'still', width: 64, height: 64, samples: 2 });
    await host.preview(scene, { width: 64, height: 64 });
    await host.review(scene, {
      shots: [{ label: 'One', camera: scene.camera }],
      width: 64,
      height: 64,
    });
    const renders = calls.filter((call) => call.method === 'render');
    const [still, preview] = renders;
    // The capture's own default is 30 s: a final still of many samples on a
    // slow or software GPU takes longer, and the host waits ten minutes for it.
    assert.ok(
      still.args.timeoutMs >= 300_000,
      `a still is given ${still.args.timeoutMs} ms by the page; the host waits 600000`,
    );
    assert.ok(
      preview.args.timeoutMs >= 60_000,
      `a preview is given ${preview.args.timeoutMs} ms by the page; the host waits 120000`,
    );
    const review = calls.find((call) => call.method === 'review');
    assert.ok(
      review.args.timeoutMs >= 60_000,
      `a review shot is given ${review.args.timeoutMs} ms`,
    );
  } finally {
    await host.close();
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});
