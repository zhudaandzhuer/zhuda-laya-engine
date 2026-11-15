// A draw check's browser, on a phone. The same interface as the headless
// Chrome the checks start on this machine (`chrome-host.mjs`), attached
// instead to a tab of the Chrome on an Android phone over its remote
// debugging port:
//
//   adb forward tcp:9333 localabstract:chrome_devtools_remote
//   ZHUDA_PHONE_CHROME=http://127.0.0.1:9333 npm run verify:lit-surface
//
// A check serves its page on this machine's loopback; the phone reaches it
// through `adb reverse`, made when the check navigates there and taken away
// when it closes. Only a blank tab, or one already showing a page of this
// machine's loopback, is ever used; it is brought to the front (a tab that
// is not shown draws no frames), and left at about:blank. Nothing else on
// the phone is read or changed. See docs/agent-development.md.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const LOOPBACK = ['127.0.0.1', 'localhost', '[::1]'];

/**
 * The tab a check may use: a blank one, or one already at a page of this
 * machine's loopback. Every other tab is its owner's. Pure.
 */
export function pickPhoneTab(tabs) {
  if (!Array.isArray(tabs)) return null;
  const usable = (tab) => {
    if (tab?.type !== 'page' || typeof tab.webSocketDebuggerUrl !== 'string') return false;
    if (tab.url === 'about:blank') return true;
    try {
      const url = new URL(tab.url);
      return url.protocol === 'http:' && LOOPBACK.includes(url.hostname);
    } catch {
      return false;
    }
  };
  return tabs.find(usable) ?? null;
}

/** The port of a loopback address the phone must be given a way back to, or null. Pure. */
export function phoneReversePort(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' || !LOOPBACK.includes(parsed.hostname)) return null;
    const port = Number(parsed.port);
    return Number.isInteger(port) && port > 0 && port < 65536 ? port : null;
  } catch {
    return null;
  }
}

/**
 * Whether a console line is LayaAir saying, as it starts on WebGPU, what
 * the adapter does not have ("WebGPU: float32-filterable is not supported
 * by the adapter."). A phone's adapter lacks things a desktop's has; such a
 * line is not a shader's or a draw's warning. Pure.
 */
export function isAdapterNotice(text) {
  return /^warning: WebGPU: [a-z0-9-]+ is not supported by the adapter\.$/.test(String(text));
}

/**
 * Attaches to the phone's Chrome. `endpoint` is where its debugging port
 * was forwarded to; `adb` the adb to make the way back with; `notices`, if
 * given, a file adapter notices are appended to instead of being handed to
 * the check as warnings (so that it goes on to judge what is drawn).
 */
export async function phoneChromeFixture({
  endpoint = process.env.ZHUDA_PHONE_CHROME,
  adb = process.env.ZHUDA_PHONE_ADB || 'adb',
  notices = process.env.ZHUDA_PHONE_NOTICES,
} = {}) {
  if (!endpoint) throw Error('ZHUDA_PHONE_CHROME is not set (for example http://127.0.0.1:9333)');
  let tabs;
  try {
    tabs = await (await fetch(new URL('/json/list', endpoint))).json();
  } catch (error) {
    throw Error(
      `The phone's Chrome did not answer at ${endpoint} (adb forward tcp:9333 localabstract:chrome_devtools_remote): ${error.message}`,
    );
  }
  const tab = pickPhoneTab(tabs);
  if (!tab) throw Error('No tab to use: open about:blank in Chrome on the phone first');
  // A tab that is not the one shown draws no frames.
  await fetch(new URL(`/json/activate/${tab.id}`, endpoint)).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 600));
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  let serial = 0;
  const pending = new Map(),
    eventWaiters = new Map(),
    reversed = new Set(),
    said = new Set(),
    errors = [],
    consoleMessages = [],
    glErrors = [];
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
    ) {
      const text =
        `${m.params.type}: ` +
        m.params.args
          .map((a) => a.value ?? a.description ?? '')
          .join(' ')
          .slice(0, 2000);
      if (notices && isAdapterNotice(text)) {
        if (!said.has(text)) {
          said.add(text);
          fs.appendFileSync(notices, text + '\n');
        }
      } else consoleMessages.push(text);
    }
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
  // A phone is slower than the desktop the checks' waits were set for.
  const send = (method, params = {}, sessionId, timeoutMs = 180000) =>
    new Promise((resolve, reject) => {
      if (method === 'Page.navigate') {
        const port = phoneReversePort(params.url);
        if (port !== null && !reversed.has(port)) {
          execFileSync(adb, ['reverse', `tcp:${port}`, `tcp:${port}`]);
          reversed.add(port);
        }
      }
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
      { expression, returnByValue: true, awaitPromise: true, ...options },
      undefined,
      timeoutMs,
    ).catch((error) => {
      throw Error(error.message + ': ' + expression.slice(0, 160));
    });
    if (r.exceptionDetails)
      throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const waitFor = async (expression) => {
    for (let i = 0; i < 900; i++) {
      if (await evaluate(expression)) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error('Browser condition timeout: ' + expression);
  };
  const close = async () => {
    try {
      await send('Emulation.clearDeviceMetricsOverride', {}, undefined, 5000).catch(() => {});
      await send('Page.navigate', { url: 'about:blank' }, undefined, 5000).catch(() => {});
    } finally {
      ws.close();
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
      for (const port of reversed) {
        try {
          execFileSync(adb, ['reverse', '--remove', `tcp:${port}`]);
        } catch {
          // The phone went away: there is nothing left to take back.
        }
      }
      reversed.clear();
    }
  };
  try {
    await send('Page.enable');
    await send('Page.bringToFront').catch(() => {});
    // What the tab said before is not this check's.
    await send('Page.navigate', { url: 'about:blank' });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await send('Runtime.enable');
    await send('Runtime.discardConsoleEntries').catch(() => {});
    await send('Log.enable').catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 200));
    errors.length = 0;
    consoleMessages.length = 0;
    glErrors.length = 0;
  } catch (error) {
    await close();
    throw error;
  }
  return {
    send,
    waitEvent: (method, timeoutMs = 180000) =>
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
    consoleMessages,
    glErrors,
    close,
    screenshot: async (file) => {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    },
  };
}
