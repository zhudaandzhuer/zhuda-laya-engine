// Independent consumer build with the engine this project pins.
// ZHUDA_ENGINE_ROOT=<engine checkout> builds against an unreleased engine change; never publish that build.
import fs from 'node:fs';
import path from 'node:path';
import { runConsumerBuild } from '../node_modules/zhuda-laya-engine/packages/compiler/consumer-build.mjs';
const projectRoot = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const config = JSON.parse(fs.readFileSync(path.join(projectRoot, 'zhuda.config.json'), 'utf8'));
if (process.env.RENDERER) config.renderer = process.env.RENDERER;
await runConsumerBuild({ projectRoot, engineRoot: process.env.ZHUDA_ENGINE_ROOT || path.join(projectRoot, 'node_modules/zhuda-laya-engine'), config });
console.log('built', path.join(projectRoot, config.outDir));
