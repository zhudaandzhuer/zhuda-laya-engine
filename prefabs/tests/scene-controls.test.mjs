import test from 'node:test';
import assert from 'node:assert/strict';
import { El, installDom } from './fake-dom.mjs';

const dom = installDom();
dom.window.setTimeout = (fn, ms) => setTimeout(fn, ms);
const { createSceneControls } = await import('../ui/scene-controls/scene-controls.ts');

const find = (el, cls) => (el.classList?.contains(cls) ? el : el.children?.map((c) => (c instanceof El ? find(c, cls) : null)).find(Boolean) ?? null);
const all = (el, cls, out = []) => {
  if (el.classList?.contains(cls)) out.push(el);
  for (const c of el.children ?? []) if (c instanceof El) all(c, cls, out);
  return out;
};
const labels = { time: '時間', run: '時間流動', drop: '再丟一隻', quality: '畫質', qualityTip: '畫質說明', soundOn: '🔊 聲音', soundOff: '🔇 靜音' };
const make = (over = {}) => {
  const calls = { weather: [], hour: [], runs: [], level: [], drop: 0, sound: 0 };
  let on = true;
  const container = new El();
  const hud = createSceneControls(container, {
    title: { kicker: 'LIVE', name: 'Zhuda', em: 'Sky Island', sub: '豬大浮島' },
    weathers: [{ id: 'clear', label: '晴' }, { id: 'rain', label: '雨' }, { id: 'storm', label: '雷雨' }],
    weather: 'clear',
    hour: 9.5,
    clock: (h) => `${Math.floor(h)}h`,
    levels: ['低', '中', '高', '滿'],
    level: 2,
    soundOn: true,
    hint: '按住豬大',
    labels,
    onWeather: (w) => calls.weather.push(w),
    onHour: (h) => calls.hour.push(h),
    onClockRuns: (r) => calls.runs.push(r),
    onLevel: (l) => calls.level.push(l),
    onDrop: () => calls.drop++,
    onSound: () => (calls.sound++, (on = !on)),
    ...over,
  });
  return { container, hud, calls };
};

test('scene controls: title, weather buttons, time, picture setting, sound and the extra action', () => {
  const { container, hud, calls } = make();
  assert.equal(container.children[0], hud.root);
  assert.ok(hud.root.classList.contains('cp-sc'));
  assert.equal(find(hud.root, 'cp-sc-title').text(), 'LIVEZhuda Sky Island豬大浮島');
  const weathers = all(find(hud.root, 'cp-sc-weathers'), 'cp-sc-btn');
  assert.deepEqual(weathers.map((b) => b.textContent), ['晴', '雨', '雷雨']);
  assert.ok(weathers[0].classList.contains('cp-sc-on'));
  weathers[2].dispatch('pointerdown');
  assert.deepEqual(calls.weather, ['storm']);
  assert.deepEqual(weathers.map((b) => b.classList.contains('cp-sc-on')), [false, false, true]);
  // time: slider, clock, pause
  const slider = find(hud.root, 'cp-sc-slider');
  assert.deepEqual([slider.type, slider.min, slider.max, slider.value], ['range', '0', '24', '9.5']);
  slider.value = '18';
  slider.dispatch('input');
  assert.deepEqual(calls.hour, [18]);
  hud.clock(25.5);
  assert.equal(find(hud.root, 'cp-sc-time').text(), '時間 25h❚❚');
  assert.equal(slider.value, '1.5');
  const run = all(find(hud.root, 'cp-sc-time'), 'cp-sc-btn')[0];
  run.dispatch('pointerdown');
  assert.deepEqual([calls.runs, run.textContent], [[false], '▶']);
  // the action row: drop, picture setting (cycles), sound (toggles)
  const [drop, fx, sound] = all(hud.root.children[3].children[3], 'cp-sc-btn');
  assert.equal(drop.textContent, '再丟一隻');
  drop.dispatch('pointerdown');
  assert.equal(calls.drop, 1);
  assert.equal(fx.textContent, '畫質 高');
  fx.dispatch('pointerdown');
  fx.dispatch('pointerdown');
  assert.deepEqual([calls.level, fx.textContent], [[3, 0], '畫質 低']);
  assert.equal(sound.textContent, '🔊 聲音');
  sound.dispatch('pointerdown');
  assert.equal(sound.textContent, '🔇 靜音');
  hud.setSound(true);
  assert.equal(sound.textContent, '🔊 聲音');
  // the keyboard still works (a click with no pointer behind it)
  drop.dispatch('click', { detail: 0 });
  assert.equal(calls.drop, 2);
});

test('scene controls: status in pieces, hint, hand and flash', () => {
  const { hud } = make();
  const status = find(hud.root, 'cp-sc-status');
  assert.equal(status.textContent, '…');
  hud.status([{ value: '60' }, ' FPS · 草 ', { value: '27,512' }, ' 根']);
  // (the stand-in DOM keeps the old text beside new children; a browser replaces it)
  assert.equal(status.children.map((c) => (c instanceof El ? c.text() : c.text)).join(''), '60 FPS · 草 27,512 根');
  assert.deepEqual(all(status, 'cp-sc-num').map((n) => n.textContent), ['60', '27,512']);
  hud.say('抓到了');
  const hint = find(hud.root, 'cp-sc-hint');
  assert.deepEqual([hint.textContent, hint.style.opacity], ['抓到了', '1']);
  const hand = find(hud.root, 'cp-sc-hand');
  hud.hand([100, 200], true);
  assert.deepEqual([hand.style.display, hand.style.left, hand.style.top, hand.textContent], ['block', '100px', '200px', '✊']);
  hud.hand(null, false);
  assert.equal(hand.style.display, 'none');
  const flash = find(hud.root, 'cp-sc-flash');
  hud.flash(2);
  assert.equal(flash.style.opacity, '0.85');
  hud.flash(-1);
  assert.equal(flash.style.opacity, '0');
});

test('scene controls: embedded in a page, and without the extra action', () => {
  const { hud } = make({ embed: true, labels: { ...labels, drop: null } });
  assert.ok(hud.root.classList.contains('cp-sc-embed'));
  assert.equal(find(hud.root, 'cp-sc-drop'), null);
  assert.equal(all(hud.root.children[3].children[3], 'cp-sc-btn').length, 2, 'picture setting and sound only');
});
