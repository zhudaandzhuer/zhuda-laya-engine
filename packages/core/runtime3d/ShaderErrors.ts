/**
 * A shader that does not compile, as something a person can act on: the
 * compiler's own words and the source lines they point at.
 *
 * LayaAir 3.4.2 gives the words only, and only to the console. On WebGPU
 * the draw then throws on a missing buffer; on WebGL the pass is skipped,
 * so a wrong shader is a thing that is simply not drawn. The renderer
 * records both in `context.renderer.errors` in this one form, with the
 * lines.
 */

/** How many lines before and after the failing one are shown. */
const BEFORE = 2,
  AFTER = 1;

/**
 * `Shader compile failed (<stage>): <log>` followed by the numbered source
 * lines round the first line the log names. Both compilers' forms are read:
 * `ERROR: 0:12: …` (WebGL) and `ERROR: :12: …` (glslang, on WebGPU). A log
 * that names no line, or a line the source does not have, gives the log
 * alone.
 */
export function zhudaShaderErrorExcerpt(log: string, source: string, stage: string): string {
  const text = String(log ?? '').trim();
  const head = `Shader compile failed (${stage}): ${text}`;
  const line = Number(/ERROR:\s*\d*:(\d+):/.exec(text)?.[1]);
  const lines = String(source ?? '').split('\n');
  if (!Number.isInteger(line) || line < 1 || line > lines.length) return head;
  const first = Math.max(1, line - BEFORE);
  return (
    head +
    '\n' +
    lines
      .slice(first - 1, line + AFTER)
      .map((content, i) => `${first + i}: ${content.slice(0, 240)}`)
      .join('\n')
  );
}

/**
 * Records every shader that fails to compile and every program that fails
 * to link on a WebGL context, into `errors` (at most `limit` entries), and
 * returns what takes the wrappers off again. The status is read right after
 * the compile, which LayaAir does itself, so nothing waits that did not wait
 * before.
 */
export function reportZhudaWebGLShaderErrors(gl: any, errors: string[], limit = 64): () => void {
  if (!gl || typeof gl.compileShader !== 'function') throw Error('A WebGL context is required');
  const sources = new WeakMap<object, string>();
  const original = {
    shaderSource: gl.shaderSource,
    compileShader: gl.compileShader,
    linkProgram: gl.linkProgram,
  };
  const wrappers = {
    shaderSource(this: any, shader: object, source: string) {
      if (shader) sources.set(shader, String(source));
      return original.shaderSource.call(gl, shader, source);
    },
    compileShader(this: any, shader: object) {
      const result = original.compileShader.call(gl, shader);
      if (
        shader &&
        errors.length < limit &&
        !gl.isContextLost?.() &&
        !gl.getShaderParameter(shader, gl.COMPILE_STATUS)
      )
        errors.push(
          zhudaShaderErrorExcerpt(
            gl.getShaderInfoLog(shader) ?? '',
            sources.get(shader) ?? '',
            gl.getShaderParameter(shader, gl.SHADER_TYPE) === gl.VERTEX_SHADER
              ? 'vertex'
              : 'fragment',
          ),
        );
      return result;
    },
    linkProgram(this: any, program: object) {
      const result = original.linkProgram.call(gl, program);
      if (
        program &&
        errors.length < limit &&
        !gl.isContextLost?.() &&
        !gl.getProgramParameter(program, gl.LINK_STATUS)
      ) {
        const log = String(gl.getProgramInfoLog(program) ?? '').trim();
        // A program whose shader did not compile fails to link as well; that
        // shader is in the list already, and the link log says nothing new.
        if (log) errors.push(`Shader link failed: ${log}`);
      }
      return result;
    },
  };
  Object.assign(gl, wrappers);
  return () => {
    for (const name of Object.keys(wrappers) as (keyof typeof wrappers)[])
      if (gl[name] === wrappers[name]) {
        // The context's own method comes back from its class.
        delete gl[name];
        if (gl[name] !== original[name]) gl[name] = original[name];
      }
  };
}
