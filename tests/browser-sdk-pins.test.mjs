import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readRecord, staleFiles, pinnedFiles } from '../scripts/release-browser-sdk.mjs';

const repo = path.resolve(import.meta.dirname, '..');

test('browser SDK templates and docs pin the latest recorded release', () => {
  const record = readRecord();
  const latest = record.releases[0];
  assert.deepEqual(staleFiles(record), [], 'run node scripts/release-browser-sdk.mjs --pin');
  const docs = fs.readFileSync(path.join(repo, 'docs/browser-sdk.md'), 'utf8');
  assert.match(
    docs,
    new RegExp(`本次固定發行：\\*\\*${latest.version.replace(/\./g, '\\.')}\\*\\*`),
  );
  for (const name of fs.readdirSync(path.join(repo, 'examples/browser-sdk'))) {
    const html = fs.readFileSync(path.join(repo, 'examples/browser-sdk', name), 'utf8');
    for (const [, url] of html.matchAll(/src="(https:[^"]+\.js)"/g))
      assert.ok(url.startsWith(latest.contentUrl), `${name} pins ${url}`);
  }
});

test('a newly recorded release rewrites every pinned URL and integrity', () => {
  const record = structuredClone(readRecord());
  const next = structuredClone(record.releases[0]);
  next.version = '99.0.0';
  next.contentUrl = next.contentUrl.replace(/[0-9a-f]{32}\/$/, 'f'.repeat(32) + '/');
  for (const entry of Object.values(next.files)) entry.integrity = 'sha384-' + 'A'.repeat(64);
  record.releases.unshift(next);
  const outputs = pinnedFiles(record);
  // The current tree is stale against the hypothetical newer release.
  assert.ok(staleFiles(record).length > 1);
  for (const [file, text] of outputs) {
    assert.ok(!text.includes(record.releases[1].contentUrl + 'zhuda-'), `${file} kept the old URL`);
    for (const old of Object.values(record.releases[1].files))
      assert.ok(!text.includes(old.integrity), `${file} kept an old integrity`);
  }
  assert.match(
    outputs.get(path.join(repo, 'docs/browser-sdk.md')),
    /本次固定發行：\*\*99\.0\.0\*\*/,
  );
  assert.throws(() => readRecord(path.join(repo, 'package.json')), /invalid browser SDK release/);
});

test('a release may carry the backend loader; one without every bundle is refused', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-sdk-record-'));
  try {
    const file = path.join(temp, 'record.json');
    const write = (change) => {
      const record = structuredClone(readRecord());
      change(record.releases[0]);
      fs.writeFileSync(file, JSON.stringify(record));
      return file;
    };
    // The releases recorded so far have no loader, and are read as they are.
    assert.equal(readRecord().releases[0].files['zhuda-loader.js'], undefined);
    const withLoader = readRecord(
      write((latest) => {
        latest.files['zhuda-loader.js'] = { bytes: 5297, integrity: 'sha384-' + 'B'.repeat(64) };
      }),
    );
    assert.equal(Object.keys(withLoader.releases[0].files).length, 7);
    // Pinned like a bundle wherever a page names it.
    const pinned = pinnedFiles(withLoader).get(path.join(repo, 'docs/browser-sdk.md'));
    assert.match(pinned, /\| `zhuda-loader\.js` \| [^|]+ \| 5,297 \|/);
    assert.throws(
      () => readRecord(write((latest) => delete latest.files['zhuda-3d.js'])),
      /must list every bundle profile/,
    );
    assert.throws(
      () =>
        readRecord(
          write((latest) => {
            latest.files['zhuda-extra.js'] = { bytes: 1, integrity: 'sha384-AAAA' };
          }),
        ),
      /invalid entry for zhuda-extra\.js/,
    );
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('a source that differs from the release of its own version is reported; a new version is not', async () => {
  const { releaseDrift } = await import('../scripts/release-browser-sdk.mjs');
  const record = {
    releases: [
      {
        version: '2.0.0',
        files: {
          'zhuda-2d.js': { integrity: 'sha384-a' },
          'zhuda-3d.js': { integrity: 'sha384-b' },
        },
      },
    ],
  };
  assert.deepEqual(
    releaseDrift(record, '2.0.0', { 'zhuda-2d.js': 'sha384-a', 'zhuda-3d.js': 'sha384-b' }),
    [],
  );
  assert.deepEqual(
    releaseDrift(record, '2.0.0', { 'zhuda-2d.js': 'sha384-a', 'zhuda-3d.js': 'sha384-changed' }),
    ['zhuda-3d.js'],
  );
  assert.deepEqual(
    releaseDrift(record, '2.0.0', { 'zhuda-2d.js': 'sha384-a' }),
    ['zhuda-3d.js'],
    'a missing bundle differs',
  );
  assert.deepEqual(
    releaseDrift(record, '2.1.0', { 'zhuda-2d.js': 'sha384-other' }),
    [],
    'an unreleased version has nothing to differ from',
  );
});
