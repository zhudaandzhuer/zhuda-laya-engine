declare global {
  interface Window {
    __ZHUDA_EDITOR_TOKEN__?: string;
  }
}

/** Same-origin editor API capability; static engine/assets remain ordinary URLs. */
export function editorFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set('X-Zhuda-Editor-Token', window.__ZHUDA_EDITOR_TOKEN__ || '');
  return fetch(url, { ...options, headers, credentials: 'same-origin' });
}
