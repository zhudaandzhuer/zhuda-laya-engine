// The prefabs 3D viewer: index.html?scene=<id>[&…] opens one shared 3D
// scene; without `scene` it lists them, with the addresses worth opening.
import { PRESETS } from './presets.ts';

const params = new URLSearchParams(location.search);
const container = document.querySelector<HTMLElement>('#game')!;
const id = params.get('scene');
const preset = PRESETS.find((p) => p.id === id);

function gallery() {
  document.title = '豬大共用 3D 場景 · 觀看台';
  document.body.style.overflow = 'auto';
  container.style.cssText = 'height:auto;min-height:100%;padding:28px 32px 48px;box-sizing:border-box;background:#f3f1ec;color:#222;font:15px/1.6 -apple-system,"PingFang TC",sans-serif;overflow:auto';
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  container.innerHTML =
    `<h1 style="margin:0 0 4px;font-size:24px">豬大共用 3D 場景</h1>` +
    `<p style="margin:0 0 22px;color:#666">prefabs/3d 的場景。點名稱開預設畫面，點後面的標籤開那個時間、天氣或狀態。程式在 <code>prefabs/3d/</code>，用 <code>scripts/sync.mjs</code> 放進遊戲。</p>` +
    PRESETS.map(
      (p) =>
        `<section style="margin:0 0 18px;padding:16px 18px;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.08)">` +
        `<h2 style="margin:0 0 4px;font-size:18px"><a href="?scene=${p.id}">${esc(p.title)}</a> <small style="color:#999;font-weight:400">${p.id}</small></h2>` +
        `<p style="margin:0 0 8px">${esc(p.summary)}</p>` +
        `<p style="margin:0 0 8px">${Object.entries(p.views)
          .map(([label, q]) => `<a href="?scene=${p.id}${q ? '&' + esc(q) : ''}" style="display:inline-block;margin:0 6px 6px 0;padding:2px 10px;border-radius:999px;background:#eef2f7;text-decoration:none">${esc(label)}</a>`)
          .join('')}</p>` +
        `<p style="margin:0;color:#888;font-size:13px">模組：${p.modules.map((m) => `<code>${m}</code>`).join('、')}</p></section>`,
    ).join('');
  Reflect.set(window, '__SCENE__', { ready: true, state: () => ({ gallery: PRESETS.map((p) => p.id) }), set: () => {}, errors: () => [] });
}

function failed(error: unknown) {
  console.error(error);
  const box = document.createElement('pre');
  box.style.cssText = 'position:absolute;left:16px;top:16px;right:16px;margin:0;padding:12px;background:rgba(120,20,20,.85);color:#fff;font:13px monospace;white-space:pre-wrap;z-index:9';
  box.textContent = `場景「${id}」開不起來：\n${error instanceof Error ? error.stack || error.message : String(error)}`;
  container.appendChild(box);
}

if (!preset) gallery();
else {
  document.title = `${preset.title} · 豬大共用 3D 場景`;
  preset.start(container, params).catch(failed);
}
