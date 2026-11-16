import test from 'node:test';
import assert from 'node:assert/strict';
import { zhudaWaitFor } from '../packages/compiler/chrome-host.mjs';

/** A page that answers `false` until the given ask, recording what each ask was allowed. */
const page = (trueAt = Infinity, delayMs = 0) => {
  const asks = [];
  const evaluate = async (expression, options) => {
    asks.push({ expression, options });
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    return asks.length >= trueAt;
  };
  return { asks, evaluate };
};

test('without a time, a wait asks as before: each ask with the harness default', async () => {
  const { asks, evaluate } = page(3);
  await zhudaWaitFor(evaluate, 'window.ready');
  assert.equal(asks.length, 3);
  assert.deepEqual(
    asks.map((a) => a.options),
    [{}, {}, {}],
  );
});

test('a time given to a wait is the whole time, and one ask may take what is left of it', async () => {
  const { asks, evaluate } = page(2);
  const started = Date.now();
  await zhudaWaitFor(evaluate, 'window.ready', 180000);
  assert.equal(asks.length, 2);
  // A page busy for longer than an ask's usual 20 s still answers within the wait.
  for (const { options } of asks) {
    assert.ok(options.timeoutMs > 170000 && options.timeoutMs <= 180000, String(options.timeoutMs));
  }
  assert.ok(Date.now() - started < 5000);
  // Near the end of a short wait an ask still gets the usual 20 s.
  const short = page(1);
  await zhudaWaitFor(short.evaluate, 'window.ready', 500);
  assert.equal(short.asks[0].options.timeoutMs, 20000);
});

test('a slow answer within the time counts; a condition never met fails at the time', async () => {
  const slow = page(1, 150);
  await zhudaWaitFor(slow.evaluate, 'window.ready', 100);
  assert.equal(slow.asks.length, 1);
  const never = page();
  const started = Date.now();
  await assert.rejects(
    zhudaWaitFor(never.evaluate, 'window.ready', 300),
    /Browser condition timeout: window\.ready/,
  );
  const took = Date.now() - started;
  assert.ok(took >= 300 && took < 10000, String(took));
  for (const bad of [0, -1, Number.NaN, Infinity])
    await assert.rejects(zhudaWaitFor(never.evaluate, 'x', bad), /Invalid wait/);
});
