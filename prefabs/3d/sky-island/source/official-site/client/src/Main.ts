// The homepage island (zhudaandzhuer.com hero) as its own small client: the viewer's
// home-island preset, opened directly (no ?scene=). Copy viewer3d/src/preset.ts, page.ts and
// presets/home-island.ts next to this file (src/preset.ts, src/page.ts, src/presets/home-island.ts).
import { homeIsland } from './presets/home-island.ts';

const params = new URLSearchParams(location.search);
const container = document.querySelector<HTMLElement>('#game')!;
homeIsland.start(container, params).catch((error) => {
  console.error(error);
  const box = document.createElement('pre');
  box.style.cssText = 'position:absolute;left:12px;bottom:12px;color:#fff;background:rgba(120,0,0,.7);padding:8px;white-space:pre-wrap;max-width:80%;z-index:9';
  box.textContent = String((error as Error)?.stack || error);
  document.body.appendChild(box);
});
