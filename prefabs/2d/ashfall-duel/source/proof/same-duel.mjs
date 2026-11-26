// Drives the original game's Duel and the library's Duel with the same seeded input script and
// compares every field of the state after every 1/120 s step (view, events, meters, mode).
//   git clone <this folder>/../ashfall-duel.bundle /tmp/ashfall-original   (any checkout of the game)
//   ORIGINAL=/tmp/ashfall-original node 2d/ashfall-duel/source/proof/same-duel.mjs   (from prefabs)
// The checkout needs node_modules/zhuda-laya-engine at def94aa (e.g. a symlink to prefabs/node_modules).
import path from 'node:path';
import { pathToFileURL } from 'node:url';
if (!process.env.ORIGINAL) throw Error('ORIGINAL=<checkout of games/ashfall-duel> is required');
const { Duel: Original } = await import(pathToFileURL(path.resolve(process.env.ORIGINAL, 'src/combat.ts')).href);
const { Duel: Library } = await import(new URL('../../combat.ts', import.meta.url).href);
const dt = 1 / 120;
const snapshot = (g) => JSON.stringify({ v: g.view, e: g.events, m: g.mode, h: [g.heroHp, g.foeHp, g.stamina, g.time, g.elapsed, g.hits, g.lastDamage, g.charge, g.hold, g.aim, g.wardAction, g.outcomeTime, g.direction], s: [g.steel.angle, g.steel.bend, g.steel.speed, g.steel.velocity], i: g.input.size });
let compared = 0, mismatches = 0; const seen = { hits: 0, victory: 0, defeat: 0, paused: 0, title: 0, evade: 0, hurt: 0, charged: 0 };
for (let seed = 1; seed <= 40; seed++) {
  let s = seed * 2654435761 >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const a = new Original(), b = new Library();
  for (let n = 0; n < 6000; n++) {
    const r = rnd();
    // an input now and then, the same for both
    if (seed % 5 === 0) { if (n === 0) { a.reset(); b.reset(); } }
    else if (r < 0.004) { a.reset(); b.reset(); }
    else if (r < 0.03) { const d = [-1, 0, 1][Math.floor(rnd() * 3)]; a.direction = b.direction = d; }
    else if (r < 0.045) { const p = rnd() < 0.5 ? undefined : { x: 700 + rnd() * 300, y: 300 + rnd() * 300 }; a.press(p); b.press(p); }
    else if (r < 0.06) { const p = rnd() < 0.5 ? undefined : { x: 700 + rnd() * 300, y: 300 + rnd() * 300 }; a.release(p); b.release(p); }
    else if (r < 0.065) { a.evade(); b.evade(); }
    else if (r < 0.0655 && seed % 4) { a.pause(); b.pause(); }
    else if (r < 0.068) { a.cancelCharge(); b.cancelCharge(); }
    a.step(dt); b.step(dt);
    const x = snapshot(a), y = snapshot(b);
    compared++;
    if (x !== y) { mismatches++; if (mismatches < 3) console.log('seed', seed, 'step', n, x.slice(0, 200), '\n', y.slice(0, 200)); }
    for (const e of a.events) { if (e.kind === 'impact') seen.hits++; if (e.kind === 'evade') seen.evade++; if (e.kind === 'hurt') seen.hurt++; if (e.kind === 'impact' && e.strength > 0.9) seen.charged++; }
    if (a.mode === 'victory' && a.outcomeTime > 0 && a.outcomeTime <= dt * 1.5) seen.victory++;
    if (a.mode === 'defeat' && a.outcomeTime > 0 && a.outcomeTime <= dt * 1.5) seen.defeat++;
    if (a.mode === 'paused') seen.paused++; if (a.mode === 'title') seen.title++;
    a.events.length = 0; b.events.length = 0;
  }
}
console.log(JSON.stringify({ compared, mismatches, seen }));
