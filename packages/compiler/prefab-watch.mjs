#!/usr/bin/env node

/**
 * Build a consumer once and keep its Scene / isolated Prefab preview in sync.
 *
 * The watcher deliberately stays outside the generated web payload. It only
 * serves dist/web, injects a tiny SSE client into the two generated entry
 * pages, and reloads them after a successful build. A failed build is sent to
 * the page as an error event and never replaces the last good output.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runZhudaBuild } from "./zhuda-build.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export function parseWatchArgs(argv = process.argv.slice(2)) {
  const value = (name, fallback) => {
    const index = argv.indexOf(name);
    return index === -1 ? fallback : argv[index + 1];
  };
  const project = path.resolve(value("--project", process.cwd()));
  const port = Number(value("--port", "8890"));
  const host = value("--host", "127.0.0.1");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error("Invalid --port");
  if (!host || host.includes("/")) throw Error("Invalid --host");
  if (!fs.existsSync(project) || !fs.statSync(project).isDirectory()) throw Error(`Project does not exist: ${project}`);
  return { project, port, host };
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
  if (html.includes("data-zhuda-live-reload")) return html;
  const script = liveReloadScript();
  return html.includes("</body>") ? html.replace("</body>", `${script}</body>`) : `${html}${script}`;
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
  })[ext] || "application/octet-stream";
}

function safeFile(root, requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0]);
  const relative = decoded.replace(/^\/+/, "") || "index.html";
  const file = path.resolve(root, relative);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) return null;
  return file;
}

export function createPreviewServer({ root, host = "127.0.0.1", port = 8890, onBuild }) {
  const clients = new Set();
  const server = http.createServer((request, response) => {
    if (request.url?.split("?")[0] === "/__zhuda_reload") {
      response.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      response.write(`event: ready\ndata: ${Date.now()}\n\n`);
      clients.add(response);
      const heartbeat = setInterval(() => response.write(": heartbeat\n\n"), 20_000);
      request.on("close", () => { clearInterval(heartbeat); clients.delete(response); });
      return;
    }
    const file = safeFile(root, request.url || "/");
    if (!file) { response.writeHead(400); response.end("Bad path"); return; }
    fs.stat(file, (statError, stat) => {
      const target = !statError && stat.isDirectory() ? path.join(file, "index.html") : file;
      fs.readFile(target, (error, bytes) => {
        if (error) { response.writeHead(error.code === "ENOENT" ? 404 : 500); response.end(error.code === "ENOENT" ? "Not found" : "Read failed"); return; }
        const body = path.basename(target) === "index.html" || path.basename(target) === "prefab-preview.html"
          ? withLiveReload(bytes.toString("utf8")) : bytes;
        response.writeHead(200, { "Content-Type": contentType(target), "Cache-Control": "no-cache" });
        response.end(body);
      });
    });
  });
  const broadcast = (event, value) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`;
    for (const client of clients) {
      try { client.write(payload); } catch { clients.delete(client); }
    }
  };
  const listening = new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve(server.address()));
  });
  const close = async () => {
    for (const client of clients) client.end();
    clients.clear();
    await new Promise(resolve => server.close(() => resolve()));
  };
  return { server, listening, broadcast, close, clients, onBuild };
}

function watchRoots(project) {
  return ["src", "assets", "public", "zhuda.config.json", "package.json"]
    .map(relative => path.join(project, relative))
    .filter(file => fs.existsSync(file));
}

export function watchConsumer({ project, port, host, build = runZhudaBuild, log = console }) {
  let building = false;
  let queued = false;
  let closed = false;
  let activeBuild = Promise.resolve();
  let timer;
  const watchers = [];
  const preview = createPreviewServer({ root: path.join(project, "dist/web"), host, port });
  const rebuild = async (reason = "source change") => {
    if (closed) return null;
    if (building) { queued = true; return; }
    building = true;
    let finished;
    activeBuild = new Promise(resolve => { finished = resolve; });
    preview.broadcast("status", { state: "building", reason });
    try {
      const result = await build({ projectRoot: project });
      if (!closed) preview.broadcast("reload", { state: "ready", reason, at: Date.now() });
      log.log(`[Zhuda Watch] rebuilt after ${reason}`);
      return result;
    } catch (error) {
      preview.broadcast("error", error instanceof Error ? error.message : String(error));
      log.error(`[Zhuda Watch] build failed: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      return null;
    } finally {
      building = false;
      finished();
      if (queued && !closed) { queued = false; void rebuild("queued source change"); }
    }
  };
  const schedule = reason => {
    if (closed) return;
    clearTimeout(timer);
    timer = setTimeout(() => void rebuild(reason), 120);
  };
  for (const root of watchRoots(project)) {
    try {
      watchers.push(fs.watch(root, { recursive: fs.statSync(root).isDirectory() }, (_event, filename) => {
        schedule(`${path.relative(project, root)}${filename ? `/${filename}` : ""}`);
      }));
    } catch (error) {
      log.warn(`[Zhuda Watch] unable to watch ${root}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const close = async () => {
    closed = true;
    queued = false;
    clearTimeout(timer);
    for (const watcher of watchers) watcher.close();
    await activeBuild;
    await preview.close();
  };
  return { preview, rebuild, close, watchers };
}

async function main() {
  const args = parseWatchArgs();
  const watcher = watchConsumer(args);
  await watcher.preview.listening;
  await watcher.rebuild("initial build");
  console.log(`[Zhuda Watch] http://${args.host}:${args.port}/prefab-preview.html?id=ui/control-bar`);
  const stop = async () => { await watcher.close(); process.exit(0); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

const launched = (() => {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(path.join(moduleDir, "prefab-watch.mjs"));
  } catch {
    return path.resolve(process.argv[1]) === path.join(moduleDir, "prefab-watch.mjs");
  }
})();
if (launched) main().catch(error => { console.error(error); process.exit(1); });
