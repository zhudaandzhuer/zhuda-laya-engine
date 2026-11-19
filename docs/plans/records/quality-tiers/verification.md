# Verification record: frame-rate tiers, measured

Task document: [task](task.md)\
Commit: the one that carries this record, on `01b8e8a`\
Date: 2026-11-20

## Environment

- This Mac: Apple M4, macOS (Darwin 27.2), Chrome 157 headless, 1920 by 1080,
  device pixel ratio 1. Node 26.13.1.
- vivo V40 (V2348): Android 16, Chrome 157.0.8103.78, through its debugging
  port over USB; 823 by 1749 backing pixels (411 by 818 CSS, ratio 2.625,
  capped at 2).
- iPhone 14: iOS 27.2.1, Safari, WebGL over plain HTTP on the local network;
  780 by 1478 backing pixels (390 by 699 CSS, ratio 3, capped at 2).
- Engine `01b8e8a`. Reports (outside this repository):
  `ZhudaGameCenter/audits/quality-tiers-2026-11-20/`.

## Checks

| Check                    | Exact command or procedure                                                   | Result                |
| ------------------------ | ---------------------------------------------------------------------------- | --------------------- |
| Tool, this Mac, WebGL    | `node scripts/measure-quality-tiers.mjs <out>`                               | PASS, table below     |
| Tool, this Mac, WebGPU   | `TIERS_RENDERER=webgpu node scripts/measure-quality-tiers.mjs <out>`         | PASS                  |
| Tool, V40, WebGL, WebGPU | the same with `ZHUDA_PHONE_CHROME=http://127.0.0.1:9333`                     | PASS                  |
| Tool, iPhone 14, WebGL   | `TIERS_LAN=<address> node scripts/measure-quality-tiers.mjs <out>`, the printed address opened in Safari | PASS |
| Tool, iPhone 14, WebGPU  | not run: WebGPU needs HTTPS there                                            | UNAVAILABLE           |
| Verify, lint, format     | `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check` | PASS, 937 tests       |

## Numbers

Frames a second, `street` / `wide`. One run each unless said; see the limits.

Look levels at full size, a node for each house:

| Level | Mac WebGL | Mac WebGPU | V40 WebGL | V40 WebGPU | iPhone WebGL |
| ----- | --------- | ---------- | --------- | ---------- | ------------ |
| 3     | 38 / 49   | 49 / 58    | 18 / 27   | 16 / 21    | 25 / 25      |
| 2     | 57 / 60   | 60 / 60    | 24 / 37   | 23 / 27    | 30 / 25      |
| 1     | 60 / 60   | 60 / 60    | 38 / 50   | 37 / 43    | 32 / 36      |
| 0     | 60 / 60   | 60 / 60    | 60 / 60   | 60 / 60    | 54 / 60      |

Look levels at render scales, WebGL:

| Step       | V40, a node each | iPhone, a node each | iPhone, instanced |
| ---------- | ---------------- | ------------------- | ----------------- |
| 1 at 1     | 39 / 52          | 20 / 33             | 43 / 47           |
| 1 at 0.85  | 45 / 59          | 32 / 30             | not run           |
| 1 at 0.7   | 56 / 60          | 31 / 35             | 45 / 49           |
| 1 at 0.5   | 60 / 60          | 41 / 38             | 54 / 52           |
| 2 at 0.7   | 45 / 56          | 22 / 27             | 33 / 40           |
| 2 at 0.5   | 60 / 60          | 36 / 32             | 45 / 51           |
| 3 at 0.5   | 49 / 60          | 25 / 29             | 41 / 42           |
| 0 at 1     | 60 / 60          | 53 / 60             | 57 / 60           |

On the Mac level 3 at 0.85 gave 60 / 60.

Where the time goes, level 1 at 0.7 from the street, two rounds each
(frames a second; milliseconds the page spent issuing a frame):

| Variant                               | iPhone, a node each | iPhone, instanced | V40, a node each |
| ------------------------------------- | ------------------- | ----------------- | ---------------- |
| full                                  | 37..39; 10.4..12.3  | 45; 3.9..4.1      | 57; 7.4          |
| no shadows                            | 39..46; 8.0..8.3    | 53; 3.2           | 60; 5.0          |
| bare HDR chain                        | 40..44; 10.4        | 53..54; 4.1..4.2  | 60; 6.2          |
| no HDR chain (shadows only)           | 48..50; 7.5..7.6    | 55; 3.5           | 60; 3.9          |
| none of them                          | 60; 3.8..3.9        | 60; 2.2..2.7      | 60; 2.4          |
| full, the town hidden                 | 35..50; 3.1         | 47..49; 2.8       | 59; 2.5          |

The V40's column is one round.

## What the numbers say

- On the V40 the picture's size decides: a smaller render scale brings every
  level up. Level 1 at 0.7 is inside 45 to 60, level 2 at 0.5 is at 60 with
  the HDR chain, fog and bloom still on.
- On the iPhone the number of draws decides. With a node for each house the
  page spends 10 to 15 ms a frame issuing them (the Mac 2.6, the V40 7.4)
  and a smaller picture changes little. With the houses instanced (83 groups)
  that is about 4 ms and level 1 at 0.7 reaches 45 to 49.
- Not explained: on the iPhone, with the houses instanced or hidden, any
  pass drawn into a target of its own (the shadow maps alone, or the HDR
  chain alone) takes the rate under 60, though the same frames drawn back to
  back take 7 to 10 ms. Removing any one effect gains 2 to 8 frames a second.

## Limits and decision

- One scene, synthetic and light in geometry; a game's will be heavier.
- One run a setting, apart from the profile's two rounds. On the Mac the same
  step read 38 and 51 frames a second in two runs; the iPhone's first table
  is not monotonic in render scale.
- The Mac is headless Chrome: no display paces it.
- The first tables (levels at full size) were measured before the issuing
  time was added to the tool; the frame rates are measured the same way.
- The instanced town was not measured on the V40; WebGPU not on the iPhone.
- No tier is met on all three devices: at 60 the iPhone's street view reads
  54 to 57 at level 0.
- No picture was judged: the tool measures rate, not how a step looks.

Decision: **In progress**. The tool is in; the tiers are not defined.
