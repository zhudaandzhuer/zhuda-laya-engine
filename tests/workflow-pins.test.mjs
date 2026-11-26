import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const workflows = path.resolve(import.meta.dirname, '../.github/workflows');

test('every action in a workflow is pinned to a commit, with its release beside it', () => {
  const files = fs.readdirSync(workflows).filter((name) => /\.ya?ml$/.test(name));
  assert.ok(files.length > 0);
  let seen = 0;
  for (const name of files) {
    const lines = fs.readFileSync(path.join(workflows, name), 'utf8').split('\n');
    lines.forEach((line, index) => {
      const uses = /^\s*-?\s*uses:\s*(\S+)(.*)$/.exec(line);
      if (!uses) return;
      seen++;
      const where = `${name}:${index + 1}: ${line.trim()}`;
      // A tag such as v4 can be moved to other code; a full commit hash cannot.
      assert.match(
        uses[1],
        /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/,
        `${where}: pin the action to a commit`,
      );
      assert.match(uses[2], /^\s+# v\d+\.\d+\.\d+$/, `${where}: name the release in a comment`);
    });
  }
  assert.ok(seen > 0);
});
