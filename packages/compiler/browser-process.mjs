// Starting and closing the headless browser of a check (WIN-04 of
// docs/plans/records/windows-acceptance/plan.md). The film host and the
// draw checks (chrome-host.mjs) and the consumer Prefab check
// (prefab-check.mjs) start their browser here, so both find it, wait for
// it and close it the same way.
//
// Closing asks the browser to quit over DevTools first. Only then are
// processes ended by force, and only this run's: the process the launch
// started and its tree, and on Windows any process whose command line names
// this run's own profile folder (a browser that relaunched itself under a
// new process). A browser the user started is never touched.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync, execFileSync } from 'node:child_process';

/** Resolve Chrome without assuming a Unix installation path. CHROME_BIN remains
 * the explicit override used by CI and is reported in every browser result. */
export function resolveChromeBinary(explicit = process.env.CHROME_BIN) {
  const candidates = [
    explicit,
    ...(process.platform === 'win32'
      ? [
          process.env.PROGRAMFILES &&
            path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
          process.env['PROGRAMFILES(X86)'] &&
            path.join(process.env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'),
          process.env.LOCALAPPDATA &&
            path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
          process.env.PROGRAMFILES &&
            path.join(process.env.PROGRAMFILES, 'Microsoft/Edge/Application/msedge.exe'),
          process.env['PROGRAMFILES(X86)'] &&
            path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft/Edge/Application/msedge.exe'),
          process.env.LOCALAPPDATA &&
            path.join(process.env.LOCALAPPDATA, 'Microsoft/Edge/Application/msedge.exe'),
        ]
      : [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/usr/bin/google-chrome',
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
        ]),
  ].filter(Boolean);
  const found = candidates.find((file) => fs.existsSync(file));
  if (found) return found;
  const command = process.platform === 'win32' ? 'where.exe' : 'which';
  for (const name of process.platform === 'win32'
    ? ['chrome.exe', 'msedge.exe']
    : ['google-chrome', 'chromium', 'chromium-browser']) {
    const result = spawnSync(command, [name], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const value =
      result.status === 0
        ? String(result.stdout || '')
            .split(/\r?\n/)
            .find(Boolean)
        : undefined;
    if (value && fs.existsSync(value.trim())) return value.trim();
  }
  return undefined;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const running = (child) => child.exitCode === null && child.signalCode === null;
const exited = (child, ms) =>
  running(child)
    ? Promise.race([
        new Promise((resolve) => child.once('exit', () => resolve(true))),
        wait(ms).then(() => !running(child)),
      ])
    : Promise.resolve(true);

/**
 * The DevTools endpoint a profile's `DevToolsActivePort` file names (port on
 * the first line, browser path on the second), or null while it is not a
 * whole one: port 0 (written before the server is bound) or a cut-off id.
 * Pure.
 */
export function devToolsPortFileEndpoint(text) {
  const [port, where] = String(text).split(/\r?\n/);
  if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) return null;
  if (!/^\/devtools\/browser\/[0-9a-f-]{36}$/.test(where ?? '')) return null;
  return new URL(`ws://127.0.0.1:${port}${where}`);
}

/**
 * Starts a headless browser on a profile folder of its own and waits until
 * DevTools answers. `ZHUDA_BROWSER_GPU=hardware` (or `gpu: 'hardware'`)
 * leaves out the software-renderer fallback, for checks that must run on
 * the machine's graphics card; which card ran is still read from the page.
 *
 * Returns `{ binary, child, profile, endpoint, relaunched, close }`;
 * `close()` never throws and resolves to what it did.
 */
export async function launchBrowser({
  binary = resolveChromeBinary(),
  args = [],
  profilePrefix = 'zhuda-browser-',
  prepareProfile,
  startupTimeoutMs = 10000,
  gpu = process.env.ZHUDA_BROWSER_GPU,
} = {}) {
  if (!binary) throw Error('Chrome unavailable. Set CHROME_BIN.');
  if (gpu !== undefined && gpu !== '' && gpu !== 'hardware' && gpu !== 'any')
    throw Error(`ZHUDA_BROWSER_GPU is 'hardware' or 'any', not ${JSON.stringify(gpu)}`);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), profilePrefix));
  prepareProfile?.(profile);
  const startedAt = Date.now();
  const child = spawn(
    binary,
    [
      '--headless=new',
      '--no-sandbox',
      ...(gpu === 'hardware' ? [] : ['--enable-unsafe-swiftshader']),
      '--use-mock-keychain',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      ...args,
      'about:blank',
    ],
    { detached: true, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true },
  );
  const state = { binary, child, profile, startedAt, endpoint: undefined, relaunched: false };
  state.close = () => closeBrowser(state);
  try {
    state.endpoint = await new Promise((resolve, reject) => {
      let log = '',
        done = false;
      const finish = (error, value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        clearInterval(poll);
        error ? reject(error) : resolve(value);
      };
      const timer = setTimeout(
        () => finish(Error('Chrome startup timeout' + (log ? ': ' + log.slice(-500) : ''))),
        startupTimeoutMs,
      );
      // The browser also writes its port here; a browser that hands over to
      // a new process (Edge relaunching itself) writes it from that one.
      // It is taken only once it reads the same twice, 50 ms apart, with a
      // real port (0 before the server is bound: seen on Windows, where
      // fetch refuses it as a bad port) and a whole browser id.
      const portFile = path.join(profile, 'DevToolsActivePort');
      let previous;
      const poll = setInterval(() => {
        try {
          const text = fs.readFileSync(portFile, 'utf8');
          const endpoint = devToolsPortFileEndpoint(text);
          if (endpoint && text === previous) finish(undefined, endpoint);
          previous = text;
        } catch {}
      }, 50);
      child.once('error', (error) => finish(error));
      child.once('exit', (code, signal) => {
        // Exit 0 before DevTools is up is a hand-over: keep waiting for the port file.
        if (code === 0) state.relaunched = true;
        else
          finish(
            Error(
              `Chrome exited before ready (${signal ? 'signal ' + signal : 'exit ' + code})` +
                (log ? ': ' + log.slice(-500) : ''),
            ),
          );
      });
      child.stderr.on('data', (chunk) => {
        log += chunk;
        const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
        if (match) finish(undefined, new URL(match[1]));
      });
    });
    return state;
  } catch (error) {
    const cleanup = await state.close();
    if (cleanup.errors.length) error.message += ' (cleanup: ' + cleanup.errors.join('; ') + ')';
    throw error;
  }
}

/**
 * The first page target of a browser. DevTools can announce its endpoint
 * before the initial about:blank page is listed, so this asks again briefly.
 */
export async function firstPageTarget(endpoint, { attempts = 100 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const tabs = await (await fetch(`http://${endpoint.host}/json/list`)).json();
    const page = tabs.find((t) => t.type === 'page');
    if (page) return page;
    if (attempt >= attempts) throw Error('Chrome did not expose a page target');
    await wait(50);
  }
}

async function askToQuit(endpoint) {
  const ws = new WebSocket(endpoint.href);
  try {
    await Promise.race([
      new Promise((resolve, reject) => {
        ws.addEventListener('open', resolve, { once: true });
        ws.addEventListener('error', () => reject(Error('DevTools unreachable')), { once: true });
      }),
      wait(2000).then(() => {
        throw Error('DevTools did not answer');
      }),
    ]);
    ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
  } finally {
    // The browser drops the connection as it quits; nothing to wait for here.
    setTimeout(() => ws.close(), 100).unref?.();
  }
}

/**
 * Windows processes of the browser's image whose command line names this
 * run's profile folder, started no earlier than the launch. Read through
 * PowerShell's CIM query; the profile path is matched here, not in a query.
 */
export function ownedWindowsProcesses({ binary, profile, startedAt }) {
  const image = path.win32.basename(binary).replace(/'/g, '');
  const script =
    `Get-CimInstance Win32_Process -Filter "Name='${image}'" | ` +
    'Select-Object ProcessId,CommandLine,@{n="Started";e={[DateTimeOffset]::new($_.CreationDate).ToUnixTimeMilliseconds()}} | ' +
    'ConvertTo-Json -Compress';
  // -EncodedCommand: the script reaches PowerShell without a second round of quoting.
  const out = execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(script, 'utf16le').toString('base64'),
    ],
    { encoding: 'utf8', timeout: 20000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
  if (!out) return [];
  const list = [].concat(JSON.parse(out));
  const needle = profile.toLowerCase();
  return list
    .filter(
      (p) =>
        typeof p.CommandLine === 'string' &&
        p.CommandLine.toLowerCase().includes(needle) &&
        !(p.Started < startedAt - 2000),
    )
    .map((p) => p.ProcessId);
}

function forceEnd(pid) {
  if (process.platform === 'win32') {
    // Negative process groups do not exist on Windows; /T ends the tree.
    const r = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    // 128: the process had already gone.
    if (r.status !== 0 && r.status !== 128)
      throw Error(`taskkill ${pid}: ${String(r.stderr || r.stdout).trim() || 'exit ' + r.status}`);
    return;
  }
  for (const target of [-pid, pid])
    try {
      process.kill(target, 'SIGKILL');
    } catch {}
}

/**
 * Closes a browser `launchBrowser` started: DevTools `Browser.close`, a
 * bounded wait, then this run's processes ended by force, then the profile
 * folder removed with bounded retries (Windows holds a file a moment after
 * its process ends). Resolves to `{ graceful, forced, errors }` and never
 * throws, so the error that ended a check stays the one reported.
 */
export async function closeBrowser(state) {
  if (state.closing) return state.closing;
  state.closing = (async () => {
    const { child, profile } = state;
    const report = { graceful: false, forced: [], errors: [] };
    const attempt = async (what, fn) => {
      try {
        return await fn();
      } catch (error) {
        report.errors.push(`${what}: ${error.message}`);
      }
    };
    const asked =
      state.endpoint && (running(child) || state.relaunched)
        ? await attempt('Browser.close', () => askToQuit(state.endpoint).then(() => true))
        : false;
    // Not asked (it never came up, or DevTools did not answer): nothing to wait for.
    report.graceful = asked ? await exited(child, 5000) : !running(child);
    if (!report.graceful && child.pid) {
      await attempt('end browser', () => forceEnd(child.pid));
      report.forced.push(child.pid);
      if (!(await exited(child, 3000))) report.errors.push(`browser ${child.pid} did not exit`);
    }
    const removeProfile = () =>
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    let removed = false;
    // A browser that quit by itself takes its children with it and frees the
    // profile. The process list is read (a PowerShell query, about a second)
    // only when that is in doubt.
    if (report.graceful && !state.relaunched)
      try {
        removeProfile();
        removed = true;
      } catch {}
    if (!removed && process.platform === 'win32') {
      // A relaunched browser, or a child process that outlived its parent:
      // given a moment to finish quitting, then ended.
      for (let round = 0; round < 6; round++) {
        const left =
          (await attempt('list browser processes', () => ownedWindowsProcesses(state))) ?? [];
        if (!left.length) break;
        if (round < 3) {
          await wait(500);
          continue;
        }
        for (const pid of left) {
          await attempt('end ' + pid, () => forceEnd(pid));
          report.forced.push(pid);
        }
        await wait(300);
      }
    }
    if (!removed)
      await attempt('remove profile', () =>
        fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }),
      );
    return report;
  })();
  return state.closing;
}
