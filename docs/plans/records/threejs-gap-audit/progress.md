# three.js gap plan: progress

Plan: `docs/plans/records/threejs-gap-audit/plan.md` (work packages WP0..WP16)\
Last updated: 2026-11-14

## Where each package stands

| Package | State | Where |
| --- | --- | --- |
| WP0 housekeeping | Merged, reviewed, review points closed | `main`; record `topology-globals-and-guardrail` |
| WP14 small game services | Merged, reviewed (five minor points open, listed in its record) | `main`; record `game-services` |
| WP1 shadow caching, render scale, upscale + sharpen | Built and committed; review not finished; not merged; not measured on a phone | branch `worktree-wf_86719f89-cb4-6` (`e6badce`) |
| WP2 specular anti-aliasing | Built and committed; review not finished; not merged | branch `worktree-wf_86719f89-cb4-2` (`7eb53c2`) |
| WP4 glTF intake quick wins | Built and committed (quantization, KHR meshopt, WebP/AVIF, lights, cameras; GPU instancing and texCoord 1 not done); review not finished; not merged | branch `worktree-wf_86719f89-cb4-3` (`ec1add9`) |
| WP7 physical material authoring | Built and committed; reviewed: one major problem (texture slot combinations the validator accepts but that cannot draw: the sampler limit) and six minor; fix not finished; not merged | branch `worktree-wf_86719f89-cb4-4` (`8f437ad`) |
| WP3, WP5, WP6, WP8..WP13, WP15, WP16 | Not started | |

Branches 2, 3 and 4 start from `9c91a26`, branch 6 from `09a840c`; `main` has
moved on since (one-pass edge smoothing, the level-of-detail reach, WP0,
WP14), so each needs a merge and a full run of the gates and of its GPU
checks on both backends before it counts.

## How the batch is run

A workflow (`threejs-gaps-batch-1`, run `wf_86719f89-cb4`) builds each
package in its own git worktree under `.claude/worktrees/wf_86719f89-cb4-N`,
has a second agent review it adversarially, and a third fix what the review
found. It was cut short twice by a usage limit and once by the session
ending; finished agents are cached, so resuming reruns only what is missing.
If the workflow cannot be resumed, the branches above hold all the work:
review each diff against its base by hand, then merge.

## After the batch

1. Merge WP2, WP4, WP7, WP1 in that order (WP1 last: it touches the look and
   the governor, where `main` changed most). Gates and GPU checks after each.
2. Measure WP1 on the vivo V40 (interval shadows; render scale 0.67 with the
   sharpen pass) with `films/compare-three/tools/phone-probe.mjs` and
   `phone-profile.mjs`, and add the numbers to `records/phone-cost`.
3. Batch 2 from the plan's order: WP3 (shader warm-up), WP5 (KTX2/Basis),
   WP6 (environment lighting), WP8 (toon, matcap, selection outline).

## Open from before the audit

- On the vivo V40 the game's governor settles at look level 0; a higher
  level costs 24..64 ms a frame there (`records/phone-cost/verification.md`).
- Nothing after `9c91a26` is pushed.
