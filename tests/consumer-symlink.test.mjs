import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runConsumerBuild } from '../packages/compiler/consumer-build.mjs';
import { createScriptRebuilder } from '../packages/compiler/consumer-scripts.mjs';
import { initConsumer } from '../packages/compiler/zhuda-init.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const count = (bytes, text) => bytes.toString('utf8').split(text).length - 1;

test('a project reached through a symbolic link registers its component classes', async (t) => {
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-linked-')));
  const real = path.join(parent, 'real');
  const linked = path.join(parent, 'linked');
  let rebuilder;
  try {
    fs.mkdirSync(real);
    initConsumer({ target: real, name: 'linked-project', engine: '1.3.0' });
    try {
      fs.symlinkSync(real, linked, 'dir');
    } catch (error) {
      // Windows without the right to make links.
      t.skip(`no symbolic link here: ${error.code}`);
      return;
    }
    // One class in a file of its own that the entry also imports, one in the entry itself.
    fs.writeFileSync(
      path.join(real, 'src/Extra.ts'),
      'export class ExtraScript extends Laya.Script {\n  mark() {\n    return "EXTRA_BODY_ONCE";\n  }\n}\n',
    );
    const main = path.join(real, 'src/Main.ts');
    fs.writeFileSync(
      main,
      'import { ExtraScript } from "./Extra";\n' +
        fs.readFileSync(main, 'utf8') +
        '\nexport class EntryScript extends Laya.Script {}\nconsole.log(ExtraScript.name);\n',
    );
    const config = { features: ['core', '3d'] };
    const built = async (projectRoot) => {
      await runConsumerBuild({ projectRoot, engineRoot, config, mode: 'candidate' });
      return fs.readFileSync(path.join(real, 'dist/candidate/web/app.js'));
    };

    const throughReal = await built(real);
    for (const id of ['zhuda://ExtraScript', 'zhuda://EntryScript'])
      assert.equal(count(throughReal, id), 1, `${id} by the real path`);

    const throughLink = await built(linked);
    for (const id of ['zhuda://ExtraScript', 'zhuda://EntryScript'])
      assert.equal(count(throughLink, id), 1, `${id} through the link`);
    // The file imported by the entry and by the registry is one module, not two.
    assert.equal(count(throughLink, 'EXTRA_BODY_ONCE'), 1);
    // The same project, the same bundle, whichever way it was reached.
    assert.equal(sha(throughLink), sha(throughReal));

    // The watcher's kept bundle uses the same plugin.
    rebuilder = await createScriptRebuilder({ projectRoot: linked, engineRoot, config });
    assert.equal(sha(await rebuilder.rebuild()), sha(throughReal));
  } finally {
    await rebuilder?.dispose();
    fs.rmSync(parent, { recursive: true, force: true });
  }
});
