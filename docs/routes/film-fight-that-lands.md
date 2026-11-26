# Route: a fight film whose every hit lands, cut to a commercial track's beats

A short action film of two rigged characters fighting, authored as data and rendered
through the MCP film tools, in which every punch and kick visibly touches what it
hits. The strike is measured on the skeleton at the moment of contact, the
defender is moved until the fist sinks 2 cm into the surface, punches are aimed in
the stage's space rather than the chest's, and the edit adds hit-stop, flash and
shake on the measured times. The music is a track from the user's library cut at
bar and beat lines so its drops land on story beats. Built and checked once, on a
desktop with WebGPU.

- **Id:** `film-fight-that-lands`
- **Kind:** workflow
- **For:** A fight or action film as data where hits must touch (no "punching the air"): keyed fight clips, contact measured on the rig, defender spacing solved per shot, aimed punches, strike-frame boards, hit-stop and flash in the edit, and a library track cut so its drops fall on the first clash and the comeback.
- **Checked on:** desktop WebGPU (Apple M4, macOS 27.2.1, headless Chrome through the MCP server); no phone
- **Status:** 《黑與紅》 version 3 (2026-11-26): 20 strikes in 11 shots all measured
  touching at the strike frame (sunk 0.4 to 2.4 cm), each strike frame looked at,
  29 shots rendered and assembled into a 54.6 s film at -14.8 LUFS. The sound was
  measured, not listened to; the user has not reviewed version 3 yet.
- **Reference consumer:** `films/black-red-duel` in the ZhudaGameCenter workspace
  (outside this repository): `fight.mjs`, `fight2.mjs`, `contact.mjs`,
  `shots2.mjs`, `shots3.mjs`, `contactboard.mjs`, `frames/gaps.mjs`,
  `frames/through.mjs`, `tools/assemble3.py`, `tools/sfx.py`.
- **Engine version:** zhuda-laya-engine 2.0.0, `unified` branch worktree (HEAD
  `44228176` on 2026-11-26); stickman builder with the uncommitted
  `STICKMAN_CLIPS`, `STICKMAN_BODY`, `STICKMAN_MOUTH` switches.

## When to take this route

For any film where bodies hit bodies: fights, sport, a slap, a shove, a ball
striking a head. Take [film-as-data](film-as-data.md) beside it for the scene,
camera paths and render jobs, and [film-ink-lines](film-ink-lines.md) or
[astral-minimal-film-look](astral-minimal-film-look.md) for the picture. For a
fight that runs live in a game (input, hitboxes, frame data) take
[side-view-duel](side-view-duel.md) or [platform-fighter-2d](platform-fighter-2d.md):
this route solves contact once, offline, per shot. For clips captured from motion
data or a DCC tool, the contact measurement (steps 3 to 6) still applies; the keyed
pose part (step 1) does not.

## Tools

- MCP server: `node packages/mcp-server/index.mjs --film-output <dir> --film-assets <dir> --film-renderer webgpu`;
  tools `film_scene_create`, `film_scene_review`, `film_scene_preview`,
  `film_render_job`, `film_scene_close`.
- Character: the stickman builder `prefabs/3d/stickman/source/build.mjs` with
  `STICKMAN_CLIPS=<module>` (the clips to bake), `STICKMAN_OUT=<file.glb>` (trial
  output, the asset is untouched), `STICKMAN_BODY`, `STICKMAN_MOUTH`. The rig and
  points come from `prefabs/3d/stickman/source/stickman-def.mjs` (`RIG`, `HEAD`);
  inverse kinematics from `games/tools/characters/hero-kit.mjs` (`poser`), quaternions
  from `games/tools/characters/kit.mjs` (`Q`).
- Node v26.13.1; Python 3 with numpy 2.0.2 and Pillow 11.3.0; ffmpeg 8.1.1.
- Music: any track in `~/zhuda-zhuer-world/06_音樂/豬大配樂/`. **Almost all are
  commercial songs**: fine to watch privately, not to publish until the user has
  dealt with the licence; for a public film use `zhuda-music` or
  `原創歌曲/`. Never commit the track to any repository.

## Steps

1. **Fight clips as keyed numbers.** Each pose is numbers: feet `[x, z, yaw, lift, pitch]`,
   `drop`, `shift`, hips/spine/chest/neck/head `[pitch, yaw, roll]`, arms
   `{at, pole, f, n}` (wrist target carried by the chest), `kick {at, w, pitch}`.
   A clip is keys `[time, pose, curve]` with curves `ease`, `in` (a punch going
   out), `out`, `linear`, `snap` (`1 - (1 - x)^4`: a head snapping back). Bake them
   into the model with `STICKMAN_CLIPS`. (`fight.mjs`, `fight2.mjs`, `tools/fighters.sh`, about 13 s for two models.)
2. **Write every strike down.** One table per film: shot, time, attacker and limb,
   defender and part (or a list of parts: a block's two forearms), weight
   (`small`, `big`, `huge`), and which strike of the shot is the main one:
   `{ t: 0.7, a: 'black', limb: 'footR', d: 'red', part: ['foreL', 'foreR', 'handL', 'handR'], kind: 'big', main: true }`.
   The edit's hit times come from this table, never typed twice. (`shots2.mjs`, `STRIKES`.)
3. **Measure contact on the skeleton.** At the strike time, pose the clip
   (`clip time = offsetSec + t * speed`), place the limb's point with
   `RIG.R.place(pose, joint, point)`, turn it by the node's yaw and add its position.
   Parts as spheres: fist `hand` at `P.grip` r 0.05; toe on `foot` r 0.05; forearm
   midpoint of elbow and wrist on `fore` r 0.04; head `HEAD.centre` r `HEAD.radii[0]`;
   chest `[0, 0.7, 0]` on `chest` r 0.085; belly `[0, 0.6, 0]` on `spine` r 0.09.
   Gap = centre distance minus both radii; negative is touching. (`contact.mjs`.)
4. **Aim punches in the stage's space.** A wrist target written in the chest's frame
   is carried by the chest's turn: the fist lands 10 to 16 cm to the side and grazes
   past the head. Instead give the target in character space, read the pose's chest
   rotation and position (`T.world(pose, 'chest')`, `T.place(pose, 'chest')`), turn the
   target into the chest frame, then measure where the fist centre (`P.grip`, mirrored
   by `RIG.side`) actually ends and correct the target by the difference, five times.
   Targets for a face: `[0, 0.92, 0.4]`; body: `[0, 0.56, 0.42]`; uppercut
   `[0, 0.98, 0.3]`. (`fight2.mjs`, `aimed()`.)
5. **Solve the spacing per shot.** For the main strike, move the defender along the
   line between the two (here Z) by `-dir_z * (gap + 0.02)`, three times, so the
   limb sinks 2 cm. Place the impact effects at the measured contact point and build
   the edit's hit list from the table. Print every strike's gap
   (`node frames/gaps.mjs`): all must be at or below 0.
6. **Check what happens between the strikes.** Sample every 1/60 s the striking limb
   against head, chest, belly, both forearms and both fists of the defender and print
   the deepest overlap (`node frames/through.mjs`). Up to about 6 cm in a flurry is
   not seen; 10 cm or more is a fist through a face: fix the defender's recovery
   (step Pitfalls 4).
7. **Look at every strike frame.** `film_scene_review` with one frame per strike at
   its exact time and the shot's camera at that time, labelled with limb, part and
   gap. A strike the camera cannot see does not land for the audience: re-frame it
   (side or three-quarter view, light from behind the camera). (`node contactboard.mjs` → `frames/contact3/`.)
8. **Render.** `film_render_job` video per shot, 1280×720, 4 samples; slow motion
   rendered at 60 fps and played at 24 (2.5× slower; 60 is the tool's limit;
   `durationSec * fps` must be a whole number). `shoot.mjs` restarts the MCP server
   and retries a shot once after a failure.
9. **Edit on the measured hits.** Per shot in ffmpeg: hit-stop with `freezeframes`
   (2, 4, 6 frames for small, big, huge), a flash with `eq=brightness` (0.18 one
   frame; 0.4 two frames; 0.75 then `negate` then 0.35 for huge), then a shake: crop
   32 px in from each edge and move the crop by `A * sin((n - f) * 2.3 + j) * exp(-(n - f) / 5)`
   with `A` = 10, 18, 30 px, scaled back to full size. A whoosh 0.12 s before each hit,
   the impact sound by weight, both slowed with slow-motion shots. (`tools/assemble3.py`.)
10. **Choose the track by its structure.** Decode candidates to mono, and for each
    find the tempo (autocorrelation of spectral flux, 70 to 190 BPM), the beat phase
    (a comb over the low-band onsets below 150 to 200 Hz) and a per-bar table of
    loudness, bass share and high share. A usable fight track has a quiet build, a
    drop, a break of a few bars and a second drop. *Loyal General (Deep Phonk)*:
    129.2 BPM, first beat 0.203 s, bar 1.858 s; build bars 0 to 7, drop at bar 8,
    break bars 32 to 39, drop at bar 40, ending bar 63.
11. **Cut the track to the story.** First drop on the first clash (shot start plus
    hit time times the slow-motion factor); a whole number of bars until the hero is
    down; then enough of the break, counted in beats, that the second drop falls on
    the comeback (here 21 beats, landing 0.04 s from the blast); a whole number of bars
    of the second drop; then the track's own ending. Snap each splice to the strongest
    kick onset within ±25 ms of the grid, crossfade 12 ms. Place the music at a gain
    that puts its drop about 3 dB under the effects bus (here 0.14 for a track whose
    drop measures -3.3 dBFS RMS), duck it to 0.45 under narration, then
    `alimiter=limit=0.85` and `loudnorm=I=-14:TP=-1.5:LRA=11`. Credit the track on the
    end card.

## Pitfalls

1. **The fist went where the chest carried it.** The punch was keyed as a wrist
   target in the chest's frame; the punch also turns the chest 14 to 18°, so the fist
   ended 10 to 16 cm to the side of the head: every hit read as "隔空打" (hitting the
   air). Aim in character space and correct on the measured fist (step 4).
2. **A strike behind the defender's head never lands on screen.** The three-hit combo
   was shot over the defender's shoulder against the sun: all three punches were
   hidden by the defender's head. Shoot strikes from the side, light behind the camera.
3. **`aimed()` adds the pose's own `shift`.** Aiming a blocked punch at the forearm
   without subtracting the pose's forward shift (0.09 m on the cross) put the fist
   9 cm into the arm. Target = forearm position minus (fist r + forearm r - 0.02) minus
   the shift.
4. **The defender walked back into the next punch.** In an eight-punch flurry the
   defender's head snapped back and then returned upright in 0.1 s, into the fist that
   was still out: 11 cm through the face. Hold the snapped-back head 0.13 s and keep
   the recovery pose leaning back (`chest -16°`, `head -22°`, 6 cm further back).
5. **A kick that cannot reach rises.** A flying kick aimed at 0.57 m ended at
   0.81 m because the leg was at full stretch from a hip 0.5 m in the air. Lower the
   air height (0.36 m) before lowering the target.
6. **Solving spacing along one axis under-corrects** when the contact direction is
   mostly up or sideways (shift = `dir_z * gap`). Aim first (step 4), then solve; or
   iterate until the gap is within 5 mm of -2 cm.
7. **Snapping a splice to "the nearest kick" within ±60 ms** took a pickup 50 ms
   early at two of three points; ±25 ms keeps the grid.
8. **A hung render.** Once, `film_render_job` hit a CDP timeout after 15 minutes and
   every later call on the same server timed out too (another session was using the
   GPU). Kill the server and connect again; retry the shot once.
9. **The renderer is three to six times slower while another session uses the GPU**
   (a shot of 58 frames: 102 s alone, 154 s and more shared).

## Engine gaps and their workarounds

| Gap | Workaround here |
| --- | --- |
| No contact or overlap query between two posed models in a film scene | Measure on the rig in Node (`contact.mjs`) with sphere parts; it ignores the mesh's real shape |
| `film_render_job` video is at most 60 fps | Slow motion is 60 fps played at 24 (2.5×); 3× needs 72 |
| Lights cannot change during a shot; effects cannot move | Impact light comes only from the effect's own glow; a beam is a row of `hit` effects started one after another |
| At most 32 effects in a scene | An eight-hit flurry with hit and sparks per strike uses 16; leave room before adding ambient effects |
| A hung page makes every later call time out | The consumer kills and restarts the MCP server (`mcp.mjs` `kill()`) |

## Checks

- `node frames/gaps.mjs`: every strike's gap at its time; all 20 between -2.4 and -0.4 cm.
- `node frames/through.mjs`: deepest overlap per striking limb over the whole shot;
  -6.5 cm at most, between strikes of the flurry.
- `node contactboard.mjs`: one picture per strike shot with the strike frames
  (`frames/contact3/`); looked at, all touching on screen.
- After the edit: one frame per strike out of the finished film (`frames/chk3/final-hits.jpg`).
- Loudness of the finished film with `zfilm loudness`: -14.8 LUFS, peak -0.6 dBFS.
  Per-section RMS: build -19.6 dB, first drop -9.8, break -18.3, second drop -10.3,
  ending -18.3 (`tools/assemble3.py` prints the music plan; `frames/assemble3/timeline.json`).

## Not checked

- Nobody has listened to the cut track: whether the splices are heard, and whether
  the music fits, are for a person to judge.
- Contact uses spheres: a fist on a stick-thin forearm can look a few millimetres
  off; the mesh was never tested against itself.
- Only the stickman rig. A rig with fingers, a weapon or a long-limbed character
  needs its own part table.
- Only two fighters, facing along Z. Fights that circle, or three people, were not
  done.
- Clips from motion capture were not tried.
- No phone, no game: the fight exists only as a rendered film.

## Boundaries

The clips, the strike table, the contact measurement and the edit stay in the
consumer. The engine owns the film format and tools, the stickman builder (its clip,
body and mouth switches belong in the engine once committed), and would own a
contact query if one were added.
