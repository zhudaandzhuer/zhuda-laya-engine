# Route: an animated title screen from one flat key art

A title screen made from one generated key art (two characters, a prize between them, a room
behind) that fits every screen shape and moves: the picture is split into layers — an empty room,
each character, the prize — placed in a unit that keeps the picture's proportions, with a short
entrance (room fades in, characters slide in, logo drops, prize pops, button rises) and idle loops
(a fighting-stance bounce, a lean now and then, wind circling each character, dust at the feet, a
floating prize with turning rays, sparkles, specks of light, a little mouse parallax). Pure DOM and
CSS animation over the engine canvas; no new character drawn. Checked in headless Chrome; no real
phone.

- **Id:** `key-art-to-animated-title`
- **Kind:** workflow
- **For:** Turning a flat key art into a layered title screen that fits 4:3 to ultra-wide and moves: cutting the characters out, an empty background plate, placing the layers, entrance and idle animation
- **Checked on:** desktop headless Chrome (frame strip at fixed animation times; twelve window shapes); no real phone
- **Status:** Done on 2026-11-26 in Zhuda Whirlwind 1 (豬大旋風1): layers built by `tools/make-title-layers.py`, `tools/check-fit.mjs` FIT OK on twelve views, a 12-frame strip of the entrance and loops looked at; published the same day (front end `20261126T032954126397Z`), the fit check passing against the public page
- **Reference consumer:** ZhudaGameCenter `games/zhuda-whirlwind-1` (outside this repository): `tools/lift-subjects.swift`, `tools/make-title-layers.py`, `design/title/` (the plate and its prompt), `public/index.html` (`#screen-title .t-scene`), `public/game.css` (title scene and `@keyframes t…`), `src/ui/screens.ts` (mouse parallax)
- **Engine version:** zhuda-laya-engine 2.0.0 (`91d21f79`, LayaAir 3.4.2)

## When to take this route

A title or menu backdrop that came as one flat picture (from `winbdl img`, Flow, an artist) and
has to work at shapes other than its own, or has to move. Take
[screen-fit-game-box](screen-fit-game-box.md) first: the layers are placed inside its box. Not for
a character that must act (walk, attack): that needs real poses — [pose-atlas-motion](pose-atlas-motion.md)
or [spine-character](spine-character.md). Not for a title drawn on the canvas.

## Tools

- **Apple Vision** `VNGenerateForegroundInstanceMaskRequest` (macOS 14+; run with the Command
  Line Tools' `swift`, 6.4.2 on macOS 27.2): offline, one RGBA cut-out and one soft mask per
  subject. `tools/lift-subjects.swift <image> <outdir>`.
- **An empty plate**: an image model that edits with a reference. Used: Qwen-Image 2.1 turbo on
  the workspace's Windows host (`winbdl qimage`, local GPU, no paid quota), 8 steps, 1664×928,
  42 s and 20 s for two seeds. The prompt and settings are kept beside the plate
  (`design/title/plate.json`).
- Python 3 with Pillow (WebP) and NumPy for `tools/make-title-layers.py`.
- The engine's headless Chrome host for screenshots (`tools/play.mjs`, `tools/check-fit.mjs`).

## Steps

1. **Cut the characters out.** `swift tools/lift-subjects.swift key-art.png lift/` → two
   instances for two pigs, clean edges including hooves and ribbons; the wind lines and dust
   painted around them stay behind (they become animation instead). Sort the instances by their
   left edge to name them.
2. **Make the empty room.** Edit the key art with the prompt "Remove both pigs, the glowing
   tangerine with its light rays and sparkles, the swirling wind lines and the dust clouds. Show
   only the empty cozy living room behind them: …(name what is in the room)… The room is empty"
   plus "same style, same colours, same camera and composition", negative "pig, animal,
   character, tangerine, glow, light rays, sparkles, text". Two seeds; both came back empty and in
   place, the closer one kept. Blur it a little (Gaussian 1.4 px) to match the key art's soft
   room, so the cut-outs stand in front of it.
3. **A clean prize.** The fruit in the key art is small and glowing; the effects sheet had a
   bigger one with rays and a dust puff. Put the cell on white, lift it (one instance: fruit, stem
   and leaf), then keep the sheet's own pixels under that mask (`min(alpha, mask)`) so no white
   fringe comes along.
4. **Build and measure.** `python3 tools/make-title-layers.py` writes `title-bg.jpg` (87 KB),
   `title-zhuda.webp` (71 KB), `title-zhuer.webp` (60 KB), `title-tangerine.webp` (15 KB) — 233 KB
   against 140 KB for the flat JPEG — and prints each cut-out's place in title units: the key art
   is 128 × 72 units, e.g. `zhuda: left −58.64u from the centre, bottom 5.28u, width 46.39u`.
5. **Place the layers.** The key-art frame (128 × 72 `--u`) is centred and stands on the bottom of
   the box: `.t-pig.zhuda { left: 50%; margin-left: calc(-58.64 * var(--u)); bottom: calc(5.28 *
   var(--u)); width: calc(46.39 * var(--u)) }`. The room is `cover` with `center bottom`. A wide
   box then shows more room at the sides, a 4:3 box more wall above (where the logo, sized in
   `rem`, has room to be larger). The prize was moved from the floor to float between the
   characters' fists (`top: 100% − 72u + 35u`), so the start button below it no longer covers it.
6. **One wrapper per kind of motion.** CSS animations on one element fight over `transform`.
   Whirlwind's pig is `.t-pig` (place + parallax, a transition) › `.t-in` (entrance) › `.t-lean`
   (the lean) › `.t-body` (the bounce, `transform-origin` at the feet) › `img`; the prize is
   `.t-prize` › `.t-pop` › `.t-float`. Where an element already has a transform (the logo's tilt,
   the button's pulse), animate the separate `translate` / `scale` properties instead.
7. **The entrance, once per showing.** A screen shown by removing `hidden` (display none → grid)
   restarts its CSS animations, so the entrance plays every time the title appears. Timings that
   read well: room 0–1.0 s fade and settle; brother 0.10 s, sister 0.22 s, 0.75 s each with an
   overshoot `cubic-bezier(0.2, 1.25, 0.4, 1)`; logo drop 0.40 s with a squash; subtitle 0.85 s;
   prize 0.85 s pop; button 1.1 s; the line under it 1.3 s. Everything is in place by 1.6 s.
8. **The idle loops.** Bounce 0.9 s / 0.82 s (squash 1.012 × 0.982 to stretch 0.992 × 1.012 and
   1.2 % up), so the two never sync; a lean toward the other one every 3.6 s / 4.3 s (4°, a few
   per cent sideways, held 12 % of the cycle). Wind: an SVG of two ellipses at the waist with
   `pathLength="240"` and a dash pattern that sums to 240, `stroke-dashoffset` animated to −240 —
   the dashes run round with no jump at the seam; one copy behind the character clipped to the
   top half, one in front clipped to the bottom half. Dust: three soft ovals at the feet, 1.8 s,
   staggered. Prize: float 2.2 s with a slight turn, a `repeating-conic-gradient` of rays masked to
   a disc turning in 14 s, a radial glow breathing, four CSS-clipped sparkles twinkling. Specks of
   light: eight dots rising through the room over 9–13 s.
9. **Parallax with a mouse only.** On `pointermove` with `pointerType === 'mouse'`, set `--mx` /
   `--my` (−1…1) on the title; each layer translates by its own depth (room −0.6u, pigs 0.9–1.1u,
   prize 1.4u) with a 0.5 s transition. Touch never moves it.
10. **Reduced motion.** Under `prefers-reduced-motion: reduce` every title animation and
    transition is off and the dust, sparkles and specks are hidden; the final layout shows at once.
11. **Check frame by frame.** In the page, `document.getAnimations().forEach(a => { a.pause();
    a.currentTime = t })` for t = 0, 150, 300 … 5000 ms and a screenshot each gives a strip that is
    the same on every run (`tools/play.mjs` steps). Then `tools/check-fit.mjs` for the layout.

## Pitfalls

- **A background image on a hidden screen is not loaded until it shows.** The room is a CSS
  background of a screen that is `display: none` while loading, so it would arrive after the
  entrance had started. `<link rel="preload" as="image" href="assets/ui/title-bg.jpg">` (the
  letterbox bars use the same file).
- **The Windows job said "interrupted" but both pictures were done.** The control kit's job
  status has a race (see the `zhuda-windows` skill); the run folder had both PNGs. `winbdl qimage
  collect <batch> --run-id <id> --out <dir>` fetched them. Look at the run folder before running
  again.
- **The first idea, a flat picture with effects over it, cannot fit shapes or move people.**
  Splitting costs one image edit and a Swift call and gives both.

## Engine gaps and their workarounds

None; the title is DOM over the canvas.

## Checks

- A 12-frame strip at 1280×720 (0 ms to 5 s): empty room, the brother arriving, both in, the
  logo falling, the subtitle, the prize with rays, the button, then idle frames with the wind,
  sparkles and different bounce phases. Looked at on 2026-11-26.
- `node tools/check-fit.mjs`: in all twelve views the two pigs, the prize, the logo, the start
  button and its line are inside the box, the button does not touch the prize and the logo covers
  under 8 % of it.

## Not checked

- Frame rate on a real phone (the loops animate `transform` and `opacity`, the wind animates an
  SVG dash with a small drop shadow; not profiled).
- Safari's handling of the individual `translate` / `scale` properties below iOS 14.5 (they are
  ignored there: no logo bob, the button appears without rising).

## Boundaries

The cut-outs, the plate, the prompts, the positions and the motion are the game's content and stay
in the game. The engine is not involved. The cut-out tool is a dozen lines of Swift; a second game
that needs it can copy it or the workspace can make it a shared tool.
