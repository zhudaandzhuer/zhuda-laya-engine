/**
 * The folders a caller of this server may point a tool at.
 *
 * A tool that takes a path from its caller reads what that path names. The
 * caller is an agent, and an agent can be talked into asking for a folder its
 * operator never meant to show it. So a path argument must lie inside a folder
 * the operator allowed: the folder the server was started in, and any added on
 * its command line (`--root DIRECTORY`, repeatable) or in `ZHUDA_MCP_ROOTS`
 * (separated like `PATH`). Links are followed before the comparison, so a link
 * inside an allowed folder does not lead out of it.
 */
import fs from 'node:fs';
import path from 'node:path';

let extra = [];

function real(file) {
  // The deepest part of the path that exists decides where it really is.
  let current = path.resolve(file);
  const tail = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync.native(current), ...tail);
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'ENOTDIR') throw err;
      const parent = path.dirname(current);
      if (parent === current) return path.join(current, ...tail);
      tail.unshift(path.basename(current));
      current = parent;
    }
  }
}

function fromEnvironment() {
  return String(process.env.ZHUDA_MCP_ROOTS || '')
    .split(path.delimiter)
    .filter(Boolean);
}

/** Replaces the folders added to the working directory (the command line's `--root`). */
export function configureAllowedRoots(directories = []) {
  extra = directories.map((directory) => path.resolve(directory));
}

/** Every allowed folder, by its real path: the working directory first. */
export function allowedRoots() {
  return [...new Set([process.cwd(), ...extra, ...fromEnvironment()].map(real))];
}

/** True when `file` is `root` or lies inside it; both are compared by real path. */
export function isInsideRoot(root, file) {
  const from = real(root);
  const to = real(file);
  const relative = path.relative(from, to);
  if (relative === '') return true;
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

/**
 * The absolute path of a caller's path argument, or an error that names the
 * argument, the allowed folders and how to allow another one.
 */
export function resolveAllowedPath(value, name, base = process.cwd()) {
  if (typeof value !== 'string' || !value) throw Error(`${name}: expected a path`);
  const absolute = path.resolve(base, value);
  const roots = allowedRoots();
  if (roots.some((root) => isInsideRoot(root, absolute))) return absolute;
  throw Error(
    `${name}: ${absolute} is outside the folders this server may read (${roots.join(', ')}). ` +
      'Start the server with --root DIRECTORY (repeatable) or set ZHUDA_MCP_ROOTS to allow another one.',
  );
}
