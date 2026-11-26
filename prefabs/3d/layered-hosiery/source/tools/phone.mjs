// Evaluates expressions in the game's tab of a phone's Chrome, through DevTools forwarded by adb
// (adb forward tcp:9333 localabstract:chrome_devtools_remote). Usage: node tools/phone.mjs '<expression>' ...
const port = process.env.DEVTOOLS_PORT || 9333;
const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
// Several game tabs may be open: take the one on screen (the touches go there).
const candidates = pages.filter((p) => p.type === 'page' && p.url.includes(':8897/'));
if (!candidates.length) throw Error('no game tab: ' + pages.map((p) => p.url).join(', '));
const open = async (page) => {
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => ((socket.onopen = r), (socket.onerror = j)));
  let id = 0;
  const pending = new Map();
  socket.onmessage = (m) => {
    const data = JSON.parse(m.data);
    if (pending.has(data.id)) pending.get(data.id)(data), pending.delete(data.id);
  };
  const send = (method, params) => new Promise((r) => (pending.set(++id, r), socket.send(JSON.stringify({ id, method, params }))));
  return { socket, send };
};
let chosen = null;
for (const page of candidates) {
  const tab = await open(page);
  const state = await tab.send('Runtime.evaluate', { expression: 'document.visibilityState', returnByValue: true });
  if (state.result?.result?.value === 'visible' && !chosen) chosen = tab;
  else tab.socket.close();
}
if (!chosen) chosen = await open(candidates[0]);
const { socket, send } = chosen;
for (const expression of process.argv.slice(2)) {
  const out = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, includeCommandLineAPI: true });
  console.log(JSON.stringify(out.result?.result?.value ?? out.result?.exceptionDetails?.exception?.description ?? out));
}
socket.close();
