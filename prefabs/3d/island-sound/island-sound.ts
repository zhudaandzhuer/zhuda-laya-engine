// Every sound of the island through the engine's one sound adapter: ambience
// loops that follow the hour and the weather (streamed, not decoded whole), effects
// placed where they happen, the characters' voice lines from where they stand (one
// line at a time, never the same take twice running), and a song to sing along to.
// Browsers start sound only after a touch or a key, so it wakes on the first one.
// The player can mute it; the choice is remembered under the game's own key.
//
// After `sync.mjs … 3d/island-sound` the files are served at
// `common/3d/island-sound/assets/{audio,voice/<who>}/…m4a`; give a provider rooted at the page.
import { IframeSoundAdapter, type AssetProvider } from 'zhuda-laya-engine';
import type { V3 } from '../math.ts';
import { EFFECTS, ISLAND_SOUND_BASE, LINES, LINE_KINDS, STREAMS, type Effect, type LineKind, type Loop, type Song, type Who } from './lines.ts';

export * from './lines.ts';

/** What the island sounds like now, 0..1 each. */
export interface SoundMix {
  day: number;
  night: number;
  rain: number;
  storm: number;
  wind: number;
}

export interface IslandSound {
  readonly on: boolean;
  toggle(): boolean;
  /** Each frame: where the ears are, what the island sounds like now, where the windmill creaks. */
  update(eye: V3, forward: V3, mix: SoundMix, windmill: V3): void;
  effect(name: Effect, at?: V3, gain?: number): void;
  /** One of a character's lines of that kind (not the take said last), from where it is. Returns false while someone is still talking (unless forced). */
  say(who: Who, kind: LineKind, at: V3, force?: boolean): boolean;
  /** Starts the song (true if it could start now: sound on, woken and loaded). */
  sing(): boolean;
  stopSong(): void;
  /** Seconds into the song, or null when it is not playing. */
  songTime(): number | null;
  /** Sound has been woken by a touch or a key (the browser's rule). */
  readonly unlocked: boolean;
  /** Wakes the sound from inside a gesture the page passed on. */
  wake(): void;
  state(): Record<string, unknown>;
  dispose(): void;
}

export interface IslandSoundOptions {
  /** Serves the files; ids are `${base}audio/x.m4a` and `${base}voice/<who>/<kind>-<n>.m4a`. */
  provider: AssetProvider;
  base?: string;
  /** Whose lines to load (default both). */
  voices?: Who[];
  /** The song, loaded last or as soon as it is asked for; none by default. */
  song?: Song | null;
  /** localStorage key that remembers a mute, e.g. 'zhuda-sky-island.sound'. */
  storageKey: string;
}

export function createIslandSound(options: IslandSoundOptions): IslandSound {
  const base = options.base ?? ISLAND_SOUND_BASE;
  const who: Who[] = options.voices ?? ['zhuda', 'zhuer'];
  const song = options.song ?? null;
  const KEY = options.storageKey;
  const remembered = () => {
    try {
      return localStorage.getItem(KEY) !== 'off';
    } catch {
      return true;
    }
  };
  let on = remembered(),
    disposed = false;
  // The song's position is read from its own media element (the adapter plays streams through
  // elements this factory makes); the long one playing is the song, the loops are all short.
  const elements: HTMLAudioElement[] = [];
  let songStarted = 0;
  let songOn = false;
  // Each start of the song is its own voice, so the end of one faded out does not stop the next.
  let songNo = 0;
  let songId = '';
  let older = new Set<HTMLAudioElement>();
  const audio = new IframeSoundAdapter({
    sampleProvider: options.provider,
    streamProvider: options.provider,
    maxActiveVoices: 48,
    maxSamples: 96,
    sampleTimeoutMs: 60_000,
    mediaElementFactory: () => {
      const el = document.createElement('audio');
      elements.push(el);
      if (elements.length > 24) elements.splice(0, elements.length - 24);
      return el;
    },
    onVoiceEvent: (e) => {
      if (e.id !== songId) return;
      if (e.type === 'started') songStarted = performance.now();
      if (e.type === 'ended' || e.type === 'failed' || e.type === 'rejected') songOn = false;
    },
  });
  audio.setChannelVolume('bgm', 0.7);
  audio.setChannelVolume('sfx', 0.9);
  audio.setChannelVolume('ui', 0.6);
  audio.setMuted(!on);
  const loaded = new Set<string>();
  const loading = new AbortController();
  // On a first visit the sounds share a slow line with 40 MB of models: a few at a
  // time, the ones heard first first, and a sound that fails is tried again later
  // (before, all sixty were asked for at once, most ran past their deadline and the
  // game stayed silent until a reload found them in the cache).
  const attempt = async (id: string, stream: boolean) => {
    // The site can be unreachable for half a minute (it is served from one machine):
    // keep trying, less and less often, for as long as the game is open.
    for (let tryNo = 0; !disposed; tryNo++) {
      try {
        if (stream) await audio.loadStream(id, { signal: loading.signal });
        else await audio.loadSample(id, { signal: loading.signal });
        loaded.add(id);
        return;
      } catch {
        if (loading.signal.aborted) return;
        await new Promise((r) => setTimeout(r, Math.min(30_000, 2000 * 2 ** tryNo)));
      }
    }
  };
  // The song (7 MB) comes last, or as soon as someone asks for it.
  let songLoading = false;
  const loadSong = () => {
    if (songLoading || !song) return;
    songLoading = true;
    void attempt(base + song.id, true);
  };
  const audioId = (name: string) => `${base}audio/${name}.m4a`;
  const voice = (kind: LineKind) => who.flatMap((w) => Array.from({ length: LINES[w][kind] }, (_, i) => `${base}voice/${w}/${kind}-${i + 1}.m4a`));
  const first = [...voice('grab'), audioId('grab'), audioId('sparkle'), audioId('whoosh'), audioId('thump'), audioId('thump-hard'), ...voice('swing'), ...voice('throw'), ...voice('land')];
  const rest = [audioId('windmill'), ...EFFECTS.map(audioId), ...LINE_KINDS.flatMap(voice)].filter((id) => !first.includes(id));
  const queue = [...first, ...rest];
  void (async () => {
    // The ambience is streamed (it starts before it has all arrived); then four short sounds at a time.
    await Promise.all(STREAMS.map((id) => attempt(audioId(id), true)));
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        for (let id = queue.shift(); id; id = queue.shift()) await attempt(id, false);
      }),
    );
    loadSong();
  })();

  let unlocked = false,
    tries = 0;
  const wake = () => {
    if (disposed || unlocked) return;
    audio.unlockAudio('pointerdown');
    if (audio.getDiagnostics().unlockedByGesture) unlocked = true;
    else if (tries++ < 20) setTimeout(wake, 150);
  };
  const touched = () => {
    tries = 0;
    wake();
  };
  window.addEventListener('pointerdown', touched, true);
  window.addEventListener('keydown', touched, true);

  const playing = new Map<Loop, boolean>();
  const setLoop = (name: Loop, want: boolean, gain: number, spatial?: V3) => {
    const id = audioId(name);
    if (!unlocked || !loaded.has(id)) return;
    const streamed = (STREAMS as readonly string[]).includes(name);
    if (want && !playing.get(name)) {
      if (streamed) {
        if (audio.playStream({ id: 'loop-' + name, streamId: id, channel: 'bgm', loop: true, peakGain: gain, fadeInSec: 2.5, replace: true })) playing.set(name, true);
      } else if (
        audio.playSample({
          id: 'loop-' + name,
          sampleId: id,
          channel: 'bgm',
          loop: true,
          peakGain: gain,
          fadeInSec: 2.5,
          replace: true,
          ...(spatial ? { spatial: { position: spatial, refDistance: 4, rolloffFactor: 1.2 } } : {}),
        })
      )
        playing.set(name, true);
    } else if (!want && playing.get(name)) {
      audio.stop('loop-' + name, 2.5);
      playing.set(name, false);
    }
  };

  const lastTake = new Map<string, number>();
  let talkingUntil = 0;
  let step = 0;
  return {
    get on() {
      return on;
    },
    toggle() {
      on = !on;
      audio.setMuted(!on);
      try {
        localStorage.setItem(KEY, on ? 'on' : 'off');
      } catch {
        /* a private window keeps no setting */
      }
      if (on) wake();
      return on;
    },
    update(eye, forward, mix, windmill) {
      if (disposed) return;
      audio.setListener({ position: eye, forward, up: [0, 1, 0] });
      // Hysteresis: a loop starts above one level and stops below a lower one, so it does not flicker.
      const want = (name: Loop, level: number) => (playing.get(name) ? level > 0.25 : level > 0.45);
      // While the song plays the island quietens: only the wind stays, low.
      if (songOn) {
        for (const name of STREAMS) if (name !== 'amb-wind') setLoop(name, false, 0);
        return;
      }
      setLoop('amb-day', want('amb-day', mix.day * (1 - mix.rain)), 0.55);
      setLoop('amb-night', want('amb-night', mix.night * (1 - mix.rain)), 0.6);
      setLoop('amb-rain', want('amb-rain', mix.rain * (1 - mix.storm)), 0.7);
      setLoop('amb-storm', want('amb-storm', mix.storm), 0.8);
      setLoop('amb-wind', true, 0.32);
      setLoop('amb-gale', want('amb-gale', Math.max(mix.storm, mix.wind - 0.35)), 0.55);
      setLoop('windmill', true, 0.5, windmill);
    },
    effect(name, at, gain = 1) {
      if (disposed || !unlocked || !loaded.has(audioId(name))) return;
      if (name === 'step-1' || name === 'step-2') name = step++ % 2 ? 'step-1' : 'step-2';
      audio.playSample({
        id: `fx-${name}-${performance.now().toFixed(1)}`,
        sampleId: audioId(name),
        channel: name === 'click' ? 'ui' : 'sfx',
        peakGain: Math.min(1, gain),
        ...(at ? { spatial: { position: at, refDistance: 5, rolloffFactor: 1 } } : {}),
      });
    },
    say(w, kind, at, force = false) {
      const now = performance.now();
      if (disposed || !unlocked || songOn || (!force && now < talkingUntil)) return false;
      const takes = LINES[w][kind];
      const key = w + kind;
      let take = 1 + Math.floor(Math.random() * takes);
      if (takes > 1 && take === lastTake.get(key)) take = (take % takes) + 1;
      const id = `${base}voice/${w}/${kind}-${take}.m4a`;
      if (!loaded.has(id)) return false;
      lastTake.set(key, take);
      const ok = audio.playSample({
        id: w + '-voice',
        sampleId: id,
        channel: 'sfx',
        peakGain: 1,
        replace: true,
        spatial: { position: at, refDistance: 7, rolloffFactor: 0.8 },
      });
      if (ok) talkingUntil = now + 1800;
      return ok;
    },
    get unlocked() {
      return unlocked;
    },
    wake: touched,
    sing() {
      loadSong();
      if (disposed || !unlocked || !song || !loaded.has(base + song.id)) return false;
      if (songOn) return true;
      songId = `song-${++songNo}`;
      older = new Set(elements);
      songOn = audio.playStream({ id: songId, streamId: base + song.id, channel: 'bgm', peakGain: 1, fadeInSec: 0.3 });
      songStarted = performance.now();
      if (songOn) for (const w of who) audio.stop(w + '-voice', 0.2);
      return songOn;
    },
    stopSong() {
      if (!songOn) return;
      songOn = false;
      audio.stop(songId, 1.2);
    },
    songTime() {
      if (!songOn || !song) return null;
      const el = [...elements].reverse().find((e) => !older.has(e) && !e.paused && e.duration > 200);
      if (el) return el.currentTime;
      const t = (performance.now() - songStarted) / 1000;
      return t < song.seconds ? t : null;
    },
    state: () => ({ on, unlocked, loaded: loaded.size, song: songOn, loops: Object.fromEntries(playing), diagnostics: audio.getDiagnostics() }),
    dispose() {
      disposed = true;
      loading.abort();
      window.removeEventListener('pointerdown', touched, true);
      window.removeEventListener('keydown', touched, true);
      audio.dispose();
    },
  };
}
