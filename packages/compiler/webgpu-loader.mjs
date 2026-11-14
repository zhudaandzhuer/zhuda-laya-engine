import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
/**
 * Runs in the page: returns what the renderer calls for its two compilers.
 * Written as a function so that it can be read and tested; `webgpuPreparation`
 * puts its text into the page.
 *
 * Compiler bytes are pinned before upstream Emscripten initialization is
 * entered: its failed fetch rejects an extra ready promise, so the fetch here
 * owns the abort and error paths.
 *
 * Bytes that are fetched (not carried in the script) are kept in the origin's
 * Cache Storage under their SHA-256, so a new release of a game or of the
 * SDK, at a new address, does not download the same 5.9 MB again. What comes
 * out of the cache is checked like what comes off the network; an entry that
 * fails is deleted and fetched. A page without Cache Storage (a sandboxed
 * frame, an insecure page) fetches as before: the cache never fails a boot.
 */
export function compilerPreparation(base, resources, shader, naga) {
  const digest = async (bytes) =>
    Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
  const key = (r) => new URL('/.zhuda-webgpu-compilers/' + r.sha256, location.href).href;
  return async (signal) => {
    const check = () => {
      if (signal.aborted) throw signal.reason;
    };
    check();
    let store = null;
    if (resources.some((r) => !r.base64)) {
      try {
        store = await caches.open('zhuda-webgpu-compilers');
      } catch {
        store = null;
      }
      check();
    }
    let from = 'inline';
    const data = await Promise.all(
      resources.map(async (r) => {
        let bytes;
        if (r.base64) bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
        else if (store) {
          try {
            const kept = await store.match(key(r));
            if (kept) {
              bytes = new Uint8Array(await kept.arrayBuffer());
              if ((await digest(bytes)) !== r.sha256) {
                bytes = undefined;
                await store.delete(key(r));
              }
            }
          } catch {
            bytes = undefined;
          }
          check();
          if (bytes) {
            if (from === 'inline') from = 'cache';
            return bytes;
          }
        }
        const fetched = !bytes;
        if (fetched) {
          const response = await fetch(new URL(r.file, base), { signal });
          if (!response.ok)
            throw Error('WEBGPU_SHADER_COMPILER: ' + r.file + ' HTTP ' + response.status);
          bytes = new Uint8Array(await response.arrayBuffer());
          from = 'network';
        }
        check();
        if ((await digest(bytes)) !== r.sha256)
          throw Error('WEBGPU_SHADER_COMPILER: integrity mismatch ' + r.file);
        if (fetched && store) {
          try {
            await store.put(
              key(r),
              new Response(bytes, { headers: { 'Content-Type': 'application/wasm' } }),
            );
          } catch {
            // Over quota, or a store that went away: the next load fetches again.
          }
        }
        return bytes;
      }),
    );
    check();
    if (store) {
      // The cache holds what this page uses: other compilers (another engine) go.
      try {
        const wanted = new Set(resources.map(key));
        for (const request of await store.keys())
          if (!wanted.has(request.url)) await store.delete(request);
      } catch {
        // Nothing depends on it.
      }
      check();
    }
    const [glslang] = await Promise.all([
      shader()({ wasmBinary: data[0] }),
      naga()({ module_or_path: data[1] }),
    ]);
    check();
    return { glslang, naga: naga(), from };
  };
}

/**
 * The script text that sets `__ZHUDA_WEBGPU_PREPARE__` in a page. `shader`
 * and `naga` are the expressions for the two compiler factories, read when
 * the renderer starts; `base` is the expression for where fetched compilers
 * are, read when the script runs.
 */
export function webgpuPreparation({
  shader = 'globalThis.__ZHUDA_GLSL_FACTORY__',
  naga = 'globalThis.wasm_bindgen',
  resources,
  base = 'new URL(".",document.currentScript.src).href',
}) {
  return `globalThis.__ZHUDA_WEBGPU_PREPARE__=(${compilerPreparation.toString()})(${base},${JSON.stringify(resources)},()=>${shader},()=>${naga});`;
}
export function webgpuResources(vendorDir, inline = false) {
  return ['shader_compiler_web.wasm', 'nagabind_bg.wasm'].map((file) => {
    const bytes = fs.readFileSync(path.join(vendorDir, file));
    return {
      file,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      ...(inline ? { base64: bytes.toString('base64') } : {}),
    };
  });
}
export function copyEngineLibraries(topology, vendorDir, outDir) {
  for (const file of [...topology.orderedFiles, ...topology.supportFiles]) {
    const input = path.join(vendorDir, file),
      output = path.join(outDir, file);
    if (topology.renderer === 'webgpu' && file === 'shader_compiler_web.js') {
      const source = fs.readFileSync(input, 'utf8');
      fs.writeFileSync(
        output,
        `/* Zhuda wrapper; upstream source unchanged inside scope. */\n(function(){\n${source}\nglobalThis.__ZHUDA_GLSL_FACTORY__=ShaderCompiler;\n})();\n`,
      );
    } else if (topology.renderer === 'webgpu' && file === 'nagabind.js') {
      fs.writeFileSync(
        output,
        fs.readFileSync(input, 'utf8') +
          '\n' +
          webgpuPreparation({ resources: webgpuResources(vendorDir) }) +
          '\n',
      );
    } else fs.copyFileSync(input, output);
  }
}
