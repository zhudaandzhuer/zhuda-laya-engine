import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { collectTsFiles } from "./ast-scanner.mjs";

export function auditConsumerSources(projectRoot) {
  const issues = [];
  const add = (source, node, code, message) => issues.push({
    file: path.relative(projectRoot, source.fileName),
    line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
    code, message
  });
  for (const file of collectTsFiles(path.join(projectRoot, "src"))) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const visit = node => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const specifier = node.moduleSpecifier?.text || "";
        if (/zhuda-laya-engine\/(?:core|packages|vendor)(?:\/|$)|(?:^|\/)packages\/core\/|(?:^|\/)vendor\//.test(specifier))
          add(source, node, "PRIVATE_ENGINE_IMPORT", "Use the pinned zhuda-laya-engine public entry; report missing APIs upstream.");
      }
      if (ts.isCallExpression(node) &&
          (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === "require")) {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteral(argument) &&
            /zhuda-laya-engine\/(?:core|packages|vendor)(?:\/|$)|(?:^|\/)packages\/core\/|(?:^|\/)vendor\//.test(argument.text))
          add(source, node, "PRIVATE_ENGINE_IMPORT", "Use the pinned zhuda-laya-engine public entry; report missing APIs upstream.");
      }
      if (ts.isVariableDeclaration(node) && node.name.getText(source) === "Laya" && node.type?.kind === ts.SyntaxKind.AnyKeyword)
        add(source, node, "UNTYPED_LAYA", "Remove Laya: any and use the installed public runtime declarations.");
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  if (fs.existsSync(path.join(projectRoot, "packages/core")))
    issues.push({ file: "packages/core", line: 1, code: "COPIED_ENGINE", message: "Install a pinned SDK instead of maintaining a consumer engine copy." });
  return { passed: !issues.length, issues };
}
