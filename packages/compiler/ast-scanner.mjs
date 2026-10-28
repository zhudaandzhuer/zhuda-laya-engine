/**
 * @zhuda-laya/compiler — AST Class Reflection Scanner & Vite/esbuild Plugin
 *
 * 解決痛點二：資產反序列化與類別註冊黑盒 (ClassUtils.regClass Blackbox)
 * - 使用 TypeScript 官方編譯器 AST (ts.createSourceFile) 掃描專案內所有繼承
 *   Laya.Script / Laya.Component 或標註 @zhudaComponent / @regClass 的類別
 * - 自動生成 src/.generated/zhuda-registry.ts，於打包入口自動注入 ClassUtils.regClass()
 */

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const REFLECT_BASE_CLASSES = new Set([
  'Laya.Script',
  'Laya.Script3D',
  'Laya.Component',
  'Script',
  'Script3D',
  'Component',
  'ZhudaComponent'
]);

const REFLECT_DECORATORS = new Set(['zhudaComponent', 'regClass']);

/**
 * 遞迴列出目錄下所有 .ts 原始檔 (排除 .d.ts 與 .generated)
 */
export function collectTsFiles(dir, result = []) {
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTsFiles(fullPath, result);
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      result.push(fullPath);
    }
  }
  return result;
}

/**
 * 以 TypeScript AST 解析單一檔案中的可反射組件類別
 */
export function parseReflectableClassesInFile(filePath) {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const discovered = [];

  const visit = (node) => {
    if (ts.isClassDeclaration(node) && node.name) {
      const className = node.name.text;
      let isExported = false;
      let baseClass = null;
      let decoratorName = null;
      let assetId = null;

      // 檢查 export 修飾詞與裝飾器
      const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
      if (modifiers) {
        for (const mod of modifiers) {
          if (mod.kind === ts.SyntaxKind.ExportKeyword) {
            isExported = true;
          }
        }
      }

      const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) : undefined;
      if (decorators) {
        for (const dec of decorators) {
          const expr = dec.expression;
          if (ts.isCallExpression(expr)) {
            const callee = expr.expression.getText(sourceFile);
            if (REFLECT_DECORATORS.has(callee)) {
              decoratorName = callee;
              if (expr.arguments.length > 0) {
                const arg0 = expr.arguments[0];
                if (ts.isStringLiteral(arg0)) {
                  assetId = arg0.text;
                } else if (ts.isObjectLiteralExpression(arg0)) {
                  for (const prop of arg0.properties) {
                    if (
                      ts.isPropertyAssignment(prop) &&
                      prop.name.getText(sourceFile) === 'assetId' &&
                      ts.isStringLiteral(prop.initializer)
                    ) {
                      assetId = prop.initializer.text;
                    }
                  }
                }
              }
            }
          } else if (ts.isIdentifier(expr) && REFLECT_DECORATORS.has(expr.text)) {
            decoratorName = expr.text;
          }
        }
      }

      // 檢查 extends 子句
      if (node.heritageClauses) {
        for (const clause of node.heritageClauses) {
          if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
            for (const typeNode of clause.types) {
              const exprText = typeNode.expression.getText(sourceFile);
              if (REFLECT_BASE_CLASSES.has(exprText)) {
                baseClass = exprText;
              }
            }
          }
        }
      }

      if (isExported && (baseClass || decoratorName)) {
        discovered.push({
          className,
          filePath,
          baseClass: baseClass || 'Class',
          decorator: decoratorName,
          assetId: assetId || `zhuda://${className}`
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return discovered;
}

/**
 * 掃描整個 src 目錄並自動生成 src/.generated/zhuda-registry.ts
 */
export function scanAndGenerateRegistry(projectRoot) {
  const srcDir = path.join(projectRoot, 'src');
  const genDir = path.join(srcDir, '.generated');
  const registryPath = path.join(genDir, 'zhuda-registry.ts');

  const files = collectTsFiles(srcDir);
  const allClasses = [];

  for (const file of files) {
    const found = parseReflectableClassesInFile(file);
    allClasses.push(...found);
  }

  fs.mkdirSync(genDir, { recursive: true });

  const imports = allClasses.map((cls, idx) => {
    const relPath = path
      .relative(genDir, cls.filePath)
      .replace(/\\/g, '/')
      .replace(/\.ts$/, '');
    const normalizedRel = relPath.startsWith('.') ? relPath : `./${relPath}`;
    return `import { ${cls.className} as _Reflected_${idx}_${cls.className} } from '${normalizedRel}';`;
  });

  const registrations = allClasses.map((cls, idx) => {
    const refVar = `_Reflected_${idx}_${cls.className}`;
    return `  EngineGuard.registerComponent('${cls.className}', ${refVar}, '${cls.assetId}');`;
  });

  const content = `/**
 * AUTO-GENERATED BY @zhuda-laya/compiler (AST Class Reflection Scanner)
 * DO NOT EDIT MANUALLY — 取代 LayaAir IDE 黑盒反射註冊表
 */
import { EngineGuard } from '../../packages/core/RuntimeGuards';
${imports.join('\n')}

export interface ReflectedClassRecord {
  className: string;
  baseClass: string;
  decorator: string | null;
  assetId: string;
}

export const ZHUDA_REFLECTED_MANIFEST: ReflectedClassRecord[] = ${JSON.stringify(
    allClasses.map((c) => ({
      className: c.className,
      baseClass: c.baseClass,
      decorator: c.decorator,
      assetId: c.assetId
    })),
    null,
    2
  )};

export function registerAllReflectedComponents(): ReflectedClassRecord[] {
${registrations.join('\n')}
  return ZHUDA_REFLECTED_MANIFEST;
}
`;

  fs.writeFileSync(registryPath, content, 'utf8');
  return {
    registryPath,
    classes: allClasses
  };
}

/**
 * 相容 esbuild 的 AST 自動反射插件介面
 */
export function zhudaReflectionPlugin(projectRoot) {
  return {
    name: 'zhuda-laya-ast-reflection',
    setup(build) {
      build.onStart(() => {
        scanAndGenerateRegistry(projectRoot);
      });
    }
  };
}

/**
 * 相容 Vite / Rollup 的 AST 自動反射插件介面
 */
export function zhudaVitePlugin(projectRoot) {
  return {
    name: 'vite-plugin-zhuda-laya',
    buildStart() {
      scanAndGenerateRegistry(projectRoot);
    }
  };
}
