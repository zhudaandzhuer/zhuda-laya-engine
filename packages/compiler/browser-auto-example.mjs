/**
 * A browser example as one page for both backends: the bundle's script tag
 * becomes the backend loader, and the page's own script runs once the loader
 * has loaded one of the two bundles. Everything else is the example as it is,
 * so the page that is checked on one backend is the page that is checked on
 * the other.
 *
 * `?prefer=webgl` keeps the page on WebGL without asking the browser. A
 * WebGPU that loaded and did not start loads the page again on WebGL.
 */
export function autoBrowserExample(html, loader, gpu, gl) {
  const tag =
    /<script src="[^"]+" integrity="[^"]+" crossorigin="anonymous"[^>]*><\/script>\n<script>\n/.exec(
      html,
    );
  const end = html.lastIndexOf('</script>');
  const failed = 'main().catch(e=>{';
  if (!tag || end < tag.index) throw Error('Browser example has no bundle script to replace');
  const code = html.slice(tag.index + tag[0].length, end);
  if (code.split(failed).length !== 2)
    throw Error('Browser example has no single place where its start fails');
  const ref = (entry) => JSON.stringify({ src: entry.file, integrity: entry.integrity });
  return (
    html.slice(0, tag.index) +
    `<script src="${loader.file}" integrity="${loader.integrity}" crossorigin="anonymous"></script>\n<script>\n` +
    `ZhudaLoader.load({prefer:new URLSearchParams(location.search).get('prefer')==='webgl'?'webgl':undefined,webgpu:[${ref(gpu)}],webgl:[${ref(gl)}]}).then(function(){\n` +
    code.replace(failed, failed + 'if(ZhudaLoader.retry(String(e)))return;') +
    `}).catch(function(e){window.__ZHUDA_LOADER_ERROR__=String(e&&e.message||e);(document.querySelector('#sdk-report')||document.querySelector('#report')).textContent='SDK 載入失敗：'+window.__ZHUDA_LOADER_ERROR__;});\n` +
    html.slice(end)
  );
}
