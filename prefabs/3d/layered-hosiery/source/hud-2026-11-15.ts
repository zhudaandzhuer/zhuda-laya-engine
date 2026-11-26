// The test bench's panel, in plain DOM over the canvas: the kinds of stocking
// and their colours, what is worn over them, and a button that puts everything
// back. No score, no clock. Every element carries `data-hud`, so a press on it
// never reaches the legs.
import type { StockingType } from './patterns';
import type { Bottom } from './bottoms';

export interface HudOptions {
  types: StockingType[];
  colors: Record<number, string>;
  bottoms: Bottom[];
  bottom: () => Bottom;
  wear: (bottom: Bottom) => void;
  current: () => StockingType;
  color: () => number;
  choose: (type: StockingType, color: number) => void;
  reset: () => void;
}

const css = `
.st-hud{position:absolute;inset:0;pointer-events:none;font:14px/1.4 "PingFang TC","Noto Sans TC",system-ui,sans-serif;color:#e8edf5;z-index:5}
.st-hud *{box-sizing:border-box}
.st-top{position:absolute;left:16px;top:14px;pointer-events:none;max-width:min(360px,calc(100% - 32px))}
.st-type{font-size:13px;color:#9fb2c8}
.st-panel{position:absolute;right:12px;top:12px;bottom:12px;width:268px;pointer-events:auto;display:flex;flex-direction:column;gap:8px;background:rgba(8,12,22,.72);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px}
.st-panel>*{flex:none}
.st-list{flex:1 1 auto;min-height:72px;overflow:auto;display:flex;flex-direction:column;gap:4px;padding-right:2px}
.st-item{all:unset;cursor:pointer;padding:7px 9px;border-radius:8px}
.st-item:hover{background:rgba(255,255,255,.06)}
.st-item[aria-pressed=true]{background:rgba(79,209,255,.16);outline:1px solid rgba(79,209,255,.5)}
.st-item b{font-weight:600}
.st-note{font-size:12px;color:#b8c6d8;min-height:34px}
.st-swatches{display:flex;flex-wrap:wrap;gap:8px}
.st-swatch{all:unset;cursor:pointer;width:26px;height:26px;border-radius:50%;border:2px solid rgba(255,255,255,.25)}
.st-swatch[aria-pressed=true]{border-color:#4fd1ff;box-shadow:0 0 0 2px rgba(79,209,255,.35)}
.st-buttons{display:flex;gap:8px}
.st-label{font-size:11px;color:#7f93ab;letter-spacing:.08em;margin-top:2px}
.st-chips{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
.st-chip{all:unset;cursor:pointer;text-align:center;font-size:12px;padding:6px 2px;border-radius:7px;background:rgba(255,255,255,.06)}
.st-chip:hover{background:rgba(255,255,255,.12)}
.st-chip[aria-pressed=true]{background:rgba(255,184,79,.2);outline:1px solid rgba(255,184,79,.6)}
.st-button{all:unset;cursor:pointer;flex:1;text-align:center;padding:8px;border-radius:8px;background:rgba(255,255,255,.08)}
.st-button:hover{background:rgba(255,255,255,.14)}
.st-hint{position:absolute;left:16px;bottom:14px;font-size:12px;color:#9fb2c8;max-width:min(520px,calc(100% - 300px))}
.st-toggle{display:none}
@media (max-width:760px){
  .st-panel{top:auto;left:8px;right:8px;bottom:8px;width:auto;max-height:62%;transform:translateY(calc(100% - 46px));transition:transform .25s}
  .st-panel.open{transform:none}
  .st-toggle{display:block;all:unset;cursor:pointer;text-align:center;font-weight:600;padding:4px 0 8px}
  .st-hint{display:none}
}`;

export function createHud(container: HTMLElement, o: HudOptions) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.className = 'st-hud';
  root.innerHTML = `
    <div class="st-top"><div class="st-type"></div></div>
    <div class="st-panel" data-hud>
      <button class="st-toggle" type="button">換一雙 ▴</button>
      <div class="st-label">絲襪</div>
      <div class="st-list" role="list"></div>
      <div class="st-note"></div>
      <div class="st-swatches"></div>
      <div class="st-label">下身</div>
      <div class="st-chips"></div>
      <div class="st-note st-bottom-note" style="min-height:0"></div>
      <div class="st-buttons"><button class="st-button st-reset" type="button">↺ 復原</button></div>
    </div>
    <div class="st-hint">拖曳大腿拉扯，拉到底會撕破；拖曳裙擺掀起；拖曳空白處轉動，滾輪拉近。</div>`;
  container.appendChild(root);
  const $ = <T extends HTMLElement>(selector: string) => root.querySelector(selector) as T;
  const chips = $('.st-chips'),
    list = $('.st-list'),
    swatches = $('.st-swatches'),
    panel = $('.st-panel');

  const renderList = () => {
    list.innerHTML = '';
    for (const type of o.types) {
      const item = document.createElement('button');
      item.className = 'st-item';
      item.type = 'button';
      item.setAttribute('aria-pressed', String(type.id === o.current().id));
      item.innerHTML = '<b></b>';
      item.querySelector('b')!.textContent = type.name;
      item.onclick = () => {
        o.choose(type, type.colors.includes(o.color()) ? o.color() : type.colors[0]);
        panel.classList.remove('open');
      };
      list.appendChild(item);
    }
  };
  const renderSwatches = () => {
    swatches.innerHTML = '';
    for (const shade of o.current().colors) {
      const swatch = document.createElement('button');
      swatch.className = 'st-swatch';
      swatch.type = 'button';
      swatch.title = o.colors[shade] || '';
      swatch.style.background = '#' + shade.toString(16).padStart(6, '0');
      swatch.setAttribute('aria-pressed', String(shade === o.color()));
      swatch.onclick = () => o.choose(o.current(), shade);
      swatches.appendChild(swatch);
    }
  };
  const renderChips = () => {
    chips.innerHTML = '';
    for (const bottom of o.bottoms) {
      const chip = document.createElement('button');
      chip.className = 'st-chip';
      chip.type = 'button';
      chip.textContent = bottom.name;
      chip.setAttribute('aria-pressed', String(bottom.id === o.bottom().id));
      chip.onclick = () => o.wear(bottom);
      chips.appendChild(chip);
    }
  };
  $('.st-toggle').onclick = () => panel.classList.toggle('open');
  $('.st-reset').onclick = () => o.reset();

  return {
    update() {
      const type = o.current();
      $('.st-type').textContent = `${type.name} · ${o.colors[o.color()] || ''} · ${o.bottom().name}`;
      $('.st-bottom-note').textContent = o.bottom().note;
      $('.st-note').textContent = type.note;
      renderList();
      renderSwatches();
      renderChips();
    },
  };
}
