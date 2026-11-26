/**
 * Talk box with a speaker tag and typewriter text, plus a choice box.
 *
 * Markup:
 *   <div class="cp-dialog"><div class="cp-dialog-who"></div><div class="cp-dialog-say"></div><div class="cp-dialog-more">▼</div></div>
 *   <div class="cp-choices"></div>
 *
 * The game drives time (`update(dt)` each frame) and sound (callbacks), and owns
 * what a line is; the box only needs `who` and `text`. A line with no `who` is
 * narration (class .tell). Speakers other than the lead get class .side.
 */
import { make, press } from '../dom.ts';

export interface DialogLine {
  who: string;
  text: string;
}

export interface DialogOptions<L extends DialogLine> {
  root: HTMLElement;
  who: HTMLElement;
  say: HTMLElement;
  more: HTMLElement;
  /** Shown form of a source string (translation). Default: as is. */
  translate?: (source: string) => string;
  /** Typing speed. Default 46 characters per second. */
  charsPerSecond?: number;
  /** The lead's name: their tag keeps the main colour, everyone else gets .side. */
  lead?: string;
  /** A talk opened (before its first line shows). */
  onOpen?: (lines: readonly L[]) => void;
  /** A line came up. */
  onLine?: (line: L) => void;
  /** The player moved past a fully shown line. */
  onAdvance?: () => void;
  /** The last line was dismissed (before the talk's own `after`). */
  onClose?: () => void;
}

export interface Dialog<L extends DialogLine> {
  readonly open: boolean;
  /** The talk being shown, as passed to `speak`. */
  readonly lines: readonly L[] | null;
  readonly line: L | null;
  /** Shows the lines one by one, then runs `after`. No lines: runs `after` at once. */
  speak(lines: readonly L[], after?: () => void): void;
  /** Finishes typing the line, or moves to the next one (or closes). */
  advance(): void;
  /** Types on; call every frame. */
  update(dt: number): void;
  /** The current line, translated, in full. */
  shownText(): string;
  /** Re-shows the current speaker in the current language (text is re-typed in full). */
  relabel(): void;
}

export function createDialog<L extends DialogLine>(options: DialogOptions<L>): Dialog<L> {
  const { root, who, say, more } = options,
    t = options.translate ?? ((s: string) => s),
    cps = options.charsPerSecond ?? 46;
  let talk: { lines: readonly L[]; index: number; shown: number; after?: () => void } | null = null;
  const shownText = () => (talk ? t(talk.lines[talk.index].text) : '');
  const showLine = () => {
    if (!talk) return;
    const line = talk.lines[talk.index];
    options.onLine?.(line);
    who.textContent = t(line.who);
    who.classList.toggle('side', options.lead !== undefined && line.who !== options.lead);
    say.classList.toggle('tell', !line.who);
    say.textContent = '';
    talk.shown = 0;
    more.style.visibility = 'hidden';
  };
  const dialog: Dialog<L> = {
    get open() {
      return !!talk;
    },
    get lines() {
      return talk ? talk.lines : null;
    },
    get line() {
      return talk ? talk.lines[talk.index] : null;
    },
    speak(lines, after) {
      if (!lines.length) {
        after?.();
        return;
      }
      talk = { lines, index: 0, shown: 0, after };
      options.onOpen?.(lines);
      root.classList.add('show');
      showLine();
    },
    advance() {
      if (!talk) return;
      const text = shownText();
      if (talk.shown < text.length) {
        talk.shown = text.length;
        return;
      }
      options.onAdvance?.();
      if (++talk.index < talk.lines.length) {
        showLine();
        return;
      }
      const after = talk.after;
      talk = null;
      root.classList.remove('show');
      options.onClose?.();
      after?.();
    },
    update(dt) {
      if (!talk) return;
      const text = shownText();
      if (talk.shown < text.length) {
        talk.shown = Math.min(text.length, talk.shown + dt * cps);
        say.textContent = text.slice(0, Math.floor(talk.shown));
      } else if (say.textContent !== text) say.textContent = text;
      more.style.visibility = talk.shown >= text.length ? 'visible' : 'hidden';
    },
    shownText,
    relabel() {
      if (!talk) return;
      who.textContent = t(talk.lines[talk.index].who);
      talk.shown = shownText().length;
    },
  };
  return dialog;
}

export interface ChoiceOption {
  id: string;
  label: string;
}

export interface ChoiceBox {
  readonly open: boolean;
  /** Shows a question (already translated) and its options; `pick` gets the chosen id once. */
  ask(prompt: string, options: readonly ChoiceOption[], pick: (id: string) => void): void;
  close(): void;
}

export function createChoiceBox(box: HTMLElement): ChoiceBox {
  let open = false;
  const close = () => {
    open = false;
    box.classList.remove('show');
  };
  return {
    get open() {
      return open;
    },
    ask(prompt, choices, pick) {
      open = true;
      box.innerHTML = '';
      box.append(make('div', 'ask', prompt));
      for (const option of choices) {
        const button = make('button', '', option.label);
        button.type = 'button';
        press(button, () => {
          if (!open) return;
          close();
          pick(option.id);
        });
        box.append(button);
      }
      box.classList.add('show');
    },
    close,
  };
}
