// 豬大打鼓 — a four-lane rhythm game on the engine's 2D stage. The song is one sample mixed in the
// page (src/audio/sound.ts). Song time = performance.now() − origin; taps are stamped with their
// event's own timeStamp (not the frame's); the sample is started at the offset the page clock gives
// and, while it sounds, `origin` follows the engine's audio clock (getSamplePositionSec). Leaving
// the page pauses; coming back restarts the sample there.
//   index.html?song=2&hard=1&auto=1     exact taps by the machine
import { ZhudaEffect2D, ZhudaEngine } from 'zhuda-laya-engine';
import { LANES, SONGS, chart, songSeconds, type ChartNote, type SongDef } from './core/song.ts';
import { Play, REACH, type Judged } from './core/judge.ts';
import { Sound } from './audio/sound.ts';
import { advanceTweens, button, designRoot, hot, rect, refreshHot, text, tween } from './ui/kit.ts';

interface Report {
  ready: boolean;
  error?: string;
  screen: string;
  frames: number;
  hot: Record<string, [number, number]>;
  songsReady: number;
  mixMs: Record<string, number>;
  /** Client x of each lane's middle and y of the hit line: where a finger taps. */
  lanes: [number, number][];
  /** Remaining notes as [lane, performance.now() milliseconds, index], renewed every frame: the times move with the clock. */
  schedule: [number, number, number][];
  game?: { song: string; hard: boolean; time: number; paused: boolean; score: number; combo: number; bestCombo: number; notes: number; counts: Play['counts']; accuracy: number; rank: string; lean: number; audio: boolean; clock: { samples: number; maxGapMs: number; jumps: number; latencyMs: number } };
  best?: Record<string, number>;
}
declare global {
  interface Window {
    __GAME__: Report;
  }
}
const report: Report = (window.__GAME__ = { ready: false, screen: 'boot', frames: 0, hot, songsReady: 0, mixMs: {}, lanes: [], schedule: [] });
const params = new URLSearchParams(location.search);
const W = 720, H = 1280, LX = 60, LW = 150, HIT = 1040, TOP = 170, LEAD = 1.5, COUNT_IN = 2.4;
const COLORS = ['#ff8fa3', '#ffd166', '#7bdff2', '#b8f2a0'], KEYS = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'], LABELS = ['D', 'F', 'J', 'K'];
const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
})();
const save = (key: string, value: string) => {
  try {
    storage?.setItem(`zhuda-beat/${key}`, value);
  } catch {
    /* private mode */
  }
};

async function main() {
  let fit = () => {};
  const context = await ZhudaEngine.boot({ container: '#game', features: ['core', '2d', 'ui'], dprCap: 2, targetFPS: 60, onResize: () => (fit(), report.ready && mark()) });
  Laya.stage.bgColor = '#14121f';
  const design = designRoot(W, H);
  fit = design.fit;
  const root = design.root;
  const sound = new Sound(storage?.getItem('zhuda-beat/muted') === '1');
  report.mixMs = sound.mixMs;
  void sound.load().then(() => ((report.songsReady = SONGS.filter((s) => sound.has(s)).length), screen === 'title' && draw()));
  const best: Record<string, number> = JSON.parse((!params.has('fresh') && storage?.getItem('zhuda-beat/best')) || '{}');
  /** How late the player hears the song, in seconds: taken off every tap's time. */
  let calibration = Number(params.get('cal') ?? storage?.getItem('zhuda-beat/cal') ?? 0) || 0;

  const back = new Laya.Sprite(), field = new Laya.Sprite(), fxLayer = new Laya.Sprite(), ui = new Laya.Sprite(), overlay = new Laya.Sprite();
  for (const s of [back, field, fxLayer, ui, overlay]) root.addChild(s);
  let screen: 'title' | 'play' | 'result' = 'title';
  let song: SongDef = SONGS[0], hard = false, notes: ChartNote[] = [], play = new Play([]);
  /** performance.now() seconds at which the song's time is zero. */
  let origin = 0;
  let paused = false, pausedAt = 0, audioStarted = false;
  const auto = params.has('auto');
  let autoNext = 0;
  /** How the audio clock and the page clock agreed during the song, for the report. */
  const clock = { samples: 0, maxGapMs: 0, jumps: 0 };
  const flash = new Array(LANES).fill(0);
  const effects: { fx: ZhudaEffect2D; left: number }[] = [];
  let scoreText: Laya.Text, comboText: Laya.Text, gradeText: Laya.Text;
  const now = () => performance.now() / 1000;
  const songTime = (at = now()) => (paused ? pausedAt : at - origin);

  function mark() {
    refreshHot();
    const canvas = document.querySelector('canvas') as HTMLCanvasElement, box = canvas.getBoundingClientRect();
    report.lanes = Array.from({ length: LANES }, (_, lane) => {
      const p = root.localToGlobal(new Laya.Point(LX + lane * LW + LW / 2, HIT));
      return [Math.round(box.left + (p.x * box.width) / Laya.stage.width), Math.round(box.top + (p.y * box.height) / Laya.stage.height)] as [number, number];
    });
  }
  const schedule = () => (report.schedule = paused ? [] : notes.map((n, i) => (play.grades[i] ? null : [n.lane, Math.round((origin + n.time + calibration) * 1000), i])).filter(Boolean) as [number, number, number][]);
  function start(which: SongDef, isHard: boolean) {
    song = which;
    hard = isHard;
    notes = chart(song, hard);
    play = new Play(notes);
    origin = now() + COUNT_IN;
    paused = false;
    audioStarted = false;
    Object.assign(clock, { samples: 0, maxGapMs: 0, jumps: 0 });
    autoNext = 0;
    screen = 'play';
    sound.play('tick');
    draw();
    schedule();
  }
  function pause() {
    if (screen !== 'play' || paused) return;
    pausedAt = songTime();
    paused = true;
    sound.stopSong();
    draw();
    schedule();
  }
  function resume() {
    // Back a beat's worth so the player finds the pulse again; notes already judged stay judged.
    origin = now() - pausedAt + 1.2;
    paused = false;
    audioStarted = false;
    draw();
    schedule();
  }
  function finish() {
    const key = `${song.id}-${hard ? 'hard' : 'easy'}`;
    best[key] = Math.max(best[key] ?? 0, play.score);
    save('best', JSON.stringify(best));
    report.best = best;
    sound.stopSong();
    sound.play('done', 0.7);
    screen = 'result';
    draw();
  }
  function draw() {
    for (const s of [back, ui, overlay]) s.destroyChildren();
    report.screen = screen;
    rect(back, 0, 0, W, H, '#14121f');
    if (screen === 'title') {
      text(overlay, '豬大打鼓', { x: 0, y: 110, w: W, size: 92, bold: true, align: 'center', color: '#ffd166', stroke: '#3a2300' });
      text(overlay, '音符落到線上時按 D F J K，或點那一軌。', { x: 0, y: 240, w: W, size: 26, align: 'center', color: '#cfd3ea' });
      SONGS.forEach((s, i) => {
        const y = 330 + i * 250, ready = sound.has(s);
        text(overlay, `${s.name}　${s.bpm} BPM　${Math.round(songSeconds(s))} 秒${ready ? '' : '　（準備中）'}`, { x: 60, y, w: W - 120, size: 32, bold: true });
        for (const [k, label] of [[0, '輕鬆'], [1, '認真']] as const) {
          const key = `${s.id}-${k ? 'hard' : 'easy'}`;
          button(overlay, 60 + k * 310, y + 56, 290, 120, `${label}　${chart(s, !!k).length} 個音\n${best[key] ? `最高 ${best[key]}` : '還沒玩過'}`, ready ? (k ? 'red' : 'gold') : 'off', () => ready && start(s, !!k), `song-${i}-${k}`, false, 28);
        }
      });
      const y = 880;
      text(overlay, `聲音校正：${calibration >= 0 ? '+' : ''}${Math.round(calibration * 1000)} 毫秒`, { x: 0, y, w: W, size: 30, align: 'center' });
      text(overlay, '藍牙耳機聲音會晚到：打完一首會告訴你平均早或晚多少，照著調。', { x: 60, y: y + 46, w: W - 120, size: 22, align: 'center', color: '#9aa0c0' });
      for (const [k, label, d] of [[0, '−10', -0.01], [1, '+10', 0.01]] as const)
        button(overlay, 190 + k * 190, y + 110, 150, 70, label, 'dark', () => {
          calibration = Math.max(-0.1, Math.min(0.3, Math.round((calibration + d) * 100) / 100));
          save('cal', String(calibration));
          draw();
        }, `cal-${k}`, false, 28);
      button(overlay, W - 190, 30, 160, 56, sound.muted ? '聲音：關' : '聲音：開', 'dark', () => {
        sound.setMuted(!sound.muted);
        save('muted', sound.muted ? '1' : '0');
        draw();
      }, 'mute', false, 22);
    } else {
      for (let lane = 0; lane < LANES; lane++) {
        rect(back, LX + lane * LW + 3, TOP, LW - 6, HIT - TOP + 150, lane % 2 ? '#1c1a2b' : '#201e31', 12);
        text(back, LABELS[lane], { x: LX + lane * LW, y: HIT + 60, w: LW, size: 40, bold: true, align: 'center', color: COLORS[lane] });
      }
      rect(back, LX, HIT - 4, LANES * LW, 8, '#ffffff', 4);
      text(ui, `${song.name}　${hard ? '認真' : '輕鬆'}`, { x: 30, y: 30, w: 440, size: 30, bold: true, color: '#ffd166' });
      button(ui, W - 150, 24, 120, 52, '暫停', 'dark', () => pause(), 'pause', false, 22);
      scoreText = text(ui, '', { x: 30, y: 84, w: 400, size: 38, bold: true });
      comboText = text(ui, '', { x: 0, y: 420, w: W, size: 64, bold: true, align: 'center', color: '#ffffff', stroke: '#14121f' });
      comboText.alpha = 0.85;
      gradeText = text(ui, '', { x: 0, y: 520, w: W, size: 46, bold: true, align: 'center', stroke: '#14121f' });
      if (paused && screen === 'play') {
        const veil = rect(overlay, 0, 0, W, H, '#000000');
        veil.alpha = 0.7;
        veil.mouseEnabled = true;
        text(overlay, '暫停', { x: 0, y: 420, w: W, size: 84, bold: true, align: 'center' });
        button(overlay, 70, 620, 270, 96, '繼續', 'gold', () => resume(), 'resume', false, 34);
        button(overlay, 380, 620, 270, 96, '回選單', 'dark', () => ((screen = 'title'), (paused = false), draw()), 'quit', false, 34);
      }
      if (screen === 'result') {
        const veil = rect(overlay, 0, 0, W, H, '#000000');
        veil.alpha = 0.72;
        veil.mouseEnabled = true;
        const c = play.counts, lean = Math.round(play.lean * 1000);
        text(overlay, play.rank, { x: 0, y: 250, w: W, size: 200, bold: true, align: 'center', color: '#ffd166', stroke: '#3a2300' });
        text(overlay, `${play.score} 分　準度 ${(play.accuracy * 100).toFixed(1)}%\n完美 ${c.perfect}　不錯 ${c.good}　勉強 ${c.late}　漏掉 ${c.miss}\n最長連擊 ${play.bestCombo} / ${notes.length}`, { x: 0, y: 500, w: W, size: 32, align: 'center' });
        text(overlay, Math.abs(lean) < 15 ? '你按得很準。' : `你平均${lean > 0 ? '晚' : '早'}了 ${Math.abs(lean)} 毫秒：把聲音校正${lean > 0 ? '加' : '減'} ${Math.round(Math.abs(lean) / 10) * 10}。`, { x: 60, y: 660, w: W - 120, size: 26, align: 'center', color: '#9aa0c0' });
        button(overlay, 70, 780, 270, 96, '再一次', 'blue', () => start(song, hard), 'again', false, 34);
        button(overlay, 380, 780, 270, 96, '回選單', 'gold', () => ((screen = 'title'), draw()), 'next', false, 34);
      }
    }
    mark();
  }
  function shown(j: Judged) {
    const words = { perfect: '完美', good: '不錯', late: '勉強', miss: '漏掉' }[j.grade];
    gradeText.text = words;
    gradeText.color = { perfect: '#ffd166', good: '#7bdff2', late: '#b0b4c8', miss: '#ff7a7a' }[j.grade];
    gradeText.alpha = 1;
    tween(gradeText, { alpha: 0 }, 0.5);
    if (j.grade !== 'miss') {
      flash[j.lane] = 1;
      if (effects.length < 6) {
        const fx = new ZhudaEffect2D(fxLayer, j.grade === 'perfect' ? 'sparkle' : 'hit-spark', { x: LX + j.lane * LW + LW / 2, y: HIT, scale: 1.3, seed: report.frames, lifeBands: 4 });
        effects.push({ fx, left: Math.max(0.5, fx.preset.seconds ?? 1) + 0.2 });
      }
    }
  }
  /** A tap from a key or a finger, stamped with its own event's time. */
  function tap(lane: number, at: number) {
    if (screen !== 'play' || paused || auto) return;
    const j = play.tap(lane, songTime(at) - calibration);
    if (j) shown(j);
    else flash[lane] = 0.4;
  }
  window.addEventListener('keydown', (e) => {
    sound.start('key');
    if (e.repeat) return;
    const lane = KEYS.indexOf(e.code);
    if (lane >= 0) (tap(lane, e.timeStamp / 1000), e.preventDefault());
    if (e.code === 'Escape') paused ? resume() : pause();
  });
  const container = document.querySelector<HTMLElement>('#game')!;
  container.addEventListener('pointerdown', (e) => {
    sound.start('pointer');
    if (screen !== 'play' || paused) return;
    const canvas = document.querySelector('canvas') as HTMLCanvasElement, box = canvas.getBoundingClientRect();
    const p = root.globalToLocal(new Laya.Point(((e.clientX - box.left) * Laya.stage.width) / box.width, ((e.clientY - box.top) * Laya.stage.height) / box.height));
    const lane = Math.floor((p.x - LX) / LW);
    if (p.y > TOP && lane >= 0 && lane < LANES) tap(lane, e.timeStamp / 1000);
  });
  document.addEventListener('visibilitychange', () => document.hidden && pause());
  window.addEventListener('blur', () => pause());

  context.runtime.start((dt) => {
    const step = context.runtime.layers.sample('ui').unscaledDeltaTime || dt;
    advanceTweens(step);
    const d = field.graphics;
    d.clear();
    if (screen !== 'title') {
      const t = songTime();
      if (screen === 'play' && !paused) {
        // The sample starts where the page clock says the song is: a late frame does not shift it.
        if (!audioStarted && t >= 0 && t < songSeconds(song) - 0.5) (audioStarted = true), sound.playSong(song, t);
        // Once the song sounds, its place by the audio clock is the time: the page clock only carries it
        // between frames. `origin` is eased onto it (the audio clock moves in steps of a few milliseconds)
        // and jumps when they part by more than 50 ms, which is what a suspended audio context looks like.
        const heard = audioStarted ? sound.songPosition() : null;
        if (heard !== null) {
          const target = now() - heard, gap = target - origin;
          clock.samples++;
          clock.maxGapMs = Math.max(clock.maxGapMs, Math.abs(gap) * 1000);
          origin = Math.abs(gap) > 0.05 ? target : origin + gap * 0.1;
          if (Math.abs(gap) > 0.05) clock.jumps++;
        }
        if (auto) for (; autoNext < notes.length && notes[autoNext].time <= t; autoNext++) if (!play.grades[autoNext]) shown(play.tap(notes[autoNext].lane, notes[autoNext].time)!);
        for (const j of play.advance(t - calibration)) shown(j);
        if (t > songSeconds(song) - 0.6 && play.done) finish();
        if (screen === 'play') schedule();
      }
      for (let lane = 0; lane < LANES; lane++) {
        if (flash[lane] > 0) (d.drawRect(LX + lane * LW + 3, HIT - 70, LW - 6, 140, COLORS[lane]), (flash[lane] = Math.max(0, flash[lane] - step * 5)));
      }
      if (t < 0 && screen === 'play') d.fillText(String(Math.ceil(-t / (60 / song.bpm))), W / 2, 300, 'bold 120px sans-serif', '#ffffff', 'center');
      for (let i = 0; i < notes.length; i++) {
        const n = notes[i];
        if (n.time - t > LEAD) break;
        if (play.grades[i] || n.time - t < -REACH - 0.1) continue;
        const y = HIT - ((n.time - t) / LEAD) * (HIT - TOP);
        d.drawRect(LX + n.lane * LW + 14, y - 18, LW - 28, 36, COLORS[n.lane], '#14121f', 3);
      }
      if (screen === 'play') {
        scoreText.text = String(play.score);
        comboText.text = play.combo >= 3 ? `${play.combo} 連擊` : '';
      }
      report.game = { song: song.id, hard, time: Math.round(t * 1000) / 1000, paused, score: play.score, combo: play.combo, bestCombo: play.bestCombo, notes: notes.length, counts: { ...play.counts }, accuracy: Math.round(play.accuracy * 1000) / 1000, rank: play.rank, lean: Math.round(play.lean * 1000), audio: audioStarted, clock: { samples: clock.samples, maxGapMs: Math.round(clock.maxGapMs * 10) / 10, jumps: clock.jumps, latencyMs: Math.round(sound.outputLatency() * 1000) } };
    }
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.fx.update(step);
      e.fx.render();
      if ((e.left -= step) <= 0) (e.fx.dispose(), effects.splice(i, 1));
    }
    report.frames++;
  });
  fit();
  draw();
  report.best = best;
  if (params.has('song') || auto) start(SONGS[Math.max(0, Math.min(SONGS.length - 1, Number(params.get('song') ?? 1) - 1))], params.get('hard') === '1');
  report.ready = true;
}

main().catch((e) => {
  window.__GAME__.error = String(e?.stack ?? e);
  console.error(e);
});
