# Route: A lane rhythm game

Notes fall down lanes to a line and are tapped in time with a song. The song is one sample mixed in the page from engine synth recipes; the chart comes from the same data as the song; time is one clock.

- **Id:** `rhythm-2d`
- **Kind:** workflow
- **For:** building anything that must be judged against music: a rhythm game, or a timed prompt over a track
- **Checked on:** desktop WebGL (headless Chromium 153 on SwiftShader, Linux container); no phone, no GPU, no human player
- **Status:** two songs, two difficulties built on 2026-11-25; real key presses at published times judged 54/54 perfect (mean −5 ms) while following the engine's audio clock; pause and resume recorded; nobody has heard it (draft)
- **Reference consumer:** this repository, `games/zhuda-beat`
- **Engine version:** zhuda-laya-engine 1.18.0; built at `def94aae9e7ebf5f9f35b915b54dbb4c3e5fe43c`, `npm run verify:games` re-run against this repository's engine

Read `game-rules-first` first: this file only adds what is particular to the genre.

## When to take this route

Input judged in tens of milliseconds against audio. Read it also before syncing a cut or a line of
dialogue to a track: the clock part is the same.

## Tools

- `IframeSoundAdapter`, `ProceduralAssetProvider`, `renderZhudaSynth`, `encodeZhudaWav`,
  `validateZhudaSynthRecipe`; engine 2D for the lanes.

## Steps

1. **One zero.** Describe the song as data (tempo, bars, melody, bass, drums). Derive both the
   audio and the chart from it. Never type chart times by hand beside a finished audio file.
2. **Mix it yourself.** A synth recipe is at most 10 s and 16 layers, so render each distinct tone
   once (`renderZhudaSynth`), add it into one `Float32Array` where it sounds, level it, wrap with
   `encodeZhudaWav`, register under a `ProceduralAssetProvider` id, `loadSample`. A 37 s song at
   22050 Hz mono took about 0.1 s.
3. **One clock.** `songTime = performance.now()/1000 − origin`. Set `origin` a count-in ahead.
   When `songTime` first passes zero, `playSample({ offsetSec: songTime, replace: true })`: the
   sample starts where the clock says, so a late frame does not shift it. While it sounds, each
   frame ease `origin` a tenth of the way onto `now − getSamplePositionSec(id)` (the audio clock
   moves in steps of a few milliseconds) and jump when they part by more than 50 ms: the song's
   time is then the audio clock's, and the page clock only carries it between frames.
4. **Stamp taps with `event.timeStamp`**, listen on the DOM (`keydown`, `pointerdown`), map the
   pointer to a lane yourself. Do not take the frame's time.
5. Judge in pure code: windows ±50 / ±100 / ±140 ms; a tap takes the earliest open note of its
   lane within reach; notes past reach are misses on `advance(time)`.
6. **Calibration**: subtract a player-set offset from every tap's time; after a song, show the
   mean signed offset of the hits and say which way to move the setting.
7. **Leaving the page pauses the game**: on `blur` and `visibilitychange`, store `songTime`, stop
   the sample. On resume, set `origin` so the song is a little before where it stopped and start
   the sample again at its offset.
8. Publish the remaining notes as `[lane, performance.now() ms]` in the report: a script can then
   press real keys on time, and that run is the check of clock → judgement.

## Pitfalls

- The adapter suspends audio on blur by itself while `performance.now()` runs on. Without step 7
  the song and the notes part ways.
- Muted, `playSample` returns false and plays nothing: never use "is the song playing" as the clock.
- A chart with the same lane twice within 0.2 s is unplayable on a phone: test for it.

## Engine gaps and their workarounds

- `getSamplePositionSec(id)` is null until a gesture unlocks audio, while muted and after `stop`:
  the page clock of step 3 is the fallback, not something to remove (`docs/audio.md`, "Keeping
  time with a sample").
- No "start at" on `playSample`: start at an offset instead (step 3).
- Synth limits (10 s, 16 layers): step 2.

## Checks

- Exact taps rank S with a full combo; 70 ms late is all "good" and the lean reads 70 ms (tests).
- The first beat has sound at time zero in the mix (test).
- Real keys at published times: all within the perfect window; Esc holds `songTime` still (recorded).
- In headless Chromium's audio context the engine's audio clock was read 1,315 times over one song
  and never stood more than 10.2 ms from the page clock; the host reported 32 ms of output latency.

## Not checked

- **Whether the ear and the eye agree.** Headless has no speaker: only clock → judgement was checked.
- Whether the songs sound good. Drift between page clock and audio clock over minutes.
- Touch on a device; Bluetooth latency.

## Boundaries

Taps only: no holds, no slides, no imported audio files, no editor.
