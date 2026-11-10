import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

export const OFFICIAL_VERSION = '3.4.2';
export const MINIGAME_TARGETS = Object.freeze([
  'wxgame',
  'bytedancegame',
  'oppogame',
  'vivogame',
  'xmgame',
  'alipaygame',
  'tbgame',
  'bilibili',
  'huawei',
]);
export const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

export function resolveMiniGameToolchain(root, expectedSha256) {
  root = fs.realpathSync(
    path.resolve(root || path.join(os.homedir(), '.layaair', OFFICIAL_VERSION)),
  );
  const resources = path.join(root, 'Resources');
  const manifest = JSON.parse(fs.readFileSync(path.join(resources, 'package.json'), 'utf8'));
  if (manifest.name !== 'layaair-cli' || manifest.version !== OFFICIAL_VERSION)
    throw Error(
      `zhuda.config.json:1 [MINIGAME_TOOLCHAIN_VERSION] Require official LayaAir CLI ${OFFICIAL_VERSION}; found ${manifest.name} ${manifest.version}. Install that exact version; no version fallback is allowed.`,
    );
  const entry = path.join(resources, 'cli-main.js');
  const identity = ['package.json', 'cli-main.js', 'cli-scene.js'].map((file) => ({
    file,
    sha256: sha256(fs.readFileSync(path.join(resources, file))),
  }));
  const fingerprint = sha256(JSON.stringify(identity));
  if (expectedSha256 && expectedSha256 !== fingerprint)
    throw Error(
      'zhuda.config.json:1 [MINIGAME_TOOLCHAIN_HASH] Official CLI fingerprint changed; inspect the installation before updating its pin.',
    );
  return { root, resources, entry, version: manifest.version, fingerprint, files: identity };
}

/** Run the installed CLI directly with Node. No shell, dispatcher fallback or UI. */
export function runOfficialCli(
  toolchain,
  args,
  { signal, timeoutMs = 180_000, logFile, onOutput, ptyCommands = [] } = {},
) {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 1_800_000)
    throw Error('zhuda.config.json:1 [MINIGAME_TIMEOUT] timeoutMs must be 1..1800000');
  signal?.throwIfAborted();
  if (ptyCommands.length && process.platform !== 'darwin')
    throw Error(
      `[MINIGAME_TOOL] ${ptyCommands.join(', ')} requires an interactive vendor CLI; headless PTY bridging is only implemented on macOS.`,
    );
  return new Promise((resolve, reject) => {
    // The VIVO CLI is installed as an npm global `mg` command. macOS ships
    // an unrelated /usr/bin/mg editor and the VIVO command requires a TTY.
    // A temporary preload wraps only that child in macOS's script(1) PTY;
    // the vendor CLI and its templates remain the actual build authority.
    const globalBins = [
      process.env.npm_config_prefix && path.join(process.env.npm_config_prefix, 'bin'),
      process.env.NPM_CONFIG_PREFIX && path.join(process.env.NPM_CONFIG_PREFIX, 'bin'),
      process.platform === 'darwin' ? '/opt/homebrew/bin' : undefined,
      '/usr/local/bin',
    ].filter((dir) => dir && fs.existsSync(dir));
    const commandShimRoot = ptyCommands.length
      ? fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-cli-pty-'))
      : undefined;
    const originalPath = [...globalBins, ...(process.env.PATH || '').split(path.delimiter)];
    let preload;
    if (commandShimRoot && process.platform === 'darwin') {
      try {
        const mappings = {};
        for (const command of ptyCommands) {
          const original = originalPath
            .map((dir) => path.join(dir, command))
            .find((file) => fs.existsSync(file) && file !== path.join(commandShimRoot, command));
          if (!original)
            throw Error(`[MINIGAME_TOOL] Cannot find ${command} in the npm/system PATH`);
          mappings[command] = original;
        }
        preload = path.join(commandShimRoot, 'pty-preload.cjs');
        fs.writeFileSync(
          preload,
          `const cp=require('node:child_process');\nconst originalSpawn=cp.spawn;\nconst ptyCommands=${JSON.stringify(mappings)};\ncp.spawn=function(command,args,options){\n  const original=ptyCommands[command];\n  if(original) return originalSpawn('/usr/bin/script',['-q','/dev/null',original,...(args||[])],{...(options||{}),shell:false,stdio:['ignore','pipe','pipe']});\n  return originalSpawn(command,args,options);\n};\n`,
        );
      } catch (error) {
        fs.rmSync(commandShimRoot, { recursive: true, force: true });
        throw error;
      }
    }
    const env = {
      ...process.env,
      PATH: [...(commandShimRoot ? [commandShimRoot] : []), ...new Set(originalPath)].join(
        path.delimiter,
      ),
    };
    const nodeArgs = preload
      ? ['--require', preload, toolchain.entry, ...args]
      : [toolchain.entry, ...args];
    let log, child;
    try {
      log = logFile ? fs.openSync(logFile, 'w') : undefined;
      child = spawn(process.execPath, nodeArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
        env,
      });
    } catch (error) {
      if (log !== undefined)
        try {
          fs.closeSync(log);
        } catch {}
      if (commandShimRoot) fs.rmSync(commandShimRoot, { recursive: true, force: true });
      reject(error);
      return;
    }
    let output = '',
      failure,
      killTimer;
    const kill = (hard) => {
      try {
        if (process.platform !== 'win32') process.kill(-child.pid, hard ? 'SIGKILL' : 'SIGTERM');
        else child.kill(hard ? 'SIGKILL' : 'SIGTERM');
      } catch {
        /* The process may already have exited. */
      }
    };
    const stop = (reason) => {
      if (failure) return;
      failure = reason;
      kill(false);
      killTimer = setTimeout(() => kill(true), 1000);
    };
    const abort = () => stop(signal.reason || Error('Official build cancelled'));
    const timeout = setTimeout(
      () => stop(Error(`[MINIGAME_TIMEOUT] Official CLI exceeded ${timeoutMs} ms`)),
      timeoutMs,
    );
    signal?.addEventListener('abort', abort, { once: true });
    // Close the race between the initial check and listener registration.
    if (signal?.aborted) abort();
    const receive = (bytes) => {
      if (log !== undefined) fs.writeSync(log, bytes);
      output = (output + bytes.toString()).slice(-2_000_000);
      try {
        onOutput?.(bytes.toString());
      } catch (error) {
        stop(error);
      }
    };
    child.stdout.on('data', receive);
    child.stderr.on('data', receive);
    child.on('error', (error) => {
      failure ??= error;
    });
    child.on('close', (code, endedBy) => {
      clearTimeout(timeout);
      clearTimeout(killTimer);
      signal?.removeEventListener('abort', abort);
      if (log !== undefined) fs.closeSync(log);
      if (commandShimRoot) fs.rmSync(commandShimRoot, { recursive: true, force: true });
      if (failure) reject(failure);
      else if (code !== 0)
        reject(
          Error(
            `[MINIGAME_CLI] Official CLI exited ${code ?? endedBy}; see ${logFile || 'output'}\n${output.slice(-4000)}`,
          ),
        );
      else resolve(output);
    });
  });
}

export function writeOfficialProject(root, name = 'zhuda-minigame') {
  for (const dir of ['src', 'assets', 'settings', 'local'])
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  fs.writeFileSync(path.join(root, 'zhuda.laya'), JSON.stringify({ version: OFFICIAL_VERSION }));
  // BuildTask reads platformConfig from BuildSettings.json directly.  A bare
  // project therefore works for browser builds but leaves required fields
  // such as the quick-game package name undefined.  Keep these values neutral
  // and consumer-owned overrides are merged by the public bridge.
  const miniGame = (packageName, minPlatformVersion = '1060') => ({
    package: packageName,
    versionCode: '1',
    minPlatformVersion,
    logLevel: 'warn',
    isRelease: false,
  });
  const buildSettings = {
    name,
    startupScene: '',
    includedScenes: [],
    minifyJS: false,
    enableVersion: false,
    wxgame: { appid: 'touristappid' },
    bytedancegame: { appid: 'touristappid' },
    oppogame: miniGame('com.zhuda.minigame'),
    vivogame: miniGame('com.zhuda.minigame', '1063'),
    xmgame: miniGame('com.zhuda.minigame', '1050'),
    alipaygame: {},
    tbgame: {},
    bilibili: {},
    huawei: {},
  };
  fs.writeFileSync(path.join(root, 'settings/BuildSettings.json'), JSON.stringify(buildSettings));
  fs.writeFileSync(
    path.join(root, 'settings/PlayerSettings.json'),
    JSON.stringify({
      modules: { 'laya.d3': false, 'laya.ui': false },
      splashScreen: { enabled: false },
    }),
  );
}

export async function listMiniGameTargets(toolchain, options = {}) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-platforms-'));
  try {
    writeOfficialProject(temporary);
    const output = await runOfficialCli(
      toolchain,
      ['build', '--list-platforms', '-p', temporary, '--skip-package-install'],
      options,
    );
    const match = output.match(/Available platforms:\s*(\[[\s\S]*?\])/);
    if (!match)
      throw Error(
        '[MINIGAME_PLATFORM_LIST] Official CLI did not return its registered platform list',
      );
    const platforms = JSON.parse(match[1]);
    if (!Array.isArray(platforms) || platforms.some((p) => typeof p.name !== 'string'))
      throw Error('Malformed official platform list');
    return platforms.filter((p) => MINIGAME_TARGETS.includes(p.name));
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
