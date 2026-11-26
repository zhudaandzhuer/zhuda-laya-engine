// Serves dist/web on loopback for the preview and the checks. Usage: node tools/serve.mjs [port]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'dist/web');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.wasm': 'application/wasm' };
export function serve(port = 0) {
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(root + path.sep)) return void res.writeHead(403).end();
    fs.readFile(file, (error, bytes) => {
      if (error) return void res.writeHead(404).end();
      res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      res.end(bytes);
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}/` })));
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const { base } = await serve(Number(process.argv[2] || 8897));
  console.log('scene:   ' + base + 'index.html');
}
