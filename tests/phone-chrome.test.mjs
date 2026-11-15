// A draw check's browser on a phone (scripts/lib/phone-chrome.mjs): which
// tab it may use, which addresses the phone is given a way back to, what is
// an adapter's notice, and that it refuses rather than touch a tab that is
// not its own. The attachment itself is exercised by a real phone.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAdapterNotice,
  phoneChromeFixture,
  phoneReversePort,
  pickPhoneTab,
} from '../scripts/lib/phone-chrome.mjs';
import { chromeFixture } from '../scripts/lib/chrome-fixture.mjs';

const tab = (url, extra = {}) => ({
  type: 'page',
  id: url,
  url,
  webSocketDebuggerUrl: 'ws://127.0.0.1:9333/devtools/page/' + encodeURIComponent(url),
  ...extra,
});

test('only a blank tab or one of this machine’s own pages is ever used', () => {
  const owners = [
    tab('https://news.example/article'),
    tab('http://192.168.1.20:8080/'),
    tab('https://localhost/'),
    tab('chrome://newtab/'),
  ];
  assert.equal(pickPhoneTab(owners), null, 'the phone’s own tabs are its owner’s');
  assert.equal(pickPhoneTab([...owners, tab('about:blank')]).url, 'about:blank');
  assert.equal(
    pickPhoneTab([...owners, tab('http://127.0.0.1:5173/live.html')]).url,
    'http://127.0.0.1:5173/live.html',
  );
  assert.equal(pickPhoneTab([tab('http://localhost:80/x')]).url, 'http://localhost:80/x');
  // The first that may be used, in the order the phone lists them.
  assert.equal(
    pickPhoneTab([owners[0], tab('http://127.0.0.1:1/'), tab('about:blank')]).url,
    'http://127.0.0.1:1/',
  );
  // Not a page, or a page nobody can attach to (another client has it).
  assert.equal(pickPhoneTab([tab('about:blank', { type: 'service_worker' })]), null);
  assert.equal(pickPhoneTab([tab('about:blank', { webSocketDebuggerUrl: undefined })]), null);
  assert.equal(pickPhoneTab([tab('not a url')]), null);
  assert.equal(pickPhoneTab(undefined), null);
});

test('the phone is given a way back to this machine’s loopback and nowhere else', () => {
  assert.equal(phoneReversePort('http://127.0.0.1:49152/live.html'), 49152);
  assert.equal(phoneReversePort('http://localhost:8080/'), 8080);
  assert.equal(phoneReversePort('about:blank'), null);
  assert.equal(phoneReversePort('http://127.0.0.1/'), null, 'no port to give');
  assert.equal(phoneReversePort('https://127.0.0.1:8443/'), null);
  assert.equal(phoneReversePort('http://192.168.1.20:8080/'), null);
  assert.equal(phoneReversePort('http://example.com:8080/'), null);
  assert.equal(phoneReversePort('nonsense'), null);
});

test('what an adapter does not have is a notice, not a shader’s warning', () => {
  for (const feature of ['float32-filterable', 'bgra8unorm-storage', 'texture-compression-bc'])
    assert.equal(
      isAdapterNotice(`warning: WebGPU: ${feature} is not supported by the adapter.`),
      true,
    );
  for (const other of [
    'error: WebGPU: float32-filterable is not supported by the adapter.',
    'warning: WebGPU: validation failed',
    "error: ERROR: :204: 'notDeclared' : undeclared identifier",
    'warning: WebGPU: float32-filterable is not supported by the adapter. And more.',
    '',
  ])
    assert.equal(isAdapterNotice(other), false, other);
});

test('it refuses, in words, rather than use a tab that is not its own', async () => {
  const saved = { fetch: globalThis.fetch, WebSocket: globalThis.WebSocket };
  const env = process.env.ZHUDA_PHONE_CHROME;
  const asked = [];
  let sockets = 0;
  globalThis.WebSocket = class {
    constructor() {
      sockets++;
      throw Error('no tab should have been attached to');
    }
  };
  try {
    delete process.env.ZHUDA_PHONE_CHROME;
    await assert.rejects(phoneChromeFixture(), /ZHUDA_PHONE_CHROME is not set/);
    // Nothing answers there.
    globalThis.fetch = async () => {
      throw Error('connect ECONNREFUSED');
    };
    await assert.rejects(
      phoneChromeFixture({ endpoint: 'http://127.0.0.1:9333' }),
      /did not answer at http:\/\/127\.0\.0\.1:9333 \(adb forward tcp:9333 localabstract:chrome_devtools_remote\)/,
    );
    // The phone has tabs, none of them blank: none is touched.
    globalThis.fetch = async (url) => {
      asked.push(String(url));
      return {
        json: async () => [tab('https://news.example/article'), tab('https://mail.example/')],
      };
    };
    await assert.rejects(
      phoneChromeFixture({ endpoint: 'http://127.0.0.1:9333' }),
      /No tab to use: open about:blank in Chrome on the phone first/,
    );
    assert.deepEqual(asked, ['http://127.0.0.1:9333/json/list'], 'listed, and nothing activated');
    // The checks' own fixture goes to the phone when the endpoint is named.
    process.env.ZHUDA_PHONE_CHROME = 'http://127.0.0.1:9333';
    await assert.rejects(chromeFixture(), /No tab to use/);
    assert.equal(sockets, 0);
  } finally {
    globalThis.fetch = saved.fetch;
    globalThis.WebSocket = saved.WebSocket;
    if (env === undefined) delete process.env.ZHUDA_PHONE_CHROME;
    else process.env.ZHUDA_PHONE_CHROME = env;
  }
});
