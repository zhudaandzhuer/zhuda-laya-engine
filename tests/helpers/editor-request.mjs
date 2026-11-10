/** Explicit authorization for programmatic editor tests, matching browser headers. */
export function authorizedFetch(editor, url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Origin: new URL(url).origin,
      'X-Zhuda-Editor-Token': editor.token,
    },
  });
}
