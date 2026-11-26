# Official mini-game packaging without the IDE

The engine can drive the installed LayaAir **3.4.2** command line tool from a
consumer checkout. It uses the vendor's public `BuildTask` API, keeps the
consumer bundle and the official platform adapter, and writes a staged output
only after the build and payload checks pass.

## Start a consumer

```sh
node packages/compiler/zhuda-init.mjs /absolute/path/to/game --template minigame
cd /absolute/path/to/game
npm install
npm run platforms
npm run build:minigame -- --platform wxgame
```

The CLI resolves `~/.layaair/3.4.2` by default. Use
`--toolchain /path/to/layaair/3.4.2` for another installation. The package name,
version and SHA-256 identity of `package.json`, `cli-main.js` and `cli-scene.js`
are recorded in `consumer-build.json`; another version is rejected.

Supported registered targets in the official 3.4.2 installation are
`wxgame`, `bytedancegame`, `oppogame`, `vivogame`, `xmgame`, `alipaygame`,
`tbgame`, `bilibili` and `huawei`. The list is discovered from the installed
CLI. Kuaishou is not included because 3.4.2 does not register an official
Kuaishou target.

Each target is built in a private staging directory. The generated
`dist/minigames/<target>/game/` contains the platform scaffold, the official
adapter, pinned Laya libraries, the Zhuda entry, notices and `game.zip`.
Quick-game RPK files are retained under the vendor scaffold when produced.
Signing, app IDs, store upload, host execution and device acceptance remain
consumer/platform work and are recorded as separate evidence.

## Configuration and boundaries

`zhuda.config.json` owns the target settings:

```json
{
  "renderer": "webgl",
  "features": ["core", "3d"],
  "minigame": {
    "maxMainPackageBytes": 8388608,
    "syntaxTarget": "es2017",
    "orientation": "landscape",
    "timeoutMs": 180000,
    "targets": {
      "wxgame": { "appid": "your-consumer-appid" },
      "oppogame": { "package": "com.example.game" }
    }
  }
}
```

`syntaxTarget` is what the scripts are lowered to: `es2017`, `es2018`, `es2019` or `es2020`
(default). Some hosts' JavaScript engines stop at ES2017; the engine itself does not lower below
that. The game's bundle is first built as the web build is (`es2020`) and compared with the gated
`app.js`, then lowered; what has no older form (a BigInt literal, for one) is refused with
`MINIGAME_SYNTAX` and where it is, never passed on. An export through the official toolchain at
each of the four targets was read back with a parser at that year: every script of the package,
the LayaAir libraries included, kept to it (macOS, `wxgame`, 2026-11-26). `orientation` (`portrait` or `landscape`) is written into the exported `game.json` as
`deviceOrientation`. For the targets whose package the official tool packs and signs itself
(`oppogame`, `vivogame`, `xmgame`, `huawei`) it is refused with `MINIGAME_ORIENTATION`: set it in
that platform's own manifest. Neither has been run in a host or on a device.

The default size is a bounded gate, not a universal vendor quota; set the
target's actual quota before release. Automatic subpackages, remote main
packages, WebGPU, WASM physics, browser DOM/pointer APIs and browser audio
providers are rejected until that host contract has an explicit adapter and
acceptance report. A successful static build never claims platform runtime or
device support.

Use `--candidate` to stage a comparison under `dist/minigames/candidate/`.
The previous published target remains intact when compilation, vendor tooling,
evidence, timeout or size checks fail. `npm run verify:minigame` runs strict
consumer typecheck, Doctor, a browser build, all registered target builds and
the failure-preservation check on the macOS host.
