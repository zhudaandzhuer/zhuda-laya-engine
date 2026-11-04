import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  runConsumerBuild,
  archiveConsumer,
} from "../packages/compiler/consumer-build.mjs";
const engineRoot = path.resolve(import.meta.dirname, "..");
test("independent consumer preserves source hashes and its DOM/CSS; archive is a real valid ZIP", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zhuda-consumer-"));
  try {
    fs.mkdirSync(path.join(root, "public"));
    fs.mkdirSync(path.join(root, "assets/prefabs"), { recursive: true });
    fs.mkdirSync(path.join(root, "assets/raw"), { recursive: true });
    fs.mkdirSync(path.join(root, "src"));
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({
      name: "consumer-fixture",
      private: true,
      type: "module",
      dependencies: { "zhuda-laya-engine": "1.3.0" },
    }));
    fs.mkdirSync(path.join(root, "src/prefabs"));
    fs.writeFileSync(
      path.join(root, "public/index.html"),
      '<title>Consumer owns this</title><link rel="stylesheet" href="own.css"><div id="mount">Own DOM</div><!-- ZHUDA_LIBS --><!-- ZHUDA_ENTRY -->',
    );
    fs.writeFileSync(path.join(root, "public/own.css"), "#mount{color:red}");
    fs.writeFileSync(path.join(root, "assets/prefabs/fixture.lh"), "{}");
    fs.writeFileSync(path.join(root, "assets/raw/source.mp4"), "source");
    fs.writeFileSync(
      path.join(root, "src/Main.ts"),
      "import {ZhudaEngine, ZhudaSceneQueries} from 'zhuda-laya-engine'; ZhudaEngine.boot({features:['core','2d']}); window['queries']=new ZhudaSceneQueries();",
    );
    fs.writeFileSync(path.join(root, "src/prefabs/definitions.ts"), "export const definitions = [];\n");
    const hashes = () =>
      ["public/index.html", "public/own.css", "src/Main.ts"].map((f) =>
        crypto
          .createHash("sha256")
          .update(fs.readFileSync(path.join(root, f)))
          .digest("hex"),
      );
    await assert.rejects(
      runConsumerBuild({
        projectRoot: root,
        engineRoot,
        config: { visualContract: "missing-contract.json" },
      }),
      /Visual presentation contract failed/,
    );
    const before = hashes();
    const r = await runConsumerBuild({
      projectRoot: root,
      engineRoot,
      config: { assetExclude: ["raw"], profile: "2d-light", prefabPreview: "src/prefabs/definitions.ts" },
    });
    assert.deepEqual(hashes(), before);
    assert.equal(r.sourceWrites, 0);
    assert.ok(
      fs
        .readFileSync(path.join(root, "dist/web/index.html"), "utf8")
        .includes("Own DOM"),
    );
    assert.match(
      fs.readFileSync(path.join(root, "dist/web/index.html"), "utf8"),
      /<meta charset="utf-8">/i,
    );
    const previewHtml = fs.readFileSync(path.join(root, "dist/web/prefab-preview.html"), "utf8");
    const previewJs = fs.readFileSync(path.join(root, "dist/web/prefab-preview.js"), "utf8");
    assert.match(previewHtml, /#preview\{display:block;position:relative/);
    assert.match(previewJs, /designWidth/);
    assert.match(previewJs, /maxWidth/);
    assert.equal(fs.existsSync(path.join(root, "src/.generated")), false);
    assert.equal(
      fs.readFileSync(path.join(root, "dist/web/assets/prefabs/fixture.lh"), "utf8"),
      "{}",
    );
    assert.equal(fs.existsSync(path.join(root, "dist/web/assets/raw/source.mp4")), false);
    assert.ok(r.orderedLibraries.includes("laya.ui.js"));
    assert.ok(
      !fs.readdirSync(path.join(root, "dist/web")).includes("preview.html"),
    );
    execFileSync("unzip", ["-t", path.join(root, "dist/game.zip")]);
    for (const outDir of [".", "src", "public", "src/generated", "assets", "assets/generated", "dist/.."])
      await assert.rejects(
        runConsumerBuild({ projectRoot: root, engineRoot, config: { outDir } }),
      );
    assert.deepEqual(hashes(), before);
    assert.throws(() =>
      archiveConsumer(
        path.join(root, "dist/web"),
        path.join(root, "too-small.zip"),
        100,
      ),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
