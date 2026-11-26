// The island's sound files as data (no engine): the characters' voice lines (kind -> takes),
// the ambience loops, the effects and the song, and where each file is served. Node tests
// check these against assets/.

/** Zhuda's lines: kind -> how many takes (voice/zhuda/<kind>-<n>.m4a). */
const ZHUDA_LINES = {
  grab: 5,
  swing: 4,
  dangle: 3,
  throw: 3,
  land: 3,
  dizzy: 2,
  splash: 2,
  shake: 2,
  roof: 1,
  lost: 1,
  respawn: 1,
  cheer: 3,
  idle: 3,
  rain: 1,
  storm: 1,
  night: 1,
  morning: 1,
} as const;
export type LineKind = keyof typeof ZHUDA_LINES;
/** Whose voice: Zhuda (聲線「豬大_正式選定_C慵懶吐槽」, 37 takes) or Zhuer (「豬二-妹妹_甜美少女」, 24 takes). */
export type Who = 'zhuda' | 'zhuer';
export const LINES: Record<Who, Record<LineKind, number>> = {
  zhuda: ZHUDA_LINES,
  zhuer: { grab: 3, swing: 2, dangle: 1, throw: 2, land: 2, dizzy: 1, splash: 1, shake: 1, roof: 1, lost: 1, respawn: 1, cheer: 2, idle: 2, rain: 1, storm: 1, night: 1, morning: 1 },
};
export const LINE_KINDS = Object.keys(ZHUDA_LINES) as LineKind[];

/** A song to play: its file (under assets/), beats a minute, where the first beat is and how long it lasts (seconds). */
export interface Song {
  id: string;
  bpm: number;
  offset: number;
  seconds: number;
}
/** 「ふたりの帰り道」, the user's own song (7 MB): about 73 beats a minute; the first beat's place was not measured. */
export const SONG_FUTARI: Song = { id: 'audio/song-futari.m4a', bpm: 73, offset: 0, seconds: 444 };

export const ISLAND_SOUND_BASE = 'common/3d/island-sound/assets/';

// Long ambience loops are streamed (not decoded whole: six of them would pass the
// adapter's decoded-sound budget); the short windmill loop is a sample so it can be placed.
export const STREAMS = ['amb-day', 'amb-night', 'amb-rain', 'amb-storm', 'amb-wind', 'amb-gale'] as const;
export const LOOPS = [...STREAMS, 'windmill'] as const;
export type Loop = (typeof LOOPS)[number];
export const EFFECTS = [
  'thunder-1', 'thunder-2', 'thunder-3', 'thump', 'thump-hard', 'roof', 'splash', 'splash-small', 'paddle', 'whoosh',
  'slide-whistle', 'poof', 'sparkle', 'dizzy', 'heart', 'pop', 'step-1', 'step-2', 'squish', 'shake', 'grab', 'click',
] as const;
export type Effect = (typeof EFFECTS)[number];

/** Every file under assets/ the sound may ask for (ids relative to assets/), for the given voices and song. */
export function soundFiles(voices: readonly Who[] = ['zhuda', 'zhuer'], song: Song | null = SONG_FUTARI): string[] {
  return [
    ...LOOPS.map((n) => `audio/${n}.m4a`),
    ...EFFECTS.map((n) => `audio/${n}.m4a`),
    ...voices.flatMap((w) => LINE_KINDS.flatMap((k) => Array.from({ length: LINES[w][k] }, (_, i) => `voice/${w}/${k}-${i + 1}.m4a`))),
    ...(song ? [song.id] : []),
  ];
}
