import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import zlib from "node:zlib";
import assert from "node:assert/strict";
import ts from "typescript";
import { runConsumerBuild } from "../packages/compiler/consumer-build.mjs";
import { chromeFixture } from "./lib/chrome-fixture.mjs";
const engineRoot = path.resolve(import.meta.dirname, "..");
const root = process.env.RUNTIME_FIXTURE_DIR || "/tmp/zhuda-runtime-feedback";
for (const sub of ["src", "public/assets", "evidence", "node_modules"])
  fs.mkdirSync(path.join(root, sub), { recursive: true });
if (!fs.existsSync(path.join(root, "node_modules/zhuda-laya-engine")))
  fs.symlinkSync(engineRoot, path.join(root, "node_modules/zhuda-laya-engine"));
fs.writeFileSync(
  path.join(root, "package.json"),
  JSON.stringify({
    private: true,
    type: "module",
    dependencies: {
      "zhuda-laya-engine": JSON.parse(
        fs.readFileSync(path.join(engineRoot, "package.json")),
      ).version,
    },
  }),
);
fs.copyFileSync(
  path.join(engineRoot, "tests/fixtures/runtime-feedback.ts"),
  path.join(root, "src/Main.ts"),
);
fs.copyFileSync(
  path.join(engineRoot, "tests/fixtures/runtime-worklet.js"),
  path.join(root, "public/assets/processor.js"),
);
const crc = (bytes) => {
  let c = -1;
  for (const b of bytes) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ -1) >>> 0;
};
const chunk = (name, bytes) => {
  const type = Buffer.from(name),
    h = Buffer.alloc(4),
    s = Buffer.alloc(4);
  h.writeUInt32BE(bytes.length);
  s.writeUInt32BE(crc(Buffer.concat([type, bytes])));
  return Buffer.concat([h, type, bytes, s]);
};
const h = Buffer.alloc(13);
h.writeUInt32BE(16);
h.writeUInt32BE(16, 4);
h[8] = 8;
h[9] = 6;
const rows = Buffer.concat(
  Array.from({ length: 16 }, () =>
    Buffer.concat([
      Buffer.from([0]),
      Buffer.from(Array(16).fill([28, 75, 90, 255]).flat()),
    ]),
  ),
);
fs.writeFileSync(
  path.join(root, "public/assets/plate.png"),
  Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", h),
    chunk("IDAT", zlib.deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]),
);
fs.writeFileSync(
  path.join(root, "public/assets/panel.lh"),
  JSON.stringify({
    _$id: "panel",
    _$type: "Sprite",
    name: "Panel",
    width: 300,
    height: 150,
    _$child: [
      {
        _$id: "plate",
        _$type: "Image",
        name: "plate",
        skin: "plate.png",
        x: 20,
        y: 20,
        width: 198,
        height: 110,
      },
    ],
  }),
);
fs.writeFileSync(
  path.join(root, "src/prefabs.ts"),
  `export const definitions=[{id:'plate',asset:'panel.lh',textures:['plate.png'],states:{idle:{}}}];`,
);
function wav(seconds) {
  const rate = 44100,
    frames = Math.round(seconds * rate),
    b = Buffer.alloc(44 + frames * 4);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(2, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 4, 28);
  b.writeUInt16LE(4, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(frames * 4, 40);
  for (let i = 0; i < frames; i++) {
    const n = Math.round(Math.sin((i * 2 * Math.PI * 220) / rate) * 2000);
    b.writeInt16LE(n, 44 + i * 4);
    b.writeInt16LE(n, 46 + i * 4);
  }
  return b;
}
fs.writeFileSync(path.join(root, "public/assets/tone.wav"), wav(1));
fs.writeFileSync(path.join(root, "public/assets/long.wav"), wav(120));
fs.writeFileSync(
  path.join(root, "public/index.html"),
  `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#121923}#game{position:relative;margin:50px 0 0 30px;width:640px;height:360px;overflow:hidden;touch-action:none}#unlock{position:absolute;left:700px;top:50px}</style><div id="game"></div><button id="unlock">Unlock audio</button><!-- ZHUDA_LIBS --><!-- ZHUDA_ENTRY -->`,
);
const program = ts.createProgram([path.join(root, "src/Main.ts")], {
  noEmit: true,
  strict: true,
  skipLibCheck: false,
  types: [],
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
});
const diagnostics = ts.getPreEmitDiagnostics(program);
assert.equal(
  diagnostics.length,
  0,
  ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => root,
    getCanonicalFileName: (f) => f,
    getNewLine: () => "\n",
  }),
);
await runConsumerBuild({
  projectRoot: root,
  engineRoot,
  config: {
    features: ["core", "2d", "3d", "ui"],
    prefabPreview: "src/prefabs.ts",
  },
});
const requests = [];
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const file = path.resolve(
    root,
    "dist/web",
    "." + decodeURIComponent(pathname === "/" ? "/index.html" : pathname),
  );
  if (!file.startsWith(path.join(root, "dist/web") + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const bytes = fs.readFileSync(file),
      range = req.headers.range?.match(/bytes=(\d+)-(\d*)/);
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".wav": "audio/wav",
        ".lh": "application/json",
        ".png": "image/png",
        ".json": "application/json",
      }[path.extname(file)] || "application/octet-stream",
    );
    res.setHeader("Accept-Ranges", "bytes");
    if (range) {
      const start = Number(range[1]),
        end = Math.min(Number(range[2] || bytes.length - 1), bytes.length - 1);
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${bytes.length}`,
        "Content-Length": end - start + 1,
      });
      res.end(bytes.subarray(start, end + 1));
    } else res.end(bytes);
    requests.push({ pathname, range: req.headers.range || null });
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
let browser = await chromeFixture();
const measurements = [], previews = [];
async function platePixels(file) {
  await browser.evaluate(
    "new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))",
  );
  const { data } = await browser.send("Page.captureScreenshot", {
    format: "png",
  });
  fs.writeFileSync(file, Buffer.from(data, "base64"));
  return browser.evaluate(`(async()=>{
  const image=await createImageBitmap(await(await fetch('data:image/png;base64,${data}')).blob());
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,image.width,image.height).data;
  let left=Infinity,top=Infinity,right=-1,bottom=-1;
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
   const i=(y*image.width+x)*4;if(Math.abs(pixels[i]-28)<=1&&Math.abs(pixels[i+1]-75)<=1&&Math.abs(pixels[i+2]-90)<=1){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  }
  const scale=image.width/innerWidth;image.close();return {x:left/scale,y:top/scale,width:(right-left+1)/scale,height:(bottom-top+1)/scale};
 })()`);
}

try {
  for (const [dpr, cap, fixed = false] of [
    [1, 3],
    [2, 3],
    [3, 3],
    [3, 1.5],
    [2, 3, true],
  ]) {
    console.log("scenario", {dpr,cap,fixed});
    assert.deepEqual(browser.errors, []);
    await browser.close();
    browser = await chromeFixture();
    await browser.send("Emulation.setDeviceMetricsOverride", {
      width: 900,
      height: 600,
      deviceScaleFactor: dpr,
      mobile: false,
    });
    await browser.send("Page.navigate", {
      url: base + "/?cap=" + cap + (fixed ? "&fixed=1" : ""),
    });
    await browser.waitFor(
      "window.runtimeError || (window.runtimeAudit?.ready && !document.getElementById('zhudaLogoSplash'))",
    );
    assert.equal(await browser.evaluate("window.runtimeError"), undefined);
    const before = await browser.evaluate("runtimeAudit.measure()");
    assert.equal(before.stage.width, fixed ? 320 : 640);
    assert.equal(before.canvas.width, Math.round(640 * Math.min(dpr, cap)));
    assert.equal(before.projected.x, before.canvas.rect.x + 320);
    assert.ok(Math.abs(before.ray.direction.z + 1) < 1e-6);
    for (const [type, buttons] of [
      ["mousePressed", 1],
      ["mouseReleased", 0],
    ])
      await browser.send("Input.dispatchMouseEvent", {
        type,
        x: 80,
        y: 100,
        button: "left",
        buttons,
        clickCount: 1,
      });
    const after = await browser.evaluate("runtimeAudit.measure()");
    assert.deepEqual(after.clicks, [
      { x: fixed ? 25 : 50, y: fixed ? 25 : 50 },
    ]);
    const pixels = await platePixels(
      path.join(
        root,
        `evidence/dpr-${dpr}-cap-${cap}${fixed ? "-fixed" : ""}.png`,
      ),
    );
    assert.ok(
      Math.abs(pixels.width - (fixed ? 396 : 198)) <= 1 / Math.min(dpr, cap),
      JSON.stringify({ dpr, cap, fixed, pixels }),
    );
    assert.ok(Math.abs(pixels.x - (fixed ? 70 : 50)) <= 1 / Math.min(dpr, cap));
    assert.ok(Math.abs(pixels.y - (fixed ? 90 : 70)) <= 1 / Math.min(dpr, cap));
    await browser.evaluate("runtimeAudit.resize(500,300)");
    await browser.waitFor(
      fixed ? "Laya.stage.width===320" : "Laya.stage.width===500",
    );
    const resized = await browser.evaluate("runtimeAudit.measure()");
    assert.equal(resized.stage.width, fixed ? 320 : 500);
    assert.equal(resized.projected.x, resized.canvas.rect.x + 250);
    await browser.evaluate("runtimeAudit.pointers(true)");
    await browser.evaluate("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");
    await browser.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 2,
    });
    await browser.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: 80, y: 100, id: 1 },
        { x: 400, y: 200, id: 2 },
      ],
    });
    const touched = await browser.evaluate("runtimeAudit.measure()");
    assert.equal(touched.pointers.length, 2, JSON.stringify({dpr,cap,fixed,touched}));
    assert.deepEqual(
      touched.pointers.map((p) => [p.x, p.y]),
      [
        [80, 100],
        [400, 200],
      ],
    );
    await browser.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    assert.equal(
      (await browser.evaluate("runtimeAudit.measure()")).pointers.length,
      0,
    );
    await browser.send("Emulation.setTouchEmulationEnabled", {
      enabled: false,
    });
    await browser.evaluate("runtimeAudit.pointers(false)");
    await browser.evaluate("runtimeAudit.clip(true)");
    const count = (await browser.evaluate("runtimeAudit.measure()")).clicks
      .length;
    for (const [type, buttons] of [
      ["mousePressed", 1],
      ["mouseReleased", 0],
    ])
      await browser.send("Input.dispatchMouseEvent", {
        type,
        x: 200,
        y: 100,
        button: "left",
        buttons,
        clickCount: 1,
      });
    assert.equal(
      (await browser.evaluate("runtimeAudit.measure()")).clicks.length,
      count,
    );
    await browser.screenshot(
      path.join(
        root,
        `evidence/clip-${dpr}-cap-${cap}${fixed ? "-fixed" : ""}.png`,
      ),
    );
    await browser.evaluate("runtimeAudit.clip(false)");
    measurements.push({
      dpr,
      cap,
      fixed,
      before,
      after,
      resized,
      touched,
      pixels,
    });
  }
  await browser.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: 740,
    y: 60,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  await browser.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: 740,
    y: 60,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
  console.log("media");
  const media = await browser.evaluate("runtimeAudit.mediaAudit()");
  assert.equal(media.playing.decodedSampleBytes, 0);
  assert.equal(media.playing.activeVoices, 1);
  assert.equal(media.hidden.contextState, "suspended");
  assert.equal(media.resumed.contextState, "running");
  assert.equal(media.after.activeVoices, 0);
  assert.equal(media.after.loadedStreams, 0);
  assert.equal(media.after.pendingStreamLoads, 0);
  console.log("worklet");
  const worklet = await browser.evaluate("runtimeAudit.backendAudit()");
  assert.equal(worklet.after.activeVoices, 0);
  assert.equal(worklet.nodes, 0);
  const progress = worklet.messages.filter((m) => m.type === "progress");
  assert.ok(progress.length >= 3);
  fs.writeFileSync(path.join(root,"evidence/worklet-observation.json"),JSON.stringify(worklet,null,2));
  assert.ok(progress.every((m) => m.maxGapFrames === 0),JSON.stringify(progress));
  const first = await browser.evaluate("runtimeAudit.measure().ticks");
  await browser.evaluate("runtimeAudit.background(true)");
  await new Promise((r) => setTimeout(r, 300));
  const background = await browser.evaluate("runtimeAudit.measure().ticks");
  assert.ok(background > first);
  await browser.send("Page.setWebLifecycleState", { state: "frozen" });
  await new Promise((r) => setTimeout(r, 200));
  await browser.send("Page.setWebLifecycleState", { state: "active" });
  await browser.evaluate("runtimeAudit.background(false)");
  await new Promise((r) => setTimeout(r, 100));
  const resumed = await browser.evaluate("runtimeAudit.measure().ticks");
  const disposed = await browser.evaluate("runtimeAudit.dispose()");
  assert.equal(disposed.activeVoices, 0);
  assert.equal(disposed.decodedSampleBytes, 0);
  assert.deepEqual(browser.errors, []);
  for (const dpr of [1, 2, 3]) {
    console.log("preview",dpr);
    assert.deepEqual(browser.errors, []);
    await browser.close();
    browser=await chromeFixture();
    await browser.send("Emulation.setDeviceMetricsOverride", {
      width: 900,
      height: 600,
      deviceScaleFactor: dpr,
      mobile: false,
    });
    await browser.send("Page.navigate", {
      url:
        base + "/prefab-preview.html?id=plate&width=640&height=360&dpr=" + dpr,
    });
    await browser.waitFor(
      "window.__ZHUDA_PREFAB_TEST__?.report().ready && !document.getElementById('zhudaLogoSplash')",
    );
    const pixels = await platePixels(
      path.join(root, `evidence/preview-dpr-${dpr}.png`),
    );
    assert.equal(pixels.width, 198);
    assert.equal(pixels.x, 20);
    previews.push({
      dpr,
      pixels,
      report: await browser.evaluate("__ZHUDA_PREFAB_TEST__.report()"),
    });
  }
  assert.deepEqual(browser.errors, []);
  const result = {
    passed: true,
    previews,
    browser: (await browser.send("Browser.getVersion")).product,
    measurements,
    media,
    worklet,
    driver: { first, background, resumed },
    disposed,
    requests,
    limits: [
      "Desktop emulation only; no physical mobile/speaker acceptance.",
      "Worklet progress measures processor continuity under a 250 ms main-thread block, not hardware output latency.",
      "Native decoder memory is browser-owned; decodedSampleBytes measures adapter-retained PCM only.",
    ],
  };
  fs.writeFileSync(
    path.join(root, "evidence/report.json"),
    JSON.stringify(result, null, 2),
  );
  console.log("PASS runtime feedback browser", root);
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}
