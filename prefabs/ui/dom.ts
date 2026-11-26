/**
 * Small DOM helpers shared by the UI prefabs.
 */

/**
 * Wires a control to the press itself. Phones only turn a tap into a `click`
 * when no other finger is down, so with a thumb on a virtual stick a `click`
 * handler would never run. A `click` with no pointer behind it (detail 0) is the
 * keyboard activating a focused button, which is still honoured.
 */
export function press(el: HTMLElement, fn: () => void): void {
  el.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    fn();
  });
  el.addEventListener('click', (event) => {
    if ((event as MouseEvent).detail === 0) fn();
  });
}

/** document.createElement with a class name and optional text. */
export function make<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
