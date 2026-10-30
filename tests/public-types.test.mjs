import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import path from "node:path";
test("strict external consumers use public exports and nullable query contracts", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const program = ts.createProgram(
    [path.join(root, "tests/fixtures/public-runtime3d.ts")],
    {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true,
      skipLibCheck: true,
      noEmit: true,
    },
  );
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(
    diagnostics.length,
    0,
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (f) => f,
      getCurrentDirectory: () => root,
      getNewLine: () => "\n",
    }),
  );
});
