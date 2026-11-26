// A script for shot.mjs: what a built game costs on the machine it runs on.
//   MEASURE_SECONDS=30 node games/tools/shot.mjs games/zhuda-wardrobe --gpu --dpr 2 \
//     --query "look=hair-bob.shirt.trousers.boots._._.pack.straw-hat" --script games/tools/device-measure.mjs --out <dir> --name stand
//   MEASURE_SOAK_MINUTES=30 ... --query "auto=1&spin=1"      memory at the start and every ten minutes
// Frame rate is the page's own requestAnimationFrame; triangles and draws are what the game
// reports on window.__GAME__ (a game that reports neither gets nulls). Memory is the page's
// JavaScript heap after a collection and the resident size of the browser's renderer and GPU
// processes (`ps`): there is no count of memory on the graphics card, and on a machine with
// shared memory the GPU process's size is the nearest thing to one.
// Beside the page's DOM node count are the Laya stage's nodes (`stageNodes`, and `stageNodesShown`: those
// visible with everything above them), counted by the engine's stage probe from outside the page: a game
// that leaks sprites shows it there, where the DOM count stays flat. Null on a page without `Laya.stage`.
import { execFileSync } from 'node:child_process';
import { stageProbeExpression } from '../../packages/compiler/stage-probe.mjs';

const seconds = Number(process.env.MEASURE_SECONDS ?? 30);
const soakMinutes = Number(process.env.MEASURE_SOAK_MINUTES ?? 0);
const everyMinutes = Number(process.env.MEASURE_EVERY_MINUTES ?? 10);
const run = process.argv.includes('--name') ? process.argv[process.argv.indexOf('--name') + 1] : 'run';

const summary = (gaps) => {
  const sorted = [...gaps].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
  const total = gaps.reduce((a, b) => a + b, 0);
  const round = (x) => Math.round(x * 100) / 100;
  return {
    frames: gaps.length,
    seconds: round(total / 1000),
    fps: round((gaps.length * 1000) / total),
    frameMs: { median: round(at(0.5)), p95: round(at(0.95)), p99: round(at(0.99)), worst: round(sorted[sorted.length - 1]) },
    over33ms: gaps.filter((g) => g > 33.4).length,
    over50ms: gaps.filter((g) => g > 50).length,
  };
};

export default async ({ page, shot, state, sleep, log }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const browser = await page.context().browser().newBrowserCDPSession();
  const frames = (ms) =>
    page.evaluate(
      (ms) =>
        new Promise((resolve) => {
          const gaps = [];
          let last = performance.now();
          const start = last;
          const tick = (now) => {
            gaps.push(now - last);
            last = now;
            if (now - start < ms) requestAnimationFrame(tick);
            else resolve(gaps.slice(1));
          };
          requestAnimationFrame(tick);
        }),
      ms,
    );
  const memory = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    const { metrics } = await cdp.send('Performance.getMetrics');
    const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
    const mb = (bytes) => Math.round((bytes / 1048576) * 10) / 10;
    const stage = await page.evaluate(stageProbeExpression({ counts: true })).catch(() => null);
    const out = { jsHeapUsedMB: mb(m.JSHeapUsedSize), jsHeapTotalMB: mb(m.JSHeapTotalSize), domNodes: m.Nodes, stageNodes: stage?.ok ? stage.total : null, stageNodesShown: stage?.ok ? stage.shown : null, listeners: m.JSEventListeners };
    try {
      const { processInfo } = await browser.send('SystemInfo.getProcessInfo');
      for (const type of ['renderer', 'GPU']) {
        const ids = processInfo.filter((p) => p.type === type).map((p) => p.id);
        const kb = ids.map((id) => Number(execFileSync('ps', ['-o', 'rss=', '-p', String(id)]).toString().trim() || 0));
        out[`${type.toLowerCase()}ProcessMB`] = mb(kb.reduce((a, b) => a + b, 0) * 1024);
      }
    } catch (error) {
      out.processes = String(error.message ?? error);
    }
    return out;
  };
  const game = async () => {
    const s = (await state()) ?? {};
    return { triangles: s.triangles ?? null, draws: s.draws ?? null, frames: s.frames ?? null, look: s.look ?? null, clip: s.clip ?? null };
  };
  const sample = async (label, ms) => {
    const rate = summary(await frames(ms));
    const entry = { measure: label, ...rate, game: await game(), memory: await memory() };
    log(entry);
    await shot(`${run}-${label}`);
    return entry;
  };

  await sleep(3000); // shaders and first uploads are not what is being measured
  if (!soakMinutes) return void (await sample('rate', seconds * 1000));
  await sample('soak-00min', 10000);
  const start = Date.now();
  for (let minute = everyMinutes; minute <= soakMinutes; minute += everyMinutes) {
    await sleep(Math.max(0, start + minute * 60000 - Date.now()));
    await sample(`soak-${String(minute).padStart(2, '0')}min`, 10000);
  }
};
