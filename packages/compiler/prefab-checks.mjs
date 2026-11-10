import path from 'node:path';
import { requestedPrefabCycles } from './prefab-lifecycle.mjs';
import { requestedPrefabEnvironment } from './prefab-environment.mjs';
export function validatePrefabChecks(config, projectRoot) {
  if (!Array.isArray(config.prefabChecks) || !config.prefabChecks.length)
    throw Error('zhuda.config.json: prefabChecks needs at least one id, baseline and output');
  const outputs = new Set();
  for (const [i, check] of config.prefabChecks.entries()) {
    const fail = (message) => {
      throw Error(`zhuda.config.json: prefabChecks[${i}]: ${message}`);
    };
    if (!check || typeof check.id !== 'string' || !check.id) fail('id is required');
    for (const key of ['baseline', 'output']) {
      const value = check[key];
      if (
        typeof value !== 'string' ||
        !value ||
        path.isAbsolute(value) ||
        value.includes('\\') ||
        value.split('/').some((v) => !v || v === '.' || v === '..')
      )
        fail(`${key} must be project-relative`);
      if (!path.resolve(projectRoot, value).startsWith(path.resolve(projectRoot) + path.sep))
        fail(`invalid ${key}`);
    }
    if (outputs.has(check.output) || check.output === check.baseline)
      fail('outputs must be distinct from each other and references');
    outputs.add(check.output);
    for (const key of ['node', 'state'])
      if (check[key] !== undefined && typeof check[key] !== 'string')
        fail(`${key} must be a string`);
    const url =
      'http://localhost/?' +
      new URLSearchParams(
        Object.fromEntries(
          Object.entries(check).filter(([key]) =>
            ['width', 'height', 'dpr', 'cycles'].includes(key),
          ),
        ),
      );
    requestedPrefabCycles(url);
    requestedPrefabEnvironment(url);
    if (
      check.maxDiffPixels !== undefined &&
      (!Number.isSafeInteger(check.maxDiffPixels) || check.maxDiffPixels < 0)
    )
      fail('invalid maxDiffPixels');
    if (
      check.browserTimeoutMs !== undefined &&
      (!Number.isSafeInteger(check.browserTimeoutMs) ||
        check.browserTimeoutMs < 5000 ||
        check.browserTimeoutMs > 180000)
    )
      fail('invalid browserTimeoutMs');
    for (const key of Object.keys(check))
      if (
        ![
          'id',
          'node',
          'state',
          'width',
          'height',
          'dpr',
          'cycles',
          'baseline',
          'output',
          'maxDiffPixels',
          'browserTimeoutMs',
        ].includes(key)
      )
        fail(`unknown field ${key}`);
  }
  return config.prefabChecks;
}
