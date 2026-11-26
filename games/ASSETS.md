# Where the games' art comes from

The engine's MIT licence covers the code in this repository. **The licence of the art listed here
has not been stated by the owner; until it is, treat it as included for running these games, not
as free to reuse.** What is written below is what the source repository recorded; it was not
re-checked when the files were copied here.

| Files | What | How it was made |
| --- | --- | --- |
| `shared-assets/models/zhuda.glb` | 豬大, the owner's character, rigged, with walk, run, idle and sit clips | Recorded in the owner's verification repository as a rigged GLB from 時空 3D, with the face reshaped by a script there |
| `shared-assets/models/{taotie,qiongqi,xingtian}-lod50.glb`, `{zheng,jiuweihu,kui,xuanwu}-lod25.glb` | Seven beasts from the 山海經, rigged and animated, at half and quarter triangle counts | Built by scripts in the owner's verification repository: bodies from the engine's SDF field, skinned, textured from the tiles below, reduced with meshoptimizer. See the route `rigged-phone-character` |
| `shared-assets/textures/<name>/{albedo,normal}-512.png` (13 materials) | Seamless ground, rock, wood and wall tiles | Generated on 2026-11-21 with an image model (recorded there as gpt-image-2.6-flare), then made seamless and given normal maps by script |
| `zhuda-idle/assets/heroes/*.png`, `zhuda-merge/assets/heroes/*.png` | Eleven hero portraits, 256 px | Reduced from portraits of original characters made for the owner's game 九野印契 (not in this repository) |
| `zhuda-idle/assets/enemies/*.png`, beast tokens in `zhuda-swarm/assets/atlas.png` | Beast pictures | Cropped from renders of the models above |
| `zhuda-swarm/assets/atlas.png` (everything else), `zhuda-jump/assets/*.png` | 豬大 as a round token, gems, shots, coins | Drawn by `zhuda-swarm/tools/make-atlas.py`; the platformer cuts three of them out |
| `zhuda-merge/assets/items.png`, `zhuda-match/assets/items.png` | Food and fruit pictures | Emoji drawn into an atlas from the Noto Color Emoji font (SIL Open Font License 1.1) by each game's `tools/make-items.py` |
| `zhuda-wardrobe/assets/parts/*.glb` | A body in ten regions, three hairstyles, 21 garments, four pairs of shoes, a hat, a pack and a belt | Built in this repository by `zhuda-wardrobe/tools/build-parts.mjs` from the shapes in `tools/defs.mjs` with the kit under `tools/characters/`; no outside source |
| `zhuda-wardrobe/assets/parts/knit.glb` | A striped knitted top | Written by `zhuda-wardrobe/tools/foreign-part.py`: the body's own surface pushed out, the body's weights carried over, a texture drawn by the script; no outside source |
| Sound | Every sound and both songs | None is a file: synthesised in the page from engine synth recipes |

`zhuda-hunt` and `zhuda-guard` copy what they need from `shared-assets/` into their own git-ignored
`assets/` when they build (`tools/sync-assets.mjs`).
