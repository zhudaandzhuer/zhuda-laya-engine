# Route: a character that moves as smoothly as a commercial game's showcase

What makes a commercial anime-game character showcase look smooth on screen, taken apart
from one reference (a LayaAir IDE project that replays a UE game's character-screen clips
with a C++/WASM port of MagicaCloth 2), measured in the running page, and set against what
this engine does. The result is a checklist for our own characters: where the smoothness
really comes from, in order of weight, and which parts the engine has, lacks or does
differently. Mouse only; desktop Chrome on macOS with WebGL.

- **Id:** `smooth-character-motion`
- **Kind:** workflow
- **For:** Any 3D character that must move smoothly on screen (a showcase, a lobby, a cut-scene or a player character): what the clips must contain, how the rig is built, who owns the animation clock, how secondary motion and props are timed.
- **Checked on:** desktop WebGL (Chrome, macOS arm64); no phone
- **Status:** 2026-11-26: the reference's clips, rigs and cloth settings were read from its
  files; in its running page the cloth's effect on bone positions was measured with the
  shipped settings and with the blend raised to 1. Nothing here was built in this engine yet.
- **Reference consumer:** the folder `陽光需求/SuisuiLaya` on the Desktop of the owner's Mac (outside this
  repository; the characters and clips look third-party, nothing is copied; how to run it:
  [laya-ide-project-cli-web](laya-ide-project-cli-web.md)).
- **Engine version:** zhuda-laya-engine 2.0.0 (`91d21f79`) for the comparison; the
  reference runs on LayaAir 3.4 (built with CLI 3.4.2).

## When to take this route

Before making or importing clips for a character people will watch closely, and when a
character "looks stiff" or "jitters" and the cause is not known. What to do about it, with a
tool that takes these measures on any `.glb` and one that raises a rig and its clips toward
them: [high-quality-character](high-quality-character.md). It does not cover walking
over ground (locomotion blends: [animation control](../animation-control.md)), rigging a
model without a DCC tool (`low-poly-character-from-shapes`, `humanoid-from-shapes`) or
cloth that must not pass through the body (`clip-free-garments`, `layered-cloth-on-body`).

## Tools

- Reading the reference: Python with `struct`/`json` on the `.glb` (accessor times, channel
  paths, interpolation, quaternion dot products), and the prefab `.lh` JSON for the
  cloth documents (`authoringData`).
- In the page: `MagicClothSystem.BeforePhysics` (a hook after the animation, before the
  solver) and a wrapper around `RuntimeSession.NativeRuntime.Step` to compare a bone's
  world position before and after the solver; `GetControl(cloth).ApplyControl({ blendWeight })`.
- In this engine: `ZhudaSpringBones` ([spring bones](../spring-bones.md)),
  [cloth](../cloth.md), `ZhudaAnimationBlend` and `ZhudaModelInspector.crossFade(..., { seconds })`
  ([animation control](../animation-control.md)), `runZhudaAfterAnimation`.

## Steps

What the reference does, most weight first. Each step ends with what this engine has.

1. **The motion is in the clips, not in the solver.** Every clip is a dense bake at 30
   frames a second of every bone (320 on the main character: translation, rotation and
   scale on each), linear interpolation, no key reduction (the imported `.lani` is as large
   as the raw data: 7.07 MB for an 18.7 s clip). Hair (70 of 70 bones), skirt (32 of 32)
   and ribbons (82 of 91) move inside the clips: the overlap and follow-through were
   baked upstream. Loops are long (idle 18.7 s, a second pose 21.3 s), so no short cycle
   repeats, and they close to within 0.25° on every bone (the two idle loops measured here; the
   weapon loop does not: [high-quality-character](high-quality-character.md), Checks). Start, Loop and End are separate
   clips per pose. Check a clip: key spacing, which bone groups move, the first-to-last
   rotation difference of a loop. *Engine:* plays such clips as they are; our own clips
   are made sparse (hand keys in `pig-clips.py`, procedural poses) and carry no
   secondary motion, which the spring bones add afterwards.
2. **The rig carries helper bones, animated every frame.** Of 91 body bones, 32 are
   twist and corrective bones: upper-arm twist ×3, forearm twist ×2, thigh twist ×2,
   calf twist, and front/back bones at shoulders, elbows, hips and knees. Joints keep their
   volume instead of collapsing or twisting like a sweet wrapper. 4 weights a vertex,
   62 k vertices. *Engine:* nothing in the way; our characters (Tripo, Blender scripts,
   shapes) have no twist or corrective bones.
3. **One owner for the clock, one order per frame.** The cloth system sets every
   `Animator.speed` to 0 and, each frame: measures real elapsed time with
   `performance.now()` (clamped to 1/240–1/3 s); puts the cloth bones back to their base
   pose; runs the props hook; advances all animators by exactly that time under a borrowed
   scene timer; then runs the solver on the pose just sampled, and the frame is drawn
   (`LayaClothSystemClock.ts`, `MagicClothSystem.StepNative`). Animation, cloth and props
   never disagree by a frame. Animators use `CULLINGMODE_ALWAYSANIMATE`. *Engine:*
   `runZhudaAfterAnimation` gives the same "after the animation, before the draw" place;
   there is no restore-to-base step (a bone no clip touches keeps last frame's solved
   pose as its start) and no single owner of every animator's time.
4. **Cross-fades in seconds.** 0.18 s between any two clips; LayaAir's `crossFade` takes
   a share of the outgoing clip (`_crossDuration = clip._duration * t`), so the reference
   passes `0.18 / outgoingSeconds`, capped at half the incoming clip. *Engine:* the same
   conversion is `ZhudaModelInspector.crossFade(path, name, { seconds })`, and 2.0.0 fixes
   the glTF cross-fade that blended towards the bind pose (the reference avoids that bug
   only because the IDE imports clips as `.lani`).
5. **Props follow the body's clock, with a tolerance.** The fan, weapon and hand props
   have their own clips of the same length, attached by UE animation-notify windows
   (start/end seconds per body clip, bone name, offset converted from UE centimetres and
   axes) in `ShowcaseRig.ts` and `ShowcaseAccessories.ts`. Each frame the prop's target
   time is computed from the body's; the prop is re-seeked only when it drifts more than
   35–40 ms, otherwise it plays on by itself (no per-frame seek stutter). *Engine:* no
   notify-window or slaved-clip helper; games attach props to bones by hand.
6. **The cloth solver smooths time, and here adds little.** MagicaCloth 2: 90 Hz fixed
   steps, at most 3 a frame, extra steps dropped (time pulled back, no catch-up spiral);
   inside the steps the animated base pose is interpolated by
   `frameInterpolation = (now − frameOldTime) / (time − frameOldTime)`; the displayed
   position is predicted (`old + velocity·dt`) and blended from last frame's display by
   the time ratio, and kept within 1.3× the rest length from its root
   (`ParticleDisplay.SimulationCalcDisplayPosition`). Settings on all 79 cloths: gravity 0,
   `animationPoseRatio` 1 (the clip's pose is the rest shape), update mode
   AnimatorLinkage, damping 0.05–1, world inertia 0.035–0.2 (moving the character barely
   flings the cloth), particle speed limit 4 m/s, angle restoration on a curve, angle
   limits 10–50°. **But the final blend is 0 on
   48 cloths, 0.5 on 30 and 1 on one.** Measured on the main character's hair, skirt and
   ribbon tips over 153 frames: 0.000 cm between the animated and the solved position as
   shipped; with the blend set to 1, 1–4 cm on average and up to 8 cm. So on that
   character only the chest spring (blend 0.5) shows; the smooth hair and skirt are the
   clips of step 1. *Engine:* spring bones step at 1/120 s, at most 8 a call, the root
   moved evenly across the steps (the same as `frameInterpolation`); there is no display
   interpolation between solver states, no `animationPoseRatio` (springs rest on the
   model's pose, not on a clip-driven target) and no per-chain blend weight.
7. **Shading that changes continuously with the head.** Face shadows come from an SDF
   texture read in head space: a script writes the head bone's rotation into the
   renderer's custom data each frame and the shader turns the shadow line with it
   (`CharacterSurface.ts`, `CharacterForward.glsl`). Toon bands are `smoothstep` ramps,
   not steps. A turning head never pops from lit to shadowed. *Engine:* the toon
   material has no head-space face shadow.

## Pitfalls

- **Taking the cloth solver for the source of the smoothness.** It was the first guess
  here too. Measure before copying: hook after the animation and after the solver and
  compare bone positions; read the blend weight.
- **Sparse clips plus physics do not look like dense clips.** Secondary motion that the
  animator shaped (the ribbon lifting on a turn, the skirt settling on a beat) cannot be
  recovered by a generic solver. Ask for, or bake, the hair and cloth bones into the clip.
- **`crossFade` with seconds.** Passing 0.18 to LayaAir fades over 18 % of the outgoing
  clip: 3.4 s from an 18.7 s idle.
- **Quaternion signs in baked data.** The reference's clips have 10–38 key pairs per clip
  with a negative dot product; a player that interpolates them without the shorter-arc
  check spins a bone the long way round. LayaAir handled them here; check any other player.
- **Measuring frame rate in a hidden browser pane.** `requestAnimationFrame` ran about
  once a second there; the numbers mean nothing.

## Engine gaps and their workarounds

| Gap | Workaround now |
| --- | --- |
| No display interpolation for spring bones and cloth (smooth on 60 Hz with 1/120 s steps; uneven step counts on 90/144 Hz screens) | Keep the step a divisor of the screen rate; not planned yet |
| No restore-to-base before the animation for bones a clip does not key | Key every spring bone in the clips (dense bake), or reset chains on clip change |
| No `animationPoseRatio`-style "rest on the clip's pose" and no per-chain blend weight | Tune stiffness to the clip; scale the effect by mixing the solved and the animated rotation in game code |
| No animation-notify windows or slaved prop clips | Compute the prop's time from the body's each frame; re-seek only past a 35–40 ms drift |
| No head-space SDF face shadow in the toon material | None |
| Our rigs have no twist or corrective bones | Add them in the DCC tool before baking clips |

## Checks

- Clip data: key spacing (1/30 s), channels per bone, groups that move, loop seam under
  0.25°, `.lani` size ≈ raw size (no reduction).
- Rig: count twist and corrective bones; vertices and weights per vertex.
- Page: the animated-vs-solved offset per cloth tip with the shipped blend (0.000 cm) and
  with blend 1 (1–4 cm mean, 8 cm max); the cloth reaches its ready state with the WASM
  backend; the character switch keeps working.

## Not checked

Frame pacing on a visible pane or a 120/144 Hz screen; phones; WebGPU; whether LayaAir
evaluates the linear keys with tangents or plain lerp; how the reference's clips were made
upstream (physics bake or hand keys); any of the engine gaps above implemented.

## Boundaries

Nothing from the reference enters this repository: its models, clips, shaders and the
cloth port are third-party. The engine gaps above, if taken up, are engine work with
tests; the clip and rig requirements belong to each game's asset pipeline.
