import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { collectTsFiles } from "./ast-scanner.mjs";

const ENGINE_PACKAGE = "zhuda-laya-engine";
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const PRIVATE_ENGINE_IMPORT = /zhuda-laya-engine\/(?:core|packages|vendor)(?:\/|$)|(?:^|\/)packages\/core\/(?:|$)|(?:^|\/)vendor\//;
const EXTERNAL_RENDERER_IMPORT = /^(?:three|three\/|three-stdlib(?:\/|$)|@react-three\/(?:fiber|three-fiber)(?:\/|$))/;
const FACADE_NAMES = new Set([
  "ZhudaEngine",
  "Zhuda3D",
  "ZhudaCameraRig",
  "LayaVector3",
  "LayaTransform3D",
  "LayaSprite3D",
  "LayaMeshSprite3D",
]);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function collectConsumerSourceFiles(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(file);
    }
  };
  visit(root);
  return files;
}

function lineAt(text, index) {
  return text.slice(0, Math.max(0, index)).split("\n").length;
}

function dependencyValue(manifest) {
  for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    const value = manifest?.[section]?.[ENGINE_PACKAGE];
    if (typeof value === "string") return { section, value };
  }
  return null;
}

function isPinnedDependency(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  const spec = value.trim();
  if (/^(?:workspace|file|link):/i.test(spec) || /^(?:\^|~|\*|latest$)/i.test(spec)) return false;
  if (/^(?:github:|git\+|git:|https?:\/\/)/i.test(spec)) return /#[0-9a-f]{7,40}$/i.test(spec);
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(spec);
}

function isExternalRendererSpecifier(specifier) {
  return EXTERNAL_RENDERER_IMPORT.test(specifier);
}

function addTextIssue(issues, projectRoot, file, code, message, text, pattern) {
  const match = pattern.exec(text);
  pattern.lastIndex = 0;
  if (!match) return;
  issues.push({
    file: path.relative(projectRoot, file) || path.basename(file),
    line: lineAt(text, match.index),
    code,
    message,
  });
}

/**
 * Check a consumer's public boundary before the compiler bundles it.
 *
 * The checks intentionally prove only static integration: a passing report
 * still needs a real WebGL/browser and device report before a project can
 * claim visual or performance acceptance.
 */
export function auditConsumerSources(projectRoot, overrides = {}) {
  const root = path.resolve(projectRoot);
  const issues = [];
  const sourceFiles = collectConsumerSourceFiles(path.join(root, "src"));
  let hasPublicSdkImport = false;
  let hasEngineBoot = false;

  const add = (source, node, code, message) => issues.push({
    file: path.relative(root, source.fileName),
    line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
    code,
    message,
  });

  for (const file of collectTsFiles(path.join(root, "src"))) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const visit = (node) => {
      if (ts.isClassDeclaration(node) && node.name && FACADE_NAMES.has(node.name.text)) {
        add(source, node, "FAKE_ENGINE_FACADE", `Do not reimplement ${node.name.text} in a consumer; import the public SDK and report missing APIs upstream.`);
      }
      if (ts.isFunctionDeclaration(node) && node.name && FACADE_NAMES.has(node.name.text)) {
        add(source, node, "FAKE_ENGINE_FACADE", `Do not reimplement ${node.name.text} in a consumer; import the public SDK and report missing APIs upstream.`);
      }
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && FACADE_NAMES.has(node.name.text) && node.initializer) {
        add(source, node, "FAKE_ENGINE_FACADE", `Do not reimplement ${node.name.text} in a consumer; import the public SDK and report missing APIs upstream.`);
      }
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        const specifier = node.moduleSpecifier?.text || "";
        if (specifier === ENGINE_PACKAGE) hasPublicSdkImport = true;
        if (PRIVATE_ENGINE_IMPORT.test(specifier))
          add(source, node, "PRIVATE_ENGINE_IMPORT", "Import { ZhudaEngine, Zhuda3D } from 'zhuda-laya-engine'. Its public declarations also expose typed Laya.Sprite3D/Laya.Vector3; report any remaining API gap with a strict consumer fixture.");
        if (isExternalRendererSpecifier(specifier))
          add(source, node, "EXTERNAL_RENDERER_IMPORT", "Use Zhuda's public rendering contracts; a Three.js renderer is not evidence of Zhuda engine usage.");
      }
      if (ts.isCallExpression(node) &&
          (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === "require")) {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteral(argument)) {
          if (argument.text === ENGINE_PACKAGE) hasPublicSdkImport = true;
          if (PRIVATE_ENGINE_IMPORT.test(argument.text))
            add(source, node, "PRIVATE_ENGINE_IMPORT", "Use the pinned 'zhuda-laya-engine' root (ZhudaEngine/Zhuda3D) and its typed Laya runtime declarations; do not import engine source paths.");
          if (isExternalRendererSpecifier(argument.text))
            add(source, node, "EXTERNAL_RENDERER_IMPORT", "Use Zhuda's public rendering contracts; a Three.js renderer is not evidence of Zhuda engine usage.");
        }
      }
      if (ts.isVariableDeclaration(node) && node.name.getText(source) === "Laya" && node.type?.kind === ts.SyntaxKind.AnyKeyword)
        add(source, node, "UNTYPED_LAYA", "Remove Laya: any. Import { ZhudaEngine, Zhuda3D } from 'zhuda-laya-engine'; after boot, use typed new Laya.Vector3(...) / new Laya.MeshSprite3D(...). LayaVector3 and LayaMeshSprite3D are not named SDK exports.");
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  for (const file of sourceFiles) {
    const code = fs.readFileSync(file, "utf8");
    const extension = path.extname(file).toLowerCase();
    if (extension !== ".ts" && extension !== ".tsx") {
      addTextIssue(issues, root, file, "FAKE_ENGINE_FACADE", "Do not define a fake Zhuda/Laya facade in consumer source; import the public SDK instead.", code, /\b(?:class\s+|(?:const|let|var)\s+)(?:ZhudaEngine|Zhuda3D|ZhudaCameraRig|Laya(?:Vector3|Transform3D|Sprite3D|MeshSprite3D))\b/);
    }
    addTextIssue(issues, root, file, "EXTERNAL_RENDERER_USAGE", "Do not use a Three.js renderer as the consumer's engine; use the pinned Zhuda/Laya runtime.", code, /\b(?:THREE\.(?:WebGLRenderer|Scene|PerspectiveCamera|Mesh|Group)|new\s+THREE\.)\b/);
    if (/\b(?:ZhudaEngine\.boot|new\s+ZhudaRuntimeHost)\b/.test(code)) hasEngineBoot = true;
  }

  const packagePath = path.join(root, "package.json");
  const manifest = readJson(packagePath);
  const dependency = dependencyValue(manifest);
  if (!manifest) {
    issues.push({ file: "package.json", line: 1, code: fs.existsSync(packagePath) ? "PACKAGE_MANIFEST_INVALID" : "PACKAGE_MANIFEST_MISSING", message: fs.existsSync(packagePath) ? "Fix package.json so the consumer dependency and pin can be read." : "Add package.json and declare the public zhuda-laya-engine dependency." });
  } else if (!dependency) {
    issues.push({ file: "package.json", line: 1, code: "ENGINE_DEPENDENCY_MISSING", message: "Declare zhuda-laya-engine in dependencies with an exact version or commit-pinned Git specification." });
  } else if (!isPinnedDependency(dependency.value)) {
    issues.push({ file: "package.json", line: 1, code: "ENGINE_DEPENDENCY_UNPINNED", message: `Pin zhuda-laya-engine instead of using ${dependency.value}; Git dependencies must end in a commit SHA.` });
  }

  const config = { ...(readJson(path.join(root, "zhuda.config.json")) || {}), ...overrides };
  const srcDir = path.join(root, "src");
  const entry = path.resolve(root, config.entry || "src/Main.ts");
  if (!fs.existsSync(srcDir)) {
    issues.push({ file: "src", line: 1, code: "CONSUMER_SOURCE_MISSING", message: "Create a src/ directory with a consumer entry before running the Zhuda build." });
  } else if (!fs.existsSync(entry)) {
    issues.push({ file: path.relative(root, entry), line: 1, code: "CONSUMER_ENTRY_MISSING", message: "Create the configured consumer entry (default: src/Main.ts)." });
  }
  if (!hasPublicSdkImport) {
    issues.push({ file: path.relative(root, entry) || "src/Main.ts", line: 1, code: "PUBLIC_SDK_IMPORT_MISSING", message: "Import the public zhuda-laya-engine package from the consumer entry; do not simulate the engine locally." });
  }
  if (!hasEngineBoot) {
    issues.push({ file: path.relative(root, entry) || "src/Main.ts", line: 1, code: "ENGINE_BOOT_MISSING", message: "Boot Zhuda with ZhudaEngine.boot (or isolate it with ZhudaRuntimeHost) before presenting a scene." });
  }

  const publicDir = path.resolve(root, config.publicDir || "public");
  const template = path.resolve(root, config.htmlTemplate || path.join(config.publicDir || "public", "index.html"));
  if (!fs.existsSync(template)) {
    issues.push({ file: path.relative(root, template), line: 1, code: "CONSUMER_HTML_MISSING", message: "Create public/index.html with the ZHUDA_LIBS and ZHUDA_ENTRY markers." });
  } else {
    const html = fs.readFileSync(template, "utf8");
    if (!html.includes("<!-- ZHUDA_LIBS -->") || !html.includes("<!-- ZHUDA_ENTRY -->")) {
      issues.push({ file: path.relative(root, template), line: 1, code: "CONSUMER_MARKERS_MISSING", message: "Keep <!-- ZHUDA_LIBS --> and <!-- ZHUDA_ENTRY --> in the consumer HTML template." });
    }
    addTextIssue(issues, root, template, "EXTERNAL_RENDERER_SCRIPT", "Do not load Three.js as the consumer renderer; let runConsumerBuild inject the pinned Laya runtime.", html, /(?:three(?:\.min)?\.js|cdnjs\.cloudflare\.com\/ajax\/libs\/three|(?:unpkg|cdn\.jsdelivr\.net)\/[^\"']*three)/i);
    addTextIssue(issues, root, template, "FAKE_ENGINE_FACADE", "Do not define a fake Zhuda/Laya facade in HTML; boot the public SDK from src/Main.ts.", html, /\bclass\s+(?:ZhudaEngine|Zhuda3D|Laya(?:Vector3|Transform3D|Sprite3D|MeshSprite3D))\b/);
    addTextIssue(issues, root, template, "EXTERNAL_RENDERER_USAGE", "Do not create a Three.js renderer in the consumer HTML; use the injected Zhuda/Laya runtime.", html, /\b(?:THREE\.(?:WebGLRenderer|Scene|PerspectiveCamera|Mesh|Group)|new\s+THREE\.)\b/);
  }
  if (!fs.existsSync(publicDir)) {
    issues.push({ file: path.relative(root, publicDir), line: 1, code: "CONSUMER_PUBLIC_DIR_MISSING", message: "Create the configured public/ directory for the consumer HTML and static files." });
  }

  if (fs.existsSync(path.join(root, "packages/core")))
    issues.push({ file: "packages/core", line: 1, code: "COPIED_ENGINE", message: "Install a pinned SDK instead of maintaining a consumer engine copy." });

  return {
    passed: !issues.length,
    issues,
    checks: {
      engineDependency: dependency ? { section: dependency.section, value: dependency.value, pinned: isPinnedDependency(dependency.value) } : null,
      publicSdkImport: hasPublicSdkImport,
      engineBoot: hasEngineBoot,
      htmlTemplate: path.relative(root, template),
    },
  };
}
