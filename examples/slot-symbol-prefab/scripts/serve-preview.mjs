#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreviewServer } from '../../../packages/compiler/prefab-watch.mjs';
import { projectRoot } from './update-manifest.mjs';

const port = Number(process.env.PORT || 8890);
const root = path.join(projectRoot, 'dist', 'candidate', 'web');
if (!fs.existsSync(root))
  throw new Error('No candidate preview found. Run npm run build:candidate first.');
const preview = createPreviewServer({ root, host: '127.0.0.1', port, reload: false });
await preview.listening;
console.log(
  `Slot Symbol preview: http://127.0.0.1:${port}/prefab-preview.html?id=slot%2Fsymbol&state=idle&node=Art&width=480&height=480&dpr=1`,
);
console.log('Press Ctrl-C to stop.');
const stop = async () => {
  await preview.close();
  process.exit(0);
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
