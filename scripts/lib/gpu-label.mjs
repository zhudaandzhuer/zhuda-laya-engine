// What a draw check calls the graphics card it ran on, as an expression for
// the page (after it has loaded: WebGPU is only there on a served page). On
// the WebGPU build the name comes from the WebGPU adapter. The WebGL renderer
// string of the same machine, which the checks used to print for both, reads
// as if a WebGPU run had fallen back to WebGL.
export const gpuLabelExpression = (webgpu) =>
  webgpu
    ? `(async()=>{const a=navigator.gpu&&await navigator.gpu.requestAdapter();if(!a)return 'WebGPU: no adapter';const i=a.info||{};return 'WebGPU adapter '+[i.vendor,i.architecture,i.device,i.description].filter(Boolean).join(' / ')+((i.isFallbackAdapter||a.isFallbackAdapter)?' (fallback)':'')})()`
    : `(()=>{const c=document.createElement('canvas').getContext('webgl2');const d=c.getExtension('WEBGL_debug_renderer_info');return d?c.getParameter(d.UNMASKED_RENDERER_WEBGL):c.getParameter(c.RENDERER)})()`;
