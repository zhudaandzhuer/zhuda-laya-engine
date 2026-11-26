// 2d/slot-client: pipeline, event bus, store, cascading locale (ported from the source's gate 12
// checks), asset tiers, server-round mapping and the remote client with a fake fetch.
import test from 'node:test';
import assert from 'node:assert/strict';

const { PipelineExecutor } = await import('../2d/slot-client/pipeline.ts');
const { EventBus } = await import('../2d/slot-client/event-bus.ts');
const { SlotStore } = await import('../2d/slot-client/slot-store.ts');
const { LocalePipeline } = await import('../2d/slot-client/locale-pipeline.ts');
const { AssetResolver } = await import('../2d/slot-client/asset-resolver.ts');
const { toResolvedRound } = await import('../2d/slot-client/server-round.ts');
const { RemoteSlotClient } = await import('../2d/slot-client/vendor.ts');
const { CascadeEngine } = await import('../2d/cascade-math/engine.ts');
const { Mulberry32 } = await import('../2d/cascade-math/rng.ts');
const { exampleConfig } = await import('../2d/cascade-math/example-config.ts');

test('pipeline: onion order, sync run, next() twice is an error', async () => {
  const log = [];
  const p = new PipelineExecutor()
    .use('a', async (c, next) => { log.push('a in'); await next(); log.push('a out'); })
    .use('b', async (c, next) => { log.push('b'); c.n++; await next(); });
  assert.deepEqual(p.getPlugNames(), ['a', 'b']);
  assert.equal((await p.execute({ n: 1 })).n, 2);
  assert.deepEqual(log, ['a in', 'b', 'a out']);
  const ctx = { n: 0 };
  new PipelineExecutor().use(async (c, next) => { c.n = 5; await next(); }).executeSync(ctx);
  assert.equal(ctx.n, 5); // finished before returning
  await assert.rejects(new PipelineExecutor().use(async (c, next) => { await next(); await next(); }).use(async () => {}).execute({}), /multiple times/);
});

test('event bus and store: handlers in order, unsubscribe, sweeps currency sets the jurisdiction', async () => {
  const bus = new EventBus();
  const seen = [];
  const off = bus.on('x', (v) => void seen.push(['first', v]));
  bus.on('x', async (v) => { await Promise.resolve(); seen.push(['second', v]); });
  await bus.emit('x', 1);
  off();
  await bus.emit('x', 2);
  assert.deepEqual(seen, [['first', 1], ['second', 1], ['second', 2]]);
  const store = new SlotStore({ balance: 500 });
  const events = [];
  store.bus.on('currency:changed', (e) => void events.push(e));
  await store.setCurrencyMode('SWEEPS_SC');
  assert.deepEqual(events, [{ mode: 'SWEEPS_SC', symbol: 'SC ' }]);
  assert.equal(store.jurisdiction, 'SWEEPS_US');
  await store.setBalance(650);
  assert.equal(store.getNetPosition(), 150);
  assert.equal(store.formatMoney(1234), 'SC 1,234');
});

test('locale cascade: vendor codes, tiers, overrides, typography, {params} (the source\'s gate 12 checks)', async () => {
  const i18n = new LocalePipeline({
    core: { 'en-US': { spin: 'SPIN', free: 'FREE SPINS', total: 'TOTAL {amount}' }, 'zh-CN': { spin: '旋转' }, 'zh-TW': { spin: '旋轉' }, 'de-DE': { spin: 'DREHEN' }, 'ar-SA': { spin: 'تدوير' } },
    game: { 'en-US': { rule: 'Land {scatterCount} scatters for {freeSpins} spins, up to {maxWin}x' }, 'zh-TW': { rule: '集滿 {scatterCount} 個觸發 {freeSpins} 次，最高 {maxWin} 倍' } },
    overrides: [{ when: (c) => c.jurisdiction === 'UKGC', texts: { free: 'BONUS SPINS' } }],
    gameParams: { scatterCount: 4, freeSpins: 12, maxWin: 5000 },
  });
  assert.equal((await i18n.switchLocale('zh_CHS')).normalizedLocale, 'zh-CN');
  assert.equal(i18n.t('spin'), '旋转');
  assert.equal(i18n.t('free'), 'FREE SPINS'); // falls back to the base locale
  const de = await i18n.switchLocale('de-AT');
  assert.deepEqual([de.normalizedLocale, de.typography.maxScaleShrink, i18n.t('spin')], ['de-DE', 0.62, 'DREHEN']);
  assert.equal((await i18n.switchLocale('ar')).typography.direction, 'rtl');
  await i18n.switchLocale('tw');
  assert.equal(i18n.t('rule'), '集滿 4 個觸發 12 次，最高 5000 倍');
  assert.equal(i18n.t('total', { amount: 90 }), 'TOTAL 90');
  assert.equal(i18n.t('missing.key'), 'missing.key');
  await i18n.switchLocale('en-GB', { jurisdiction: 'UKGC' });
  assert.equal(i18n.t('free'), 'BONUS SPINS');
  assert.equal((await i18n.switchLocale('xx')).normalizedLocale, 'en-US');
});

test('asset resolver: vendor skin → game locale → game default → core fallback', () => {
  const r = new AssetResolver(
    { vendorSkins: { op1: { 'de-DE': { 'ui:logo': 'op1/de/logo.png' }, '*': { 'ui:bg': 'op1/bg.jpg' } } }, gameLocales: { 'de-DE': { 'ui:title': 'de/title.png' } }, game: { 'ui:logo': 'logo.png', 'ui:title': 'title.png', 'ui:bg': 'bg.jpg' }, core: 'core/missing.png' },
    { vendorId: 'op1', locale: 'de-DE' },
  );
  assert.deepEqual(['ui:logo', 'ui:bg', 'ui:title', 'ui:none'].map((k) => [r.resolveDetailed(k).tierResolved, r.resolve(k)]), [
    ['VENDOR_SKIN', 'op1/de/logo.png'], ['VENDOR_SKIN', 'op1/bg.jpg'], ['GAME_LOCALE', 'de/title.png'], ['CORE_FALLBACK', 'core/missing.png'],
  ]);
  r.vendorId = 'other';
  r.locale = 'en-US';
  assert.deepEqual(r.preload('ui:'), ['logo.png', 'title.png', 'bg.jpg']);
  assert.equal(new AssetResolver({ game: {} }).resolveDetailed('x').tierResolved, 'MISSING');
});

test('server round JSON → what the client plays: waves, multiplier, free spins, money adds up', () => {
  for (let seed = 1; seed <= 200; seed++) {
    for (const req of [{ betAmount: 10 }, { betAmount: 10, buyFeature: true }]) {
      const round = new CascadeEngine(exampleConfig(), new Mulberry32(seed), { now: () => 0 }).spin(req, `r${seed}`);
      const { p, b } = toResolvedRound(round, 6, 5);
      assert.equal(p.mainWin + b.total, round.totalWin);
      assert.equal(p.spin.waves.length, round.steps.filter((s) => s.type === 'PAY_ANYWHERE_EVAL').length);
      assert.equal(p.spin.waves.reduce((n, w) => n + w.waveWin, 0), round.baseWin);
      for (const w of p.spin.waves) assert.ok(w.winning.length >= 8 && w.gridAfter.length === 30);
      assert.equal(b.spins.length, round.freeSpinsCount ?? 0);
      if (round.freeSpinTriggered) assert.equal(b.spins.at(-1).globalMultiplier, round.freeSpins.at(-1).globalMultiplier ?? 0);
    }
  }
});

test('remote client: spin, balance, replay, errors with the status', async () => {
  const calls = [];
  const round = new CascadeEngine(exampleConfig(), new Mulberry32(3), { now: () => 0 }).spin({ betAmount: 10 }, 'R');
  const fetch = async (url, init = {}) => {
    calls.push([url, init.method ?? 'GET', init.headers?.Authorization]);
    if (url.endsWith('/api/health')) return { ok: true, status: 200, json: async () => ({ status: 'UP' }) };
    if (url.endsWith('/api/user/balance')) return { ok: true, status: 200, json: async () => ({ balance: 990 }) };
    if (url.includes('/api/replay')) return { ok: true, status: 200, json: async () => round };
    const body = JSON.parse(init.body);
    if (body.betAmount > 100) return { ok: false, status: 402, json: async () => ({ success: false, error: 'insufficient balance', balance: 5 }) };
    return { ok: true, status: 200, json: async () => ({ success: true, data: round, balance: 1000 - 10 + round.totalWin }) };
  };
  const client = new RemoteSlotClient({ baseUrl: 'http://s', token: 'T', fetch });
  assert.equal(await client.health(), true);
  assert.equal(await client.balance(), 990);
  const got = await client.spin({ betAmount: 10 });
  assert.equal(got.round.roundId, 'R');
  assert.equal((await client.replay('R')).totalWin, round.totalWin);
  await assert.rejects(client.spin({ betAmount: 1000 }), /SLOT_SPIN_ERROR\(402\): insufficient balance/);
  assert.deepEqual(calls[2], ['http://s/api/spin', 'POST', 'Bearer T']);
  assert.equal(await new RemoteSlotClient({ baseUrl: 'http://s', fetch: async () => { throw Error('down'); } }).health(), false);
});

test('remote session: the runtime plays server rounds (buy / ante by fixture), keeps them for replay', async () => {
  const { RemoteSession } = await import('../2d/slot-client/remote-session.ts');
  const { GameRuntime } = await import('../systems/slot-round/game-runtime.ts');
  let balance = 1000, n = 0;
  const asked = [];
  const client = {
    balance: async () => balance,
    spin: async (req) => {
      asked.push(req);
      const round = new CascadeEngine(exampleConfig(), new Mulberry32(++n), { now: () => 0 }).spin(req, `srv-${n}`);
      balance = balance - round.totalBet + round.totalWin;
      return { round, balance };
    },
  };
  const session = new RemoteSession({ client, cols: 6, rows: 5, now: () => 7 });
  assert.equal(await session.open(), 1000);
  const played = [];
  const runtime = new GameRuntime({ presentation: { play: async (r) => void played.push(r.id) }, bets: [10, 20], initial: { fixture: 'normal' } });
  runtime.attachSession(session);
  await runtime.advance();
  runtime.configure({ fixture: 'buy' });
  await runtime.advance();
  runtime.configure({ fixture: 'ante', singleBet: 20 });
  const last = await runtime.advance();
  assert.deepEqual(asked, [{ betAmount: 10, buyFeature: false, anteBet: false }, { betAmount: 10, buyFeature: true, anteBet: false }, { betAmount: 20, buyFeature: false, anteBet: true }]);
  assert.deepEqual(played, ['srv-1', 'srv-2', 'srv-3']);
  assert.equal(session.points, balance);
  assert.equal(runtime.state.points, balance);
  assert.equal(last.bet, 30);
  assert.equal(session.replay({ id: 'srv-2' }).bet, 800);
  assert.equal(session.last.presented, true);
  assert.throws(() => session.replay({ id: 'nope' }), /找不到/);
});
