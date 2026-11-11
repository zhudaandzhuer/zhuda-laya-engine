/**
 * Browser host for film scenes. Builds the public `3d` browser SDK bundle and
 * a small page script, serves them on loopback, drives headless Chrome and
 * renders every image through `ZhudaFilmRenderer` (cinematic capture).
 *
 * Writes files only inside `outputDir`. Scenes are data; no code from a caller
 * reaches the page.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import { PNG } from 'pngjs';
import { buildBrowserSdk } from '../compiler/browser-sdk.mjs';
import { chromeFixture } from '../compiler/chrome-host.mjs';
import { exportFilm } from '../ci-gate/export-film.mjs';
import { sampleZhudaFilmCameraPath, validateZhudaFilmCameraPath } from './runtime.mjs';

const engineRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
/** Opaque sRGB RGBA from the page, encoded here (no DOM canvas in the page). */
function encodePng({ rgba, width, height }) {
  const image = new PNG({ width, height });
  Buffer.from(rgba, 'base64').copy(image.data);
  if (image.data.length !== width * height * 4) throw Error('Film host returned a malformed frame');
  return PNG.sync.write(image, { colorType: 2, inputColorType: 6, inputHasAlpha: true });
}

function size(width, height, { max = 3840, even = false } = {}) {
  for (const [label, value] of [
    ['width', width],
    ['height', height],
  ])
    if (!Number.isSafeInteger(value) || value < 16 || value > max || (even && value % 2))
      throw Error(`${label} must be ${even ? 'an even ' : 'an '}integer 16..${max}`);
}
/** Shot time in seconds for previews and stills: where animations and moving nodes are. */
function shotTime(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 3600)
    throw Error('time must be 0..3600 seconds');
  return value;
}

function samplesOf(value, fallback) {
  const samples = value ?? fallback;
  if (!Number.isSafeInteger(samples) || samples < 1 || samples > 64)
    throw Error('samples must be an integer 1..64');
  return samples;
}

export class ZhudaFilmHost {
  #outputDir;
  #chrome;
  #work;
  #server;
  #browser;
  #origin;
  #mounted;
  #queue = Promise.resolve();
  #starting;
  #closed = false;
  info;

  #packs;
  #assetsDir;
  /**
   * `packs`: operator-chosen modules exporting `{ props, recipes }` (default
   * or named). They are trusted like any server code; agents only name what
   * they provide.
   */
  constructor({ outputDir, chrome = chromeFixture, packs = [], assets } = {}) {
    this.#outputDir = outputDir ? path.resolve(outputDir) : null;
    if (assets) {
      const dir = path.resolve(assets);
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory())
        throw Error(`Film asset directory not found: ${assets}`);
      this.#assetsDir = fs.realpathSync(dir);
    }
    this.#chrome = chrome;
    this.#packs = packs.map((file) => {
      const resolved = path.resolve(file);
      if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile())
        throw Error(`Film pack not found: ${file}`);
      return resolved;
    });
  }

  /**
   * Models (.glb) and lightmaps (.hdr) below the asset directory, as logical
   * ids, with a version that changes when any of them is rewritten.
   */
  assetList() {
    if (!this.#assetsDir) return { ids: [], version: '' };
    const found = [];
    const walk = (dir, prefix) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const id = prefix + entry.name;
        if (entry.isDirectory()) walk(path.join(dir, entry.name), id + '/');
        else if (entry.isFile() && /\.(glb|hdr)$/i.test(entry.name)) {
          const stat = fs.statSync(path.join(dir, entry.name));
          found.push({ id, stamp: `${id}:${stat.size}:${stat.mtimeMs}` });
        }
        if (found.length > 4096) throw Error('Film asset directory: more than 4096 assets');
      }
    };
    walk(this.#assetsDir, '');
    found.sort((a, b) => a.id.localeCompare(b.id));
    return {
      ids: found.map((item) => item.id),
      version: crypto
        .createHash('sha256')
        .update(found.map((item) => item.stamp).join('\n'))
        .digest('hex'),
    };
  }

  /** The file an `/assets/` request names, or null when it is outside the directory. */
  #assetFile(pathname) {
    if (!this.#assetsDir || !pathname.startsWith('/assets/')) return null;
    let id;
    try {
      id = decodeURIComponent(pathname.slice('/assets/'.length));
    } catch {
      return null;
    }
    if (
      !id ||
      id.includes('\0') ||
      id.split('/').some((part) => !part || part === '.' || part === '..')
    )
      return null;
    const file = path.join(this.#assetsDir, ...id.split('/'));
    try {
      const real = fs.realpathSync(file);
      if (!real.startsWith(this.#assetsDir + path.sep) || !fs.statSync(real).isFile()) return null;
      return real;
    } catch {
      return null;
    }
  }

  /** Runs browser work one call at a time. */
  #serial(task) {
    const run = this.#queue.then(task, task);
    this.#queue = run.catch(() => {});
    return run;
  }

  async #start() {
    if (this.#closed) throw Error('Film host closed');
    if (this.#browser) return;
    this.#starting ??= (async () => {
      this.#work = await fsp.mkdtemp(path.join(os.tmpdir(), 'zhuda-film-host-'));
      const web = path.join(this.#work, 'web');
      await buildBrowserSdk({ engineRoot, outDir: web, profiles: ['3d-gltf'] });
      // Packs import the public SDK; in the page that is the loaded `Zhuda`
      // bundle, so the import is mapped to it instead of bundling a copy.
      const imports = this.#packs.map(
        (file, i) => `import * as pack${i} from ${JSON.stringify(file)};`,
      );
      const list = this.#packs.map(
        (file, i) =>
          `{ name: ${JSON.stringify(path.basename(file))}, ...(pack${i}.default ?? pack${i}) }`,
      );
      await esbuild.build({
        stdin: {
          contents: [
            ...imports,
            `import { startFilmHost } from ${JSON.stringify(path.join(engineRoot, 'packages/compiler/film-host-client.ts'))};`,
            `startFilmHost([${list.join(', ')}], { assets: ${!!this.#assetsDir} });`,
          ].join('\n'),
          resolveDir: engineRoot,
          loader: 'js',
        },
        bundle: true,
        format: 'iife',
        target: 'es2020',
        outfile: path.join(web, 'film-host.js'),
        logLevel: 'silent',
        plugins: [
          {
            name: 'zhuda-sdk-global',
            setup(build) {
              build.onResolve({ filter: /^zhuda-laya-engine$/ }, () => ({
                path: 'zhuda-sdk-global',
                namespace: 'zhuda-sdk',
              }));
              build.onResolve({ filter: /^zhuda-laya-engine\/demo$/ }, () => ({
                path: path.join(engineRoot, 'packages/demo/index.ts'),
              }));
              build.onLoad({ filter: /.*/, namespace: 'zhuda-sdk' }, () => ({
                contents: 'module.exports = globalThis.Zhuda;',
                loader: 'js',
              }));
            },
          },
        ],
      });
      await fsp.writeFile(
        path.join(web, 'index.html'),
        '<!doctype html><meta charset="utf-8"><title>Zhuda film host</title>' +
          '<script>window.ZhudaBranding={mode:"none"}</script>' +
          '<div id="view" style="width:64px;height:64px"></div>' +
          '<script src="zhuda-3d-gltf.js"></script><script src="film-host.js"></script>',
      );
      const files = new Map(
        ['index.html', 'zhuda-3d-gltf.js', 'film-host.js'].map((name) => [
          `/${name}`,
          path.join(web, name),
        ]),
      );
      files.set('/', path.join(web, 'index.html'));
      this.#server = http.createServer((request, response) => {
        const port = this.#server.address().port;
        if (request.headers.host !== `127.0.0.1:${port}` || request.method !== 'GET') {
          response.writeHead(403).end();
          return;
        }
        const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
        const asset = this.#assetFile(pathname);
        const file = asset ?? files.get(pathname);
        if (!file) {
          response.writeHead(404).end();
          return;
        }
        response.writeHead(200, {
          'Content-Type': asset
            ? 'application/octet-stream'
            : file.endsWith('.html')
              ? 'text/html; charset=utf-8'
              : 'text/javascript',
          'Cache-Control': 'no-store',
        });
        fs.createReadStream(file).pipe(response);
      });
      await new Promise((resolve) => this.#server.listen(0, '127.0.0.1', resolve));
      this.#origin = `http://127.0.0.1:${this.#server.address().port}`;
      this.#browser = await this.#chrome();
      await this.#browser.send('Page.navigate', { url: `${this.#origin}/` });
      for (let i = 0; ; i++) {
        const info = await this.#browser
          .evaluate('window.__ZHUDA_FILM__ ? window.__ZHUDA_FILM__.info() : null')
          .catch(() => null);
        if (info?.error) throw Error('Film host boot failed: ' + info.error);
        if (info?.ready) {
          this.info = {
            ...info,
            gpu: await this.#browser.evaluate(
              // Ask Laya's own WebGL context, not a new canvas.
              `(()=>{const c=document.querySelector('#view canvas')?.getContext('webgl2');const d=c&&c.getExtension('WEBGL_debug_renderer_info');return c?(d?c.getParameter(d.UNMASKED_RENDERER_WEBGL):c.getParameter(c.RENDERER)):'unknown'})()`,
            ),
          };
          break;
        }
        if (i > 300) throw Error('Film host did not become ready');
        await new Promise((r) => setTimeout(r, 100));
      }
    })();
    try {
      await this.#starting;
    } catch (error) {
      this.#starting = undefined;
      await this.close();
      throw error;
    }
  }

  /** Starts the browser and loads the page (and its packs). */
  ready() {
    return this.#serial(() => this.#start());
  }

  async #call(method, args, timeoutMs = 120000) {
    const result = await this.#browser.evaluate(
      `window.__ZHUDA_FILM__.${method}(${JSON.stringify(args)})`,
      { timeoutMs },
    );
    const errors = this.#browser.errors.splice(0);
    if (errors.length) throw Error('Film host page error: ' + errors.join('; '));
    return result;
  }

  async #mount(scene) {
    const assetsVersion = this.assetList().version;
    const key = assetsVersion + JSON.stringify(scene);
    if (this.#mounted?.key === key) return this.#mounted.result;
    this.#mounted = undefined;
    const result = await this.#call('mount', { scene, assetsVersion });
    this.#mounted = { key, result };
    return result;
  }

  #output(name, extension) {
    if (!this.#outputDir)
      throw Error('Render jobs need an output directory; start the server with --film-output DIR');
    if (typeof name !== 'string' || !NAME.test(name))
      throw Error('name must use lowercase letters, digits, dot, dash or underscore');
    const file = path.join(this.#outputDir, name + extension);
    if (path.dirname(file) !== this.#outputDir) throw Error('Output escapes the film directory');
    if (fs.existsSync(file)) throw Error(`${path.basename(file)} exists; choose another name`);
    return file;
  }

  /** Console output of the page since it started (warnings and shader errors), for diagnosis. */
  consoleMessages() {
    return this.#browser ? [...this.#browser.consoleMessages] : [];
  }

  /** Mounts the scene and reports its batches, models and asset cache (no render). */
  mountReport(scene) {
    return this.#serial(async () => {
      await this.#start();
      return this.#mount(scene);
    });
  }

  /** PNG preview at the scene camera or the camera given. */
  preview(scene, { camera, width = 640, height = 360, time } = {}) {
    size(width, height, { max: 1920 });
    const timeSec = shotTime(time);
    return this.#serial(async () => {
      await this.#start();
      const mounted = await this.#mount(scene);
      const frame = await this.#call('render', { camera, width, height, samples: 1, timeSec });
      return { png: encodePng(frame), ...mounted, renderMs: frame.renderMs };
    });
  }

  /** One PNG with up to four labelled shots. */
  review(scene, { shots, width = 384, height = 384 } = {}) {
    size(width, height, { max: 1024 });
    if (!Array.isArray(shots) || shots.length < 1 || shots.length > 4)
      throw Error('shots: use one to four shots');
    for (const shot of shots)
      if (
        !shot ||
        typeof shot.label !== 'string' ||
        !shot.label ||
        shot.label.length > 40 ||
        !shot.camera
      )
        throw Error('Each shot needs a label (1..40 characters) and a camera');
    for (const shot of shots) shotTime(shot.time);
    return this.#serial(async () => {
      await this.#start();
      await this.#mount(scene);
      const grid = await this.#call('review', { shots, width, height });
      return {
        png: encodePng(grid),
        width: grid.width,
        height: grid.height,
        cells: grid.cells,
      };
    });
  }

  /** Final still with anti-aliasing and depth of field, written as PNG. */
  still(scene, { name, camera, width = 1920, height = 1080, samples, time } = {}) {
    size(width, height);
    const timeSec = shotTime(time);
    const count = samplesOf(samples, 16),
      file = this.#output(name, '.png');
    return this.#serial(async () => {
      await this.#start();
      await this.#mount(scene);
      const frame = await this.#call(
        'render',
        { camera, width, height, samples: count, timeSec },
        600000,
      );
      const bytes = encodePng(frame);
      await fsp.writeFile(file, bytes, { flag: 'wx' });
      return {
        path: file,
        bytes: bytes.length,
        sha256: sha(bytes),
        width,
        height,
        samples: count,
        renderMs: frame.renderMs,
      };
    });
  }

  /** MP4 along a keyed camera path; frames go through the same capture and the film gate. */
  video(
    scene,
    { name, cameraPath, fps = 24, durationSec, width = 1280, height = 720, samples } = {},
  ) {
    size(width, height, { even: true });
    const count = samplesOf(samples, 4);
    if (!Number.isSafeInteger(fps) || fps < 1 || fps > 60)
      throw Error('fps must be an integer 1..60');
    const issues = validateZhudaFilmCameraPath(cameraPath);
    if (issues.length) throw Error('Invalid camera path:\n- ' + issues.join('\n- '));
    const duration = durationSec ?? cameraPath[cameraPath.length - 1].time,
      frames = Math.round(duration * fps);
    if (!Number.isFinite(duration) || duration <= 0 || Math.abs(frames - duration * fps) > 1e-6)
      throw Error('durationSec × fps must be a whole number of frames');
    if (frames > 1800) throw Error('A render job is limited to 1800 frames');
    const file = this.#output(name, '.mp4');
    return this.#serial(async () => {
      await this.#start();
      await this.#mount(scene);
      const stage = await fsp.mkdtemp(path.join(this.#work, 'frames-'));
      try {
        const report = {
          schemaVersion: 1,
          requestedBackend: 'webgl',
          selectedBackend: 'webgl',
          status: 'ready',
          errors: [],
          expectedTimes: [],
          frames: [],
        };
        for (let index = 0; index < frames; index++) {
          const time = index / fps,
            camera = sampleZhudaFilmCameraPath(cameraPath, time);
          const frame = await this.#call(
            'render',
            { camera, width, height, samples: count, index, fps },
            600000,
          );
          const bytes = encodePng(frame),
            imagePath = `frame-${String(index).padStart(5, '0')}.png`;
          await fsp.writeFile(path.join(stage, imagePath), bytes);
          report.expectedTimes.push(time);
          report.frames.push({ time, ready: true, imagePath, imageSha256: sha(bytes) });
        }
        const reportPath = path.join(stage, 'report.json');
        await fsp.writeFile(reportPath, JSON.stringify(report));
        const film = await exportFilm({ reportPath, fps, output: file });
        const bytes = await fsp.readFile(file);
        return {
          path: file,
          bytes: bytes.length,
          sha256: sha(bytes),
          frames: film.frames,
          fps,
          durationSec: film.durationSec,
          width,
          height,
          samples: count,
        };
      } finally {
        await fsp.rm(stage, { recursive: true, force: true });
      }
    });
  }

  async close() {
    this.#closed = true;
    await this.#browser?.close().catch(() => {});
    this.#browser = undefined;
    await new Promise((resolve) => (this.#server ? this.#server.close(resolve) : resolve()));
    this.#server = undefined;
    if (this.#work) await fsp.rm(this.#work, { recursive: true, force: true });
  }
}
