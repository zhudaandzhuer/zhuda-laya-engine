import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
/** Isolated headless Chrome for reproducible engine integration tests. */
export async function chromeFixture() {
  const binary =
    process.env.CHROME_BIN ||
    [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium",
      ...[process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean).map(base => path.join(base, "Google/Chrome/Application/chrome.exe")),
    ].find(fs.existsSync);
  if (!binary) throw Error("Chrome unavailable");
  const profile = fs.mkdtempSync(
    path.join(os.tmpdir(), "zhuda-runtime-browser-"),
  );
  const child = spawn(
    binary,
    [
      "--headless=new",
      "--no-sandbox",
      "--enable-unsafe-swiftshader",
      "--use-mock-keychain",
      "--no-first-run",
      "--no-default-browser-check",
      "--enable-precise-memory-info",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { detached: true, stdio: ["ignore", "ignore", "pipe"] },
  );
  let ws,
    serial = 0;
  const eventWaiters = new Map();
  const pending = new Map(),
    errors = [];
  const close = async () => {
    ws?.close();
    for (const r of pending.values()) {
      clearTimeout(r.timer);
      r.reject(Error("Browser closed"));
    }
    pending.clear();
    for (const waiter of eventWaiters.values()) { clearTimeout(waiter.timer); waiter.reject(Error("Browser closed")); }
    eventWaiters.clear();
    if (child.pid) {
      try {
        if (process.platform === "win32") child.kill();
        else process.kill(-child.pid, "SIGKILL");
      } catch {}
      if (child.exitCode === null && child.signalCode === null)
        await new Promise((r) => child.once("exit", r));
    }
    fs.rmSync(profile, { recursive: true, force: true });
  };
  try {
    const endpoint = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error("Chrome startup timeout")),
        10000,
      );
      let log = "";
      child.once("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      child.once("exit", () => {
        clearTimeout(timer);
        reject(Error("Chrome exited"));
      });
      child.stderr.on("data", (b) => {
        log += b;
        const match = log.match(/DevTools listening on (ws:\/\/\S+)/);
        if (match) {
          clearTimeout(timer);
          resolve(new URL(match[1]));
        }
      });
    });
    const tabs = await (
      await fetch(`http://${endpoint.host}/json/list`)
    ).json();
    ws = new WebSocket(
      tabs.find((t) => t.type === "page").webSocketDebuggerUrl,
    );
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    ws.addEventListener("message", (event) => {
      const m = JSON.parse(event.data),
        r = pending.get(m.id);
      if (r) {
        pending.delete(m.id);
        clearTimeout(r.timer);
        m.error ? r.reject(Error(m.error.message)) : r.resolve(m.result);
      }
      const waiter = eventWaiters.get(m.method);
      if (waiter) { eventWaiters.delete(m.method); clearTimeout(waiter.timer); waiter.resolve(m.params); }
      if (m.method === "Runtime.exceptionThrown")
        errors.push(
          m.params.exceptionDetails.exception?.description ||
            m.params.exceptionDetails.text,
        );
    });
    const send = (method, params = {}, sessionId) =>
      new Promise((resolve, reject) => {
        const id = ++serial,
          timer = setTimeout(() => {
            pending.delete(id);
            reject(Error("CDP timeout " + method));
          }, 20000);
        pending.set(id, { resolve, reject, timer });
        ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      });
    const evaluate = async (expression, options = {}) => {
      const r = await send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
        ...options,
      }).catch(error => { throw Error(error.message + ": " + expression.slice(0,160)); });
      if (r.exceptionDetails)
        throw Error(
          r.exceptionDetails.exception?.description || r.exceptionDetails.text,
        );
      return r.result.value;
    };
    const waitFor = async (expression) => {
      for (let i = 0; i < 150; i++) {
        if (await evaluate(expression)) return;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw Error("Browser condition timeout: " + expression);
    };
    await send("Page.enable");
    await send("Runtime.enable");
    return {
      send,
      waitEvent: (method, timeoutMs = 20000) => new Promise((resolve, reject) => {
        if (eventWaiters.has(method)) { reject(Error("Duplicate event waiter")); return; }
        const timer = setTimeout(() => { eventWaiters.delete(method); reject(Error("CDP event timeout " + method)); }, timeoutMs);
        eventWaiters.set(method, { resolve, reject, timer });
      }),
      evaluate,
      waitFor,
      errors,
      close,
      screenshot: async (file) => {
        const r = await send("Page.captureScreenshot", { format: "png" });
        fs.writeFileSync(file, Buffer.from(r.data, "base64"));
      },
    };
  } catch (error) {
    await close();
    throw error;
  }
}
