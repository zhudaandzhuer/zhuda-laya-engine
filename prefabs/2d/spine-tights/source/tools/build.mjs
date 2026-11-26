// The consumer build with the pinned SDK; RENDERER=webgl for the WebGL backend (default: the config's, WebGPU).
import fs from 'node:fs';
import path from 'node:path';
const projectRoot = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const engineRoot = path.join(projectRoot, 'node_modules/zhuda-laya-engine');
const { runConsumerBuild } = await import(path.join(engineRoot, 'packages/compiler/consumer-build.mjs'));
const config = JSON.parse(fs.readFileSync(path.join(projectRoot, 'zhuda.config.json'), 'utf8'));
if (process.env.RENDERER) config.renderer = process.env.RENDERER;
await runConsumerBuild({ projectRoot, engineRoot, config });
console.log('built', config.renderer, path.join(projectRoot, config.outDir));
