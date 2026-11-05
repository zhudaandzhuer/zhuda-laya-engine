import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { PNG } from "pngjs";
import {
  exportFilm,
  inspectFilmWav,
  filmCli,
} from "../packages/ci-gate/export-film.mjs";
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zhuda-film-test-")),
    image = PNG.sync.write({
      width: 2,
      height: 2,
      data: Buffer.alloc(16, 255),
    });
  fs.writeFileSync(path.join(root, "frame.png"), image);
  const report = {
      schemaVersion: 1,
      requestedBackend: "webgl",
      selectedBackend: "webgl",
      status: "ready",
      errors: [],
      expectedTimes: [0],
      frames: [
        {
          time: 0,
          ready: true,
          imagePath: "frame.png",
          imageSha256: crypto.createHash("sha256").update(image).digest("hex"),
        },
      ],
    },
    reportPath = path.join(root, "sequence.json"),
    output = path.join(root, "movie.mp4");
  fs.writeFileSync(reportPath, JSON.stringify(report));
  fs.writeFileSync(output, "previous-good-movie");
  return {
    root,
    report,
    options: { reportPath, output, fps: 24 },
    verify() {
      assert.equal(fs.readFileSync(output, "utf8"), "previous-good-movie");
      assert.ok(
        !fs.readdirSync(root).some((n) => n.startsWith(".zhuda-film-")),
      );
    },
    cleanup() {
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}
test("film rejects hash/timestamp/budget/encoder failures and preserves previous output atomically", async () => {
  const f = fixture();
  try {
    for (const options of [
      { maxInputBytes: 1 },
      { maxPixels: 1 },
      { fps: 0 },
      { ffmpeg: process.execPath },
      { ffmpeg: path.join(f.root, "missing-encoder") },
    ]) {
      await assert.rejects(exportFilm({ ...f.options, ...options }));
      f.verify();
    }
    f.report.frames[0].time = 0.5;
    fs.writeFileSync(f.options.reportPath, JSON.stringify(f.report));
    await assert.rejects(exportFilm(f.options), /expected time/);
    f.verify();
    f.report.frames[0].time = 0;
    f.report.frames[0].imageSha256 = "0".repeat(64);
    fs.writeFileSync(f.options.reportPath, JSON.stringify(f.report));
    await assert.rejects(exportFilm(f.options), /SHA/);
    f.verify();
    const abort = new AbortController();
    abort.abort();
    await assert.rejects(
      exportFilm({ ...f.options, signal: abort.signal }),
      (e) => e.name === "AbortError",
    );
    f.verify();
  } finally {
    f.cleanup();
  }
});
test("film soundtrack validation checks PCM layout, nonfinite samples and exact WAV extent", () => {
  const wav = Buffer.alloc(44 + 8000 * 4);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(3, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(4, 32);
  wav.writeUInt16LE(32, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(wav.length - 44, 40);
  assert.equal(inspectFilmWav(wav).durationSec, 1);
  wav.writeFloatLE(NaN, 44);
  assert.throws(() => inspectFilmWav(wav), /Nonfinite/);
  wav.writeFloatLE(0, 44);
  wav.writeUInt16LE(2, 32);
  assert.throws(() => inspectFilmWav(wav), /malformed/);
  assert.throws(() => inspectFilmWav(wav.subarray(0, 44)), /complete/);
});
test("film CLI documents required flags and rejects missing output", async () => {
  assert.match(await filmCli(["--help"]), /zhuda-film-export/);
  await assert.rejects(filmCli(["a.json", "--fps", "24"]), /--output/);
});
