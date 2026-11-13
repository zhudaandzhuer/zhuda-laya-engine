#!/usr/bin/env node
import { cliMain } from './cli.mjs';
import { starter2D } from './consumer-starter-2d.mjs';
import { starterMiniGame } from './consumer-starter-minigame.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const engineRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function packageName(value) {
  const name = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!name) throw Error('Project name must contain at least one letter or number');
  return name;
}

function currentEngineSpec() {
  if (process.env.ZHUDA_ENGINE_SPEC) return process.env.ZHUDA_ENGINE_SPEC;
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: engineRoot,
      encoding: 'utf8',
    }).trim();
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: engineRoot,
      encoding: 'utf8',
    }).trim();
    if (fs.realpathSync(top) === fs.realpathSync(engineRoot) && /^[0-9a-f]{7,40}$/i.test(sha))
      return `github:zhudaandzhuer/zhuda-laya-engine#${sha}`;
  } catch {
    // A packaged CLI may not have a Git checkout. Keep the requirement explicit.
  }
  throw Error(
    'Cannot determine an engine commit; pass --engine <exact-version-or-git-commit-spec>.',
  );
}

export function parseInitArgs(argv = process.argv.slice(2)) {
  let target = 'zhuda-consumer';
  let name;
  let engine;
  let template = '3d';
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--name') {
      name = argv[++index];
      if (!name || name.startsWith('-')) throw Error('--name requires a package name');
    } else if (arg === '--engine') {
      engine = argv[++index];
      if (!engine || engine.startsWith('-'))
        throw Error('--engine requires an exact version or commit-pinned Git specification');
    } else if (arg === '--template') {
      template = argv[++index];
      if (!['2d', '3d', 'minigame'].includes(template))
        throw Error('--template requires 2d, 3d or minigame');
    } else if (arg === '--help' || arg === '-h') return { help: true };
    else if (arg.startsWith('-')) throw Error(`Unknown option: ${arg}`);
    else if (target !== 'zhuda-consumer') throw Error('Only one target directory is supported');
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

function filesFor({ name, engine, template = '3d' }) {
  if (!['2d', '3d', 'minigame'].includes(template))
    throw Error('--template requires 2d, 3d or minigame');
  return {
    'package.json':
      JSON.stringify(
        {
          name,
          private: true,
          type: 'module',
          engines: { node: '>=24' },
          scripts: {
            build: 'zhuda-laya-build',
            ...(template === 'minigame'
              ? {
                  'build:minigame': 'zhuda-laya-minigame',
                  platforms: 'zhuda-laya-minigame --list-platforms',
                }
              : {}),
            'build:candidate': 'zhuda-laya-build --candidate',
            'watch:candidate': 'zhuda-laya-watch --candidate',
            'accept:prefabs': 'zhuda-laya-accept',
            typecheck: 'tsc --noEmit',
            doctor: 'zhuda-laya-doctor --project .',
            test: 'node --test',
            verify: 'npm run build && npm run typecheck && npm run doctor && npm test',
          },
          dependencies: { 'zhuda-laya-engine': engine },
          devDependencies: { typescript: '5.6.3' },
        },
        null,
        2,
      ) + '\n',
    'zhuda.config.json':
      JSON.stringify(
        {
          name,
          entry: 'src/Main.ts',
          outDir: 'dist/web',
          features:
            template === '2d'
              ? ['core', '2d', 'ui']
              : template === '3d'
                ? ['core', '3d', 'postProcess']
                : ['core', '3d'],
          ...(['2d', 'minigame'].includes(template) ? { prefabPreview: 'src/prefabs.ts' } : {}),
          ...(template === 'minigame'
            ? { minigame: { maxMainPackageBytes: 8388608, targets: {} } }
            : {}),
          viewport: { width: 1280, height: 720, scaleMode: 'showall' },
        },
        null,
        2,
      ) + '\n',
    'tsconfig.json':
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
            module: 'ESNext',
            moduleResolution: 'bundler',
            lib: ['ES2020', 'DOM'],
            strict: true,
            skipLibCheck: false,
            noEmit: true,
          },
          include: ['src/**/*.ts'],
        },
        null,
        2,
      ) + '\n',
    '.gitignore': 'node_modules/\ndist/\n',
    'public/index.html': `<!doctype html>
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
    'src/Main.ts': `import {
  Zhuda3D,
  ZhudaEngine,
  ZhudaQualityGovernor,
  ZhudaSceneLook,
  type ZhudaLookQuality,
} from "zhuda-laya-engine";

async function main() {
  const container = document.querySelector<HTMLElement>("#game");
  if (!container) throw new Error("Missing #game container");

  // postProcess carries the HDR grade: tone mapping, bloom, ambient occlusion.
  const context = await ZhudaEngine.boot({
    container,
    features: ["core", "3d", "postProcess"],
    dprCap: 1.5,
    targetFPS: 60,
  });
  const scene = Zhuda3D.createScene3D(context.rootScene);
  const eye: [number, number, number] = [5, 3, 7];
  const target: [number, number, number] = [0, 0.75, 0];
  const camera = Zhuda3D.createCamera(scene, { position: eye, rotationEuler: [-14.7, 35.5, 0] });

  // The look owns the sun, its shadows, the sky, the fog and the HDR chain:
  // do not add a directional light of your own. See the engine's
  // docs/quality-route.md for every step and why it is there.
  const look = new ZhudaSceneLook(scene, camera, {
    preset: "day",
    sun: { azimuthDeg: 155, elevationDeg: 32 }, // from the side, a little ahead of the camera
    ambientGround: [0.26, 0.23, 0.2], // what the ground throws back
    shadows: { distance: 40, resolution: 2048, cascades: 4 },
    grade: { exposure: 1.1, bloom: 0.2, ao: 0.6 },
    lightFog: { density: 0.003 }, // its colour follows the sky
  });

  // Physically based surfaces (the default): lit by the sky and the HDR chain.
  const surface = (albedoColor: [number, number, number, number], smoothness: number) =>
    Zhuda3D.createMaterial({ type: "pbr", albedoColor, smoothness, metallic: 0 });
  const add = (mesh: Laya.Mesh, material: Laya.Material, y: number) => {
    const node = new Laya.MeshSprite3D(mesh);
    node.meshRenderer.sharedMaterial = material;
    node.meshRenderer.castShadow = true;
    node.meshRenderer.receiveShadow = true;
    node.transform.position = new Laya.Vector3(0, y, 0);
    scene.addChild(node);
    return node;
  };
  add(
    Zhuda3D.createPrimitiveMesh("box", { width: 30, height: 0.2, depth: 30 }),
    surface([0.32, 0.33, 0.35, 1], 0.1),
    -0.1,
  );
  add(
    Zhuda3D.createPrimitiveMesh("box", { width: 1.5, height: 1.5, depth: 1.5 }),
    surface([0.2, 0.55, 0.9, 1], 0.55),
    0.75,
  );

  // Hold the frame budget: the governor decides the level, the look applies it.
  const governor = new ZhudaQualityGovernor({ budgetMs: 1000 / 60 });
  context.runtime.start((dt) => {
    look.update(eye, target, camera.fieldOfView, camera.aspectRatio);
    const level = governor.sample(dt * 1000);
    if (level !== undefined) look.setQuality(level as ZhudaLookQuality);
  });
}

void main();
`,
    'README.md': `# ${name}

This consumer is pinned to \`${engine}\`. It uses the public
\`zhuda-laya-engine\` SDK and the independent consumer build.

## Verify

\`npm install\` then run \`npm run verify\`. Static Doctor checks prove the
public boundary only. Record a real browser/WebGL report and device checks in
this repository before claiming visual or performance acceptance.

Keep game rules, assets, prefabs and deployment here. Read \`AGENTS.md\` in
this folder first: it lists what to read in the installed engine, in order,
and how to connect the engine's MCP server (\`.mcp.json\`).
`,
    'AGENTS.md': `# AGENTS.md

This project is a game on \`zhuda-laya-engine\`, pinned to \`${engine}\`. For
any coding agent working here:

1. Import only from the public entries of the package (\`zhuda-laya-engine\`
   and the ones its \`package.json\` exports). \`npm run doctor\` checks that
   boundary.
2. The rules ship inside the package, at the pinned version. After
   \`npm install\`, read in this order:
   - \`node_modules/zhuda-laya-engine/AGENTS.md\`
   - \`node_modules/zhuda-laya-engine/docs/consumer-route.md\`
   - \`node_modules/zhuda-laya-engine/docs/quality-route.md\` before any 3D
     scene: the steps, in order, that make a scene look lit, grounded and deep.
3. With the MCP server connected (\`.mcp.json\`), call \`get_agent_contract\`
   and \`get_quality_route\` first. Author and preview 3D scenes with the
   \`film_*\` tools and act on the \`advice\` and \`metrics\` in their replies.
4. \`npm run verify\` must pass before anything is reported as done. It proves
   the build, the types and the package boundary, and no pixel: a visual or
   performance claim needs a recorded browser run kept in this repository.
`,
    '.mcp.json':
      JSON.stringify(
        { mcpServers: { 'zhuda-laya-engine': { command: 'npx', args: ['zhuda-laya-mcp'] } } },
        null,
        2,
      ) + '\n',
    ...(template === '2d' ? starter2D() : {}),
    ...(template === 'minigame' ? starterMiniGame() : {}),
  };
}

export function initConsumer(options) {
  const target = path.resolve(options.target);
  if (fs.existsSync(target) && fs.readdirSync(target).length)
    throw Error(`Target is not empty: ${target}`);
  fs.mkdirSync(target, { recursive: true });
  for (const [relative, contents] of Object.entries(filesFor(options))) {
    const file = path.join(target, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  }
  return {
    target,
    name: options.name,
    engine: options.engine,
    files: Object.keys(filesFor(options)),
  };
}

export function printHelp() {
  console.log(
    'Usage: zhuda-laya-init [directory] [--name package-name] [--engine exact-version-or-commit-spec] [--template 2d|3d|minigame]',
  );
  console.log(
    'Creates a public-SDK consumer with pinned engine dependency, required HTML markers and verify scripts.',
  );
}

const launched = cliMain(
  import.meta.url,
  'Usage: zhuda-laya-init DIRECTORY [--template 2d|3d|minigame] [--engine PIN]',
);
if (launched) {
  try {
    const options = parseInitArgs();
    if (options.help) printHelp();
    else {
      const result = initConsumer(options);
      console.log(`Created Zhuda consumer ${result.name} at ${result.target}`);
      console.log(`Pinned engine: ${result.engine}`);
      console.log('Next: cd into the project, npm install, then npm run verify');
    }
  } catch (error) {
    console.error(`zhuda-laya-init: ${error.message}`);
    process.exitCode = 1;
  }
}
