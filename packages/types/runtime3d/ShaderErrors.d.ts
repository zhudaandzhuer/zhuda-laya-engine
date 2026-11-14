// Generated from TypeScript source; run npm run types:generate.
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
/**
 * `Shader compile failed (<stage>): <log>` followed by the numbered source
 * lines round the first line the log names. Both compilers' forms are read:
 * `ERROR: 0:12: …` (WebGL) and `ERROR: :12: …` (glslang, on WebGPU). A log
 * that names no line, or a line the source does not have, gives the log
 * alone.
 */
export declare function zhudaShaderErrorExcerpt(log: string, source: string, stage: string): string;
/**
 * Records every shader that fails to compile and every program that fails
 * to link on a WebGL context, into `errors` (at most `limit` entries), and
 * returns what takes the wrappers off again. The status is read right after
 * the compile, which LayaAir does itself, so nothing waits that did not wait
 * before.
 */
export declare function reportZhudaWebGLShaderErrors(gl: any, errors: string[], limit?: number): () => void;
