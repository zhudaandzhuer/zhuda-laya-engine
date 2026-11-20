# Route: a WeChat, Douyin or other mini-game build without the IDE

A game project packaged for a mini-game host by driving the installed LayaAir 3.4.2
command line tool from the project: the game's bundle, the official platform
adapter, pinned libraries and a size gate, written only when every check passes.
Builds are checked on macOS; running in a host is the game's own acceptance.

- **Id:** `mini-game-build`
- **Kind:** workflow
- **For:** Packaging a game for WeChat, Douyin (ByteDance), OPPO, vivo, Xiaomi, Alipay, Taobao, Bilibili or Huawei mini-game hosts from the command line.
- **Checked on:** macOS (static builds of every registered target); no host, no device
- **Status:** `npm run verify:minigame` builds every registered target, the browser
  build, strict types and the Doctor, and checks that a failed build leaves the
  previous output, on macOS. No host ran a package in these checks.
- **Reference consumer:** the project `zhuda-laya-init --template minigame` writes.
- **Engine version:** 1.18.0 (this checkout); LayaAir command line 3.4.2 exactly.

## When to take this route

After [new-game-project](new-game-project.md), when the game must run in a
mini-game host. Not for a browser game and not for WebGPU.

## Tools

- LayaAir 3.4.2 command line installed at `~/.layaair/3.4.2` (or
  `--toolchain <path>`); another version is refused.
- `zhuda-laya-minigame` (`npm run platforms`, `npm run build:minigame`).
- The host's own developer tool for preview, upload and device runs.

## Steps

The guide is [mini-game packaging](../minigame-packaging.md).

1. **Create the project** with
   `node packages/compiler/zhuda-init.mjs /absolute/path/to/game --template minigame`,
   then `npm install`.
2. **List the targets** the installed tool registers: `npm run platforms`
   (`wxgame`, `bytedancegame`, `oppogame`, `vivogame`, `xmgame`, `alipaygame`,
   `tbgame`, `bilibili`, `huawei`).
3. **Configure** `zhuda.config.json`: `renderer: "webgl"`, `features`, and under
   `minigame` the size gate (`maxMainPackageBytes`), the timeout and each target's
   `appid` or `package`. Set the host's real quota before release.
4. **Build one target**: `npm run build:minigame -- --platform wxgame`. Output:
   `dist/minigames/<target>/game/` with `game.zip`. `--candidate` stages a
   comparison and leaves the published build alone.
5. **Run it in the host's tool and on devices**, sign and upload: the game's own
   work, recorded as its own evidence.

## Pitfalls

- **A wrong toolchain version** is rejected: the tool's identity (name, version,
  SHA-256 of three files) is recorded in `consumer-build.json`.
- **The default size gate is not the host's quota.**
- **Browser APIs in game code**: DOM, pointer events and browser audio providers
  are refused for a mini-game until that host has an adapter and a report.
- **Syntax too new for a host**: lower the bundle where the host's JavaScript
  engine needs it (one WeChat game of the owner's lowers its bundle to ES2017; not
  checked here).
- **A static build is not a run**: it claims nothing about the host or a device.

## Engine gaps and their workarounds

- No automatic subpackages and no remote main package.
- No WebGPU and no WASM physics in a mini-game.
- Kuaishou is not a target: LayaAir 3.4.2 registers none.

## Checks

`npm run verify:minigame` in the engine; in the game `npm run verify` and the
target build. A host run and a device run are recorded by the game.

## Not checked

No package was run in a host or on a device by this route; signing, app ids and
store upload are untested here.

## Boundaries

App ids, signing, store listings, host execution and device acceptance belong to the
game and the platform. The engine drives the vendor's tool and checks the payload.
