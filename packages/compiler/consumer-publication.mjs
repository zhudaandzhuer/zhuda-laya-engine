import fs from 'node:fs';
import path from 'node:path';

/**
 * Publish already-validated artifacts with rollback on a caught rename error.
 * The caller holds the output-parent lock. No asynchronous work runs between
 * renames; this is not a crash-safe transaction or an atomic snapshot for
 * readers in other processes.
 */
export function publishConsumerOutput({ staging, output }) {
  const parent = path.dirname(output);
  const pairs = [
    ['web', output],
    ['game.zip', path.join(parent, 'game.zip')],
    ['consumer-build.json', path.join(parent, 'consumer-build.json')],
  ];
  const backups = [];
  const installed = [];
  try {
    for (const [name, destination] of pairs) {
      if (fs.existsSync(destination)) {
        const backup = path.join(staging, `previous-${name}`);
        fs.renameSync(destination, backup);
        backups.push([backup, destination]);
      }
      fs.renameSync(path.join(staging, name), destination);
      installed.push(destination);
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const destination of installed.reverse()) {
      try {
        fs.rmSync(destination, { recursive: true, force: true });
      } catch (failure) {
        rollbackErrors.push(failure);
      }
    }
    for (const [backup, destination] of backups.reverse()) {
      try {
        fs.renameSync(backup, destination);
      } catch (failure) {
        rollbackErrors.push(failure);
      }
    }
    if (rollbackErrors.length) {
      // Do not destroy the only remaining last-good files in the caller's cleanup.
      const failure = new AggregateError(
        [error, ...rollbackErrors],
        `Publication rollback incomplete; recover backups from ${staging}`,
      );
      failure.recoveryDirectory = staging;
      throw failure;
    }
    throw error;
  }
}
