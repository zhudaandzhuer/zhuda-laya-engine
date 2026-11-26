# Verification record: distance-bricks (AG4)

Task document: `docs/plans/records/distance-bricks/task.md`\
Commit: the commit that adds this file, on top of the merge after `98e93f0`\
Date: 2026-11-17

## Environment

- macOS 27.0.1, Apple M4; Node 26.12.0, npm 11.20.0. Pure data: no browser
  or GPU involved.
- Evidence (outside the repository): `EV` =
  `<workspace>/audits/distance-bricks-2026-11-17/`
  (`unit.log`, `verify.log`).

## Checks

| Check                                     | Exact command or procedure                                 | Result           | Artifact        |
| ----------------------------------------- | ---------------------------------------------------------- | ---------------- | --------------- |
| Build, types, declarations, doctor, tests | `npm run verify`                                           | PASS, 911 of 911 | `EV/verify.log` |
| Lint, format, whitespace                  | `npm run lint`, `npm run format:check`, `git diff --check` | PASS             | —               |
| Fixtures                                  | `node --test tests/distance-bricks.test.mjs`               | PASS, 8          | `EV/unit.log`   |

## What the fixtures show

- A sphere of radius 2 m in an 8 m box, 0.1 m apart, band 0.5 m: over
  20 000 deterministic points, distances within 0.45 m of the surface are
  within one byte step (0.0039 m) plus 0.004 m of the exact ones; farther
  ones read exactly ±0.5 with the right sign; deep inside -0.5; outside the
  region 0.5. Normals within 3° of radial.
- Rays: a ray meets the sphere within 0.01 m of where it should, a ray over
  it and one stopped short miss, one from inside meets it at 0, one from
  outside the region is followed from where it enters, one leaving the
  region misses.
- An arch (two pillars and a lintel, exact boxes; opening 1.2 m by 1.5 m),
  0.05 m apart, band 1 m: a sphere of radius 0.4 sweeps through the opening
  untouched; one of 0.7 stops where it touches the opening's edges (within
  0.02 m of the exact contact), pushed back; a sweep through the solid part
  stops one radius in front of the face.
- A slide written in the test, as a game would write it (move to the
  contact, then spend the rest of the move along the surface): it ends in
  front of the face, moved along it, never inside.
- `resolveCameraBoom` through `ZhudaSceneQueries` with the bricks' provider
  stops the camera in front of a rock and is unblocked once the provider is
  removed; `sweepSphere` through the queries names the provider.
- Memory: 2 796 of 19 683 bricks kept for the sphere, 257 676 bytes against
  2 205 472 for the same samples as floats; built in about 9 ms. Bricks made
  from a volume of the same field read within 0.01 m of those made from the
  field.

## Found on the way

A fixture arch made as a wall minus an opening (`max(wall, -opening)`)
stopped a small sphere inside the opening: that field says 0.4 m where the
true distance is 0.72 m, and the bricks keep what the field says. The
documentation now says a field must be exact outside or never more than the
true distance, and the fixture uses a union of exact boxes.

## Limits and decision

- No phone timing of a build. No streaming as a camera moves: the consumer
  rebuilds a region.
- A field that overestimates distance would let a ray or sweep pass through
  thin rock; the bricks cannot detect that.

Decision: **Implemented**; pure data, checked by fixtures.
