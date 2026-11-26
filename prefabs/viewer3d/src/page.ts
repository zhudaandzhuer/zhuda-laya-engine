// Small page helpers the presets share: a stylesheet link and a loading note.

/** Adds a stylesheet (a library module's CSS under common/…) and resolves once it has loaded (or failed). */
export function linkStyle(href: string): Promise<void> {
  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = link.onerror = () => resolve();
    document.head.appendChild(link);
  });
}

/** A note in the middle while models arrive, so a slow first visit does not look like a broken page. */
export function loadingNote(container: HTMLElement, title: string) {
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:14px 22px;border-radius:14px;background:rgba(18,24,34,.6);color:#fff;font:15px -apple-system,"PingFang TC",sans-serif;text-align:center;z-index:5;backdrop-filter:blur(8px)';
  container.appendChild(box);
  return {
    progress(arrived: number, total: number, retrying: boolean) {
      box.innerHTML = `${retrying ? '網路不穩，重新下載中…' : title}<br><b>${arrived} / ${total}</b>`;
    },
    remove() {
      box.remove();
    },
  };
}
