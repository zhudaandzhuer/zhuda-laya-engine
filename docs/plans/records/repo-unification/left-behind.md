# Left behind: what the one branch does not carry

Written on 2026-11-26 on the owner's Mac, when the owner asked for one branch with `unified` as
the main one and what is not needed removed. `unified` is that branch. The two other branches of
the verification repository are **not merged into it**: this page says what is on them, why it
stays out, and where it is, so that removing them loses nothing by accident. What was then done
with them, on the owner's word the same day, is at the end.

## The branches

| Branch (verification repository) | Tip | Tracked size | What it is |
| --- | --- | --- | --- |
| `unified` | this branch | about 80 MB | the engine with its whole history, routes, nine reference games, the character kit, the local-machine results |
| `claude/zhuda-engine-review-scenes-w8btzs` | `a32a7c7a` | about 4 GB | the outside review of the engine: eleven scenes, fifteen characters, their deliverables, three larger games, the review's working files |
| `claude/xianxia-select-stage` | `760e2c0f` | the above plus 25 MB | the same history plus one more game, a character-select stage (問道台) |

`unified` shares no history with the other two: it is the engine's history plus commits, and what
came from the review was copied in (see [task](task.md) and [verification](verification.md)).

## What came across on 2026-11-26

- `LOCAL-REQUESTS.md` (the list of what the cloud sessions need from a local machine), with the
  answers under [`local-results/`](../../../../local-results/README.md).
- Nothing else. Everything the reference games, the routes and the engine needed had come across
  on 2026-11-25.

## What stays out, and why

| On the old branches | Tracked size | Why it is not on `unified` |
| --- | --- | --- |
| `deliverables/` (the review's report, models, renders, engine patches 01 to 12) | 2.7 GB | Evidence of a finished review. The engine's records name it by commit (`3c182f0`, `fc89029`); patches 01 to 12 are commits of the engine. Too large for a repository every consumer clones. |
| `epic-scenes/` (eleven film scenes, their pack and tools) | 715 MB | The reference consumer of `film-as-data`, `outdoor-landscape` and `rigged-phone-character`. Those routes say it is not published. Its art has no stated licence. |
| `games/jiuye-seal-pact` (九野印契) | 169 MB | A game made to ship, with eleven characters' art. `games/` here holds small test consumers. **It has not been through the game centre's `game-to-prefabs` route**: its reusable parts are not in `commonPrefabs/`. Do not delete the only copy before that. |
| `games/zhuda-sightseeing` (看風景) | 47 MB | The same: a larger game with its own scene art, not taken apart into shared parts. |
| `games/ashfall-duel` (灰燼之庭) | 11 MB | An older copy. The game was taken apart on 2026-11-25 into `commonPrefabs/2d/ashfall-duel` in the game centre, which also holds its full history as a bundle. This copy is not needed. |
| `games/xianxia-select` (問道台, on its own branch) | 25 MB | Depends on the eleven characters of 九野印契 (repacked at build time, 32 MB, not tracked) and on the scenes' pack. It cannot be built from `unified`. |
| `games/zhuda-*` (eight) and `routes-draft/` | 5 MB | Already here: `games/` and `docs/routes/`. The copies on the old branch are older. |
| `textures/` (48 tiling materials) | 150 MB | The game centre's `commonAssets/` holds the same library and is where scenes take it from. |
| `review-work/`, `research/`, `tools/` | 198 MB | The review's working files and its container tooling (patched-engine set-up, LOD and texture tools for the fifteen characters). Not used by anything here. |
| `ENGINE-REQUESTS*.md`, `ENGINE-REPLY.md` | small | Answered. What was still open is in `HANDOFF.md` under "Repository unification". |
| `HANDOFF.md` (981 lines, fourteen rounds) | small | The review's own handoff. Rounds 11 to 14 are summarised in this repository's `HANDOFF.md`; rounds 1 to 10 are about what stays out. |

## Only on the owner's Mac (not on any branch)

In the checkout of the review branch, `ZhudaGameCenter/audits/VerifyZhuda/`, ignored by git:

- `textures/raw/` (102 MB): the generated source pictures of the 48 materials.
- `games/jiuye-seal-pact/assets/models/` (39 MB) and `assets/portraits/` (1.5 MB).
- `games/zhuda-sightseeing/assets/scene/` (27 MB).
- `review-work/main-verification/out/mac-2026-11-20/`: outputs of a run on the Mac.
- `node_modules/` and `dist/` of the scenes and the three games.

Switching that checkout to another branch or deleting it would lose these. It was left exactly as
it was; `unified` is checked out beside it as a second working tree
(`ZhudaGameCenter/audits/VerifyZhuda-unified/`).

## What was done with the old branches (2026-11-26, on the owner's word)

1. `unified` was pushed to the verification repository.
2. Both tips were tagged and the tags pushed, so the review stays reachable by the commits the
   engine's records name: `archive/review-scenes-2026-11-25` is `a32a7c7a`,
   `archive/xianxia-select-2026-11-25` is `760e2c0f`.
3. `claude/xianxia-select-stage` was deleted, after its tip on GitHub was read again and matched
   its tag.

Not done, and why. **Later the same day the owner put both of these off** ("先不去動舊的", recorded
by the cloud session at the top of `HANDOFF.md`): `unified` is the branch in use, and the review
branch stays where it is, still the default, until the owner says otherwise. The cloud session
could not change the default either (its proxy refuses repository-settings writes).

- **`unified` is not yet the default branch on GitHub.** The account signed in on the Mac
  (`zhudaandzhuer`) may push to the repository but not administer it; the change needs the
  repository's owner account (Settings, General, Default branch).
- **`claude/zhuda-engine-review-scenes-w8btzs` is still there**, because GitHub does not delete a
  default branch. Once the default is `unified`:
  `git push origin --delete claude/zhuda-engine-review-scenes-w8btzs`. `a32a7c7a` is tagged, so
  this loses nothing on GitHub. The branch has one commit after the tag (`413834ee`): a note at
  the top of its `HANDOFF.md` and `README.md` that says the branch is archived and gives these
  steps to the session that holds the owner's account. The steps and their checks are also at
  the top of this repository's `HANDOFF.md`.

The checkout of the review branch on the Mac (`ZhudaGameCenter/audits/VerifyZhuda/`) was not
touched and still holds the files that are on no branch (listed above). 九野印契 and 看風景 are
now reachable on GitHub only through the first tag, and still have not been through
`game-to-prefabs`. Whether the repository should keep 4 GB of archive at all, or the archive
should live elsewhere, is for the owner.
