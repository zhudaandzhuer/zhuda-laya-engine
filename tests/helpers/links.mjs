// File symbolic links need Developer Mode or an elevated shell on Windows;
// directory junctions do not. A test that needs a file link asks here and
// skips that part, with the reason, instead of failing where links are not
// allowed. Directory links in the tests use 'junction' for the same reason.
import fs from 'node:fs';

export const NO_FILE_LINKS =
  'file symbolic links are not permitted here (Windows without Developer Mode or elevation)';

/** Creates a file symbolic link. False only where Windows refuses for lack of the right. */
export function linkFile(target, link) {
  try {
    fs.symlinkSync(target, link, 'file');
    return true;
  } catch (error) {
    if (process.platform === 'win32' && error.code === 'EPERM') return false;
    throw error;
  }
}
