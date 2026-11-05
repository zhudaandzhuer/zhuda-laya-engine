#!/usr/bin/env node
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { PNG } from "pngjs";
import { validateSequenceReport } from "./verify-sequence.mjs";
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
const check = (signal) => {
  if (signal.aborted) throw signal.reason;
};
async function command(binary, args, signal) {
  check(signal);
  return await new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "",
      stderr = "",
      error;
    const abort = () => {
      error = signal.reason;
      child.kill("SIGKILL");
    };
    signal.addEventListener("abort", abort, { once: true });
    const collect = (key, bytes) => {
      if (key === "out") stdout += bytes;
      else stderr += bytes;
      if (stdout.length + stderr.length > 256 * 1024) {
        error = Error("Encoder/probe output budget exceeded");
        child.kill("SIGKILL");
      }
    };
    child.stdout.on("data", (b) => collect("out", b));
    child.stderr.on("data", (b) => collect("err", b));
    child.once("error", (e) => {
      error = e;
    });
    child.once("close", (code) => {
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else if (code !== 0)
        reject(
          Error(`${path.basename(binary)} failed (${code}): ${stderr.trim()}`),
        );
      else resolve(stdout);
    });
  });
}
export function inspectFilmWav(bytes) {
  if (
    bytes.length < 44 ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WAVE" ||
    bytes.readUInt32LE(4) + 8 !== bytes.length
  )
    throw Error("Expected a complete PCM/float RIFF WAV soundtrack");
  let fmt, data;
  for (let at = 12; at + 8 <= bytes.length; ) {
    const id = bytes.toString("ascii", at, at + 4),
      size = bytes.readUInt32LE(at + 4),
      end = at + 8 + size;
    if (end > bytes.length) throw Error("Truncated WAV chunk");
    if (id === "fmt ") {
      if (fmt || size < 16) throw Error("Invalid WAV format chunk");
      fmt = {
        format: bytes.readUInt16LE(at + 8),
        channels: bytes.readUInt16LE(at + 10),
        sampleRate: bytes.readUInt32LE(at + 12),
        byteRate: bytes.readUInt32LE(at + 16),
        blockAlign: bytes.readUInt16LE(at + 20),
        bits: bytes.readUInt16LE(at + 22),
      };
    }
    if (id === "data") {
      if (data) throw Error("Duplicate WAV data");
      data = bytes.subarray(at + 8, end);
    }
    at = end + (size % 2);
  }
  if (
    !fmt ||
    !data ||
    ![1, 2].includes(fmt.channels) ||
    fmt.sampleRate < 8000 ||
    fmt.sampleRate > 192000 ||
    !(
      (fmt.format === 1 && [16, 24, 32].includes(fmt.bits)) ||
      (fmt.format === 3 && fmt.bits === 32)
    ) ||
    fmt.blockAlign !== (fmt.channels * fmt.bits) / 8 ||
    fmt.byteRate !== fmt.sampleRate * fmt.blockAlign ||
    data.length % fmt.blockAlign
  )
    throw Error(
      "Unsupported or malformed WAV; use mono/stereo PCM16/24/32 or float32",
    );
  if (fmt.format === 3)
    for (let at = 0; at < data.length; at += 4)
      if (!Number.isFinite(data.readFloatLE(at)))
        throw Error("Nonfinite WAV sample");
  return {
    ...fmt,
    frames: data.length / fmt.blockAlign,
    durationSec: data.length / fmt.byteRate,
  };
}
/** Fixed-rate, half-open PNG sequence to SDR H.264/AAC. Previous output survives
 * every validation/encoder/probe failure. FFmpeg and ffprobe are external tools. */
export async function exportFilm(options) {
  const { fps } = options,
    timeout = options.timeoutMs ?? 300000,
    maxFrames = options.maxFrames ?? 86400,
    maxBytes = options.maxInputBytes ?? 4 * 1024 ** 3,
    maxPixels = options.maxPixels ?? 16777216;
  if (
    !Number.isFinite(fps) ||
    fps < 1 ||
    fps > 240 ||
    ![timeout, maxFrames, maxBytes, maxPixels].every(
      (v) => Number.isSafeInteger(v) && v > 0,
    ) ||
    timeout > 2147483647
  )
    throw Error("Invalid film rate/deadline/budgets");
  const output = path.resolve(options.output),
    reportPath = path.resolve(options.reportPath);
  if (path.extname(output).toLowerCase() !== ".mp4")
    throw Error("Film output must be .mp4");
  const controller = new AbortController(),
    abort = () =>
      controller.abort(
        options.signal.reason ??
          new DOMException("Film cancelled", "AbortError"),
      );
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(
      () =>
        controller.abort(
          new DOMException("Film export timed out", "TimeoutError"),
        ),
      timeout,
    ),
    signal = controller.signal;
  let stage;
  try {
    check(signal);
    if ((await fsp.stat(reportPath)).size > 16 * 1024 ** 2)
      throw Error("Sequence report byte budget exceeded");
    const report = JSON.parse(await fsp.readFile(reportPath, "utf8"));
    if (
      !Array.isArray(report.frames) ||
      !report.frames.length ||
      report.frames.length > maxFrames
    )
      throw Error("Film frame budget exceeded");
    const times = report.frames.map((_, i) => i / fps),
      root = path.dirname(reportPath);
    let preflightBytes = 0;
    for (const frame of report.frames) {
      check(signal);
      if (typeof frame?.imagePath !== "string")
        throw Error("Missing frame imagePath");
      preflightBytes += (await fsp.stat(path.resolve(root, frame.imagePath)))
        .size;
      if (preflightBytes > maxBytes)
        throw Error("Film input byte budget exceeded");
    }
    const gate = validateSequenceReport(report, { root, times });
    if (!gate.passed) throw Error("Sequence gate: " + gate.errors.join("; "));
    await fsp.mkdir(path.dirname(output), { recursive: true });
    stage = await fsp.mkdtemp(path.join(path.dirname(output), ".zhuda-film-"));
    let width,
      height,
      total = 0;
    for (let i = 0; i < report.frames.length; i++) {
      check(signal);
      const frame = report.frames[i],
        file = path.resolve(root, frame.imagePath);
      total += (await fsp.stat(file)).size;
      if (total > maxBytes) throw Error("Film input byte budget exceeded");
      const bytes = await fsp.readFile(file);
      if (sha(bytes) !== frame.imageSha256)
        throw Error("Frame changed after validation: " + i);
      if (
        bytes.length < 33 ||
        !bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
        bytes.toString("ascii", 12, 16) !== "IHDR"
      )
        throw Error("Expected PNG at frame " + i);
      const w = bytes.readUInt32BE(16),
        h = bytes.readUInt32BE(20);
      if (!w || !h || w * h > maxPixels || w % 2 || h % 2)
        throw Error("Film needs even PNG dimensions within pixel budget");
      if (i === 0) {
        width = w;
        height = h;
      } else if (w !== width || h !== height)
        throw Error("Film frame dimensions differ");
      const png = PNG.sync.read(bytes, { checkCRC: true });
      for (let p = 3; p < png.data.length; p += 4)
        if (png.data[p] !== 255)
          throw Error(
            "Film requires opaque sRGB PNG frames; composite alpha before export",
          );
      await fsp.writeFile(
        path.join(stage, `frame-${String(i).padStart(8, "0")}.png`),
        bytes,
      );
    }
    let audio = null;
    if (options.audio) {
      const file = path.resolve(options.audio);
      total += (await fsp.stat(file)).size;
      if (total > maxBytes) throw Error("Film input byte budget exceeded");
      const bytes = await fsp.readFile(file);
      audio = inspectFilmWav(bytes);
      if (
        Math.abs(audio.durationSec - report.frames.length / fps) >
        1 / audio.sampleRate + 1e-9
      )
        throw Error("Soundtrack duration must match frameCount / fps");
      await fsp.writeFile(path.join(stage, "soundtrack.wav"), bytes);
    }
    check(signal);
    const target = path.join(stage, "movie.mp4");
    const args = [
      "-nostdin",
      "-hide_banner",
      "-v",
      "error",
      "-framerate",
      String(fps),
      "-i",
      path.join(stage, "frame-%08d.png"),
    ];
    if (audio) args.push("-i", path.join(stage, "soundtrack.wav"));
    args.push("-map", "0:v:0");
    if (audio) args.push("-map", "1:a:0");
    args.push(
      "-frames:v",
      String(report.frames.length),
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "18",
      "-vf",
      "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=iec61966-2-1:colorspace=bt709",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "iec61966-2-1",
      "-colorspace",
      "bt709",
      "-color_range",
      "tv",
    );
    if (audio) args.push("-c:a", "aac", "-b:a", "192k");
    args.push("-movflags", "+faststart", target);
    await command(options.ffmpeg ?? "ffmpeg", args, signal);
    const probe = JSON.parse(
      await command(
        options.ffprobe ?? "ffprobe",
        [
          "-v",
          "error",
          "-count_frames",
          "-show_streams",
          "-show_format",
          "-of",
          "json",
          target,
        ],
        signal,
      ),
    );
    const video = probe.streams?.find((s) => s.codec_type === "video"),
      sound = probe.streams?.find((s) => s.codec_type === "audio"),
      ratio = (value) => {
        const [a, b] = String(value).split("/").map(Number);
        return a / b;
      };
    if (
      !video ||
      ![ratio(video.avg_frame_rate), Number(video.duration)].every(
        Number.isFinite,
      ) ||
      video.color_primaries !== "bt709" ||
      video.color_range !== "tv" ||
      video.width !== width ||
      video.height !== height ||
      Number(video.nb_read_frames) !== report.frames.length ||
      Math.abs(ratio(video.avg_frame_rate) - fps) > 1e-6 ||
      Math.abs(Number(video.duration) - report.frames.length / fps) > 1 / fps ||
      video.pix_fmt !== "yuv420p" ||
      video.color_space !== "bt709" ||
      video.color_transfer !== "iec61966-2-1"
    )
      throw Error(
        "Encoded video probe differs from sequence: " + JSON.stringify(video),
      );
    if (
      audio &&
      (!sound ||
        !Number.isFinite(Number(sound.duration)) ||
        Number(sound.channels) !== audio.channels ||
        Number(sound.sample_rate) !== audio.sampleRate ||
        Math.abs(Number(sound.duration) - audio.durationSec) > 0.03)
    )
      throw Error("Encoded audio probe differs from soundtrack");
    check(signal);
    await fsp.rename(target, output);
    return {
      passed: true,
      output,
      frames: report.frames.length,
      fps,
      width,
      height,
      durationSec: report.frames.length / fps,
      color: {
        primaries: "bt709",
        transfer: "srgb",
        matrix: "bt709",
        range: "limited",
      },
      audio,
      probe,
    };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
    if (stage) await fsp.rm(stage, { recursive: true, force: true });
  }
}
export async function filmCli(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      output: { type: "string", short: "o" },
      fps: { type: "string" },
      audio: { type: "string" },
      ffmpeg: { type: "string" },
      ffprobe: { type: "string" },
      "timeout-ms": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help)
    return "Usage: zhuda-film-export report.json --fps 24 --output movie.mp4 [--audio soundtrack.wav] [--ffmpeg path --ffprobe path --timeout-ms 300000]";
  if (positionals.length !== 1 || !values.output || !values.fps)
    throw Error("Expected report.json, --fps and --output; use --help");
  const controller = new AbortController(),
    abort = () =>
      controller.abort(
        new DOMException("Film export interrupted", "AbortError"),
      );
  process.once("SIGINT", abort);
  process.once("SIGTERM", abort);
  try {
    return await exportFilm({
      reportPath: positionals[0],
      output: values.output,
      fps: Number(values.fps),
      audio: values.audio,
      ffmpeg: values.ffmpeg,
      ffprobe: values.ffprobe,
      timeoutMs:
        values["timeout-ms"] === undefined
          ? undefined
          : Number(values["timeout-ms"]),
      signal: controller.signal,
    });
  } finally {
    process.removeListener("SIGINT", abort);
    process.removeListener("SIGTERM", abort);
  }
}
const invoked =
  process.argv[1] &&
  fs.existsSync(process.argv[1]) &&
  fs.realpathSync(process.argv[1]) ===
    fs.realpathSync(fileURLToPath(import.meta.url));
if (invoked)
  try {
    const result = await filmCli(process.argv.slice(2));
    console.log(
      typeof result === "string" ? result : JSON.stringify(result, null, 2),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
