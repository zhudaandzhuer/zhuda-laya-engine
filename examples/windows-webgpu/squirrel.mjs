// Squirrel.Windows starts the installed app with one of these arguments
// while it installs, updates or removes it, and waits for it to exit
// (DIST-02 of docs/plans/records/windows-acceptance/plan.md). Such a start
// must not open a window or load the renderer: it makes or removes the
// shortcuts through Squirrel's Update.exe and exits at once, or Squirrel's
// hook times out and an uninstall leaves the main executable behind.
// `--squirrel-firstrun` is a normal start and is not handled here.
import path from 'node:path';
import { spawn } from 'node:child_process';

const EVENTS = new Set(['install', 'updated', 'uninstall', 'obsolete']);

/** The Squirrel event this start is for, or undefined for a normal start. */
export function squirrelEvent(argv = process.argv, platform = process.platform) {
  if (platform !== 'win32') return undefined;
  const match = /^--squirrel-([a-z]+)$/.exec(argv[1] ?? '');
  return match && EVENTS.has(match[1]) ? match[1] : undefined;
}

/**
 * Handles `event` and exits the app. Shortcuts are made on install and
 * update and removed on uninstall by Squirrel's own Update.exe, beside the
 * app's version folder; its run is given at most `timeoutMs` (Squirrel's
 * own limit for the hook is 15 s). Resolves to what Update.exe did, for
 * tests; the app has exited by then.
 */
export async function runSquirrelEvent(
  event,
  { app, execPath = process.execPath, start = spawn, timeoutMs = 10000 },
) {
  const exe = path.win32.basename(execPath);
  const args =
    event === 'install' || event === 'updated'
      ? ['--createShortcut=' + exe]
      : event === 'uninstall'
        ? ['--removeShortcut=' + exe]
        : undefined;
  let outcome = 'nothing to run';
  if (args) {
    const update = path.win32.resolve(path.win32.dirname(execPath), '..', 'Update.exe');
    outcome = await new Promise((resolve) => {
      let child;
      try {
        child = start(update, args, { detached: true, stdio: 'ignore', windowsHide: true });
      } catch (error) {
        resolve('Update.exe did not start: ' + error.message);
        return;
      }
      const timer = setTimeout(
        () => resolve('Update.exe still running after ' + timeoutMs + ' ms'),
        timeoutMs,
      );
      child.once('error', (error) => {
        clearTimeout(timer);
        resolve('Update.exe did not start: ' + error.message);
      });
      child.once('close', (code) => {
        clearTimeout(timer);
        resolve('Update.exe exit ' + code);
      });
    });
  }
  // exit, not quit: nothing was opened, and nothing else may start.
  app.exit(0);
  return outcome;
}
