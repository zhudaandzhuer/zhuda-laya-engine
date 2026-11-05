import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import ts from "typescript";
import { PNG } from "pngjs";
import { chromeFixture } from "./lib/chrome-fixture.mjs";
import { validateSequenceReport } from "../packages/ci-gate/verify-sequence.mjs";
const engine = path.resolve(import.meta.dirname, ".."),
  root = path.resolve(process.env.CINEMA_OUT ?? "/tmp/zhuda-cinema"),
  consumer = path.join(root, "consumer"),
  evidence = path.join(root, "evidence"),
  sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
for (const sub of ["src", "public/assets", "node_modules"])
  fs.mkdirSync(path.join(consumer, sub), { recursive: true });
fs.mkdirSync(evidence, { recursive: true });
fs.copyFileSync(
  path.join(engine, "examples/cinematic-capture/Main.ts"),
  path.join(consumer, "src/Main.ts"),
);
for (const file of fs
  .readdirSync(path.join(engine, "tests/fixtures/gltf-review"))
  .filter((f) => f.startsWith("multi-") && f.endsWith(".gltf")))
  fs.copyFileSync(
    path.join(engine, "tests/fixtures/gltf-review", file),
    path.join(consumer, "public/assets", file),
  );
// One second mono constant .5 PCM, authored for exact gain/fade/scheduling checks.
const wav = Buffer.alloc(44 + 48000 * 2);
wav.write("RIFF");
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(48000, 24);
wav.writeUInt32LE(96000, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(wav.length - 44, 40);
for (let i = 44; i < wav.length; i += 2) wav.writeInt16LE(16384, i);
fs.writeFileSync(path.join(consumer, "public/assets/tone.wav"), wav);
const score = Buffer.from(wav);
for (let i = 0; i < 48000; i++)
  score.writeInt16LE(
    Math.round(
      4000 *
        (Math.sin((2 * Math.PI * 220 * i) / 48000) +
          0.4 * Math.sin((2 * Math.PI * 330 * i) / 48000)),
    ),
    44 + i * 2,
  );
fs.writeFileSync(path.join(consumer, "public/assets/score.wav"), score);
const packed = JSON.parse(
    execFileSync("npm", ["pack", "--json", "--pack-destination", root], {
      cwd: engine,
      encoding: "utf8",
      maxBuffer: 32e6,
    }),
  )[0],
  sdk = path.join(consumer, "node_modules/zhuda-laya-engine");
fs.rmSync(sdk, { recursive: true, force: true });
fs.mkdirSync(sdk, { recursive: true });
execFileSync("tar", [
  "-xzf",
  path.join(root, packed.filename),
  "-C",
  sdk,
  "--strip-components=1",
]);
for (const dep of [
  "@webgpu",
  "i18next",
  "esbuild",
  "typescript",
  "meshoptimizer",
  "pngjs",
]) {
  const dest = path.join(consumer, "node_modules", dep);
  if (!fs.existsSync(dest))
    fs.symlinkSync(path.join(engine, "node_modules", dep), dest);
}
fs.writeFileSync(
  path.join(consumer, "package.json"),
  JSON.stringify({
    name: "cinema-consumer",
    private: true,
    type: "module",
    dependencies: {
      "zhuda-laya-engine": JSON.parse(
        fs.readFileSync(path.join(engine, "package.json")),
      ).version,
    },
  }),
);
fs.writeFileSync(
  path.join(consumer, "public/index.html"),
  '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#111}#game{width:640px;height:360px}</style><div id="game"></div><!-- ZHUDA_LIBS --><!-- ZHUDA_ENTRY -->',
);
const program = ts.createProgram([path.join(consumer, "src/Main.ts")], {
    noEmit: true,
    strict: true,
    skipLibCheck: false,
    types: [],
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  }),
  diagnostics = ts.getPreEmitDiagnostics(program);
assert.equal(
  diagnostics.length,
  0,
  ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => consumer,
    getCanonicalFileName: (x) => x,
    getNewLine: () => "\n",
  }),
);
const esm = await import(path.join(sdk, "dist/sdk/zhuda-laya-engine.esm.js")),
  cjs = createRequire(import.meta.url)(
    path.join(sdk, "dist/sdk/zhuda-laya-engine.cjs"),
  );
for (const name of [
  "ZhudaModelAnimationSampler",
  "ZhudaPhysicalCameraRig",
  "ZhudaCinematicCapture",
  "physicalCameraMetrics",
]) {
  assert.equal(typeof esm[name], "function");
  assert.equal(typeof cjs[name], "function");
}
const { runConsumerBuild } = await import(
  path.join(sdk, "packages/compiler/consumer-build.mjs")
);
const backends = process.env.CINEMA_BACKEND
  ? [process.env.CINEMA_BACKEND]
  : ["webgl", "webgpu"];
for (const renderer of backends) {
  const config = {
    name: "cinema-" + renderer,
    entry: "src/Main.ts",
    renderer,
    features: ["core", "2d", "3d", "gltf", "postProcess"],
    outDir: "dist/" + renderer,
    assetInclude: fs.readdirSync(path.join(consumer, "public/assets")),
  };
  fs.writeFileSync(
    path.join(consumer, "zhuda.config.json"),
    JSON.stringify(config),
  );
  await runConsumerBuild({ projectRoot: consumer, engineRoot: sdk, config });
}
const server = http.createServer((req, res) => {
  try {
    let name = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (name.endsWith("/")) name += "index.html";
    const file = path.join(consumer, "dist", name);
    res.setHeader(
      "Content-Type",
      file.endsWith(".js")
        ? "application/javascript"
        : file.endsWith(".html")
          ? "text/html"
          : "application/octet-stream",
    );
    res.end(fs.readFileSync(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let b;
const results = [];
const save = (name, data) => {
  const bytes = Buffer.from(data.split(",").at(-1), "base64");
  fs.writeFileSync(path.join(evidence, name), bytes);
  return { bytes, sha: sha(bytes), png: PNG.sync.read(bytes) };
};
try {
  for (const backend of backends) {
    b = await chromeFixture();
    await b.send("Emulation.setDeviceMetricsOverride", {
      width: 800,
      height: 600,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await b.send("Page.navigate", {
      url: "http://127.0.0.1:" + server.address().port + "/" + backend + "/",
    });
    await b.waitFor("!!window.cinema");
    assert.equal(
      await b.evaluate("cinema.ready"),
      true,
      JSON.stringify(await b.evaluate("cinema")),
    );
    const report = await b.evaluate("cinema.report()");
    console.log(backend, JSON.stringify(report.renderer));
    assert.equal(report.renderer.selected, backend);
    assert.equal(report.renderer.status, "ready");
    const poses = [];
    for (const interpolation of ["linear", "step", "cubicspline"])
      for (const skin of ["", "-skin"])
        for (const t of [0, 0.5, 1.5, 2, 0.5]) {
          const state = await b.evaluate(
            `cinema.sample('multi-${interpolation}${skin}.gltf',${t})`,
          );
          const weights = state.inspection.nodes.find(
            (n) => "bend" in n.morphWeights,
          ).morphWeights;
          const u = t / 2,
            smooth = 3 * u * u - 2 * u * u * u,
            expected =
              interpolation === "linear"
                ? [u, 0.2 + 0.6 * u]
                : interpolation === "step"
                  ? t < 2
                    ? [0, 0.2]
                    : [1, 0.8]
                  : [
                      smooth +
                        0.8 * (u * u * u - 2 * u * u + u) -
                        0.4 * (u * u * u - u * u),
                      0.2 +
                        0.6 * smooth -
                        0.4 * (u * u * u - 2 * u * u + u) +
                        1.2 * (u * u * u - u * u),
                    ];
          for (const [i, key] of ["bend", "lift"].entries())
            assert.ok(
              Math.abs(weights[key] - expected[i]) < 1e-5,
              JSON.stringify({
                backend,
                interpolation,
                skin,
                t,
                weights,
                expected,
              }),
            );
          const node = state.nodes.find(
            (n) => n.name === (skin ? "Joint" : "Probe"),
          );
          assert.ok(Math.abs(node.position[0] - 0.1 * u) < 1e-5);
          poses.push({
            interpolation,
            skin,
            t,
            weights,
            position: node.position,
          });
        }
    await b.evaluate("cinema.sample('multi-linear-skin.gltf',0)");
    const modelFrames = [];
    for (const [index, time] of [0, 0.5, 2, 0.5].entries())
      modelFrames.push(
        save(
          backend + "-model-" + index + ".png",
          await b.evaluate("cinema.modelPng(" + time + ")"),
        ).sha,
      );
    assert.notEqual(modelFrames[0], modelFrames[2]);
    assert.equal(modelFrames[1], modelFrames[3]);
    const single = save(
      backend + "-sharp.png",
      await b.evaluate("cinema.png(0)"),
    );
    const repeated = save(
      backend + "-repeat.png",
      await b.evaluate("cinema.png(0)"),
    );
    assert.equal(single.sha, repeated.sha, "Exact pose must repeat");
    const center = Array.from(
      single.png.data.subarray(
        (190 * 640 + 320) * 4,
        (190 * 640 + 320) * 4 + 3,
      ),
    );
    assert.ok(
      center[0] > 150 && center[1] < 160 && center[2] > 150,
      "glTF material must retain magenta: " + center,
    );
    for (const dpr of [1, 3]) {
      await b.send("Emulation.setDeviceMetricsOverride", {
        width: 800 + dpr * 20,
        height: 600 + dpr * 20,
        deviceScaleFactor: dpr,
        mobile: false,
      });
      const resized = save(
        backend + "-dpr" + dpr + ".png",
        await b.evaluate("cinema.png(0)"),
      );
      assert.equal(
        resized.sha,
        single.sha,
        "Output must not depend on viewport/DPR",
      );
    }
    // Blue marker is above yellow in scene; catch backend readback orientation.
    const centroid = (png, predicate) => {
      let y = 0,
        count = 0;
      for (let p = 0; p < png.data.length; p += 4)
        if (predicate(...png.data.subarray(p, p + 4))) {
          y += Math.floor(p / 4 / png.width);
          count++;
        }
      assert.ok(count > 10);
      return y / count;
    };
    const blueY = centroid(
        single.png,
        (r, g, b) => b > 200 && r < 30 && g < 30,
      ),
      yellowY = centroid(single.png, (r, g, b) => r > 200 && g > 200 && b < 30);
    assert.ok(blueY < yellowY, JSON.stringify({ blueY, yellowY }));
    const dof = save(
      backend + "-dof.png",
      await b.evaluate("cinema.png(0,32,true,false)"),
    );
    assert.notEqual(single.sha, dof.sha);
    const aa = save(
      backend + "-aa.png",
      await b.evaluate("cinema.png(0,32,false,false)"),
    );
    const difference = (a, b, x, y, w, h) => {
      let sum = 0;
      for (let v = y; v < y + h; v++)
        for (let u = x; u < x + w; u++) {
          const p = (v * 640 + u) * 4;
          for (let c = 0; c < 3; c++)
            sum += Math.abs(a.data[p + c] - b.data[p + c]);
        }
      return sum / (w * h * 3);
    };
    const focus = {
      front: difference(aa.png, dof.png, 30, 40, 80, 50),
      plane: difference(aa.png, dof.png, 295, 91, 50, 8),
      back: difference(aa.png, dof.png, 408, 120, 38, 30),
    };
    assert.ok(
      focus.front > 5 && focus.back > 2 && focus.plane < 2,
      JSON.stringify(focus),
    );
    const motion = save(
      backend + "-motion.png",
      await b.evaluate("cinema.png(0,32,false,true)"),
    );
    assert.notEqual(single.sha, motion.sha);
    const redWidth = (png) => {
      const xs = [];
      for (let y = 280; y < 340; y++)
        for (let x = 60; x < 250; x++) {
          const p = (y * png.width + x) * 4;
          if (png.data[p] > 50 && png.data[p + 1] < 20 && png.data[p + 2] < 20)
            xs.push(x);
        }
      assert.ok(xs.length);
      return Math.max(...xs) - Math.min(...xs);
    };
    const motionWidth = {
      stationary: redWidth(aa.png),
      moving: redWidth(motion.png),
    };
    assert.ok(
      motionWidth.moving > motionWidth.stationary + 15,
      "Shutter must visibly broaden the moving subject",
    );
    save(backend + "-filmic.png", await b.evaluate("cinema.filmic()"));
    const mix = await b.evaluate("cinema.audio()"),
      sound = Buffer.from(mix.wav, "base64");
    fs.writeFileSync(path.join(evidence, backend + "-soundtrack.wav"), sound);
    for (const [sec, expected] of [
      [0, 0],
      [0.125, 0],
      [0.1875, 0.05],
      [0.3, 0.1],
      [0.8125, 0.05],
      [0.875, 0],
    ])
      assert.ok(
        Math.abs(
          sound.readFloatLE(44 + Math.round(sec * 48000) * 8) - expected,
        ) < 1e-5,
        JSON.stringify({ sec, expected }),
      );
    const mute = await b.evaluate("cinema.audio(true)");
    assert.equal(mute.peak, 0);
    assert.equal(
      (await b.evaluate("cinema.report().audio")).playedEventsCount,
      0,
    );
    const scoreBytes = Buffer.from(
      await b.evaluate("cinema.score()"),
      "base64",
    );
    fs.writeFileSync(path.join(evidence, backend + "-score.wav"), scoreBytes);
    const lifecycle = await b.evaluate("cinema.lifecycle()");
    assert.deepEqual(
      lifecycle[3],
      lifecycle.at(-1),
      "Capture resources must plateau",
    );
    // Half-open movie frames [0,1); one second 4K24 with a half-frame shutter.
    await b.evaluate("cinema.setup(3840,2160)");
    const frames = [];
    for (let index = 0; index < 24; index++) {
      const imagePath =
          backend + "-4k-" + String(index).padStart(4, "0") + ".png",
        frame = save(
          imagePath,
          await b.evaluate(`cinema.png(${index},2,true,true)`),
        );
      assert.equal(frame.png.width, 3840);
      assert.equal(frame.png.height, 2160);
      frames.push({
        time: index / 24,
        ready: true,
        imagePath,
        imageSha256: frame.sha,
      });
    }
    const sequence = {
      schemaVersion: 1,
      requestedBackend: backend,
      selectedBackend: report.renderer.selected,
      isFallbackAdapter: report.renderer.adapter?.isFallbackAdapter ?? null,
      fallbackReason: report.renderer.fallbackReason,
      status: report.renderer.status,
      errors: report.renderer.errors,
      expectedTimes: frames.map((f) => f.time),
      frames,
    };
    assert.equal(
      validateSequenceReport(sequence, { root: evidence }).passed,
      true,
    );
    fs.writeFileSync(
      path.join(evidence, backend + "-sequence.json"),
      JSON.stringify(sequence, null, 2),
    );
    if (!process.env.CINEMA_SKIP_ENCODE) {
      const result = JSON.parse(
        execFileSync(
          process.execPath,
          [
            path.join(sdk, "packages/ci-gate/export-film.mjs"),
            path.join(evidence, backend + "-sequence.json"),
            "--fps",
            "24",
            "--output",
            path.join(evidence, backend + "-movie.mp4"),
            "--audio",
            path.join(evidence, backend + "-score.wav"),
          ],
          { encoding: "utf8" },
        ),
      );
      assert.equal(result.passed, true);
      const before = sha(fs.readFileSync(result.output));
      const failed = spawnSync(
        process.execPath,
        [
          path.join(sdk, "packages/ci-gate/export-film.mjs"),
          path.join(evidence, backend + "-sequence.json"),
          "--fps",
          "24",
          "--output",
          result.output,
          "--ffprobe",
          path.join(root, "missing-probe"),
        ],
        { encoding: "utf8" },
      );
      assert.notEqual(failed.status, 0);
      assert.equal(
        sha(fs.readFileSync(result.output)),
        before,
        "Failed probe must retain the prior movie",
      );
      result.failurePreservedPrevious = true;
      fs.writeFileSync(
        path.join(evidence, backend + "-video-probe.json"),
        JSON.stringify(result, null, 2),
      );
    }
    results.push({
      backend,
      browser: await b.send("Browser.getVersion"),
      renderer: report.renderer,
      poses,
      modelFrames,
      materialColor: center,
      focus,
      motionWidth,
      orientation: { blueY, yellowY },
      lifecycle,
      audio: { ...mix, wav: undefined },
      sequence,
    });
    await b.evaluate("cinema.dispose()");
    assert.deepEqual(b.errors, []);
    await b.close();
    b = null;
    fs.writeFileSync(
      path.join(evidence, "results.json"),
      JSON.stringify(
        {
          baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
            cwd: engine,
            encoding: "utf8",
          }).trim(),
          workingTree: true,
          node: process.version,
          os: os.platform() + " " + os.release(),
          tarballSha256: sha(fs.readFileSync(path.join(root, packed.filename))),
          sourceSha256: sha(
            fs.readFileSync(path.join(consumer, "src/Main.ts")),
          ),
          assets: Object.fromEntries(
            fs
              .readdirSync(path.join(consumer, "public/assets"))
              .map((name) => [
                name,
                sha(
                  fs.readFileSync(path.join(consumer, "public/assets", name)),
                ),
              ]),
          ),
          results,
        },
        null,
        2,
      ),
    );
    console.log("PASS cinematic packed consumer " + backend);
  }
  if (results.length === 2)
    for (let i = 0; i < 3; i++)
      assert.ok(
        Math.abs(results[0].materialColor[i] - results[1].materialColor[i]) <=
          2,
        "WebGL/WebGPU material color differs",
      );
} finally {
  await b?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
