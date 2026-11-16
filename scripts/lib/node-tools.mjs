// What the verify scripts need from Node that differs between Windows and
// the other platforms (docs/plans/records/windows-acceptance/plan.md, WIN-01).
//
// npm on Windows is `npm.cmd`, a batch file that execFile cannot start
// without a shell, so npm is run here as Node running npm's own CLI script,
// with an argument array and no shell.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

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
