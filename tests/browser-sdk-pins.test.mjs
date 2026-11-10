import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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
