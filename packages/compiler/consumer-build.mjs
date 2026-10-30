import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";
import { auditVisualPresentationContracts } from "./visual-contract-audit.mjs";
import { TopologyResolver } from "./compiler-runtime.mjs";
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
}) {
  const out = path.resolve(projectRoot, config.outDir || "dist/web"),
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
    !within(out, projectRoot) ||
    out === projectRoot ||
    [
      pub,
      path.join(projectRoot, "src"),
      entry,
      template,
      path.join(projectRoot, "node_modules"),
      engineRoot,
    ].some((source) => within(out, source) || within(source, out))
  )
    throw Error(
      "Output must be separate from source, public assets and engine",
    );
  for (let p = out; p !== projectRoot; p = path.dirname(p)) {
    if (fs.existsSync(p) && fs.lstatSync(p).isSymbolicLink())
      throw Error("Output path cannot contain symlinks");
  }
  const html = fs.readFileSync(template, "utf8");
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
  const topology = TopologyResolver.resolveByFeatures(
    config.features || ["core", "3d", "gltf"],
  );
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, "libs"), { recursive: true });
  if (fs.existsSync(pub))
    fs.cpSync(pub, out, {
      recursive: true,
      filter: (p) => !path.basename(p).startsWith("."),
    });
  for (const file of topology.orderedFiles)
    fs.copyFileSync(
      path.join(engineRoot, "vendor/laya-3.4.2/libs", file),
      path.join(out, "libs", file),
    );
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
  const payload = walk(out).map((f) => ({
    path: f.path,
    bytes: f.bytes.length,
    sha256: crypto.createHash("sha256").update(f.bytes).digest("hex"),
  }));
  fs.writeFileSync(
    path.join(out, "payload-manifest.json"),
    JSON.stringify(
      {
        libraries: topology.orderedFiles,
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
    consumer: true,
    sourceWrites: 0,
    output: out,
    orderedLibraries: topology.orderedFiles,
    archive,
  };
  fs.writeFileSync(
    path.join(path.dirname(out), "consumer-build.json"),
    JSON.stringify(report, null, 2),
  );
  return report;
}
