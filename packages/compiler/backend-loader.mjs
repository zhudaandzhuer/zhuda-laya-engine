import esbuild from 'esbuild';
// The same pinned transform options as the browser bundles: bytes never depend
// on a tsconfig.json next to the install.
const TSCONFIG_RAW = {
  compilerOptions: { experimentalDecorators: true, useDefineForClassFields: false },
};

/** The files the loader's bytes come from, relative to the engine root. */
export const BACKEND_LOADER_SOURCES = Object.freeze([
  'packages/core/runtime3d/BackendChoice.ts',
  'packages/compiler/backend-loader.mjs',
]);

/**
 * `zhuda-loader.js`: the backend chooser (`BackendChoice.ts`) as a script of
 * its own, to be loaded before either backend. It defines `ZhudaLoader` and
 * nothing else. The same engine version gives the same bytes.
 */
export async function backendLoaderCode(engineRoot, version) {
  const result = await esbuild.build({
    absWorkingDir: engineRoot,
    minify: true,
    stdin: {
      contents: `import {chooseZhudaBackend,loadZhudaBackend,probeZhudaBackend,retryZhudaBackend} from './packages/core/runtime3d/BackendChoice.ts';
if(globalThis.ZhudaLoader)throw Error('ZHUDA_DUPLICATE_LOADER: load the backend loader once');
Object.defineProperty(globalThis,'ZhudaLoader',{value:Object.freeze({
load:options=>loadZhudaBackend(options),
retry:reason=>retryZhudaBackend(reason),
choose:(facts,options,retry)=>chooseZhudaBackend(facts,options,retry),
probe:timeoutMs=>probeZhudaBackend(globalThis,timeoutMs)
}),configurable:false,writable:false});`,
      resolveDir: engineRoot,
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    tsconfigRaw: TSCONFIG_RAW,
  });
  return (
    `/* Zhuda LayaAir ${version} backend loader; MIT; see LICENSE.txt. Asks the browser, then loads one backend. */\n` +
    result.outputFiles[0].text
  );
}

const list = (files, prefix) => JSON.stringify(files.map((file) => prefix + file));

/**
 * The script a consumer page runs in place of its library tags: both
 * backends' libraries by name, what runs after them, and what happens when
 * a backend loads by halves (the page is loaded again on WebGL; when that
 * cannot be done the error is left on the document for a check to read).
 *
 * A page that sets `window.ZhudaBackendPrefer = 'webgl'` before this runs
 * (from the game's own settings) stays on WebGL without asking the browser.
 */
export function backendLoaderCall({ webgpu, webgl, prefix = 'libs/', between = '', after }) {
  return `ZhudaLoader.load({prefer:globalThis.ZhudaBackendPrefer,webgpu:${list(webgpu, prefix)},webgl:${list(webgl, prefix)},after:[${
    between ? `function(){${between}},` : ''
  }${after.map((file) => JSON.stringify(file)).join(',')}]}).catch(function(error){var text=String(error&&error.message||error);if(!ZhudaLoader.retry(text)){document.documentElement.setAttribute('data-zhuda-loader-error',text);console.error(error);}});`;
}
