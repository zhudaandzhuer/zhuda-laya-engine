/** Internal deadline boundary. Timers bound IO; they never drive simulation. */
export function awaitAbortable<T>(work: Promise<T>, signal: AbortSignal, discard?: (value: T) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const abort = () => {
      if (settled) return;
      settled = true;
      reject(signal.reason ?? new DOMException('Cancelled', 'AbortError'));
    };
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
    work.then(value => {
      signal.removeEventListener('abort', abort);
      if (settled) { discard?.(value); return; }
      settled = true;
      resolve(value);
    }, error => {
      signal.removeEventListener('abort', abort);
      if (!settled) { settled = true; reject(error); }
    }).catch(() => { /* A faulty late disposer cannot create an unhandled rejection. */ });
  });
}
