import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Compare filesystem identities, including npm-bin links and encoded file URLs. */
export function isMainModule(url, entry = process.argv[1]) {
  if (!entry) return false;
  try {
    return fs.realpathSync(path.resolve(entry)) === fs.realpathSync(fileURLToPath(url));
  } catch {
    return false;
  }
}

export function cliMain(url, usage) {
  if (!isMainModule(url)) return false;
  if (process.argv.slice(2).some((value) => value === '--help' || value === '-h')) {
    console.log(usage);
    return false;
  }
  return true;
}
