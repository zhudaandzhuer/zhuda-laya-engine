/** IO deadline only; never a gameplay time source. Releases non-cooperative late results. */
export function withDeadline<T>(
  run: (signal: AbortSignal) => Promise<T>,
  options: { signal?: AbortSignal; timeoutMs?: number },
  discard: (value: T) => void = () => {},
): Promise<T> {
  const timeout = options.timeoutMs ?? 15_000;
  if (!Number.isSafeInteger(timeout) || timeout <= 0)
    return Promise.reject(Error('Invalid IO timeoutMs'));
  return new Promise<T>((resolve, reject) => {
    const controller = new AbortController();
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
    };
    const fail = (reason: unknown) => {
      if (settled) return;
      settled = true;
      controller.abort(reason);
      cleanup();
      reject(reason);
    };
    const abort = () =>
      fail(options.signal?.reason ?? new DOMException('Operation cancelled', 'AbortError'));
    const timer = setTimeout(
      () => fail(new DOMException('IO deadline exceeded', 'TimeoutError')),
      timeout,
    );
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) {
      abort();
      return;
    }
    Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) throw controller.signal.reason;
        return run(controller.signal);
      })
      .then((value) => {
        if (settled) {
          discard(value);
          return;
        }
        settled = true;
        cleanup();
        resolve(value);
      }, fail)
      .catch(() => {
        /* A late release must not cause an unhandled rejection. */
      });
  });
}
