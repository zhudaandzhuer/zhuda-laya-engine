import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const browserOnly = new Map([
  [
    'ZhudaRuntimeHost',
    'Mini-games use a single platform canvas; use ZhudaEngine.boot without a DOM container.',
  ],
  [
    'ZhudaPointerInput',
    'Use typed Laya stage/touch events and the existing ZhudaInputBuffer. DOM pointer capture is unavailable.',
  ],
  [
    'ZhudaVirtualGamepad',
    'Provide a platform/Laya input adapter to the existing input buffer; DOM gamepad controls are unavailable.',
  ],
  [
    'DirectoryAssetProvider',
    'Provide a platform transport through AssetProvider; browser fetch/URL delivery is not a mini-game transport.',
  ],
  [
    'ChunkedAssetProvider',
    'Provide a platform transport through AssetProvider; browser fetch/streams are not available on every host.',
  ],
  [
    'IframeSoundAdapter',
    'The browser mixer requires a validated platform audio backend; mini-game audio is not yet accepted by this route.',
  ],
  [
    'ZhudaWorkerFrameDriver',
    'Use the default runtime driver. Browser Workers are not portable mini-game background drivers.',
  ],
  ['NoSleepAdapter', 'Use the platform wake-lock capability after verifying host support.'],
]);

/** Conservative reachable-source audit. This is not a complete JS compatibility proof. */
export function auditMiniGameInputs(files, projectRoot) {
  const issues = [];
  for (const file of files) {
    if (!/\.[cm]?[jt]sx?$/.test(file) || file.includes(`${path.sep}node_modules${path.sep}`))
      continue;
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const add = (node, message) =>
      issues.push(
        `${path.relative(projectRoot, file)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1} [MINIGAME_BROWSER_API] ${message}`,
      );
    const namespaces = new Set();
    const checkImportName = (node, name) => {
      if (browserOnly.has(name)) add(node, browserOnly.get(name));
    };
    const visit = (node) => {
      if (ts.isNamespaceImport(node)) namespaces.add(node.name.text);
      if (ts.isImportSpecifier(node) || ts.isExportSpecifier(node)) {
        const name = (node.propertyName || node.name).text;
        checkImportName(node, name);
      }
      if (ts.isPropertyAccessExpression(node)) {
        const text = node.getText(source);
        if (ts.isIdentifier(node.expression) && namespaces.has(node.expression.text))
          checkImportName(node.name, node.name.text);
        if (
          /^(?:document|window\.document)\./.test(text) ||
          /^window\.(?:addEventListener|removeEventListener|location|localStorage|sessionStorage|AudioContext)\b/.test(
            text,
          )
        )
          add(
            node,
            'Remove browser DOM/storage/event dependencies from the mini-game entry; use Laya/PAL platform APIs and the shared runtime lifecycle.',
          );
      }
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0]) &&
        node.arguments[0].text === 'zhuda-laya-engine'
      )
        add(
          node,
          'Use a static public SDK import in the mini-game entry so the browser-only boundary can be checked before packaging.',
        );
      if (
        ts.isElementAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        namespaces.has(node.expression.text) &&
        node.argumentExpression &&
        ts.isStringLiteral(node.argumentExpression)
      )
        checkImportName(node.argumentExpression, node.argumentExpression.text);
      if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'container')
        add(
          node,
          'Mini-game boot cannot mount into an HTML container. Omit container and use designSize/width/height.',
        );
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  if (issues.length) throw Error([...new Set(issues)].join('\n'));
}
