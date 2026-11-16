import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  closeBrowser,
  firstPageTarget,
  launchBrowser,
  resolveChromeBinary,
} from '../packages/compiler/browser-process.mjs';
import { resolveChromeBinary as fromPrefabCheck } from '../packages/compiler/prefab-check.mjs';

const chrome = resolveChromeBinary();
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
  const browser = await launchBrowser({ binary: chrome });
  const page = await firstPageTarget(browser.endpoint);
  assert.equal(page.type, 'page');
  const report = await browser.close();
  assert.deepEqual(report, { graceful: true, forced: [], errors: [] });
  assert.equal(await gone(browser.child.pid), true);
  assert.equal(fs.existsSync(browser.profile), false);
  // Closing twice is the same close.
  assert.equal(await browser.close(), report);
});

test('a browser that does not answer is ended by force, its own only', { skip }, async () => {
  const other = await launchBrowser({ binary: chrome }); // stands for a browser the user runs
  const browser = await launchBrowser({ binary: chrome });
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
