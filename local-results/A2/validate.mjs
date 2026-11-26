// A2 step 1: every .glb under games/ through the Khronos glTF Validator.
// Usage: node local-results/A2/validate.mjs <dir holding node_modules/gltf-validator> [out dir]
// The validator is not a dependency of this repository: `npm i gltf-validator` anywhere and point at it.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const validatorHome = resolve(process.argv[2] ?? ".");
const out = resolve(process.argv[3] ?? "local-results/A2");
const validator = createRequire(join(validatorHome, "x.js"))("gltf-validator");
const root = resolve("games");

function walk(dir, found = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, found);
    else if (name.endsWith(".glb") || name.endsWith(".gltf")) found.push(p);
  }
  return found;
}

mkdirSync(join(out, "reports"), { recursive: true });
const rows = [];
const codes = new Map();
for (const file of walk(root).sort()) {
  const rel = relative(resolve("."), file);
  const report = await validator.validateBytes(new Uint8Array(readFileSync(file)), {
    uri: rel,
    maxIssues: 0,
    writeTimestamp: false,
  });
  writeFileSync(join(out, "reports", rel.replaceAll("/", "__") + ".json"), JSON.stringify(report, null, 2) + "\n");
  const i = report.issues;
  rows.push({ file: rel, errors: i.numErrors, warnings: i.numWarnings, infos: i.numInfos, hints: i.numHints, info: report.info });
  for (const m of i.messages) {
    const key = `${["error", "warning", "info", "hint"][m.severity]} ${m.code}`;
    const entry = codes.get(key) ?? { count: 0, files: new Set(), example: `${m.message} (${m.pointer ?? ""})` };
    entry.count += 1;
    entry.files.add(rel);
    codes.set(key, entry);
  }
}

const lines = [`glTF Validator ${validator.version()}, ${rows.length} files`, ""];
lines.push("errors warnings infos hints  file");
for (const r of rows) lines.push(`${String(r.errors).padStart(6)} ${String(r.warnings).padStart(8)} ${String(r.infos).padStart(5)} ${String(r.hints).padStart(5)}  ${r.file}`);
const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
lines.push(`${String(sum("errors")).padStart(6)} ${String(sum("warnings")).padStart(8)} ${String(sum("infos")).padStart(5)} ${String(sum("hints")).padStart(5)}  total`, "", "by code:");
for (const [key, e] of [...codes].sort((a, b) => a[0].localeCompare(b[0]))) lines.push(`  ${key}: ${e.count} in ${e.files.size} files; e.g. ${e.example}`);
writeFileSync(join(out, "validator-summary.log"), lines.join("\n") + "\n");
writeFileSync(join(out, "validator-info.json"), JSON.stringify(rows, null, 2) + "\n");
console.log(lines.join("\n"));
