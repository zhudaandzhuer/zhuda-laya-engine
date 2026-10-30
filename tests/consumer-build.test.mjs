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
    fs.mkdirSync(path.join(root, "src"));
    fs.writeFileSync(
      path.join(root, "public/index.html"),
      '<title>Consumer owns this</title><link rel="stylesheet" href="own.css"><div id="mount">Own DOM</div><!-- ZHUDA_LIBS --><!-- ZHUDA_ENTRY -->',
    );
    fs.writeFileSync(path.join(root, "public/own.css"), "#mount{color:red}");
    fs.writeFileSync(
      path.join(root, "src/Main.ts"),
      "import {ZhudaSceneQueries} from 'zhuda-laya-engine'; window['queries']=new ZhudaSceneQueries();",
    );
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
    const r = await runConsumerBuild({ projectRoot: root, engineRoot });
    assert.deepEqual(hashes(), before);
    assert.equal(r.sourceWrites, 0);
    assert.ok(
      fs
        .readFileSync(path.join(root, "dist/web/index.html"), "utf8")
        .includes("Own DOM"),
    );
    assert.equal(fs.existsSync(path.join(root, "src/.generated")), false);
    assert.ok(
      !fs.readdirSync(path.join(root, "dist/web")).includes("preview.html"),
    );
    execFileSync("unzip", ["-t", path.join(root, "dist/game.zip")]);
    for (const outDir of [".", "src", "public", "src/generated", "dist/.."])
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
