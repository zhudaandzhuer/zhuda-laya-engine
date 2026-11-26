/**
 * Collection book (圖鑑): tabs of collectibles (characters, clues, items, monsters...),
 * each a strip of cards over a detail pane. Locked entries show as silhouettes with a
 * hint for where to find them; new ones carry a dot until they have been looked at.
 *
 * Markup:
 *   <div class="cp-book">
 *     <header><nav class="cp-book-tabs"><button data-tab="a">…</button>…</nav><span class="cp-book-count"></span><button>close</button></header>
 *     <div class="cp-book-strip"></div>
 *     <div class="cp-book-detail">
 *       <div class="cp-book-views"></div>
 *       <div><h3 class="cp-book-name"></h3><div class="cp-book-role"></div><button class="cp-book-voice">…</button><ul class="cp-book-pages"></ul></div>
 *     </div>
 *   </div>
 *
 * The game owns what is unlocked and how it looks (thumbnails, views, texts already
 * translated); the book owns tabs, selection and drawing. Open/close is the game's
 * (toggle .show on the root), so it can hush its own controls.
 */
import { make, press } from '../dom.ts';

export interface BookPage {
  /** Heading; leave out for a page that is only text. */
  title?: string;
  text: string;
  /** 'new' adds a NEW mark, 'shut' dims a page that is still locked. */
  state: 'open' | 'new' | 'shut';
}

export interface BookEntry {
  id: string;
  /** Unlocked: drawn normally. Locked: silhouette (class .locked on the card and the views). */
  open: boolean;
  /** Has something not yet looked at (dot on the card). */
  fresh: boolean;
  /** Card caption. */
  name: string;
  /** Picture on the card. */
  thumb(): HTMLElement;
  /** Detail pane content, top to bottom. */
  views(): HTMLElement[];
  title: string;
  subtitle: string;
  pages: BookPage[];
  /** Show the voice button for this entry. */
  voice?: boolean;
  /** The entry's detail was just shown: clear its NEW marks. */
  seen?(): void;
}

export interface BookTab {
  id: string;
  button: HTMLElement;
  /** Class put on the book while this tab is showing (for tab-specific layout). */
  rootClass?: string;
  entries(): BookEntry[];
  /** Something new in this tab (dot on the tab), asked after the entry was seen. */
  fresh(): boolean;
}

export interface CollectionBookOptions {
  root: HTMLElement;
  strip: HTMLElement;
  views: HTMLElement;
  name: HTMLElement;
  role: HTMLElement;
  pages: HTMLElement;
  voice?: HTMLElement;
  /** Unlock counter, e.g. "12/33 unlocked". */
  count?: { el: HTMLElement; text: () => string };
  tabs: BookTab[];
  /** The voice button was pressed for an entry. */
  onVoice?: (tabId: string, entryId: string) => void;
  /** Called after every redraw (e.g. to refresh a dot on the button that opens the book). */
  onRender?: () => void;
}

export interface CollectionBook {
  readonly tab: string;
  /** Selected entry of a tab. */
  picked(tabId: string): string;
  /** Switches tab and/or entry (no redraw; call render). */
  select(tabId: string, entryId?: string): void;
  render(): void;
}

export function createCollectionBook(options: CollectionBookOptions): CollectionBook {
  const { root, strip, views, name, role, pages, voice, count, tabs } = options;
  let tab = tabs[0].id;
  const picks = new Map<string, string>();
  const current = () => tabs.find((t) => t.id === tab) ?? tabs[0];
  const picked = (tabId: string) => {
    const t = tabs.find((x) => x.id === tabId);
    return picks.get(tabId) ?? t?.entries()[0]?.id ?? '';
  };
  function render() {
    if (count) count.el.textContent = count.text();
    const active = current();
    for (const t of tabs) if (t.rootClass) root.classList.toggle(t.rootClass, t === active);
    const entries = active.entries(),
      pick = picked(active.id);
    strip.innerHTML = '';
    for (const entry of entries) {
      const card = make('button', 'card' + (entry.open ? '' : ' locked') + (entry.id === pick ? ' on' : '') + (entry.fresh ? ' fresh' : ''));
      card.type = 'button';
      card.append(entry.thumb(), make('span', '', entry.name));
      press(card, () => {
        picks.set(active.id, entry.id);
        render();
      });
      strip.append(card);
    }
    const entry = entries.find((e) => e.id === pick) ?? entries[0];
    if (entry) {
      views.classList.toggle('locked', !entry.open);
      views.innerHTML = '';
      views.append(...entry.views());
      name.textContent = entry.title;
      role.textContent = entry.subtitle;
      if (voice) voice.hidden = !entry.voice;
      pages.innerHTML = '';
      for (const page of entry.pages) {
        const li = make('li', page.state === 'open' ? '' : page.state);
        if (page.title !== undefined) li.append(make('b', '', page.title));
        li.append(make('span', '', page.text));
        pages.append(li);
      }
      entry.seen?.();
    }
    for (const t of tabs) {
      t.button.classList.toggle('on', t === active);
      t.button.classList.toggle('fresh', t.fresh());
    }
    options.onRender?.();
  }
  for (const t of tabs)
    press(t.button, () => {
      tab = t.id;
      render();
    });
  if (voice && options.onVoice) press(voice, () => options.onVoice!(tab, picked(tab)));
  return {
    get tab() {
      return tab;
    },
    picked,
    select(tabId, entryId) {
      if (tabs.some((t) => t.id === tabId)) tab = tabId;
      if (entryId !== undefined) picks.set(tabId, entryId);
    },
    render,
  };
}
