# Route: a character that holds up when it is looked at closely

A 3D character a player watches from near (a hero, a showcase, a lobby, a cut-scene), made or
raised by an agent with Blender headless and this repository's tools, held to a bar that is
measured before anyone is asked to judge it. The bar comes from one commercial game's character
showcase taken apart in [smooth-character-motion](smooth-character-motion.md): what its files
contain was turned into numbers a tool reads off any `.glb`. Two of this repository's own
characters were raised to it and drawn in the engine; no character was made from nothing here.
Mouse only; desktop Chrome on an Apple M4.

- **Id:** `high-quality-character`
- **Kind:** workflow
- **For:** A 3D character that is looked at closely: what its rig and clips must hold, how an agent raises a character to that with Blender and the repository's tools, the measured bar it must pass, and what is left for a person to judge.
- **Checked on:** desktop WebGPU (Chrome 158, Apple M4, on the graphics card); Blender 5.2.2 headless; no phone
- **Status:** 2026-11-26: `motion-audit.mjs` gives the reference's numbers again (and finds one
  of its four loops that does not close); `raise-rig.py` raised the wardrobe's body and the pig Zhuda,
  both then pass every must of the bar and play in the engine on the model stand. Steps 1, 2, 6,
  8 and 9 are written from the reference and from other routes and were not run for this one;
  nobody judged a picture.
- **Reference consumer:** this repository: `games/tools/characters/motion-audit.mjs`,
  `games/tools/characters/blender/raise-rig.py` with `blender/examples/wardrobe-body.json` and
  `zhuda.json`, and `zhuda-engine-prefabs/viewer3d` at `?scene=model-stand`. The characters raised are
  `games/zhuda-wardrobe/assets/parts/body.glb` and `zhuda-engine-prefabs/3d/zhuda-characters/assets/zhuda.glb`;
  the raised copies replace nothing (the record is `local-results/character-bar/`).
- **Engine version:** zhuda-laya-engine 2.0.0 and what came after it (`6b6f1cfc`, with this
  route's commit on top).

## When to take this route

- A character the camera comes near, or that stands still in front of the player: its joints,
  its hair and clothes, its loops and its changes of clip are all seen.
- Read first [smooth-character-motion](smooth-character-motion.md): where a showcase's smoothness
  comes from, measured, most weight first. This route is what to do about it.
- Not for a crowd, a far figure or a phone's budget of many: `rigged-phone-character` and
  [model levels](../model-lod.md). Not for 2D: `spine-character`, `pose-atlas-motion`. Clothes
  that are changed at run time: `humanoid-from-shapes`, `clip-free-garments`, `outfit-swap-3d`,
  and then this route for the body they hang on. Bringing any model in: `model-from-dcc`.

What the quality is made of, in the reference's order of weight, and what an agent can do
about each:

| # | What | Here |
| --- | --- | --- |
| 1 | The motion is in the clips: dense keys, hair and cloth moving inside them, long loops that close | steps 4 to 7; measured by the audit |
| 2 | Twist and corrective bones | step 3; twist bones made and measured, corrective bones not |
| 3 | One owner for the clock, one order a frame | step 8 |
| 4 | Changes of clip in seconds | step 8 |
| 5 | Props on the body's clock | step 8; no helper yet |
| 6 | A solver adds a little on top of the clip's pose | steps 5 and 8 |
| 7 | Shading that changes continuously | step 9; the face's shadow has no helper yet |
| - | The body itself: silhouette, face, hands | steps 2, 10 and 11: a person judges, from pictures the agent makes |

## Tools

| Tool | Version | Where from | Licence and what may be committed |
| --- | --- | --- | --- |
| Blender | 5.2.2 LTS | blender.org (on the owner's Mac: Homebrew) | Run headless: `blender -b --factory-startup -noaudio --python <script> -- <arguments>`. Nothing of it is committed. |
| MPFB (MakeHuman for Blender) | 2.0.18 | extensions.blender.org | GPL-3: an external tool, never in this repository or a game's bundle. The bodies it makes are CC0. Used for the body of `zhuda-engine-prefabs/3d/layered-hosiery` (`source/export_legs.py`). |
| VRM Add-on for Blender | as installed | extensions.blender.org | An external tool. Writes VRM 1.0, which the engine reads ([VRM](../vrm.md)). Not used by this route yet. |
| An image-to-mesh service | - | the owner's own accounts | Gives a mesh with no skeleton. Ask the owner before a paid service; its output's licence is the service's. |

In this repository:

- `node games/tools/characters/motion-audit.mjs <model.glb>...`: the bar. Names and numbers
  only; exit code 1 when a must fails. `--secondary`, `--twist`, `--corrective`, `--loops` take
  a pattern for rigs whose bones or clips are named otherwise; `--secondary-at-run-time` when
  hair and cloth are left to a solver on purpose; `--json`.
- `blender -b ... --python games/tools/characters/blender/raise-rig.py -- in.glb out.glb
  config.json [--report r.json] [--stills dir]`: twist bones, hair and cloth swung and written
  into the clips, every clip dense and a whole number of frames.
- `zhuda-engine-prefabs/viewer3d` at `?scene=model-stand&file=local/<name>.glb`: any rigged `.glb` in the
  engine, its clips changed by cross-fades in seconds or frozen at a second. Copy the file to
  `zhuda-engine-prefabs/viewer3d/dist/web/local/` after `npm run build` (no rebuild for a new file).
  Photograph it with `games/tools/shot.mjs . --gpu --hook __SCENE__ --script <steps.mjs>`.
- Engine: `ZhudaModelLibrary`, `ZhudaModelInspector` (`inspect`, `play`, `crossFade` in
  seconds), `ZhudaModelAnimationSampler`, `ZhudaAnimationBlend`, `runZhudaAfterAnimation`
  ([animation control](../animation-control.md)); `ZhudaSpringBones`
  ([spring bones](../spring-bones.md)); `ZhudaToonMaterial`
  ([stylized shading](../stylized-shading.md)); `ZhudaVrm`.

## Steps

1. **Say what will be watched.** Which clips (each pose as Start, Loop and End; an idle; the
   gaits), which parts must move by themselves (hair, sleeves, a skirt, a tail, ears), how near
   the camera comes, and the budget. The reference is a showcase: 62,327 vertices, 320 joints,
   161 morph targets; a skin of more than 24 joints is several draws here (`model-from-dcc`).
   Not run for this route: the two characters raised were what they were.
2. **Get a body whose shape a person has accepted.** No step after this one mends a face.

   | Source | What it gives | Known here |
   | --- | --- | --- |
   | A model made in a DCC tool, or bought with its rights | everything, if it was made for games | `model-from-dcc`; the pig Zhuda is one (rigged by a Blender script) |
   | MPFB in Blender, headless | an adult body of chosen build, CC0, with MakeHuman's rigs | the lower body only (`layered-hosiery`); a whole body with a rig was not made |
   | A VRM 1.0 avatar | body, face expressions, hair springs, toon materials | the engine reads all of it; no third-party avatar was tried |
   | Shapes in code (`humanoid-from-shapes`) | a figure in ten seconds, dressed without clipping | a stand-in: its face and hands were never judged good (`local-results/B1`) |
   | An image-to-mesh service | a textured mesh, no skeleton | needs a skeleton and weights; not done by any route here |

   Show the owner front, side and back at rest and the face and a hand from near before going
   on (step 10 says how). Not run for this route.
3. **Give the rig twist bones.** In `raise-rig.py`'s configuration, one entry a twist bone:
   `follow` on the far half of a limb takes a share of the turn the next joint makes about the
   limb (the forearm for the hand); `counter` on the near half undoes a share of the limb's own
   turn (the upper arm at the shoulder, the thigh at the hip). The script lays the bone on the
   limb, shares the skin's weights out along it (a smooth step from 0.3 to 0.9 of the limb's
   length for `follow`, 0.1 to 0.6 for `counter`) and keys it in every clip from what the joints
   do; no constraint is left in the file. `share` 0.5 is the reference's own split in two.
   Give `probe` to have it measured: the hand is turned 120° about the forearm and the thinnest
   ring of skin at the wrist is compared with rest. On the wardrobe's body: 0.501 of its rest
   radius before (half the wrist is gone), 0.866 after; pictures with `--stills`. Corrective
   bones at the shoulder, elbow, hip and knee (the reference has 16) are not made by the script.
4. **Make the clips dense and a whole number of frames.** Set the scene's frame rate before
   the file is read (the script does). A clip is keyed on every frame at 30 a second, or with
   cubic splines; the script rescales a clip whose length is not a whole number of frames (the
   wardrobe's run was 19.8 frames: 0.66 s became 0.667 s) and writes each clip over exactly its
   own frames. Body motion itself is authored as before: poses as functions of time sampled 30
   times a second (`games/tools/characters/kit.mjs`, `sampleClips`), or keys set by a Blender
   script (`zhuda-engine-prefabs/3d/zhuda-characters/source/pig-clips.py`). Start, Loop and End of a pose
   are three clips.
5. **Put the hair, the cloth and the tail into the clips.** One `chains` entry a chain of bones.
   Each bone's far end is a point on a spring that rests on what the clip already does with the
   bone, with no gravity by default (as the reference's cloth: the clip's pose is the rest
   shape). `hz`: how many times a second it would swing if let go (1 to 2 long hair, 2 to 4 a
   ribbon, a hem, an ear; more is stiffer). `damping`: 0.2 keeps swinging, 0.5 settles in a
   swing or two. `limit`: the most degrees it leaves the clip's pose (the reference: 10 to 50).
   `wind`: a slow push to and fro in m/s², so that a chain lives while the body is still (it
   rests about `wind` ÷ (2π·`hz`)² metres off). A clip named in `loops` is simulated round after
   round until a round begins as the one before did (within 0.05°), and then closes on itself;
   the wind goes round a whole number of times in it. Used: hair 1.6 Hz, 0.35, 40°, wind 3;
   cloth panels 2.2 Hz, 0.45, 30°; the pig's ears 2.6 Hz, 0.35, 35°; its tail 2.8 Hz, 0.55, 30°.
   Leaving a chain to the engine's spring bones at run time instead is a choice, not a fault:
   say so (`--secondary-at-run-time`), and know what is given up: the motion is the solver's
   and nobody shaped it, a loop cannot be made to close, and the file cannot show it.
6. **Make the idle long.** The reference's are 18.7 s and 21.3 s; the two raised here are 3.2 s
   and 3.8 s and repeat in sight. Layer motions whose lengths share no small multiple (breath,
   a shift of weight, a look aside) and take their common length as the loop. Not run.
7. **Audit.** `node games/tools/characters/motion-audit.mjs out.glb`. Every `must` is `ok` or
   `n/a` with its reason read: `dense-keys` (24 keys a second or more on the bones that turn, or
   cubic splines), `secondary-in-clips` (0.8 of the hair, cloth and tail bones move in every
   clip), `loop-seam` (every bone of every loop closes within 0.5° and 1 mm, or within one and a
   half of the smaller of its own first and last steps: a clip may leave its closing key out,
   and a jump on the last key is still a jump),
   `joints-on-a-vertex` (four at most). Each `should` that is `weak` is looked at by name:
   `idle-length` (8 s), `no-pops` (no bone over 1,200° a second between two keys: the line names
   the bone), `twist-bones` (four or more on a human rig).
8. **Play it in one order.** One clock: the session's (`context.runtime.start`), never a timer
   of the character's own. Change clips with `new ZhudaModelInspector(model).crossFade(path,
   name, { seconds: 0.18 })` (LayaAir's own call takes a share of the outgoing clip; 0.18 given
   to it is 3.4 s out of an 18.7 s idle). Gaits through `ZhudaAnimationBlend`. What follows
   the pose (spring bones for what was left to them, a prop on a hand) runs inside
   `runZhudaAfterAnimation`, once a frame. A prop with a clip of its own takes its time from the
   body's and is put back only when it is more than 35 to 40 ms off. Written from the reference
   and the engine's guides; the model stand does the first two.
9. **Shade it so that nothing jumps.** `ZhudaToonMaterial` with a `softness` on its bands (a
   band's edge is a blend, not a step) and an outline; light as `good-looking-3d-scene`. The
   reference turns the face's shadow with the head through a texture; the toon material has no
   such thing. Not run.
10. **Look at it in the engine, every version.** Copy the file to
    `zhuda-engine-prefabs/viewer3d/dist/web/local/` and photograph it on the model stand with a script that
    names its moments (`S.set({ clip, fade: 0 })`, `S.set({ freeze: seconds })`, `S.set({ yaw })`;
    `S.where(bone)` gives a bone's place for a number; `S.set({ aim: [x, y, z] })` looks at a
    point from near). A generated mesh is often 1 unit tall, centred on the origin and facing
    another way: `?scale=&lift=&turn=` stand it upright on the stage without touching the file.
    The sheet to make: front, side and back
    at rest; three moments of every clip; from behind while it runs; the bends that break rigs
    (elbow and knee folded, the wrist turned, the arm raised overhead); the face and a hand from
    near; and the same moments of the version before, row over row. A change that cannot be
    seen in the sheet is not reported as an improvement.
11. **Ask a person, and write down what they say.** What the audit cannot know: whether the
    proportions are right, how weak the face and hands are, which clip looks least natural, how
    near the camera may come. The questions the owner was put for the wardrobe are in
    `local-results/B1/notes.md`; an agent's own reading of its pictures is a hint about where
    to look, never the answer.

## Pitfalls

| Seen | Cause | Fix |
| --- | --- | --- |
| The audit passes and the character still looks wrong | It reads names and numbers: nothing is drawn | Steps 10 and 11 are not optional; the audit's last line says so every time |
| Clips come out shorter and a run no longer closes (3.2 s became 2.567 s; a seam of 17.7°) | Blender's glTF importer places keys by the scene's frame rate (24 by default); the file was read at 24 and written at 30 | Set `scene.render.fps` before `import_scene.gltf` |
| Every clip is one frame longer and holds its last key (3.2 s became 3.233 s) | Exported through the NLA tracks the importer makes, whose strips start at frame 1 | Export with `export_animation_mode='ACTIONS'` and each action's own frame range (`use_frame_range`, 0 to N) |
| A loop cannot close at 30 a second | Its length is not a whole number of frames (19.8) | Rescale its keys to the nearest whole number first |
| A twist bone twists the wrong way, or hair lags toward the motion | After import a bone's own axes need not lie along the limb (the wardrobe's bones all point up) | Take the limb's direction from joint to joint; swing a point toward the next bone, the bone's child or the skin it carries, never "the bone's Y" |
| A chain that never repeats, however many rounds | The simulation took an extra step at the seam to look ahead | Run rounds end to end, frame 0 straight after the last frame, and compare a round's first frame with the round before |
| Hair that barely moves, or moves differently at another frame rate | Stiffness given as a share of the gap closed each step | A spring by its frequency and its damping ratio, stepped at 120 a second |
| "Dense" clips that are no better | A sparse clip resampled at 30 a second passes `dense-keys` and holds no more than before (the pig's are 21 a second, rewritten at 30) | Density is asked of the source: sample poses, or bake a simulation, at the rate written |
| A game's other data stops matching the model | A round trip through Blender changes vertex order and count (7,255 became 7,256) and rounds clip lengths (the pig's walk 0.476 s became 0.467 s) | Rebuild whatever is counted per vertex or triangle (the wardrobe's cover masks), and tell whatever is timed by a clip's length; do not swap the file alone |
| Copying the reference as the bar | Even it has a loop that does not close: in its weapon loop 29 hair, ribbon and skirt bones end away from where they began, one ribbon bone by 44° in a single key (1,322° a second) | The bar is the audit's, not "as the reference does" |
| The model stand shows grey | `?height=` is the canvas's height in every viewer page; the character's is `?tall=` | - |

## Engine gaps and their workarounds

| Gap | Workaround now |
| --- | --- |
| No corrective bones (shoulder, elbow, hip, knee) from any tool here | Twist bones only; look at the folded elbow and knee in step 10 and say what is seen |
| No tool composes a long idle from layers | Author it by hand in the kit's pose functions or a Blender script (step 6) |
| `raise-rig.py` needs Blender; nothing in Node adds twist bones or bakes a chain into a `.glb` | Run Blender headless; the kit's own figures could carry both from the start (`heroRig`'s `extras`, `hangFollow`), not done |
| Spring bones at run time: no rest on the clip's pose, no blend weight, no display interpolation, no return to the base pose (listed in `smooth-character-motion`) | Bake the chain (step 5) and leave the solver off for it |
| No prop helper (a prop's clip slaved to the body's, windows in which it is held) | Step 8's rule in game code |
| No face shadow that turns with the head in the toon material | None |
| No retargeting of clips from another rig, no `.vrma` ([VRM](../vrm.md)) | Clips are made on the character's own rig |
| No preview of a `.glb` from Node | The model stand |

## Checks

All on 2026-11-26, Apple M4; the outputs are in `local-results/character-bar/`.

- **The audit against the reference** (read where it lies, nothing copied): 320 joints, of them
  18 twist, 16 corrective and 193 hair, skirt and ribbon bones by name; 62,327 vertices, four
  joints a vertex at most; twelve clips at 30 keys a second; the two idle loops 18.667 s and
  21.333 s, closing within 0.234° and 0.174°; 184 of the 193 secondary bones moving in the first
  (70 + 32 + 82 of 91, as `smooth-character-motion` counted them by hand). New: of its four
  loops three close on every bone and the weapon loop is open on 29, as the Pitfalls say; so
  the reference itself does not pass every must.
- **Raised and audited**:

  | | Wardrobe body, before | after | Zhuda, before | after |
  | --- | --- | --- | --- | --- |
  | Joints | 24 | 30 (6 twist) | 14 | 14 |
  | `dense-keys` | 30 | 30 | 21: fails | 30 |
  | `secondary-in-clips` | 0.25 of 4: fails | 1 | 0 of 3: fails | 1 |
  | `loop-seam` | 0° | 0° | 0° | 0° |
  | `twist-bones` | 0: weak | 6 | not a human rig | - |
  | `idle-length` | 3.2 s: weak | 3.2 s: weak | 3.81 s: weak | 3.8 s: weak |
  | `no-pops` | 602°/s | 596°/s | 1,357°/s: weak (an arm in Struggle) | 1,800°/s: weak (the tail in Shake) |
  | Every must | no | yes | no | yes |

- **Twist, measured and seen**: the wrist's thinnest ring with the hand turned 120°: 0.501 of
  rest before, 0.866 after (`wrist-twist-120-before-after.jpg`).
- **In the engine** (model stand, WebGPU, `games/tools/shot.mjs --gpu`): both raised files load
  with their clips' lengths as written (the body: 42 nodes, 5 clips; the pig: 19 clips), no
  renderer error, no page error; thirteen and ten moments photographed beside the same moments
  of the files as they were. While the pig's idle plays, the tip of its left ear moves 18.7 mm
  to and from the head (0.2 mm before: its ears were still in every clip). Across a 0.18 s
  cross-fade from Idle to Walk the body's left hand was read every 60 ms and moves without a
  jump.
- `node --test tests/character-motion-audit.test.mjs`: nine tests on files made in the test
  (each measure alone) and on the repository's three characters.
- `zhuda-engine-prefabs/viewer3d`: `npm run verify` with the model stand among its presets.

## Not checked

- A character made from nothing by this route: steps 1, 2, 6, 8 and 9 were not run for it.
- Anybody's judgement of any picture. The pig's tail in Shake (1,800° a second) and the baked
  ears were looked at in stills by the agent only, never in motion by a person.
- The wardrobe body's hair and cloth bones as skin: `body.glb` carries no hair and no cloth
  (the wardrobe binds them at run time), so their baked motion was measured and not seen. The
  pig's ears and tail were seen.
- The raised files in a game: neither replaced the file it came from.
- Corrective bones; a long idle; props; the toon material on these characters; a VRM avatar;
  a whole MPFB body with a rig; an image-to-mesh character.
- A phone, WebGL for the model stand's pictures, frame rate, a 120 Hz screen.
- Whether 24 keys a second, 0.8, 8 s and 1,200° a second are where an eye stops minding: they
  are this route's choices, set from one reference.

## Boundaries

- The tools are this repository's (`games/tools/characters/`, the model stand). A raised
  character belongs to the game or the prefab module that owns the character; raising one there
  is that owner's change, with whatever of its data must be rebuilt.
- Nothing of the reference enters the repository: it is read where it lies.
- Blender's add-ons stay outside; MPFB is GPL-3, its bodies are CC0.
- Closing a gap above in the engine is engine work with tests; the bar's numbers change only
  with a measurement written beside them.
