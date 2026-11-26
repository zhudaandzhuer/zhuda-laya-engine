/**
 * Scripts-only rebuilds for `zhuda-laya-watch --candidate`.
 *
 * A full consumer build copies the assets and the engine libraries, bundles `app.js`, writes the
 * pages, hashes every file and packs the ZIP. When a save changed nothing but files under `src/`,
 * only `app.js` can differ, so the watcher rebuilds that one file through an esbuild context it
 * keeps, with the options and the source gates of the full build.
 *
 * What comes out is never written to disk. The watcher's own server answers `app.js` from memory
 * and answers `payload-manifest.json` without a fingerprint while it does; the output directory,
 * the ZIP and the build report stay the last full build, whole. So there is no file that could be
 * taken for a release or for an accepted candidate.
 */
import crypto from 'node:crypto';
import path from 'node:path';
import esbuild from 'esbuild';
import { auditConsumerGates, consumerScriptOptions } from './consumer-build.mjs';

/**
 * What a change the watcher saw calls for. Only a file inside `src/` is 'scripts'; everything
 * else, and a change whose path is not known, is 'full'.
 */
export function classifyWatchChange(relative) {
  const parts = String(relative ?? '')
    .split(/[\\/]+/)
    .filter(Boolean);
  return parts.length > 1 && parts[0] === 'src' && !parts.includes('..') ? 'scripts' : 'full';
}

/**
 * Why a project's saves cannot be answered from the scripts alone, or null when they can.
 * Nothing in a consumer build reads the scripts to choose engine features or libraries (those
 * come from `zhuda.config.json`), and the class registry is inside `app.js`; what else is built
 * from the scripts is listed here and keeps the full build.
 */
export function scriptsOnlyObstacle({ projectRoot, engineRoot, config, candidate }) {
  if (!candidate)
    return 'without --candidate every build is a gated release written to the output directory';
  if (!config) return 'zhuda.config.json is missing or is not JSON';
  if (path.resolve(projectRoot) === path.resolve(engineRoot) || config.demoAssets === true)
    return 'this is the engine workbench, not a consumer build';
  for (const key of ['prefabPreview', 'prefabChecks', 'prefabEvidence'])
    if (config[key] !== undefined)
      return `"${key}" is configured: the prefab preview bundles and their evidence are built from the same scripts`;
  // A page input kept among the scripts would change with them and not be rebuilt.
  const src = path.join(path.resolve(projectRoot), 'src');
  for (const [key, file] of [
    ['htmlTemplate', config.htmlTemplate],
    ['publicDir', config.publicDir],
    ['branding.logo', config.branding?.logo],
  ]) {
    if (typeof file !== 'string') continue;
    const resolved = path.resolve(projectRoot, file);
    if (resolved === src || resolved.startsWith(src + path.sep))
      return `"${key}" is inside src/: the page, not only app.js, is built from it`;
  }
  return null;
}

/**
 * The payload manifest as the watcher serves it while `served` (path to bytes) replaces files of
 * the last full build: the listed files are the ones served, and there is no fingerprint and no
 * dependency proof, so a browser report taken now matches no build.
 */
export function staleManifest(manifest, served) {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.files)) return null;
  const { prefabDependencies: _dropped, ...rest } = manifest;
  const files = manifest.files.map((file) => {
    const bytes = served[file.path];
    return bytes
      ? {
          path: file.path,
          bytes: bytes.length,
          sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        }
      : file;
  });
  return {
    ...rest,
    fingerprint: null,
    stale: {
      by: 'zhuda-laya-watch',
      reason:
        'rebuilt from the scripts alone and served from memory; the files on disk are the last full build',
      files: Object.keys(served).sort(),
      fullBuildFingerprint: manifest.fingerprint ?? null,
    },
    files,
    totalBytes: files.reduce((total, file) => total + file.bytes, 0),
  };
}

/** Why a payload manifest cannot stand behind browser evidence, or null when it can. */
export function stalePayloadReason(manifest) {
  if (manifest?.stale) return String(manifest.stale.reason || 'marked stale');
  return null;
}

/**
 * A consumer's script bundle, kept for the life of a watcher. `rebuild()` gives the bytes a full
 * build would write as `app.js` from the sources as they are now, or throws what that build
 * would throw for them.
 */
export async function createScriptRebuilder({ projectRoot, engineRoot, config }) {
  projectRoot = path.resolve(projectRoot);
  const entry = path.resolve(projectRoot, config.entry || 'src/Main.ts');
  // What the two TypeScript passes over src/ found (the component classes, the source guards),
  // by file and by the file's text: a save parses only the files it changed.
  const classCache = new Map();
  const guardCache = new Map();
  const context = await esbuild.context({
    ...consumerScriptOptions({
      projectRoot,
      entry,
      engineRoot,
      // Names the output only: nothing is written.
      outfile: path.join(projectRoot, 'app.js'),
      classCache,
    }),
    write: false,
  });
  // A context's first build reads and parses everything. Done here, and thrown away, so that the
  // first save costs what the later ones do; what is wrong with the sources is reported by the
  // rebuild that answers a save.
  await context.rebuild().catch(() => {});
  return {
    async rebuild() {
      auditConsumerGates(projectRoot, config, guardCache);
      const { contents } = (await context.rebuild()).outputFiles[0];
      return Buffer.from(contents.buffer, contents.byteOffset, contents.byteLength);
    },
    dispose: () => context.dispose(),
  };
}
