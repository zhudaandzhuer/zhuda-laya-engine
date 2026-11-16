import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  closeBrowser,
  devToolsPortFileEndpoint,
  firstPageTarget,
  launchBrowser,
  ownedWindowsProcesses,
  resolveChromeBinary,
} from '../packages/compiler/browser-process.mjs';
import { resolveChromeBinary as fromPrefabCheck } from '../packages/compiler/prefab-check.mjs';

const chrome = resolveChromeBinary();
// `node --test` runs the test files side by side: on a busy CI runner Chrome
// can take longer than the launcher's 10 s default to come up.
const STARTUP_MS = 30000;
const skip = chrome ? false : 'no Chrome or Edge on this machine';
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};
const gone = async (pid) => {
  for (let i = 0; i < 40 && alive(pid); i++) await new Promise((r) => setTimeout(r, 50));
  return !alive(pid);
};

test('prefab-check still exports the shared resolveChromeBinary', () => {
  assert.equal(fromPrefabCheck, resolveChromeBinary);
});

test('the port file is taken only when whole: no port 0, no cut-off id', () => {
  const id = '/devtools/browser/0d1e2f3a-4b5c-6d7e-8f90-a1b2c3d4e5f6';
  assert.equal(devToolsPortFileEndpoint('0\n' + id), null, 'before the server is bound');
  assert.equal(devToolsPortFileEndpoint('53412\n' + id.slice(0, 30)), null);
  assert.equal(devToolsPortFileEndpoint('534'), null);
  assert.equal(devToolsPortFileEndpoint('70000\n' + id), null);
  assert.equal(devToolsPortFileEndpoint('53412\r\n' + id).href, 'ws://127.0.0.1:53412' + id);
});

test('an unknown ZHUDA_BROWSER_GPU value is refused before a browser starts', async () => {
  await assert.rejects(
    launchBrowser({ binary: process.execPath, gpu: 'fast' }),
    /ZHUDA_BROWSER_GPU is 'hardware' or 'any'/,
  );
});

test('a browser that cannot start reports why and leaves no profile', async () => {
  let profile;
  await assert.rejects(
    launchBrowser({
      binary: process.execPath, // Node exits at once on Chrome's flags
      prepareProfile: (dir) => (profile = dir),
      startupTimeoutMs: 5000,
    }),
    /exited before ready|startup timeout/,
  );
  assert.equal(fs.existsSync(profile), false);
});

test('close asks the browser to quit, waits, and removes the profile', { skip }, async () => {
  const browser = await launchBrowser({ binary: chrome, startupTimeoutMs: STARTUP_MS });
  const page = await firstPageTarget(browser.endpoint);
  assert.equal(page.type, 'page');
  const report = await browser.close();
  assert.deepEqual(report, { graceful: true, forced: [], errors: [] });
  assert.equal(await gone(browser.child.pid), true);
  assert.equal(fs.existsSync(browser.profile), false);
  // Nothing of it is left running: the quick path skips the process list,
  // so check here that a browser which quit took its children with it.
  if (process.platform === 'win32') assert.deepEqual(ownedWindowsProcesses(browser), []);
  // Closing twice is the same close.
  assert.equal(await browser.close(), report);
});

test('a browser that does not answer is ended by force, its own only', { skip }, async () => {
  const other = await launchBrowser({ binary: chrome, startupTimeoutMs: STARTUP_MS }); // stands for a browser the user runs
  const browser = await launchBrowser({ binary: chrome, startupTimeoutMs: STARTUP_MS });
  try {
    browser.endpoint = new URL('ws://127.0.0.1:9/devtools/browser/none');
    const report = await closeBrowser(browser);
    assert.equal(report.graceful, false);
    assert.deepEqual(report.forced.slice(0, 1), [browser.child.pid]);
    assert.match(report.errors.join('\n'), /Browser.close: DevTools/);
    assert.equal(await gone(browser.child.pid), true);
    assert.equal(fs.existsSync(browser.profile), false);
    assert.equal(alive(other.child.pid), true);
    await firstPageTarget(other.endpoint); // still answering
  } finally {
    const report = await other.close();
    assert.equal(report.graceful, true);
  }
});
