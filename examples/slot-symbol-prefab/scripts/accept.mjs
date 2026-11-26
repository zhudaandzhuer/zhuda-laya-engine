#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { acceptConsumer } from '../../../packages/compiler/consumer-accept.mjs';
import {
  createIsolatedProject,
  engineRoot,
  projectRoot,
  removeIsolated,
} from './project-tools.mjs';
import { writeManifest } from './update-manifest.mjs';

const copyBack = (isolated, relative) => {
  const source = path.join(isolated, relative);
  const target = path.join(projectRoot, relative);
  if (!fs.existsSync(source)) return;
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
};

writeManifest(projectRoot);
const isolated = createIsolatedProject();
const capture = process.argv.includes('--capture');
try {
  // Read for the check alone: a copy without a readable configuration stops here.
  JSON.parse(fs.readFileSync(path.join(isolated, 'zhuda.config.json'), 'utf8'));
  const result = await acceptConsumer({ projectRoot: isolated, engineRoot, capture });
  copyBack(isolated, 'reference');
  copyBack(isolated, 'evidence');
  if (result.published) copyBack(isolated, 'dist');
  console.log(
    JSON.stringify({ capture, published: result.published, reports: result.reports }, null, 2),
  );
} finally {
  removeIsolated(isolated);
}
