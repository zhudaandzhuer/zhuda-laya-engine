import fs from 'node:fs';
import path from 'node:path';
import { launchBrowser, firstPageTarget } from './browser-process.mjs';

/**
 * Asks the page until `expression` is true. Without `timeoutMs`: up to 150
 * asks 100 ms apart, each answered within 20 s. With it: that is the whole
 * time allowed, and one ask may take all of what is left, so a page busy in
 * one long task (a large field of grass built at once) answers late instead
 * of failing the check at 20 s.
 */
export async function zhudaWaitFor(evaluate, expression, timeoutMs) {
  if (timeoutMs !== undefined && !(Number.isFinite(timeoutMs) && timeoutMs > 0))
    throw Error('Invalid wait: timeoutMs is a positive number of milliseconds');
  const deadline = timeoutMs === undefined ? undefined : Date.now() + timeoutMs;
  for (let i = 0; deadline === undefined ? i < 150 : Date.now() < deadline; i++) {
    const options =
      deadline === undefined ? {} : { timeoutMs: Math.max(20000, deadline - Date.now()) };
    if (await evaluate(expression, options)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error('Browser condition timeout: ' + expression);
}

/** Isolated headless Chrome for engine integration tests and the film host. */
export async function chromeFixture({ zoomFactor = 1 } = {}) {
  if (!Number.isFinite(zoomFactor) || zoomFactor < 0.25 || zoomFactor > 5)
    throw Error('Invalid Chrome zoom factor');
  // Chrome's real desktop page zoom (not CDP pinch/visual-viewport scaling).
  // Default partition key: chromium/src/chrome/browser/ui/zoom/chrome_zoom_level_prefs.cc.
  const browser = await launchBrowser({
    profilePrefix: 'zhuda-runtime-browser-',
    args: ['--enable-precise-memory-info'],
    prepareProfile: (profile) => {
      fs.mkdirSync(path.join(profile, 'Default'), { recursive: true });
      fs.writeFileSync(
        path.join(profile, 'Default', 'Preferences'),
        JSON.stringify({
          partition: { default_zoom_level: { x: Math.log(zoomFactor) / Math.log(1.2) } },
        }),
      );
    },
  });
  let ws,
    serial = 0;
  const eventWaiters = new Map();
  const pending = new Map(),
    errors = [],
    consoleMessages = [],
    glErrors = [];
  /** Closes the page connection and the browser; resolves to what the browser close did. */
  const close = async () => {
    ws?.close();
    for (const r of pending.values()) {
      clearTimeout(r.timer);
      r.reject(Error('Browser closed'));
    }
    pending.clear();
    for (const waiter of eventWaiters.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(Error('Browser closed'));
    }
    eventWaiters.clear();
    const report = await browser.close();
    if (report.errors.length)
      console.warn('Browser cleanup: ' + report.errors.join('; ') + ` (${browser.profile})`);
    return report;
  };
  try {
    const page = await firstPageTarget(browser.endpoint);
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    ws.addEventListener('message', (event) => {
      const m = JSON.parse(event.data),
        r = pending.get(m.id);
      if (r) {
        pending.delete(m.id);
        clearTimeout(r.timer);
        m.error ? r.reject(Error(m.error.message)) : r.resolve(m.result);
      }
      const waiter = eventWaiters.get(m.method);
      if (waiter) {
        eventWaiters.delete(m.method);
        clearTimeout(waiter.timer);
        waiter.resolve(m.params);
      }
      if (
        m.method === 'Runtime.consoleAPICalled' &&
        (m.params.type === 'error' || m.params.type === 'warning')
      )
        consoleMessages.push(
          `${m.params.type}: ` +
            m.params.args
              .map((a) => a.value ?? a.description ?? '')
              .join(' ')
              .slice(0, 2000),
        );
      // The driver reports WebGL errors through the Log domain, not the console API.
      if (
        m.method === 'Log.entryAdded' &&
        /GL_INVALID_|GL_OUT_OF_MEMORY|WebGL: INVALID_/.test(m.params.entry?.text ?? '')
      )
        glErrors.push(String(m.params.entry.text).slice(0, 500));
      if (m.method === 'Runtime.exceptionThrown')
        errors.push(
          m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text,
        );
    });
    const send = (method, params = {}, sessionId, timeoutMs = 20000) =>
      new Promise((resolve, reject) => {
        const id = ++serial,
          timer = setTimeout(() => {
            pending.delete(id);
            reject(Error('CDP timeout ' + method));
          }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    const evaluate = async (expression, { timeoutMs, ...options } = {}) => {
      const r = await send(
        'Runtime.evaluate',
        {
          expression,
          returnByValue: true,
          awaitPromise: true,
          ...options,
        },
        undefined,
        timeoutMs,
      ).catch((error) => {
        throw Error(error.message + ': ' + expression.slice(0, 160));
      });
      if (r.exceptionDetails)
        throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    };
    const waitFor = (expression, timeoutMs) => zhudaWaitFor(evaluate, expression, timeoutMs);
    await send('Page.enable');
    await send('Runtime.enable');
    // Optional: a browser without the Log domain still runs every check but the WebGL-error one.
    await send('Log.enable').catch(() => {});
    return {
      send,
      waitEvent: (method, timeoutMs = 20000) =>
        new Promise((resolve, reject) => {
          if (eventWaiters.has(method)) {
            reject(Error('Duplicate event waiter'));
            return;
          }
          const timer = setTimeout(() => {
            eventWaiters.delete(method);
            reject(Error('CDP event timeout ' + method));
          }, timeoutMs);
          eventWaiters.set(method, { resolve, reject, timer });
        }),
      evaluate,
      waitFor,
      errors,
      /** console.error and console.warn text (WebGL shader logs land here). */
      consoleMessages,
      /**
       * WebGL errors the driver reported (`GL_INVALID_OPERATION` and the
       * like). Chrome stops repeating one message after a few times, so the
       * count is a lower bound; an empty list is the pass condition.
       */
      glErrors,
      close,
      screenshot: async (file) => {
        const r = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
      },
    };
  } catch (error) {
    await close();
    throw error;
  }
}
