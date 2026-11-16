# Fly-through benchmark and blind critic

Two optional gates for a 3D scene, film or game look, taken from the way
[Abyssal Garden](plans/records/abyssal-garden-techniques/plan.md) was
accepted: a scripted camera move timed frame by frame against a budget, and
a critic that sees only pictures of it. Record:
`docs/plans/records/flythrough-critic/`.

Neither is a device check. The numbers are those of the machine that ran
it; a phone needs its own run.

## The fly-through

```sh
npm run verify:flythrough -- path/to/scene.flythrough.json [--out DIR] [--no-recording]
ZHUDA_FILM_RENDERER=webgpu npm run verify:flythrough -- path/to/scene.flythrough.json
```

The file holds a film scene and what to do with it:

```json
{
  "schemaVersion": 1,
  "scene": {
    "schemaVersion": 1,
    "id": "yard",
    "camera": { "eye": [12, 2.4, 16], "target": [-1, 1.2, 0] },
    "nodes": []
  },
  "cameraPath": [
    { "time": 0, "camera": { "eye": [12, 2.4, 16], "target": [-1, 1.2, 0] } },
    { "time": 6, "camera": { "eye": [-14, 5, -6], "target": [0, 0.8, 0] } }
  ],
  "fps": 30,
  "width": 960,
  "height": 540,
  "poses": [0, 2, 4, 6],
  "budget": { "gpuAverageMs": 11, "gpuP99Ms": 16.7, "gpuMaxMs": 33.3 },
  "recording": { "durationSec": 3, "fps": 24, "width": 640, "height": 360 }
}
```

- `cameraPath`: keys as in a film video (smoothstep between keys). The run
  is `durationSec` (default: the last key) times `fps` frames.
- Each frame is drawn as a game draws it, one sample, into a target of
  `width` × `height`, with the scene's time set to the frame's time. Ten
  frames are drawn first and not timed (`warmupFrames`), so shader compiles
  and first uploads stay out of the numbers.
- CPU time is the time spent submitting the frame. GPU time comes from
  `ZhudaRuntimeProfiler`: WebGPU timestamps summed over the frame's render
  passes, or WebGL's disjoint timer query where the browser has it. Where
  there is none, the report says GPU time unavailable and why; it is never 0.
- `budget`: any of `cpuAverageMs`, `cpuP99Ms`, `cpuMaxMs`, `gpuAverageMs`,
  `gpuP99Ms`, `gpuMaxMs`. p99 is the nearest rank. Single GPU readings spike
  on a desktop (to several times the median), so a max limit alone fails at
  random; give p99 the tight limit and max a loose one.
- Exit 0 within budget; 1 over budget, a WebGL error, or a bad file; 2 when
  a limit asked for could not be checked (GPU time unavailable), never a
  pass. Every problem is printed with `file:line`: the budget line exceeded,
  and the slowest frames with the camera key they come after.

Beside `report.json` (every frame, the summary, the backend and GPU):
`pose-<i>-<t>s.png` at each pose (drawn after the timed run), `recording.mp4`
(the film video path at one sample a frame, needs `ffmpeg`; when it cannot be
made the report says why), and `critic-brief.md`.

In a page of your own, `runZhudaFlythrough(stage, runtime, options)` does
the same on a mounted `ZhudaFilmStage`, and `summarizeZhudaFlythrough`
checks the frames against a budget.

## The critic

Hand the pose pictures, the recording and `critic-brief.md` to a reviewer
that sees nothing else: no scene file, no code, no intended look. An agent
started for the purpose (with only the brief and the picture files) or a
person who has not seen the scene. It returns JSON: the defects it found
(`shimmer`, `aliasing`, `popping`, `banding`, `flat-light`, `noise`,
`clipping`, `other`), each `minor`, `major` or `critical`, with the picture
and where, most severe first. Keep the report with the run.

```sh
npm run flythrough:critic -- critic-report.json --run DIR
```

`minor-only` (exit 0) is the gate the critic proposes: no defect above
minor. A person still looks and accepts it; it is not a pass by itself. A
defect above minor, or a report that does not validate (a kind or severity
it does not know, a picture it was not given, a picture it did not review,
defects not ranked), exits 1 with `file:line` for each.
