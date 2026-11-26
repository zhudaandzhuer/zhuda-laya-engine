import test from 'node:test';
import assert from 'node:assert/strict';
import { El, installDom } from './fake-dom.mjs';

const dom = installDom();
const { createVisualNovel } = await import('../ui/visual-novel/visual-novel.ts');

const find = (el, cls) => (el.classList?.contains(cls) ? el : el.children?.map((c) => (c instanceof El ? find(c, cls) : null)).find(Boolean) ?? null);
const tick = () => new Promise((r) => setTimeout(r, 5));

function setup(extra = {}) {
  const host = new El(), calls = { voice: [], sfx: [], bgm: [], stop: 0 };
  const vn = createVisualNovel({
    host,
    speakers: { a: { name: '阿大', slot: 'left', voiced: true, color: '#f9c' }, b: { name: '阿二', slot: 'right', voiced: true }, narr: { name: '' } },
    image: { bg: (k) => `bg/${k}.jpg`, cg: (k) => `cg/${k}.jpg`, sprite: (who, e) => `char/${who}_${e}.png` },
    voice: (id) => { calls.voice.push(id); return Promise.resolve(); },
    stopVoice: () => calls.stop++,
    sfx: (id) => calls.sfx.push(id),
    bgm: (id) => calls.bgm.push(id),
    cps: 1000,
    ...extra,
  });
  return { host, vn, calls, root: host.children[0] };
}

const LINES = [
  { id: 'l1', who: 'narr', text: '夜裡。', bg: 'room', bgm: 'night', sfx: 'tick' },
  { id: 'l2', who: 'a', text: '睡不著？', show: { a: 'sleepy', b: 'normal' } },
  { id: 'l3', who: 'b', text: '嗯。', cg: 'opening' },
  { id: 'l4', who: 'a', text: '數豬吧。', cg: null, show: null },
];

test('plays lines: background, narration, sprites, who is lit, CG, sounds and voices', async () => {
  const { vn, calls, root } = setup();
  const done = vn.play(LINES);
  assert.equal(vn.open, true);
  const name = find(root, 'cp-vn-name'), text = find(root, 'cp-vn-text'), bg = find(root, 'cp-vn-bg'), cg = find(root, 'cp-vn-cg');
  const left = find(root, 'cp-vn-left'), right = find(root, 'cp-vn-right');
  vn.advance(); // finish typing
  assert.equal(text.textContent, '夜裡。'); assert.equal(name.hidden, true, 'narration hides the name plate');
  assert.equal(bg.src, 'bg/room.jpg'); assert.deepEqual([calls.bgm, calls.sfx], [['night'], ['tick']]);
  assert.equal(calls.voice.length, 0, 'narration is not voiced');
  vn.advance(); vn.advance();
  assert.equal(name.textContent, '阿大'); assert.equal(name.style.background, '#f9c'); assert.deepEqual(calls.voice, ['l2']);
  assert.equal(left.children[0].src, 'char/a_sleepy.png'); assert.equal(right.children[0].src, 'char/b_normal.png');
  assert.ok(left.classList.contains('cp-vn-talk') && right.classList.contains('cp-vn-dim'));
  vn.advance(); vn.advance();
  assert.ok(cg.classList.contains('cp-vn-on')); assert.ok(right.classList.contains('cp-vn-talk'));
  vn.advance(); vn.advance();
  assert.ok(!cg.classList.contains('cp-vn-on')); assert.ok(left.classList.contains('cp-vn-off') && right.classList.contains('cp-vn-off'));
  vn.advance(); // past the last line
  await done;
  assert.equal(vn.open, false);
});

test('typing runs on its own; a press finishes it first, the next press moves on', async () => {
  const { vn, root } = setup({ cps: 400 });
  const done = vn.play([{ id: 'x', who: 'a', text: '一二三四五六七八' }, { id: 'y', who: 'a', text: '好' }]);
  const text = find(root, 'cp-vn-text');
  assert.ok(text.textContent.length < 8);
  vn.advance(); assert.equal(text.textContent, '一二三四五六七八');
  vn.advance(); await tick(); assert.equal(text.textContent, '好');
  vn.advance(); vn.advance(); await done;
});

test('language: lines, names and control labels go through t, and relabel re-reads them', async () => {
  let lang = 'zh';
  const t = (s) => (lang === 'en' ? ({ '睡不著？': "Can't sleep?", 阿大: 'Da', Auto: 'Auto', 自動: 'Auto' }[s] ?? s) : s);
  const { vn, root } = setup({ t, labels: { auto: '自動', skip: '快轉', log: '回顧', logTitle: '回顧' } });
  vn.play([LINES[1]]); vn.advance();
  assert.equal(find(root, 'cp-vn-text').textContent, '睡不著？');
  assert.equal(find(root, 'cp-vn-auto').textContent, '自動');
  lang = 'en'; vn.relabel();
  assert.deepEqual([find(root, 'cp-vn-name').textContent, find(root, 'cp-vn-text').textContent, find(root, 'cp-vn-auto').textContent], ['Da', "Can't sleep?", 'Auto']);
});

test('the log lists what was said and replays a voiced line', () => {
  const { vn, calls, root } = setup();
  vn.play(LINES); vn.advance(); vn.advance(); vn.advance();
  const logBtn = find(root, 'cp-vn-logbtn'), log = find(root, 'cp-vn-log');
  logBtn.dispatch('pointerdown');
  assert.ok(log.classList.contains('cp-vn-on'));
  const rows = log.children.filter((c) => c.classList?.contains('cp-vn-log-line'));
  assert.equal(rows.length, 2);
  assert.match(rows[1].text(), /阿大睡不著？/);
  const before = calls.voice.length;
  rows[1].dispatch('pointerdown');
  assert.equal(calls.voice.length, before + 1);
  vn.advance(); // ignored while the log is open
  assert.ok(log.classList.contains('cp-vn-on'));
  log.dispatch('pointerdown');
  assert.ok(!log.classList.contains('cp-vn-on'));
});

test('space and enter advance only while open', () => {
  const { vn, root } = setup();
  dom.window.dispatch('keydown', { key: ' ', preventDefault() {} }); // closed: nothing happens
  vn.play(LINES);
  dom.window.dispatch('keydown', { key: 'Enter', preventDefault() {} });
  assert.equal(find(root, 'cp-vn-text').textContent, '夜裡。');
});
