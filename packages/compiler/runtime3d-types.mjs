import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const source = path.join(root, "packages/core");
const program = ts.createProgram(
  ["runtime3d", "terrain", "shaders"].map((dir) =>
    path.join(source, dir, "index.ts"),
  ),
  {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    declaration: true,
    emitDeclarationOnly: true,
    allowImportingTsExtensions: true,
    skipLibCheck: true,
  },
);
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length)
  throw Error(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (f) => f,
      getCurrentDirectory: () => root,
      getNewLine: () => "\n",
    }),
  );
program.emit(undefined, (file, data) => {
  if (!file.startsWith(source + path.sep) || !file.endsWith(".d.ts")) return;
  const destination = path.join(
    root,
    "packages/types",
    path.relative(source, file),
  );
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(
    destination,
    data.replaceAll('.ts"', '"').replaceAll(".ts'", "'"),
  );
});
