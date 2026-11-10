import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const realPath = (value) => fs.realpathSync(value);
export const inside = (root, file) => file === root || file.startsWith(root + path.sep);
export const scriptJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
const fail = (status, message) => Object.assign(new Error(message), { status });

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const ANY_INTERFACE = new Set(['0.0.0.0', '::']);
export const isLoopbackHost = (host) => LOOPBACK.has(String(host).toLowerCase());

/**
 * Host-header check for local tool servers (DNS-rebinding guard). A server
 * bound to every interface accepts any name; it must authenticate instead.
 */
export function isAllowedRequestHost(request, boundHost) {
  const raw = request.headers.host;
  if (
    typeof raw !== 'string' ||
    request.rawHeaders.filter(
      (_, i) => i % 2 === 0 && request.rawHeaders[i].toLowerCase() === 'host',
    ).length !== 1
  )
    return false;
  let authority;
  try {
    authority = new URL('http://' + raw);
  } catch {
    return false;
  }
  if (raw !== authority.host || Number(authority.port || 80) !== request.socket.localPort)
    return false;
  if (ANY_INTERFACE.has(boundHost)) return true;
  const name = authority.hostname.toLowerCase();
  return LOOPBACK.has(name) || name === String(boundHost).toLowerCase();
}

/**
 * One capability per editor process. Do not put the API token in URLs, logs
 * or referrers.
 *
 * Loopback is the default and needs nothing else. Any other bind address must
 * be requested with `allowRemote`; the editor then also requires a session:
 * the start URL carries a one-time key that is exchanged for an HttpOnly
 * cookie, and every request without it is refused, including the page that
 * would otherwise hand out the API token.
 */
export function createEditorAccess(host, { allowRemote = false } = {}) {
  const remote = !isLoopbackHost(host);
  if (remote && !allowRemote)
    throw Error(
      `Refusing to serve the editor on non-loopback host ${host}: it can write project files. ` +
        'Use 127.0.0.1, or pass --allow-remote on a network you trust.',
    );
  const token = crypto.randomBytes(32).toString('hex');
  const session = remote ? crypto.randomBytes(32).toString('hex') : null;
  const matches = (value) =>
    typeof value === 'string' &&
    /^[a-f0-9]{64}$/.test(value) &&
    crypto.timingSafeEqual(Buffer.from(value), Buffer.from(session));
  const hosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  if (!ANY_INTERFACE.has(host)) hosts.add(host.toLowerCase());
  return {
    token,
    remote,
    /** Append to the start URL printed in the terminal; empty on loopback. */
    startQuery: session ? `key=${session}` : '',
    validate(request, response) {
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Referrer-Policy', 'no-referrer');
      response.setHeader('X-Frame-Options', 'DENY');
      response.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
      response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      const raw = request.headers.host;
      if (
        typeof raw !== 'string' ||
        request.rawHeaders.filter(
          (_, i) => i % 2 === 0 && request.rawHeaders[i].toLowerCase() === 'host',
        ).length !== 1
      )
        throw fail(403, 'Invalid Host');
      let authority;
      try {
        authority = new URL('http://' + raw);
      } catch {
        throw fail(403, 'Invalid Host');
      }
      if (
        (!hosts.has(authority.hostname.toLowerCase()) && !(session && ANY_INTERFACE.has(host))) ||
        authority.username ||
        authority.password ||
        authority.pathname !== '/' ||
        authority.search ||
        authority.hash ||
        raw !== authority.host ||
        Number(authority.port || 80) !== request.socket.localPort
      )
        throw fail(403, 'Invalid Host');
      const origin = request.headers.origin;
      if (origin !== undefined && origin !== authority.origin) throw fail(403, 'Foreign Origin');
      if (request.headers['sec-fetch-site'] === 'cross-site')
        throw fail(403, 'Cross-site editor request');
      const url = new URL(request.url || '/', authority.origin);
      if (url.origin !== authority.origin) throw fail(403, 'Foreign request target');
      if (session) {
        const cookie = /(?:^|;\s*)zhuda_editor=([a-f0-9]{64})(?:;|$)/.exec(
          String(request.headers.cookie || ''),
        )?.[1];
        if (!matches(cookie)) {
          if (!matches(url.searchParams.get('key')))
            throw fail(403, 'Remote editor session required; open the URL printed at startup');
          response.setHeader(
            'Set-Cookie',
            `zhuda_editor=${session}; HttpOnly; SameSite=Strict; Path=/`,
          );
        }
      }
      if (!['GET', 'HEAD', 'POST'].includes(request.method)) throw fail(405, 'Unsupported method');
      if (url.pathname.startsWith('/api/')) {
        const supplied = request.headers['x-zhuda-editor-token'];
        if (
          typeof supplied !== 'string' ||
          !/^[a-f0-9]{64}$/.test(supplied) ||
          !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(token))
        )
          throw fail(403, 'Invalid editor capability');
      }
      if (request.method === 'POST') {
        if (origin !== authority.origin) throw fail(403, 'Same-origin write required');
        if (
          request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json'
        )
          throw fail(415, 'Expected application/json');
        if (!url.pathname.startsWith('/api/')) throw fail(405, 'Unsupported write');
      }
      return url;
    },
  };
}

export function resolveProjectFile(projectRoot, relative, { mustExist = false } = {}) {
  const root = realPath(projectRoot);
  if (
    typeof relative !== 'string' ||
    !relative ||
    path.isAbsolute(relative) ||
    relative.includes('\\')
  )
    throw Error('Path must be project-relative');
  const file = path.resolve(root, relative);
  if (!inside(root, file)) throw Error('Path escapes project root');
  if (mustExist && !fs.existsSync(file)) throw Error(`Project file does not exist: ${relative}`);
  if (fs.existsSync(file) && !inside(root, realPath(file)))
    throw Error('Symlinked path escapes project root');
  return file;
}

const privatePart = (part) =>
  part.startsWith('.') || part.endsWith('.bak') || part.includes('.tmp-');
export const publicAssetPath = (relative) =>
  relative.split(/[\\/]/).every((part) => part && !privatePart(part));
const contentType = (file) =>
  ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.gltf': 'model/gltf+json',
    '.glb': 'model/gltf-binary',
  })[path.extname(file).toLowerCase()] || 'application/octet-stream';

/** Keep the realpath containment check shared by both editor hosts. */
export async function respondStatic(root, requestPath, response, { projectAssets = false } = {}) {
  try {
    let relative;
    try {
      relative = decodeURIComponent(requestPath);
    } catch {
      throw fail(400, 'Bad path');
    }
    if (relative.includes('\\') || path.isAbsolute(relative)) throw fail(400, 'Bad path');
    const project = realPath(root);
    const allowed = projectAssets ? realPath(path.join(project, 'assets')) : project;
    if (!inside(project, allowed)) throw fail(403, 'Asset root escapes project');
    if (projectAssets && (!relative.startsWith('assets/') || !publicAssetPath(relative)))
      throw fail(403, 'Private project path');
    const candidate = path.resolve(project, relative);
    if (!inside(allowed, candidate)) throw fail(403, 'Path escapes static root');
    const file = realPath(candidate);
    if (!inside(allowed, file) || (projectAssets && !publicAssetPath(path.relative(project, file))))
      throw fail(403, 'Private or escaping asset');
    if (!(await fsp.stat(file)).isFile()) throw fail(404, 'Not found');
    const bytes = await fsp.readFile(file);
    response.writeHead(200, { 'Content-Type': contentType(file), 'Cache-Control': 'no-store' });
    response.end(bytes);
  } catch (error) {
    response.writeHead(error.status || (error.code === 'ENOENT' ? 404 : 403));
    response.end(error.status ? error.message : 'Asset unavailable');
  }
}
