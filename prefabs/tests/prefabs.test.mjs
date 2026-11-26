import test from 'node:test';
import assert from 'node:assert/strict';
import { El, installDom } from './fake-dom.mjs';

const dom = installDom();
const { createVirtualStick } = await import('../ui/virtual-stick/virtual-stick.ts');
const { createDialog, createChoiceBox } = await import('../ui/dialog/dialog.ts');
const { createToast } = await import('../ui/toast/toast.ts');
const { createCollectionBook } = await import('../ui/collection-book/collection-book.ts');
const { moveVector, createPointerAim, MOVE_KEYS } = await import('../input/move-input.ts');
const { readJSON, writeJSON, removeKey, storedSet, strings } = await import('../systems/storage.ts');
const { createI18n } = await import('../systems/i18n.ts');

test('virtual stick follows the thumb, clamps to the unit circle and lets go anywhere', () => {
  const zone = new El(), stick = new El(), knob = new El();
  let presses = 0;
  const s = createVirtualStick({ zone, stick, knob, onPress: () => presses++ });
  zone.dispatch('pointerdown', { pointerId: 3, clientX: 100, clientY: 600 });
  assert.equal(s.held, true);
  assert.equal(presses, 1);
  assert.equal(stick.style.left, '34px'); // 100 - 66
  assert.equal(stick.style.top, '534px');
  assert.ok(stick.classList.contains('live'));
  zone.dispatch('pointermove', { pointerId: 3, clientX: 100 + 28, clientY: 600 });
  assert.equal(s.x, 0.5);
  zone.dispatch('pointermove', { pointerId: 3, clientX: 100 + 300, clientY: 600 + 400 });
  assert.ok(Math.abs(Math.hypot(s.x, s.y) - 1) < 1e-9, 'clamped');
  // a second finger in the zone does not take over
  zone.dispatch('pointerdown', { pointerId: 4, clientX: 10, clientY: 10 });
  assert.equal(presses, 2);
  zone.dispatch('pointermove', { pointerId: 4, clientX: 500, clientY: 10 });
  assert.ok(s.y > 0.7);
  // lifted outside the zone: the window hears it
  dom.window.dispatch('pointerup', { pointerId: 3 });
  assert.equal(s.held, false);
  assert.deepEqual([s.x, s.y, stick.style.left, stick.classList.contains('live')], [0, 0, '', false]);
  assert.equal(knob.style.transform, 'translate(0px, 0px)');
  // stays on screen near an edge
  zone.dispatch('pointerdown', { pointerId: 5, clientX: 1279, clientY: 2 });
  assert.equal(stick.style.left, `${1280 - 132 - 8}px`);
  assert.equal(stick.style.top, '8px');
  dom.window.dispatch('blur');
  assert.equal(s.held, false);
  s.dispose();
  zone.dispatch('pointerdown', { pointerId: 6, clientX: 100, clientY: 100 });
  assert.equal(s.held, false, 'disposed');
});

test('move vector and pointer aim: the last thing touched decides', () => {
  assert.deepEqual(moveVector(new Set(['KeyD'])), { x: 1, y: 0 });
  const v = moveVector(new Set(['KeyW', 'KeyD']));
  assert.ok(Math.abs(Math.hypot(v.x, v.y) - 1) < 1e-9);
  assert.deepEqual(moveVector(new Set(), 0.3, -0.4), { x: 0.3, y: -0.4 });
  assert.equal(MOVE_KEYS.length, 8);
  let now = 1000;
  const aim = createPointerAim({ holdMs: 4000, now: () => now });
  assert.equal(aim.active(), false);
  aim.point(5, 6);
  assert.equal(aim.active(), true);
  assert.deepEqual([aim.x, aim.y], [5, 6]);
  now += 3999;
  assert.equal(aim.active(), true);
  now += 2;
  assert.equal(aim.active(), false);
  aim.point(1, 1);
  aim.release();
  assert.equal(aim.active(), false);
});

test('dialog types lines, completes on the first press, closes after the last and runs after()', () => {
  const root = new El(), who = new El(), say = new El(), more = new El();
  const log = [];
  const d = createDialog({ root, who, say, more, lead: 'Pig', translate: (s) => s.toUpperCase(),
    onOpen: (lines) => log.push('open ' + lines.length), onLine: (l) => log.push('line ' + l.text), onAdvance: () => log.push('adv'), onClose: () => log.push('close') });
  let done = 0;
  d.speak([], () => done++);
  assert.equal(done, 1, 'no lines: after() at once');
  const lines = [{ who: 'Pig', text: 'hello there' }, { who: 'Cat', text: 'meow' }, { who: '', text: 'rain' }];
  d.speak(lines, () => done++);
  assert.equal(d.open, true);
  assert.equal(d.lines, lines);
  assert.ok(root.classList.contains('show'));
  assert.equal(who.textContent, 'PIG');
  assert.equal(who.classList.contains('side'), false);
  d.update(0.1); // 4.6 chars
  assert.equal(say.textContent, 'HELL');
  assert.equal(more.style.visibility, 'hidden');
  d.advance(); // completes
  d.update(0);
  assert.equal(say.textContent, 'HELLO THERE');
  assert.equal(more.style.visibility, 'visible');
  d.advance();
  assert.equal(who.textContent, 'CAT');
  assert.equal(who.classList.contains('side'), true);
  d.update(10);
  d.advance();
  assert.equal(say.classList.contains('tell'), true, 'narration');
  d.update(10);
  d.advance();
  assert.equal(d.open, false);
  assert.equal(root.classList.contains('show'), false);
  assert.equal(done, 2);
  assert.deepEqual(log, ['open 3', 'line hello there', 'adv', 'line meow', 'adv', 'line rain', 'adv', 'close']);
});

test('choice box shows the question and calls pick once', () => {
  const box = new El();
  const c = createChoiceBox(box);
  const picked = [];
  c.ask('Who?', [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], (id) => picked.push(id));
  assert.equal(c.open, true);
  assert.equal(box.children.length, 3);
  assert.equal(box.children[0].textContent, 'Who?');
  box.children[2].dispatch('pointerdown');
  box.children[1].dispatch('pointerdown');
  assert.deepEqual(picked, ['b']);
  assert.equal(c.open, false);
  assert.equal(box.classList.contains('show'), false);
});

test('toast shows a label and text, then hides', () => {
  const el = new El();
  const toast = createToast(el, { seconds: 1 });
  toast.show('Clue', 'A watch');
  assert.equal(el.text(), 'ClueA watch');
  assert.ok(el.classList.contains('show'));
  toast.update(0.6);
  assert.ok(el.classList.contains('show'));
  toast.update(0.6);
  assert.equal(el.classList.contains('show'), false);
});

test('collection book: tabs, selection, locked entries, NEW marks cleared once seen', () => {
  const parts = { root: new El(), strip: new El(), views: new El(), name: new El(), role: new El(), pages: new El(), voice: new El() };
  const count = new El(), tabA = new El('button'), tabB = new El('button');
  const fresh = new Set(['b1']);
  const entry = (id, open) => ({
    id, open, fresh: fresh.has(id), name: open ? id : '???', thumb: () => new El(), views: () => [new El(), new El()],
    title: open ? id.toUpperCase() : '???', subtitle: open ? 'role' : 'where to look', voice: open,
    pages: open ? [{ title: 'p', text: 'text', state: fresh.has(id) ? 'new' : 'open' }, { text: 'hint', state: 'shut' }] : [],
    seen: () => fresh.delete(id),
  });
  const voices = [];
  let renders = 0;
  const book = createCollectionBook({ ...parts, count: { el: count, text: () => `${fresh.size} new` },
    tabs: [
      { id: 'a', button: tabA, entries: () => [entry('a1', true), entry('a2', false)], fresh: () => false },
      { id: 'b', button: tabB, rootClass: 'tab-b', entries: () => [entry('b0', true), entry('b1', true)], fresh: () => fresh.has('b1') },
    ],
    onVoice: (tab, id) => voices.push(tab + ':' + id), onRender: () => renders++ });
  book.render();
  assert.equal(book.tab, 'a');
  assert.equal(parts.strip.children.length, 2);
  assert.equal(parts.strip.children[0].className, 'card on');
  assert.equal(parts.strip.children[1].className, 'card locked');
  assert.equal(parts.name.textContent, 'A1');
  assert.equal(parts.views.children.length, 2);
  assert.equal(parts.voice.hidden, false);
  assert.equal(parts.pages.children[1].className, 'shut');
  assert.ok(tabA.classList.contains('on'));
  assert.ok(tabB.classList.contains('fresh'), 'tab B has news');
  // pick the locked one
  parts.strip.children[1].dispatch('pointerdown');
  assert.equal(parts.views.classList.contains('locked'), true);
  assert.equal(parts.role.textContent, 'where to look');
  assert.equal(parts.voice.hidden, true);
  // jump to the news in tab B
  book.select('b', 'b1');
  book.render();
  assert.ok(parts.root.classList.contains('tab-b'));
  assert.equal(parts.pages.children[0].className, 'new');
  assert.equal(fresh.has('b1'), false, 'seen');
  assert.equal(tabB.classList.contains('fresh'), false, 'tab dot asked after seeing');
  assert.equal(count.textContent, '1 new', 'count is taken before the entry is seen');
  parts.voice.dispatch('pointerdown');
  assert.deepEqual(voices, ['b:b1']);
  tabA.dispatch('pointerdown');
  assert.equal(book.tab, 'a');
  assert.equal(book.picked('a'), 'a2', 'each tab keeps its own selection');
  assert.equal(parts.root.classList.contains('tab-b'), false);
  assert.ok(renders >= 4);
});

test('storage survives a blocked localStorage and keeps sets', () => {
  assert.equal(readJSON('nope'), null);
  assert.equal(writeJSON('k', { a: 1 }), true);
  assert.deepEqual(readJSON('k'), { a: 1 });
  removeKey('k');
  assert.equal(readJSON('k'), null);
  assert.deepEqual(strings([1, 'a', null, 'b']), ['a', 'b']);
  const set = storedSet('pages');
  assert.deepEqual(set.add('x', 'y'), ['x', 'y']);
  assert.deepEqual(set.add('y', 'z'), ['z']);
  assert.deepEqual(storedSet('pages').ids, new Set(['x', 'y', 'z']));
  const real = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('blocked'); } });
  assert.equal(readJSON('pages'), null);
  assert.equal(writeJSON('pages', []), false);
  removeKey('pages');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: real });
});

test('i18n: stored choice wins, lookup with compounds and slots, listeners, page translation', () => {
  const opts = {
    storageKey: 'game.lang',
    langs: [{ id: 'zh', label: '中文' }, { id: 'en', label: 'English' }],
    tables: { zh: null, en: { 你好: 'Hello', '線索 {n}/{t}': 'Clue {n}/{t}', '去：': 'Go: ', 甲: 'A', 乙: 'B' } },
    detect: (l) => (l.startsWith('zh') ? 'zh' : 'en'),
    compound: [{ lead: '去：', sep: '、' }],
    separators: { en: { '、': ', ' } },
  };
  const i = createI18n(opts);
  assert.equal(i.get(), 'en', 'no navigator, nothing stored: detect("")');
  assert.equal(i.t('你好'), 'Hello');
  assert.equal(i.t('沒有'), '沒有', 'missing stays source');
  assert.equal(i.t('去：甲、乙、丙'), 'Go: A, B, 丙');
  assert.equal(i.tf('線索 {n}/{t}', { n: 2, t: 9 }), 'Clue 2/9');
  const heard = [];
  i.on((l) => heard.push(l));
  i.set('zh');
  i.set('zh');
  assert.deepEqual(heard, ['zh']);
  assert.equal(i.t('你好'), '你好');
  assert.equal(createI18n(opts).get(), 'zh', 'remembered');
  const label = new El();
  label.textContent = '你好';
  dom.document.marked.push(label);
  i.set('en');
  i.translatePage('你好');
  assert.equal(label.textContent, 'Hello');
  assert.equal(label.dataset.src, '你好');
  assert.equal(dom.document.title, 'Hello');
  assert.equal(dom.document.documentElement.lang, 'en');
  i.set('zh');
  i.translatePage();
  assert.equal(label.textContent, '你好');
});

const { createGameMenu } = await import('../ui/game-menu/game-menu.ts');
const { createSettingsForm } = await import('../ui/settings-form/settings-form.ts');
const key = (code) => { const e = { code, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } }; dom.window.dispatch('keydown', e); return e; };

test('game menu: items, keyboard focus wraps, panels open and close, Esc goes back then calls onBack', () => {
  const host = new El();
  const chosen = [];
  let backs = 0;
  const menu = createGameMenu({ host, backLabel: 'Back', onBack: () => backs++, items: [
    { id: 'start', label: 'Start', domId: 'start', action: () => chosen.push('start') },
    { id: 'load', label: 'Load', disabled: true, action: () => chosen.push('load') },
    { id: 'settings', label: 'Settings', hint: 'sound', action: () => menu.open({ id: 'settings', title: 'Settings', body: new El(), onOpen: () => chosen.push('opened') }) },
  ] });
  const list = menu.root.children[0], panel = menu.root.children[1];
  assert.equal(host.children[0], menu.root);
  assert.equal(panel.children[0].className, 'cp-menu-head', 'no header tag for games to style by accident');
  assert.equal(list.children.length, 3);
  assert.equal(list.children[0].id, 'start');
  assert.equal(list.children[1].disabled, true);
  menu.focus();
  assert.equal(dom.document.activeElement, list.children[0]);
  assert.equal(key('ArrowDown').defaultPrevented, true);
  assert.equal(dom.document.activeElement, list.children[2], 'skips the disabled item');
  key('ArrowDown');
  assert.equal(dom.document.activeElement, list.children[0], 'wraps');
  key('KeyW');
  assert.equal(dom.document.activeElement, list.children[2]);
  assert.equal(key('KeyE').defaultPrevented, false, 'other keys pass through to the game');
  list.children[1].click();
  assert.deepEqual(chosen, [], 'disabled does nothing');
  list.children[2].click();
  assert.equal(menu.panel, 'settings');
  assert.equal(panel.hidden, false);
  assert.equal(list.hidden, true);
  assert.deepEqual(chosen, ['opened']);
  assert.equal(key('ArrowDown').defaultPrevented, false, 'arrows belong to panel controls');
  assert.equal(key('Escape').defaultPrevented, true);
  assert.equal(menu.panel, null);
  assert.equal(dom.document.activeElement, list.children[2], 'focus returns to the item that opened it');
  assert.equal(backs, 0);
  key('Escape');
  assert.equal(backs, 1);
  menu.show(false);
  assert.equal(menu.root.hidden, true);
  assert.equal(key('Escape').defaultPrevented, false, 'hidden menus take no keys');
  menu.show(true);
  menu.setItems([{ id: 'resume', label: 'Resume', action: () => chosen.push('resume') }]);
  menu.root.children[0].children[0].click();
  assert.deepEqual(chosen, ['opened', 'resume']);
  menu.dispose();
  assert.equal(key('Escape').defaultPrevented, false, 'disposed');
});

test('settings form: builds rows from fields, applies changes, reports saving, resets', () => {
  let values = { volume: 80, subtitles: true, lang: 'zh' }, store = true;
  const form = createSettingsForm({
    fields: [
      { key: 'volume', label: 'Volume', type: 'range', min: 0, max: 100, step: 1, format: (v) => v + '%' },
      { key: 'subtitles', label: 'Subtitles', note: 'dialogue', type: 'toggle' },
      { key: 'lang', label: 'Language', type: 'choice', options: [{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }] },
    ],
    get: () => values,
    change: (patch) => { values = { ...values, ...patch }; return store; },
    status: { saved: 'saved', unsaved: 'not saved', reset: 'defaults' },
    reset: { label: 'Reset', values: { volume: 100, subtitles: true, lang: 'zh' } },
  });
  const [range, toggle, choice, foot] = form.root.children;
  const slider = range.children[1].children[0], out = range.children[1].children[1];
  assert.equal(slider.value, '80');
  assert.equal(out.textContent, '80%');
  assert.equal(toggle.children[1].checked, true);
  assert.equal(choice.children[1].children[0].classList.contains('on'), true);
  const status = foot.children[0];
  assert.equal(status.textContent, 'saved');
  slider.value = '35';
  slider.dispatch('input');
  assert.equal(values.volume, 35);
  assert.equal(out.textContent, '35%');
  toggle.children[1].checked = false;
  toggle.children[1].dispatch('change');
  assert.equal(values.subtitles, false);
  store = false;
  choice.children[1].children[1].dispatch('pointerdown');
  assert.equal(values.lang, 'en');
  assert.equal(choice.children[1].children[1].classList.contains('on'), true);
  assert.equal(status.textContent, 'not saved');
  store = true;
  foot.children[1].dispatch('pointerdown');
  assert.deepEqual(values, { volume: 100, subtitles: true, lang: 'zh' });
  assert.equal(slider.value, '100');
  assert.equal(status.textContent, 'defaults');
});
