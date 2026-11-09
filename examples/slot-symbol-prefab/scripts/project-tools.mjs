import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runZhudaBuild } from '../../../packages/compiler/zhuda-build.mjs';
import { writeManifest, projectRoot } from './update-manifest.mjs';

export const engineRoot = path.resolve(projectRoot, '../..');
export { projectRoot };

function copyFilter(source, destination) {
  const relative = path.relative(projectRoot, source);
  if (!relative) return true;
  const first = relative.split(path.sep)[0];
  if (first === 'dist' || first === 'node_modules') return false;
  return true;
}

export function createIsolatedProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-slot-symbol-consumer-'));
  fs.cpSync(projectRoot, root, { recursive: true, filter: copyFilter });
  return root;
}

function replaceDirectory(source, destination) {
  fs.rmSync(destination, { recursive: true, force: true });
  if (fs.existsSync(source)) fs.cpSync(source, destination, { recursive: true });
}

export async function buildIsolated({ mode = 'candidate', keep = true } = {}) {
  writeManifest(projectRoot);
  const isolated = createIsolatedProject();
  try {
    const config = JSON.parse(fs.readFileSync(path.join(isolated, 'zhuda.config.json'), 'utf8'));
    const report = await runZhudaBuild({ projectRoot: isolated, engineRoot, config, candidate: mode === 'candidate' });
    const sourceArtifacts = path.join(isolated, 'dist', mode === 'candidate' ? 'candidate' : '');
    const destinationArtifacts = path.join(projectRoot, 'dist', mode === 'candidate' ? 'candidate' : 'release');
    replaceDirectory(sourceArtifacts, destinationArtifacts);
    return { report, isolated, artifacts: destinationArtifacts };
  } finally {
    if (!keep) fs.rmSync(isolated, { recursive: true, force: true });
  }
}

export function removeIsolated(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv.includes('--release') ? 'release' : 'candidate';
  const result = await buildIsolated({ mode, keep: false });
  console.log(JSON.stringify({ mode, output: result.artifacts, fingerprint: result.report.fingerprint }, null, 2));
}
