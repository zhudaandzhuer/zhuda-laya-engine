// The browser SDK folder a browser check serves. A folder given by the caller
// (a release being certified) is used as it is; otherwise the bundles are
// built from this source into a fresh folder, so a check never reads a stale
// `dist/browser/<version>` left from before a change (the builder refuses to
// overwrite a release folder that differs, and rightly).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildBrowserSdk } from '../../packages/compiler/browser-sdk.mjs';

const engineRoot = path.resolve(import.meta.dirname, '../..');

/** `given` (a path), or this source's bundles built into a fresh temporary folder. */
export async function browserSdkFolder(given) {
  if (given) return path.resolve(given);
  const version = JSON.parse(fs.readFileSync(path.join(engineRoot, 'package.json'))).version;
  const outDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-browser-check-')), version);
  await buildBrowserSdk({ engineRoot, outDir });
  return outDir;
}
