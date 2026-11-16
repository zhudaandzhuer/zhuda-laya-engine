// What the verify scripts need from Node that differs between Windows and
// the other platforms (docs/plans/records/windows-acceptance/plan.md, WIN-01).
//
// npm on Windows is `npm.cmd`, a batch file that execFile cannot start
// without a shell, so npm is run here as Node running npm's own CLI script,
// with an argument array and no shell.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const NPM_CLI = /(^|[\\/])npm[\\/]bin[\\/]npm-cli\.(c?js|mjs)$/;

/**
 * Where npm's CLI script is: `ZHUDA_NPM_CLI` when set (it must be one),
 * else the one `npm run` names in `npm_execpath`, else the one installed
 * beside Node. Undefined when none is found; on Windows that is an error
 * for the caller to report.
 */
export function resolveNpmCli({
  explicit = process.env.ZHUDA_NPM_CLI,
  execpath = process.env.npm_execpath,
  nodePath = process.execPath,
} = {}) {
  if (explicit) {
    if (!NPM_CLI.test(explicit) || !fs.existsSync(explicit))
      throw Error(`ZHUDA_NPM_CLI is not npm's CLI script (…/npm/bin/npm-cli.js): ${explicit}`);
    return path.resolve(explicit);
  }
  // npm_execpath is pnpm's or yarn's when they run the script: only npm's is used.
  if (execpath && NPM_CLI.test(execpath) && fs.existsSync(execpath)) return path.resolve(execpath);
  const dir = path.dirname(nodePath);
  for (const candidate of [
    path.join(dir, 'node_modules/npm/bin/npm-cli.js'), // Windows installers and zips
    path.join(dir, '../lib/node_modules/npm/bin/npm-cli.js'), // Unix tarballs, nvm
  ])
    if (fs.existsSync(candidate)) return candidate;
  return undefined;
}

/**
 * Runs npm with `args` (an array; each element reaches npm as it is) in
 * `cwd` and returns its standard output. Throws with the command, the
 * folder, the exit code or signal and the end of standard error when npm
 * fails, cannot be found or runs past `timeout` milliseconds.
 */
export function runNpm(args, { cwd = process.cwd(), maxBuffer = 16e6, timeout, env, npmCli } = {}) {
  if (!Array.isArray(args) || !args.every((a) => typeof a === 'string'))
    throw TypeError('runNpm: args is an array of strings');
  const cli = npmCli ?? resolveNpmCli();
  let command, argv;
  if (cli) [command, argv] = [process.execPath, [cli, ...args]];
  else if (process.platform !== 'win32') [command, argv] = ['npm', args];
  else
    throw Error(
      "npm's CLI was not found. Run this through `npm run …`, or set ZHUDA_NPM_CLI to …\\node_modules\\npm\\bin\\npm-cli.js.",
    );
  try {
    return execFileSync(command, argv, {
      cwd,
      env,
      encoding: 'utf8',
      maxBuffer,
      timeout,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const timedOut = error.code === 'ETIMEDOUT';
    const how = timedOut
      ? `timed out after ${timeout} ms`
      : error.status != null
        ? `exit ${error.status}`
        : error.signal
          ? `signal ${error.signal}`
          : error.code || 'failed to start';
    const stderr = String(error.stderr ?? '').trim();
    const failure = Error(
      `npm ${args.join(' ')} (in ${cwd}): ${how}` + (stderr ? '\n' + stderr.slice(-4000) : ''),
      { cause: error },
    );
    Object.assign(failure, {
      status: error.status ?? null,
      signal: error.signal ?? null,
      stdout: String(error.stdout ?? ''),
      stderr,
      cwd,
      timedOut,
    });
    throw failure;
  }
}

/**
 * Imports a module by its file path. A Windows drive path is not a module
 * specifier (`C:` reads as a URL scheme), and `#`, `%` and spaces must be
 * escaped, so the path goes through `pathToFileURL` (WIN-03).
 */
export const importFile = (file) => import(pathToFileURL(path.resolve(file)).href);

/**
 * Links folder `link` to the folder `target` (WIN-02): a junction on Windows,
 * which needs no Developer Mode or elevation, a directory symbolic link
 * elsewhere. The target must be a folder (a junction cannot point at a
 * file). An existing link to the same folder is kept; a link to another
 * folder or to nothing is replaced; a real file or folder at `link` is left
 * as it is. Returns whether a link was made.
 */
export function linkDirectory(target, link) {
  const real = fs.realpathSync(target);
  if (!fs.statSync(real).isDirectory()) throw Error(`linkDirectory: not a folder: ${target}`);
  const at = path.resolve(link);
  let existing;
  try {
    existing = fs.lstatSync(at);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (existing) {
    if (!existing.isSymbolicLink()) return false;
    let current;
    try {
      current = fs.realpathSync(at);
    } catch {}
    if (current === real) return false;
    // Only the link goes: neither call follows it into the folder it names.
    try {
      fs.unlinkSync(at);
    } catch (error) {
      if (!['EPERM', 'EISDIR'].includes(error.code)) throw error;
      fs.rmdirSync(at);
    }
  }
  fs.mkdirSync(path.dirname(at), { recursive: true });
  fs.symlinkSync(real, at, process.platform === 'win32' ? 'junction' : 'dir');
  return true;
}
