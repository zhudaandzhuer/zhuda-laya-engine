import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderZhudaSynth, validateZhudaSynthRecipe } from 'zhuda-laya-engine';
import { LANES, SAMPLE_RATE, SONGS, chart, melody, mix, recipeOf, songSeconds, tones } from '../src/core/song.ts';
import { GOOD, PERFECT, Play, REACH } from '../src/core/judge.ts';

test('songs are the same every time, and every tone is a recipe the engine synth accepts', () => {
  for (const song of SONGS) {
    assert.deepEqual(melody(song), melody(song));
    const ids = new Set<string>();
    for (const t of tones(song)) {
      const r = recipeOf(t);
      if (ids.has(r.id)) continue;
      ids.add(r.id);
      assert.deepEqual(validateZhudaSynthRecipe(r), [], r.id);
      assert.ok(t.at >= 0 && t.at + r.durationSec <= songSeconds(song) + 0.01, `${r.id} at ${t.at} fits`);
    }
    assert.ok(ids.size < 80, `${song.id}: ${ids.size} distinct tones to render`);
  }
});

test('charts: in order, inside the song, in four lanes, playable (no lane asked twice within 0.2 s), hard has more', () => {
  for (const song of SONGS) {
    const easy = chart(song, false), hard = chart(song, true);
    assert.ok(hard.length > easy.length * 1.2, `${song.id}: ${easy.length} / ${hard.length}`);
    assert.ok(easy.length >= 40);
    for (const notes of [easy, hard]) {
      const last = new Array(LANES).fill(-9);
      notes.forEach((n, i) => {
        assert.ok(n.lane >= 0 && n.lane < LANES && n.time >= 0 && n.time < songSeconds(song));
        if (i) assert.ok(n.time >= notes[i - 1].time);
        assert.ok(n.time - last[n.lane] >= 0.2, `${song.id} lane ${n.lane} at ${n.time}`);
        last[n.lane] = n.time;
      });
      assert.ok(new Set(notes.map((n) => n.lane)).size === LANES);
    }
  }
});

test('the mix is one track of the song\'s length with sound at the first beat and a 0.85 peak', () => {
  const song = SONGS[0];
  const m = mix(song, renderZhudaSynth);
  assert.equal(m.samples.length, Math.ceil(songSeconds(song) * SAMPLE_RATE));
  let peak = 0, early = 0;
  for (let i = 0; i < m.samples.length; i++) peak = Math.max(peak, Math.abs(m.samples[i]));
  for (let i = 0; i < SAMPLE_RATE * 0.05; i++) early = Math.max(early, Math.abs(m.samples[i]));
  assert.ok(Math.abs(peak - 0.85) < 1e-3);
  assert.ok(early > 0.1, 'the first beat sounds at time zero: the chart and the track share one zero');
  assert.ok(m.rendered < 80);
});

test('taps: exact is perfect, 80 ms off is good, 120 ms is late, 200 ms hits nothing; a tap takes the earliest note of its lane only', () => {
  const p = new Play([{ time: 1, lane: 0 }, { time: 2, lane: 1 }, { time: 3, lane: 2 }, { time: 3.3, lane: 2 }, { time: 5, lane: 3 }]);
  assert.equal(p.tap(0, 1.0)!.grade, 'perfect');
  assert.equal(p.tap(1, 2.08)!.grade, 'good');
  assert.equal(p.tap(2, 2.88)!.grade, 'late');
  assert.equal(p.tap(2, 2.9), null, 'that note is judged; the next in the lane is out of reach');
  assert.equal(p.tap(0, 5), null, 'another lane');
  assert.equal(p.counts.empty, 2);
  assert.equal(p.tap(2, 3.3)!.index, 3);
  assert.deepEqual(p.advance(5 + REACH + 0.01).map((j) => [j.index, j.grade]), [[4, 'miss']]);
  assert.equal(p.combo, 0);
  assert.equal(p.bestCombo, 4);
  assert.ok(p.done);
  assert.ok(PERFECT < GOOD && GOOD < REACH);
});

test('players: exact taps rank S with a full combo; 70 ms late ranks C and is told it leans late; no taps is all misses', () => {
  const notes = chart(SONGS[1], true);
  const run = (offset: number | null) => {
    const p = new Play(notes);
    let i = 0;
    for (let t = 0; t < songSeconds(SONGS[1]) + 1; t += 1 / 120) {
      while (offset !== null && i < notes.length && notes[i].time + offset <= t) (p.tap(notes[i].lane, notes[i].time + offset), i++);
      p.advance(t);
    }
    return p;
  };
  const exact = run(0), late = run(0.07), none = run(null);
  assert.equal(exact.rank, 'S');
  assert.equal(exact.bestCombo, notes.length);
  assert.equal(late.counts.good, notes.length);
  assert.equal(late.rank, 'C');
  assert.ok(Math.abs(late.lean - 0.07) < 1e-6);
  assert.equal(none.counts.miss, notes.length);
  assert.equal(none.score, 0);
  assert.equal(none.rank, 'D');
  assert.ok(exact.score > late.score);
});
