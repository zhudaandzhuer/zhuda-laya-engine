#!/usr/bin/env node
/**
 * Minimal static server for the built workbench (`npm start`).
 * Loopback only, no directory listing, no path escape. Usage:
 *   node scripts/serve.mjs [directory=dist/web] [port=8890]
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'dist/web');
const port = Number(process.argv[3] || 8890);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Invalid port');
  process.exit(1);
}
if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  console.error(`Nothing to serve at ${root}; run npm run build first`);
  process.exit(1);
}

const server = http.createServer((request, response) => {
  const send = (status, body) => {
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(body);
  };
  const host = String(request.headers.host || '').toLowerCase();
  if (!['localhost', '127.0.0.1', '[::1]'].some((name) => host === `${name}:${port}`))
    return send(403, 'Invalid Host');
  if (request.method !== 'GET' && request.method !== 'HEAD') return send(405, 'Method not allowed');
  let relative;
  try {
    relative = decodeURIComponent((request.url || '/').split('?')[0]);
  } catch {
    return send(400, 'Bad path');
  }
  let file = path.resolve(root, '.' + path.posix.normalize('/' + relative.replace(/\\/g, '/')));
  if (file !== root && !file.startsWith(root + path.sep)) return send(400, 'Bad path');
  fs.stat(file, (statError, stat) => {
    if (!statError && stat.isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (error, bytes) => {
      if (error) return send(error.code === 'ENOENT' ? 404 : 500, 'Not found');
      response.writeHead(200, {
        'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    });
  });
});
server.listen(port, '127.0.0.1', () => console.log(`Serving ${root} at http://127.0.0.1:${port}/`));
