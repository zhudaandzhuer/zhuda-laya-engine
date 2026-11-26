// Captures the micro film frame by frame in headless Chrome.
// Usage: node tools/film.mjs [firstShot] [lastShot]     (shot numbers from 1; default all)
// Reads film/voice/<line>.wav for the lengths, writes film/frames/f00000.jpg ... and film/timeline.json.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromeFixture } from '../node_modules/zhuda-laya-engine/packages/compiler/chrome-host.mjs';
import { serve } from './serve.mjs';
import { FPS, SHOTS } from '../src/film.ts';
const project = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const lines = JSON.parse(fs.readFileSync(path.join(project, 'film/lines.json'), 'utf8'));
const LEAD = 1.0,
  TAIL = 1.3;
const seconds = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString());
// Each shot holds its line: a second before it, a little more after.
let at = 0;
const timeline = SHOTS.map((shot) => {
  const line = lines.find((l) => l.id === shot.line);
  const voice = line ? seconds(path.join(project, 'film/voice', line.id + '.wav')) : 0;
  const length = Math.round(Math.max(shot.seconds, voice ? LEAD + voice + TAIL : 0) * FPS) / FPS;
  const entry = { id: shot.id, start: at, seconds: length, line: line?.id, text: line?.text, voiceAt: at + LEAD, voiceSeconds: voice };
  at += length;
  return entry;
});
// Subtitles: a line is shown a clause or two at a time, for a share of its length by its letters.
const subs = [];
for (const entry of timeline) {
  if (!entry.text) continue;
  const clauses = entry.text.match(/[^，。、？！]+[，。、？！]?/g) ?? [entry.text];
  const parts = [];
  for (const clause of clauses) {
    const last = parts[parts.length - 1];
    if (last && (last + clause).length <= 17) parts[parts.length - 1] = last + clause;
    else parts.push(clause);
  }
  const letters = parts.reduce((sum, part) => sum + part.length, 0);
  let t = entry.voiceAt;
  for (const part of parts) {
    const share = (entry.voiceSeconds * part.length) / letters;
    subs.push({ start: t, end: t + share, text: part.replace(/[，。、]$/, '') });
    t += share;
  }
}
const total = at;
// film/film.json: { "title", "under", "endUnder", "query" } — the cards at both ends and the page's address parameters.
const about = JSON.parse(fs.readFileSync(path.join(project, 'film/film.json'), 'utf8'));
const cards = [
  { start: 0.6, end: 6, title: about.title, under: about.under ?? '' },
  { start: total - 9, end: total, title: about.title, under: about.endUnder ?? '' },
];
fs.writeFileSync(path.join(project, 'film/timeline.json'), JSON.stringify({ fps: FPS, total, timeline, subs, cards }, null, 1));
const first = Number(process.argv[2] || 1) - 1,
  last = Number(process.argv[3] || SHOTS.length) - 1;
const frames = path.join(project, 'film/frames');
fs.mkdirSync(frames, { recursive: true });
const { server, base } = await serve();
const browser = await chromeFixture();
try {
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await browser.send('Page.navigate', { url: `${base}index.html?film=1&width=1280&height=720&${about.query ?? ''}&durs=${timeline.map((e) => e.seconds).join(',')}` });
  for (let i = 0; i < 900; i++) {
    if (await browser.evaluate('!!window.__FILM__').catch(() => false)) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  await browser.evaluate(`Object.assign(window.__FILM__.words, ${JSON.stringify({ subs, cards })}); 1`);
  await new Promise((r) => setTimeout(r, 6000));
  const startFrame = Math.round(timeline[first].start * FPS),
    endFrame = Math.round((timeline[last].start + timeline[last].seconds) * FPS);
  // Start at the first shot asked for.
  await browser.evaluate(`window.__FILM__.time = ${startFrame / FPS}; window.__FILM__.frame = ${startFrame}; window.__FILM__.shot = -1; 1`);
  const step = `new Promise((resolve) => { const f = window.__FILM__; const want = f.frame + 1; f.pending = 1; const wait = () => (f.frame >= want ? requestAnimationFrame(() => requestAnimationFrame(() => resolve(f.shot))) : requestAnimationFrame(wait)); wait(); })`;
  let shotNow = -1;
  const began = Date.now();
  for (let n = startFrame; n < endFrame; n++) {
    const shot = await browser.evaluate(step, { awaitPromise: true, timeoutMs: 60000 });
    if (shot !== shotNow) {
      // A cut to a new place: let its grass and its shaders arrive before the frame is taken.
      shotNow = shot;
      await new Promise((r) => setTimeout(r, 2500));
    }
    const reply = await browser.send('Page.captureScreenshot', { format: 'jpeg', quality: 93 });
    fs.writeFileSync(path.join(frames, `f${String(n).padStart(5, '0')}.jpg`), Buffer.from(reply.data ?? reply.result.data, 'base64'));
    if (n % 240 === 0) console.log(`frame ${n} of ${endFrame}, shot ${shot + 1}, ${Math.round((Date.now() - began) / 1000)} s`);
  }
  console.log(JSON.stringify({ frames: endFrame - startFrame, rendererErrors: await browser.evaluate('JSON.stringify(window.__FILM__.errors())'), pageErrors: browser.errors.slice(0, 4) }));
} finally {
  await browser.close();
  server.close();
}
