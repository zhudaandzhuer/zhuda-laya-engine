#!/usr/bin/env node
import { cliMain } from './cli.mjs';
import { isAllowedRequestHost } from './editor-http.mjs';

/**
 * Build a consumer once and keep its Scene / isolated Prefab preview in sync.
 *
 * The watcher deliberately stays outside the generated web payload. It only
 * serves dist/web, injects a tiny SSE client into the two generated entry
 * pages, and reloads them after a successful build. A failed build is sent to
 * the page as an error event and never replaces the last good output.
 *
 * With --candidate, a save that changed only files under src/ is answered by
 * rebuilding app.js alone (consumer-scripts.mjs). That bundle is served from
 * memory and never written: the output directory stays the last full build.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { resolveEngineRoot, runZhudaBuild } from './zhuda-build.mjs';
import {
  classifyWatchChange,
  createScriptRebuilder,
  scriptsOnlyObstacle,
  staleManifest,
} from './consumer-scripts.mjs';

export function parseWatchArgs(argv = process.argv.slice(2)) {
  const value = (name, fallback) => {
    const index = argv.indexOf(name);
    return index === -1 ? fallback : argv[index + 1];
  };
  const project = path.resolve(value('--project', process.cwd()));
  const port = Number(value('--port', '8890'));
  const host = value('--host', '127.0.0.1');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid --port');
  if (!host || host.includes('/')) throw Error('Invalid --host');
  if (!fs.existsSync(project) || !fs.statSync(project).isDirectory())
    throw Error(`Project does not exist: ${project}`);
  return {
    project,
    port,
    host,
    candidate: argv.includes('--candidate'),
    fullBuilds: argv.includes('--full-builds'),
  };
}

export function liveReloadScript() {
  return `<script data-zhuda-live-reload>(function(){
  if (!window.EventSource) return;
  var source = new EventSource('/__zhuda_reload');
  source.addEventListener('reload', function(){ window.location.reload(); });
  source.addEventListener('error', function(event){
    if (!event || !event.data) return;
    var node = document.querySelector('[data-zhuda-build-error]');
    if (!node) {
      node = document.createElement('div');
      node.setAttribute('data-zhuda-build-error', '');
      node.setAttribute('role', 'alert');
      node.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:2147483647;background:#1a1010;padding:12px;white-space:pre-wrap;pointer-events:none';
      document.body.appendChild(node);
    }
    var detail = event.data;
    if (node) { node.textContent = detail; node.style.color = '#ff8b8b'; }
  });
  window.addEventListener('pagehide', function(){ source.close(); }, { once: true });
})();</script>`;
}

function withLiveReload(html) {
  if (html.includes('data-zhuda-live-reload')) return html;
  const script = liveReloadScript();
  return html.includes('</body>')
    ? html.replace('</body>', `${script}</body>`)
    : `${html}${script}`;
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
    }[ext] || 'application/octet-stream'
  );
}

function safeFile(root, requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath.split('?')[0]);
  } catch {
    return null;
  }
  const relative = decoded.replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(root, relative);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) return null;
  return file;
}

export function createPreviewServer({
  root,
  host = '127.0.0.1',
  port = 8890,
  onBuild,
  reload = true,
}) {
  const clients = new Set();
  // Files answered from memory in place of the ones under `root`, by their path in the payload.
  const overlay = new Map();
  const server = http.createServer((request, response) => {
    // A page on another origin must not be able to read the preview through a
    // rebinding hostname. Binding to 0.0.0.0 stays open for device testing.
    if (!isAllowedRequestHost(request, host)) {
      response.writeHead(403);
      response.end('Invalid Host');
      return;
    }
    if (request.url?.split('?')[0] === '/__zhuda_reload') {
      response.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      response.write(`event: ready\ndata: ${Date.now()}\n\n`);
      clients.add(response);
      const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 20_000);
      request.on('close', () => {
        clearInterval(heartbeat);
        clients.delete(response);
      });
      return;
    }
    const file = safeFile(root, request.url || '/');
    if (!file) {
      response.writeHead(400);
      response.end('Bad path');
      return;
    }
    const held = overlay.get(path.relative(root, file).split(path.sep).join('/'));
    if (held) {
      response.writeHead(200, { 'Content-Type': contentType(file), 'Cache-Control': 'no-cache' });
      response.end(held);
      return;
    }
    fs.stat(file, (statError, stat) => {
      const target = !statError && stat.isDirectory() ? path.join(file, 'index.html') : file;
      fs.readFile(target, (error, bytes) => {
        if (error) {
          response.writeHead(error.code === 'ENOENT' ? 404 : 500);
          response.end(error.code === 'ENOENT' ? 'Not found' : 'Read failed');
          return;
        }
        const body =
          reload &&
          (path.basename(target) === 'index.html' ||
            path.basename(target) === 'prefab-preview.html')
            ? withLiveReload(bytes.toString('utf8'))
            : bytes;
        response.writeHead(200, {
          'Content-Type': contentType(target),
          'Cache-Control': 'no-cache',
        });
        response.end(body);
      });
    });
  });
  const broadcast = (event, value) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`;
    for (const client of clients) {
      try {
        client.write(payload);
      } catch {
        clients.delete(client);
      }
    }
  };
  const listening = new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server.address()));
  });
  const close = async () => {
    for (const client of clients) client.end();
    clients.clear();
    await new Promise((resolve) => server.close(() => resolve()));
  };
  return { server, listening, broadcast, close, clients, onBuild, overlay };
}

function watchRoots(project) {
  return ['src', 'assets', 'public', 'zhuda.config.json', 'package.json']
    .map((relative) => path.join(project, relative))
    .filter((file) => fs.existsSync(file));
}

export function watchConsumer({
  project,
  port,
  host,
  candidate = false,
  fullBuilds = false,
  watchFiles = true,
  build = runZhudaBuild,
  scripts = createScriptRebuilder,
  log = console,
}) {
  let building = false;
  let queued = null;
  let closed = false;
  let activeBuild = Promise.resolve();
  let timer;
  const watchers = [];
  const configFile = path.join(project, 'zhuda.config.json');
  const config = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf8')) : {};
  const release = path.resolve(project, config.outDir || 'dist/web');
  const root = candidate
    ? path.join(path.dirname(release), 'candidate', path.basename(release))
    : release;
  const preview = createPreviewServer({ root, host, port });
  const where = path.relative(project, root).split(path.sep).join('/') || '.';
  // Paths, relative to the project, that changed since the last build began.
  const pending = new Set();
  // What the last full build was made from, for as long as the output directory is that build:
  // null until the first one succeeds, and again after one fails.
  let full = null;
  // The script bundle kept between saves, made in the background after a full build.
  let kept = null;
  // Whether the scripts have been rebuilt, or tried, since the directory was last written.
  let ahead = false;
  // The inputs a bundle could not be kept for, and why: not tried again until they change.
  let unkept = null;
  let explained;
  const message = (error) => (error instanceof Error ? error.message : String(error));
  // A build reads these two besides the watched directories. A scripts-only rebuild is right
  // only while they are what the last full build read, whether or not a change event came.
  const inputs = () => {
    const texts = ['zhuda.config.json', 'package.json'].map((name) => {
      try {
        return fs.readFileSync(path.join(project, name), 'utf8');
      } catch {
        return null;
      }
    });
    let parsed = null;
    try {
      parsed = texts[0] === null ? null : JSON.parse(texts[0]);
    } catch {
      // The build itself reports a configuration that is not JSON.
    }
    return { signature: JSON.stringify(texts), config: parsed };
  };
  const dropKept = async () => {
    const old = kept;
    kept = null;
    if (!old) return;
    try {
      await (await old.ready).dispose();
    } catch {
      // It never came to be.
    }
  };
  const runFull = async () => {
    const made = inputs();
    full = null;
    const result = await build({ projectRoot: project, candidate });
    // Published: the directory is the sources again, so nothing is answered from memory.
    preview.overlay.clear();
    ahead = false;
    const engineRoot = resolveEngineRoot(project, made.config?.engineRoot);
    const obstacle = fullBuilds
      ? '--full-builds was given'
      : (scriptsOnlyObstacle({
          projectRoot: project,
          engineRoot,
          config: made.config,
          candidate,
        }) ?? (unkept?.signature === made.signature ? unkept.reason : null));
    if (kept && kept.signature !== made.signature) await dropKept();
    full = { ...made, engineRoot, obstacle, manifest: undefined };
    if (obstacle !== explained) {
      explained = obstacle;
      log.log(
        obstacle
          ? `[Zhuda Watch] every change runs the full build: ${obstacle}`
          : `[Zhuda Watch] a save that changes only src/ rebuilds app.js alone, served from memory; ${where} on disk keeps the last full build`,
      );
    }
    // Made now, in the background, so that the first save is as quick as the ones after it.
    if (obstacle === null && !closed) void bundle();
    return result;
  };
  const scriptsAlone = (paths) =>
    full !== null &&
    full.obstacle === null &&
    paths.length > 0 &&
    paths.every((file) => classifyWatchChange(file) === 'scripts') &&
    inputs().signature === full.signature;
  /** The kept bundle, or null (and full builds from now on) when it cannot be made. */
  const bundle = async () => {
    const state = full;
    if (!kept)
      kept = {
        signature: state.signature,
        ready: Promise.resolve().then(() =>
          scripts({ projectRoot: project, engineRoot: state.engineRoot, config: state.config }),
        ),
      };
    const mine = kept;
    try {
      return await mine.ready;
    } catch (error) {
      if (kept === mine) kept = null;
      const reason = `the script bundle could not be kept (${message(error)})`;
      unkept = { signature: state.signature, reason };
      if (full === state && state.obstacle === null) {
        state.obstacle = explained = reason;
        log.warn(`[Zhuda Watch] every change runs the full build: ${reason}`);
      }
      return null;
    }
  };
  const runScripts = async (rebuilder) => {
    // From here the scripts are newer than the directory, whether or not they compile.
    ahead = true;
    const app = await rebuilder.rebuild();
    if (full.manifest === undefined) {
      try {
        full.manifest = JSON.parse(fs.readFileSync(path.join(root, 'payload-manifest.json')));
      } catch {
        full.manifest = null;
      }
    }
    const served = { 'app.js': app };
    const manifest = staleManifest(full.manifest, served);
    if (manifest)
      preview.overlay.set('payload-manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));
    for (const [file, bytes] of Object.entries(served)) preview.overlay.set(file, bytes);
    return { scriptsOnly: true, served: Object.keys(served) };
  };
  /**
   * Build once. `changed` adds paths (relative to the project) to the ones the file watchers
   * have seen; the build is scripts-only when every one of them is under src/ and nothing else
   * stands in the way, and the full build otherwise.
   */
  const rebuild = async (reason = 'source change', changed = []) => {
    if (closed) return null;
    for (const file of changed) pending.add(file);
    if (building) {
      queued = reason;
      return;
    }
    building = true;
    let finished;
    activeBuild = new Promise((resolve) => {
      finished = resolve;
    });
    const paths = [...pending];
    pending.clear();
    const started = performance.now();
    let kind = 'full';
    try {
      const rebuilder = scriptsAlone(paths) ? await bundle() : null;
      if (rebuilder) kind = 'scripts only';
      preview.broadcast('status', { state: 'building', reason, kind });
      const result = rebuilder ? await runScripts(rebuilder) : await runFull();
      if (!closed) preview.broadcast('reload', { state: 'ready', reason, kind, at: Date.now() });
      log.log(
        `[Zhuda Watch] rebuilt after ${reason} in ${Math.round(performance.now() - started)} ms, ${kind}`,
      );
      return result;
    } catch (error) {
      preview.broadcast('error', message(error));
      log.error(
        `[Zhuda Watch] build failed after ${reason} in ${Math.round(performance.now() - started)} ms, ${kind}: ${error instanceof Error ? error.stack || error.message : String(error)}`,
      );
      return null;
    } finally {
      building = false;
      finished();
      if (queued !== null && !closed) {
        const next = queued;
        queued = null;
        void rebuild(next);
      }
    }
  };
  /** A watched path changed: build after the changes have been quiet for a moment. */
  const note = (relative) => {
    if (closed) return;
    pending.add(relative);
    clearTimeout(timer);
    timer = setTimeout(
      () => void rebuild(pending.size > 1 ? `${relative} and ${pending.size - 1} more` : relative),
      120,
    );
  };
  for (const watched of watchFiles ? watchRoots(project) : []) {
    const name = path.relative(project, watched).split(path.sep).join('/');
    try {
      watchers.push(
        fs.watch(watched, { recursive: fs.statSync(watched).isDirectory() }, (_event, filename) => {
          note(filename ? `${name}/${String(filename).split(path.sep).join('/')}` : name);
        }),
      );
    } catch (error) {
      log.warn(`[Zhuda Watch] unable to watch ${watched}: ${message(error)}`);
    }
  }
  const close = async () => {
    closed = true;
    queued = null;
    clearTimeout(timer);
    for (const watcher of watchers) watcher.close();
    await activeBuild;
    if (ahead)
      log.log(
        `[Zhuda Watch] stopped: ${where} on disk is the last full build, older than the scripts; a full build brings it up to date`,
      );
    await dropKept();
    await preview.close();
  };
  return { preview, rebuild, note, close, watchers };
}

async function main() {
  const args = parseWatchArgs();
  const watcher = watchConsumer(args);
  await watcher.preview.listening;
  await watcher.rebuild('initial build');
  console.log(
    `[Zhuda Watch] http://${args.host}:${args.port}/prefab-preview.html?id=ui/control-bar`,
  );
  const stop = async () => {
    await watcher.close();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

const launched = cliMain(
  import.meta.url,
  'Usage: zhuda-laya-watch [--project DIRECTORY] [--host HOST] [--port PORT] [--candidate] [--full-builds]',
);
if (launched)
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
