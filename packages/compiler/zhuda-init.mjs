#!/usr/bin/env node
import { cliMain } from './cli.mjs';
import {starter2D} from './consumer-starter-2d.mjs';
import {starterMiniGame} from './consumer-starter-minigame.mjs';
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const engineRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function packageName(value) {
  const name = String(value || "").trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!name) throw Error("Project name must contain at least one letter or number");
  return name;
}

function currentEngineSpec() {
  if (process.env.ZHUDA_ENGINE_SPEC) return process.env.ZHUDA_ENGINE_SPEC;
  try {
    const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: engineRoot, encoding: "utf8" }).trim();
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {cwd: engineRoot, encoding:'utf8'}).trim();
    if (fs.realpathSync(top) === fs.realpathSync(engineRoot) && /^[0-9a-f]{7,40}$/i.test(sha)) return `github:zhudaandzhuer/zhuda-laya-engine#${sha}`;
  } catch {
    // A packaged CLI may not have a Git checkout. Keep the requirement explicit.
  }
  throw Error("Cannot determine an engine commit; pass --engine <exact-version-or-git-commit-spec>.");
}

export function parseInitArgs(argv = process.argv.slice(2)) {
  let target = "zhuda-consumer";
  let name;
  let engine;
  let template = "3d";
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--name") {
      name = argv[++index];
      if (!name || name.startsWith("-")) throw Error("--name requires a package name");
    }
    else if (arg === "--engine") {
      engine = argv[++index];
      if (!engine || engine.startsWith("-")) throw Error("--engine requires an exact version or commit-pinned Git specification");
    }
    else if (arg === "--template") {
      template = argv[++index];
      if (!["2d","3d","minigame"].includes(template)) throw Error("--template requires 2d, 3d or minigame");
    }
    else if (arg === "--help" || arg === "-h") return { help: true };
    else if (arg.startsWith("-")) throw Error(`Unknown option: ${arg}`);
    else if (target !== "zhuda-consumer") throw Error("Only one target directory is supported");
    else target = arg;
  }
  const absoluteTarget = path.resolve(process.cwd(), target);
  return {
    target: absoluteTarget,
    name: packageName(name || path.basename(absoluteTarget)),
    engine: engine || currentEngineSpec(),
    help: false,
    template,
  };
}

function filesFor({ name, engine, template = "3d" }) {
  if (!["2d","3d","minigame"].includes(template)) throw Error("--template requires 2d, 3d or minigame");
  return {
    "package.json": JSON.stringify({
      name,
      private: true,
      type: "module",
      engines: { node: ">=24" },
      scripts: {
        build: "zhuda-laya-build",
        ...(template === 'minigame' ? {'build:minigame':'zhuda-laya-minigame','platforms':'zhuda-laya-minigame --list-platforms'} : {}),
        "build:candidate": "zhuda-laya-build --candidate",
        "watch:candidate": "zhuda-laya-watch --candidate",
        "accept:prefabs": "zhuda-laya-accept",
        typecheck: "tsc --noEmit",
        doctor: "zhuda-laya-doctor --project .",
        test: "node --test",
        verify: "npm run build && npm run typecheck && npm run doctor && npm test",
      },
      dependencies: { "zhuda-laya-engine": engine },
      devDependencies: { typescript: "5.6.3" },
    }, null, 2) + "\n",
    "zhuda.config.json": JSON.stringify({
      name,
      entry: "src/Main.ts",
      outDir: "dist/web",
      features: template === "2d" ? ["core", "2d", "ui"] : ["core", "3d"],
      ...(["2d","minigame"].includes(template) ? {prefabPreview: "src/prefabs.ts"} : {}),
      ...(template === "minigame" ? {minigame:{maxMainPackageBytes:8388608,targets:{}}} : {}),
      viewport: { width: 1280, height: 720, scaleMode: "showall" },
    }, null, 2) + "\n",
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        moduleResolution: "bundler",
        lib: ["ES2020", "DOM"],
        strict: true,
        skipLibCheck: false,
        noEmit: true,
      },
      include: ["src/**/*.ts"],
    }, null, 2) + "\n",
    ".gitignore": "node_modules/\ndist/\n",
    "public/index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>${name}</title>
    <style>html,body,#game{width:100%;height:100%;margin:0;overflow:hidden;background:#07111f}#game{touch-action:none}</style>
  </head>
  <body><main id="game" aria-label="Game"></main>
    <!-- ZHUDA_LIBS -->
    <!-- ZHUDA_ENTRY -->
  </body>
</html>
`,
    "src/Main.ts": `import { Zhuda3D, ZhudaEngine } from "zhuda-laya-engine";

async function main() {
  const container = document.querySelector<HTMLElement>("#game");
  if (!container) throw new Error("Missing #game container");

  const context = await ZhudaEngine.boot({
    container,
    features: ["core", "3d"],
    dprCap: 1.5,
    targetFPS: 60,
  });
  const scene = Zhuda3D.createScene3D(context.rootScene);
  Zhuda3D.createCamera(scene, { position: [0, 3, 7], rotationEuler: [-18, 0, 0] });
  Zhuda3D.createDirectionalLight(scene);

  const cube = new Laya.MeshSprite3D(Zhuda3D.createPrimitiveMesh("box", { width: 1.5, height: 1.5, depth: 1.5 }));
  cube.meshRenderer.sharedMaterial = Zhuda3D.createMaterial({ albedoColor: [0.2, 0.7, 1, 1], shininess: 48 });
  scene.addChild(cube);
  context.runtime.start(() => {});
}

void main();
`,
    "README.md": `# ${name}

This consumer is pinned to \`${engine}\`. It uses the public
\`zhuda-laya-engine\` SDK and the independent consumer build.

## Verify

\`npm install\` then run \`npm run verify\`. Static Doctor checks prove the
public boundary only. Record a real browser/WebGL report and device checks in
this repository before claiming visual or performance acceptance.

Keep game rules, assets, prefabs and deployment here. Read the engine's
\`AGENTS.md\` and [consumer route](https://github.com/zhudaandzhuer/zhuda-laya-engine/blob/main/docs/consumer-route.md)
before adding visual content.
`,
    ...(template === "2d" ? starter2D() : {}),
    ...(template === "minigame" ? starterMiniGame() : {}),
  };
}

export function initConsumer(options) {
  const target = path.resolve(options.target);
  if (fs.existsSync(target) && fs.readdirSync(target).length) throw Error(`Target is not empty: ${target}`);
  fs.mkdirSync(target, { recursive: true });
  for (const [relative, contents] of Object.entries(filesFor(options))) {
    const file = path.join(target, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  }
  return { target, name: options.name, engine: options.engine, files: Object.keys(filesFor(options)) };
}

export function printHelp() {
  console.log("Usage: zhuda-laya-init [directory] [--name package-name] [--engine exact-version-or-commit-spec] [--template 2d|3d|minigame]");
  console.log("Creates a public-SDK consumer with pinned engine dependency, required HTML markers and verify scripts.");
}

const launched = cliMain(import.meta.url, 'Usage: zhuda-laya-init DIRECTORY [--template 2d|3d|minigame] [--engine PIN]');
if (launched) {
  try {
    const options = parseInitArgs();
    if (options.help) printHelp();
    else {
      const result = initConsumer(options);
      console.log(`Created Zhuda consumer ${result.name} at ${result.target}`);
      console.log(`Pinned engine: ${result.engine}`);
      console.log("Next: cd into the project, npm install, then npm run verify");
    }
  } catch (error) {
    console.error(`zhuda-laya-init: ${error.message}`);
    process.exitCode = 1;
  }
}
