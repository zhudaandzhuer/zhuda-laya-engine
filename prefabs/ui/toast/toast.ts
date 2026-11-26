/**
 * A short notice near the top: a coloured label and a line of text, gone after a few seconds.
 *
 * Markup: <div class="cp-toast"></div>
 */
export interface Toast {
  /** Shows text already translated by the caller. Replaces whatever is showing. */
  show(label: string, text: string): void;
  /** Counts down; call every frame. */
  update(dt: number): void;
  readonly showing: boolean;
}

export function createToast(el: HTMLElement, options: { seconds?: number } = {}): Toast {
  const seconds = options.seconds ?? 3.2;
  let left = 0;
  return {
    show(label, text) {
      el.innerHTML = '';
      const b = document.createElement('b');
      b.textContent = label;
      el.append(b, document.createTextNode(text));
      el.classList.add('show');
      left = seconds;
    },
    update(dt) {
      if (left > 0 && (left -= dt) <= 0) el.classList.remove('show');
    },
    get showing() {
      return left > 0;
    },
  };
}
