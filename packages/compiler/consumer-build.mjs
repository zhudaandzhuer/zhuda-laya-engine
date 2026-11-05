import {copyEngineLibraries} from './webgpu-loader.mjs';
import {resolveConsumerBranding} from './branding-assets.mjs';
import { injectBrandSplash } from './branding.mjs';
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";
import { auditVisualPresentationContracts } from "./visual-contract-audit.mjs";
import { auditConsumerSources } from "./consumer-guards.mjs";
import { buildPrefabPreview } from "./prefab-preview.mjs";
import { publishConsumerOutput } from "./consumer-publication.mjs";
import { auditPrefabEnvironment, requestedPrefabEnvironment } from "./prefab-environment.mjs";
import { auditPrefabLifecycle } from "./prefab-lifecycle.mjs";
import { buildPrefabDependencies, prefabEvidenceMatches } from './prefab-dependencies.mjs';
import { validatePrefabChecks } from './prefab-checks.mjs';
import { ENGINE_PRESET_PROFILES, TopologyResolver } from "./compiler-runtime.mjs";
import {
  collectTsFiles,
  parseReflectableClassesInFile,
} from "./ast-scanner.mjs";

/** Read-only reflection. Registration is appended after entry declarations initialize. */
export function zhudaConsumerPlugin({ projectRoot, entry, engineRoot }) {
  return {
    name: "zhuda-consumer",
    setup(build) {
      build.onResolve({ filter: /^zhuda-laya-engine$/ }, () => ({
        path: path.join(engineRoot, "dist/sdk/zhuda-laya-engine.esm.js"),
      }));
      build.onLoad({ filter: /\.tsx?$/ }, (args) => {
        if (path.resolve(args.path) !== path.resolve(entry)) return;
        const classes = collectTsFiles(path.join(projectRoot, "src")).flatMap(
          parseReflectableClassesInFile,
        );
        const imports = [
            `import {EngineGuard as __ZhudaGuard} from 'zhuda-laya-engine';`,
          ],
          calls = [];
        for (const [i, c] of classes.entries()) {
          let name = c.className;
          if (path.resolve(c.filePath) !== path.resolve(entry)) {
            name = `__ZhudaClass${i}`;
            imports.push(
              `import {${c.className} as ${name}} from ${JSON.stringify(c.filePath)};`,
            );
          }
          calls.push(
            `__ZhudaGuard.registerComponent(${JSON.stringify(c.className)},${name},${JSON.stringify(c.assetId)});`,
          );
        }
        return {
          contents:
            imports.join("\n") +
            "\n" +
            fs.readFileSync(entry, "utf8") +
            "\n" +
            calls.join("\n"),
          loader: "ts",
          resolveDir: path.dirname(entry),
        };
      });
    },
  };
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
const crc = (b) => {
  let n = 0xffffffff;
  for (const v of b) n = crcTable[(n ^ v) & 255] ^ (n >>> 8);
  return (n ^ 0xffffffff) >>> 0;
};
function ensureUtf8Charset(html) {
  if (/<meta\b[^>]*charset\s*=\s*["']?utf-8\b/i.test(html)) return html;
  const doctype = html.match(/^\s*<!doctype\b[^>]*>/i);
  if (!doctype) return `<meta charset="utf-8">${html}`;
  return `${doctype[0]}<meta charset="utf-8">${html.slice(doctype[0].length)}`;
}
function walk(root, dir = root, result = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink())
      throw Error("Build payload cannot contain symlinks");
    if (e.isDirectory()) walk(root, p, result);
    else
      result.push({
        path: path.relative(root, p).split(path.sep).join("/"),
        bytes: fs.readFileSync(p),
      });
  }
  return result;
}
function assetPaths(value, name) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some(p => typeof p !== 'string' || !p || p.startsWith('/') ||
      p.includes('\\') || /[:*?\0]/.test(p) || p.split('/').some(part => !part || part === '.' || part === '..')))
    throw Error(`${name} must contain normalized file or directory paths relative to assets/ (no glob patterns)`);
  return [...new Set(value)].sort();
}
/** ZIP Deflate, bounded entries; archive stays outside the web payload. Sizes are actual bytes. */
export function archiveConsumer(root, destination, maxBytes = 50_000_000) {
  const files = walk(root);
  if (files.length > 2000) throw Error("Archive exceeds 2000 entries");
  let offset = 0,
    unpacked = 0;
  const chunks = [],
    directory = [];
  for (const f of files) {
    const name = Buffer.from(f.path),
      raw = f.bytes,
      deflated = zlib.deflateRawSync(raw),
      store = raw.length > deflated.length * 190,
      packed = store ? raw : deflated,
      checksum = crc(raw);
    unpacked += raw.length;
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50);
    h.writeUInt16LE(20, 4);
    h.writeUInt16LE(0x800, 6);
    h.writeUInt16LE(store ? 0 : 8, 8);
    h.writeUInt32LE(checksum, 14);
    h.writeUInt32LE(packed.length, 18);
    h.writeUInt32LE(raw.length, 22);
    h.writeUInt16LE(name.length, 26);
    const d = Buffer.alloc(46);
    d.writeUInt32LE(0x02014b50);
    d.writeUInt16LE(20, 4);
    d.writeUInt16LE(20, 6);
    d.writeUInt16LE(0x800, 8);
    d.writeUInt16LE(store ? 0 : 8, 10);
    d.writeUInt32LE(checksum, 16);
    d.writeUInt32LE(packed.length, 20);
    d.writeUInt32LE(raw.length, 24);
    d.writeUInt16LE(name.length, 28);
    d.writeUInt32LE(offset, 42);
    directory.push(d, name);
    chunks.push(h, name, packed);
    offset += h.length + name.length + packed.length;
  }
  const central = Buffer.concat(directory),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  const zip = Buffer.concat([...chunks, central, end]);
  if (zip.length > maxBytes || unpacked > maxBytes)
    throw Error(
      `Payload limit exceeded: ZIP=${zip.length}, unpacked=${unpacked}, limit=${maxBytes}`,
    );
  fs.writeFileSync(destination, zip);
  return {
    zipBytes: zip.length,
    unpackedBytes: unpacked,
    entries: files.length,
    limitBytes: maxBytes,
  };
}
export async function runConsumerBuild({
  projectRoot,
  engineRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
  ),
  config = {},
  mode = 'release',
  expectedFingerprint,
}) {
  if (!['release', 'candidate'].includes(mode)) throw Error('Unknown consumer build mode');
  if (config.prefabChecks) validatePrefabChecks(config,projectRoot);
  const releaseOutput = path.resolve(projectRoot, config.outDir || 'dist/web');
  if (mode === 'candidate') config = { ...config, outDir: path.join(path.dirname(releaseOutput), 'candidate', path.basename(releaseOutput)) };
  const output = path.resolve(projectRoot, config.outDir || "dist/web"),
    entry = path.resolve(projectRoot, config.entry || "src/Main.ts"),
    pub = path.resolve(projectRoot, config.publicDir || "public");
  projectRoot = path.resolve(projectRoot);
  const template = path.resolve(
    projectRoot,
    config.htmlTemplate ||
      path.join(config.publicDir || "public", "index.html"),
  );
  const within = (a, b) => a === b || a.startsWith(b + path.sep);
  if (
    !within(output, projectRoot) ||
    output === projectRoot ||
    [
      pub,
      path.join(projectRoot, "src"),
      path.join(projectRoot, "assets"),
      entry,
      template,
      path.join(projectRoot, "node_modules"),
      engineRoot,
    ].some((source) => within(output, source) || within(source, output))
  )
    throw Error(
      "Output must be separate from source, public assets and engine",
    );
  for (let p = output; p !== projectRoot; p = path.dirname(p)) {
    if (fs.existsSync(p) && fs.lstatSync(p).isSymbolicLink())
      throw Error("Output path cannot contain symlinks");
  }
  const branding = resolveConsumerBranding(projectRoot, config.branding);
  const html = injectBrandSplash(ensureUtf8Charset(fs.readFileSync(template, "utf8")), fs.readFileSync(path.join(engineRoot, 'assets/branding/zhuda-layaair-mark.svg'), 'utf8'), branding);
  if (
    !html.includes("<!-- ZHUDA_LIBS -->") ||
    !html.includes("<!-- ZHUDA_ENTRY -->")
  )
    throw Error("HTML template needs ZHUDA_LIBS and ZHUDA_ENTRY markers");
  const visual = auditVisualPresentationContracts({
    projectRoot,
    manifestPath: config.visualContract,
  });
  if ((config.visualContract || visual.manifestPath) && !visual.passed)
    throw Error(
      "Visual presentation contract failed: " + visual.issues.join(" | "),
    );
  const guard = auditConsumerSources(projectRoot, config);
  if (!guard.passed) throw Error(guard.issues.map(i => `${i.file}:${i.line} [${i.code}] ${i.message}`).join("\n"));
  const features = config.features ||
    (config.profile && ENGINE_PRESET_PROFILES[config.profile]) ||
    ["core", "3d", "gltf"];
  let topology;
  try { topology = TopologyResolver.resolveByFeatures(features, config.renderer); }
  catch(error) { throw Error('zhuda.config.json:1 [RENDERER_TOPOLOGY] '+error.message); }
  const includes = assetPaths(config.assetInclude, 'assetInclude');
  const excludes = assetPaths(config.assetExclude, 'assetExclude') || [];
  const under = (value, prefix) => value === prefix || value.startsWith(prefix + '/');
  const assetAllowed = (relative, directory = false) =>
    !excludes.some(prefix => under(relative, prefix)) &&
    (includes === undefined || includes.some(prefix => under(relative, prefix) || (directory && under(prefix, relative))));
  const assets = path.join(projectRoot, 'assets');
  for (const include of includes || []) {
    if (!fs.existsSync(path.join(assets, include)) && !fs.existsSync(path.join(pub, 'assets', include)))
      throw Error(`assetInclude path is missing: ${include}`);
  }
  const parent = path.dirname(output);
  for (const name of ['game.zip', 'consumer-build.json']) {
    const artifact = path.join(parent, name);
    if (artifact === output || artifact === entry || artifact === template ||
        (fs.existsSync(artifact) && (!fs.lstatSync(artifact).isFile() || fs.lstatSync(artifact).isSymbolicLink())))
      throw Error(`Reserved consumer artifact path: ${artifact}`);
  }
  fs.mkdirSync(parent, { recursive: true });
  const lock = path.join(parent, '.zhuda-consumer-build.lock');
  let lockFd;
  try { lockFd = fs.openSync(lock, 'wx'); }
  catch (error) {
    if (error.code === 'EEXIST') throw Error(`Consumer build already owns ${parent}; if interrupted, confirm its process exited before removing ${lock}`);
    throw error;
  }
  let staging;
  let preserveRecovery = false;
  try {
    fs.writeFileSync(lockFd, JSON.stringify({ pid: process.pid, output }));
    staging = fs.mkdtempSync(path.join(parent, '.zhuda-build-'));
    const out = path.join(staging, 'web');
    fs.mkdirSync(path.join(out, "libs"), { recursive: true });
    if (fs.existsSync(pub))
      fs.cpSync(pub, out, {
        recursive: true,
        filter: (p) => {
          if (path.basename(p).startsWith('.')) return false;
          const relative = path.relative(pub, p).split(path.sep).join('/');
          return relative === 'assets' || !relative.startsWith('assets/') || assetAllowed(relative.slice(7), fs.lstatSync(p).isDirectory());
        },
      });
    if (fs.existsSync(assets))
      fs.cpSync(assets, path.join(out, "assets"), {
        recursive: true,
        filter: (p) => {
          if (path.basename(p).startsWith(".")) return false;
          const relative = path.relative(assets, p).split(path.sep).join("/");
          return relative === '' || assetAllowed(relative, fs.lstatSync(p).isDirectory());
        },
      });
    copyEngineLibraries(topology, path.join(engineRoot, "vendor/laya-3.4.2/libs"), path.join(out,"libs"));
    await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      format: "iife",
      target: "es2020",
      outfile: path.join(out, "app.js"),
      minify: true,
      plugins: [zhudaConsumerPlugin({ projectRoot, entry, engineRoot })],
    });
    const tags = topology.orderedFiles
      .map((f) => `<script src="libs/${f}"></script>`)
      .join("\n");
    fs.writeFileSync(
      path.join(out, "index.html"),
      html
        .replace("<!-- ZHUDA_LIBS -->", tags)
        .replace("<!-- ZHUDA_ENTRY -->", '<script src="app.js"></script>'),
    );
    fs.writeFileSync(path.join(out, ".nojekyll"), "");
    const componentBundles = config.prefabPreview
      ? await buildPrefabPreview({ projectRoot, engineRoot, out, topology, config }) : {};
    const notices = path.join(out, 'zhuda-notices');
    if (fs.existsSync(notices)) throw Error('Reserved payload directory: zhuda-notices');
    fs.mkdirSync(notices);
    fs.copyFileSync(path.join(engineRoot, 'LICENSE'), path.join(notices, 'LICENSE.txt'));
    if(topology.renderer==='webgpu')for(const file of ['WEBGPU-LICENSES.txt','webgpu-provenance.json'])fs.copyFileSync(path.join(engineRoot,'vendor/laya-3.4.2',file),path.join(notices,file));
    fs.writeFileSync(path.join(notices, 'branding.json'), JSON.stringify({mode: branding.mode, brandId: branding.brandId ?? 'zhuda', engine: 'zhuda-laya-engine', version: JSON.parse(fs.readFileSync(path.join(engineRoot, 'package.json'))).version}, null, 2));
    const payload = walk(out).map((f) => ({
      path: f.path,
      bytes: f.bytes.length,
      sha256: crypto.createHash("sha256").update(f.bytes).digest("hex"),
    }));
    const fingerprint = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    const prefabDependencies=buildPrefabDependencies(payload,config.prefabComponents,componentBundles);
    if (expectedFingerprint && expectedFingerprint !== fingerprint)
      throw Error('Candidate changed during acceptance; rebuild and rerun browser checks');
    const evidenceFiles = config.prefabChecks
      ? [...new Set([...(config.prefabEvidence || []), ...config.prefabChecks.map(check => check.output)])]
      : config.prefabEvidence;
    if (mode === 'release' && evidenceFiles) {
      if (!Array.isArray(evidenceFiles) || !evidenceFiles.length)
        throw Error("prefabEvidence requires at least one browser report");
      for (const file of evidenceFiles) {
        const reportPath = path.resolve(projectRoot, file);
        const evidence = JSON.parse(fs.readFileSync(reportPath, "utf8"));
        if (evidence.schemaVersion !== 2 || !evidence.passed || !evidence.provenance ||
            !evidence.environment?.passed ||
            !auditPrefabEnvironment(evidence.environment.requested, evidence.environment.measured).passed ||
            !evidence.selection?.id || !prefabEvidenceMatches(evidence,fingerprint,prefabDependencies))
          throw Error(`${file}: missing, failed or stale prefab evidence; rerun the browser comparison`);
        if (evidence.url && !auditPrefabLifecycle(evidence, evidence.url).passed)
          throw Error(`${file}: incomplete or failed prefab lifecycle`);
        for (const check of (config.prefabChecks || []).filter(value=>value.output===file)) {
          const {baseline,output,maxDiffPixels,...params}=check;
          const requestedUrl='http://localhost/prefab-preview.html?'+new URLSearchParams(params);
          if (!auditPrefabLifecycle(evidence,requestedUrl).passed ||
              !auditPrefabEnvironment(requestedPrefabEnvironment(requestedUrl),evidence.environment.measured).passed ||
              !evidence.comparison?.passed || !Number.isSafeInteger(evidence.comparison.differentPixels) ||
              evidence.comparison.differentPixels > (maxDiffPixels || 0) ||
              path.resolve(path.dirname(reportPath),evidence.baseline)!==path.resolve(projectRoot,baseline))
            throw Error(`${file}: evidence does not satisfy configured selection, cycles, baseline or tolerance`);
        }
        for (const [artifact, checksum] of [[evidence.actual, evidence.actualSha256], [evidence.baseline, evidence.baselineSha256]]) {
          if (typeof artifact !== "string" || typeof checksum !== "string" ||
              crypto.createHash("sha256").update(fs.readFileSync(path.resolve(path.dirname(reportPath), artifact))).digest("hex") !== checksum)
            throw Error(`${file}: changed prefab comparison artifact`);
        }
      }
    }
    fs.writeFileSync(
      path.join(out, "payload-manifest.json"),
      JSON.stringify(
        {
          renderer: topology.renderer,
          supportFiles: topology.supportFiles,
          libraries: topology.orderedFiles,
          fingerprint,
          prefabDependencies,
          files: payload,
          totalBytes: payload.reduce((n, f) => n + f.bytes, 0),
        },
        null,
        2,
      ),
    );
    const archive = archiveConsumer(
      out,
      path.join(path.dirname(out), "game.zip"),
      config.maxPackageBytes || 50_000_000,
    );
    const report = {
      branding: {mode: branding.mode, brandId: branding.brandId ?? "zhuda"},
      consumer: true,
      mode,
      fingerprint,
      releaseOutput,
      sourceWrites: 0,
      output,
      renderer: topology.renderer,
      supportFiles: topology.supportFiles,
      orderedLibraries: topology.orderedFiles,
      assets: { include: includes ?? null, exclude: excludes },
      route: {
        level: mode === 'candidate' ? 'unverified-candidate' : "engine-backed-static",
        engineDependency: guard.checks.engineDependency,
        publicSdkImport: guard.checks.publicSdkImport,
        engineBoot: guard.checks.engineBoot,
        browserWebGL: "required",
        deviceEvidence: "required",
      },
      archive,
    };
    fs.writeFileSync(
      path.join(path.dirname(out), "consumer-build.json"),
      JSON.stringify(report, null, 2),
    );
    publishConsumerOutput({ staging, output });
    return report;
  } catch (error) {
    preserveRecovery = Boolean(error.recoveryDirectory);
    throw error;
  } finally {
    // Cleanup failure must not turn an already-published success into a failed
    // build with changed output, nor hide the original gate/rollback error.
    for (const cleanup of [
      () => { if (staging && !preserveRecovery) fs.rmSync(staging, { recursive: true, force: true }); },
      () => fs.closeSync(lockFd),
      () => fs.unlinkSync(lock),
    ]) {
      try { cleanup(); }
      catch (error) { console.warn(`Consumer build cleanup: ${error.message}`); }
    }
  }
}
