/**
 * Runs every film verification on the WebGPU backend (real browser, hardware
 * adapter). Each script is the same one that certifies WebGL; only the film
 * host's renderer changes. A missing adapter fails: there is no fallback.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const scripts = [
  'verify-film-scene',
  'verify-film-look',
  'verify-film-model',
  'verify-film-reflector',
  'verify-film-fog',
  'verify-film-animation',
  'verify-film-environment',
  'verify-film-water',
];
const failed = [];
for (const name of scripts) {
  const run = spawnSync(process.execPath, [path.join(here, name + '.mjs')], {
    env: { ...process.env, ZHUDA_FILM_RENDERER: 'webgpu' },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = run.stdout + run.stderr;
  // Every script reports the adapter it drew with; WebGL here would be a false pass.
  const onGpu = /WebGPU [^"\n]*\(ready\)/.test(output);
  const ok = run.status === 0 && onGpu;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} on WebGPU`);
  if (!ok) {
    failed.push(name);
    console.log(output.split('\n').slice(-25).join('\n'));
    if (run.status === 0) console.log('The run did not report a ready WebGPU adapter.');
  }
}
if (failed.length) {
  console.error(`FAIL film on WebGPU: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`PASS film on WebGPU: ${scripts.length} verifications`);
