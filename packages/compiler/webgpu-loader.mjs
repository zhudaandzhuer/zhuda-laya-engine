import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
/** Pin compiler bytes before entering upstream Emscripten initialization. Its
 * failed fetch rejects an extra ready promise; our fetch owns abort/error paths. */
export function webgpuPreparation({
  shader = 'globalThis.__ZHUDA_GLSL_FACTORY__',
  naga = 'globalThis.wasm_bindgen',
  resources,
  base = 'new URL(".",document.currentScript.src).href',
}) {
  return `globalThis.__ZHUDA_WEBGPU_PREPARE__=(()=>{const base=${base},resources=${JSON.stringify(resources)};return async signal=>{
 const check=()=>{if(signal.aborted)throw signal.reason;};check();
 const data=await Promise.all(resources.map(async r=>{let bytes;if(r.base64)bytes=Uint8Array.from(atob(r.base64),c=>c.charCodeAt(0));else{const response=await fetch(new URL(r.file,base),{signal});if(!response.ok)throw Error('WEBGPU_SHADER_COMPILER: '+r.file+' HTTP '+response.status);bytes=new Uint8Array(await response.arrayBuffer());}
 check();const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(actual!==r.sha256)throw Error('WEBGPU_SHADER_COMPILER: integrity mismatch '+r.file);return bytes;}));check();
 const [glslang]=await Promise.all([${shader}({wasmBinary:data[0]}),${naga}({module_or_path:data[1]})]);check();return {glslang,naga:${naga}};
 };})();`;
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
