/**
 * Game menu: a vertical list of choices (title screen, pause, game over) with
 * sub-panels (settings, controls, credits…) that open over it and close with Back.
 *
 * Built by the component inside `host`:
 *   <div class="cp-menu">
 *     <nav class="cp-menu-list" role="menu"><button class="cp-menu-item" role="menuitem">…</button>…</nav>
 *     <section class="cp-menu-panel" hidden><div class="cp-menu-head"><button class="cp-menu-back">…</button><div class="cp-menu-title" role="heading"></div></div><div class="cp-menu-panel-body"></div></section>
 *
 * Only cp-* classes and no header/h2 tags, so a game's broad selectors (header, h2, `.x button`) do not reach in.
 *   </div>
 *
 * Keyboard while shown: ↑/↓ (or W/S) move between items, Enter/Space choose,
 * Esc closes the open panel, else calls `onBack` (e.g. resume from pause).
 * Keys it handles are captured on the window and marked defaultPrevented, so a
 * game's own key handler (which should ignore defaultPrevented events) never sees them.
 */
import { make } from '../dom.ts';

export interface MenuItem {
  id: string;
  label: string;
  /** Small text under the label. */
  hint?: string;
  disabled?: boolean;
  /** DOM id for the button (for tests or automation). */
  domId?: string;
  action: () => void;
}

export interface MenuPanel {
  id: string;
  title: string;
  body: HTMLElement;
  /** Called after the panel was opened (e.g. refresh values). */
  onOpen?: () => void;
}

export interface GameMenuOptions {
  host: HTMLElement;
  items: MenuItem[];
  /** Extra class on the root, e.g. 'title' or 'pause', for per-use layout. */
  className?: string;
  /** Text of the Back button on panels. Default '←'. */
  backLabel?: string;
  /** Esc with no panel open. */
  onBack?: () => void;
  /** Starts shown. Default true. */
  shown?: boolean;
}

export interface GameMenu {
  readonly root: HTMLElement;
  readonly shown: boolean;
  /** The open panel's id, or null on the list. */
  readonly panel: string | null;
  setItems(items: MenuItem[]): void;
  show(shown: boolean): void;
  /** Opens a panel over the list. */
  open(panel: MenuPanel): void;
  /** Closes the open panel; false when none was open. */
  back(): boolean;
  /** Puts keyboard focus on an item (default: the first enabled one). */
  focus(id?: string): void;
  dispose(): void;
}

export function createGameMenu(options: GameMenuOptions): GameMenu {
  const root = make('div', 'cp-menu' + (options.className ? ' ' + options.className : '')),
    list = make('nav', 'cp-menu-list'),
    panelEl = make('section', 'cp-menu-panel'),
    head = make('div', 'cp-menu-head'),
    backButton = make('button', 'cp-menu-back', options.backLabel ?? '←'),
    titleEl = make('div', 'cp-menu-title'),
    body = make('div', 'cp-menu-panel-body');
  list.setAttribute('role', 'menu');
  backButton.type = 'button';
  titleEl.setAttribute('role', 'heading');
  titleEl.setAttribute('aria-level', '2');
  head.append(backButton, titleEl);
  panelEl.append(head, body);
  panelEl.hidden = true;
  root.append(list, panelEl);
  options.host.append(root);
  let items: MenuItem[] = [],
    buttons: HTMLButtonElement[] = [],
    current: MenuPanel | null = null,
    shown = options.shown ?? true,
    lastFocus = '';
  root.hidden = !shown;

  function setItems(next: MenuItem[]) {
    items = next;
    list.innerHTML = '';
    buttons = items.map((item) => {
      const button = make('button', 'cp-menu-item');
      button.type = 'button';
      button.setAttribute('role', 'menuitem');
      button.dataset.item = item.id;
      if (item.domId) button.id = item.domId;
      button.disabled = !!item.disabled;
      button.append(make('span', 'cp-menu-label', item.label));
      if (item.hint) button.append(make('small', 'cp-menu-hint', item.hint));
      button.addEventListener('click', () => {
        if (!item.disabled) item.action();
      });
      button.addEventListener('focus', () => (lastFocus = item.id));
      button.addEventListener('pointerenter', () => !item.disabled && button.focus({ preventScroll: true }));
      list.append(button);
      return button;
    });
  }
  const enabled = () => buttons.filter((b) => !b.disabled);
  function focus(id?: string) {
    const target = (id && buttons.find((b) => b.dataset.item === id && !b.disabled)) || enabled()[0];
    target?.focus({ preventScroll: true });
  }
  function back() {
    if (!current) return false;
    const was = current.id;
    current = null;
    panelEl.hidden = true;
    list.hidden = false;
    root.classList.remove('panel-open');
    body.innerHTML = '';
    focus(lastFocus || was);
    return true;
  }
  function open(panel: MenuPanel) {
    current = panel;
    titleEl.textContent = panel.title;
    body.innerHTML = '';
    body.append(panel.body);
    root.dataset.panel = panel.id;
    list.hidden = true;
    panelEl.hidden = false;
    root.classList.add('panel-open');
    panel.onOpen?.();
    backButton.focus({ preventScroll: true });
  }
  const onKey = (event: KeyboardEvent) => {
    if (!shown || event.defaultPrevented) return;
    const code = event.code;
    if (code === 'Escape') {
      event.preventDefault();
      if (!back()) options.onBack?.();
      return;
    }
    if (current) return; // panel controls keep their own keys (sliders use arrows)
    const up = code === 'ArrowUp' || code === 'KeyW',
      down = code === 'ArrowDown' || code === 'KeyS';
    // Enter/Space on a focused item are the button's own click.
    if (!up && !down) return;
    event.preventDefault();
    const live = enabled();
    if (!live.length) return;
    const at = live.indexOf(document.activeElement as HTMLButtonElement);
    const next = at < 0 ? (down ? 0 : live.length - 1) : (at + (down ? 1 : -1) + live.length) % live.length;
    live[next].focus({ preventScroll: true });
  };
  backButton.addEventListener('click', () => back());
  window.addEventListener('keydown', onKey, true);
  setItems(options.items);

  return {
    root,
    get shown() {
      return shown;
    },
    get panel() {
      return current ? current.id : null;
    },
    setItems,
    show(next) {
      if (next === shown) return;
      shown = next;
      root.hidden = !next;
      if (!next) back();
    },
    open,
    back,
    focus,
    dispose() {
      window.removeEventListener('keydown', onKey, true);
      root.remove();
    },
  };
}
