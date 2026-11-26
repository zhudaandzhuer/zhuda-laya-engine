// 「灰燼之庭」 combat, ported from games/ashfall-duel/tests/combat.test.mjs (author CCW): the same
// fifteen tests against 2d/ashfall-duel and 2d/cel-motion. combat.ts drives the engine's own
// ZhudaActionStateMachine and ZhudaInputBuffer, so this file loads the engine's ESM build in
// node (it does at def94aa); the other library tests stay engine-free.
import assert from "node:assert/strict";
import { test } from "node:test";
import { Duel } from "../2d/ashfall-duel/combat.ts";
import { PoseTrack } from "../2d/cel-motion/cel-motion.ts";
import { CELS as strips } from "../2d/ashfall-duel/motion-cels.ts";
import {
  FlexibleBlade,
  KNIGHT,
  KNIGHT_SCALE,
  WARDEN,
  WARDEN_SCALE,
  fixed,
  onBlade,
  pin,
  plantBlade,
  wardenSurface,
} from "../2d/ashfall-duel/motion.ts";

const dt = 1 / 120;
function ticks(game, seconds) {
  for (let n = 0; n < Math.round(seconds / dt); n++) game.step(dt);
}
function fresh() {
  const game = new Duel();
  game.reset();
  return game;
}
function strike(game, hold = 0, point) {
  game.press(point);
  ticks(game, hold);
  game.release(point);
}

test("a tap damages one plate once; dust and the drawn point agree at contact", () => {
  const game = fresh();
  strike(game);
  while (!game.hits && game.time < 1) game.step(dt);
  assert.equal(game.hits, 1);
  assert.equal(game.foeHp, 84);
  const dust = game.events.find((e) => e.kind === "impact");
  assert.ok(dust);
  assert.ok(Math.abs(dust.y - game.view.dent.y) < 0.01);
  const tip = onBlade(game.view.blade, game.view.blade.contactU);
  assert.ok(
    Math.hypot(
      tip.x - game.view.dent.x - game.view.dent.displacement,
      tip.y - dust.y
    ) < 0.01
  );
  let minimum = Infinity,
    maximum = 0;
  for (let i = 0; i < 145; i++) {
    game.step(dt);
    minimum = Math.min(minimum, game.view.dent.displacement);
    maximum = Math.max(maximum, game.view.dent.displacement);
  }
  assert.equal(game.hits, 1);
  assert.ok(maximum > 7 && minimum < -0.3);
  assert.ok(Math.abs(game.view.dent.displacement) < 0.07);
});

test("release charge changes damage, stamina cost and impact force", () => {
  const tap = fresh(),
    heavy = fresh();
  strike(tap);
  strike(heavy, 0.79);
  for (const game of [tap, heavy])
    while (!game.hits && game.time < 2) game.step(dt);
  assert.equal(heavy.hits, 1);
  assert.ok(heavy.lastDamage > tap.lastDamage);
  assert.ok(heavy.stamina < tap.stamina);
  assert.ok(heavy.view.dent.displacement > tap.view.dent.displacement);
});

test("choosing the upper and lower armor moves the actual hit and dust origin", () => {
  const impactY = (aim) => {
    const g = fresh(),
      foe = g.view.warden;
    const p = wardenSurface(foe.pose, foe.x, foe.y, aim);
    strike(g, 0, p);
    ticks(g, 0.8);
    const hit = g.events.find((e) => e.kind === "impact");
    assert.ok(hit);
    return hit.y;
  };
  assert.ok(impactY(1) - impactY(-1) > 80);
});

test("a swing outside blade reach spends stamina and creates no hit dust", () => {
  const game = fresh();
  game.evade();
  ticks(game, 0.5);
  game.direction = -1;
  ticks(game, 0.37);
  game.direction = 0;
  strike(game);
  ticks(game, 0.78);
  assert.equal(game.foeHp, 100);
  assert.equal(game.hits, 0);
  assert.ok(game.events.some((e) => e.kind === "swing"));
  assert.ok(!game.events.some((e) => e.kind === "impact"));
});

test("steel bends under an acceleration impulse, relaxes and stays pinned at the guard", () => {
  function peak(acceleration) {
    const steel = new FlexibleBlade();
    steel.reset(0);
    let max = 0;
    for (let i = 1; i <= 20; i++) {
      steel.step((acceleration * (i * dt) ** 2) / 2, dt, 0.7);
      max = Math.max(max, Math.abs(steel.bend));
    }
    for (let i = 0; i < 240; i++) steel.step(steel.angle, dt, 0.7);
    assert.ok(Math.abs(steel.bend) < 0.01);
    return max;
  }
  assert.ok(peak(120) > 2 * peak(30));
  const grip = { x: 44, y: 80 },
    end = { x: 236, y: 67 },
    blade = plantBlade(grip, end, -48);
  assert.deepEqual(onBlade(blade, 0), grip);
  assert.ok(
    Math.hypot(
      onBlade(blade, blade.contactU).x - end.x,
      onBlade(blade, blade.contactU).y - end.y
    ) < 1e-5
  );
  assert.ok(
    Math.hypot(onBlade(blade, 1).x - grip.x, onBlade(blade, 1).y - grip.y) >=
      306
  );
});

test("backstep evades an oncoming gauntlet and pausing freezes simulation", () => {
  const evade = fresh(),
    stay = fresh();
  while (evade.wardAction !== "startup" && evade.time < 5) {
    evade.step(dt);
    stay.step(dt);
  }
  ticks(evade, 0.53);
  ticks(stay, 0.53);
  evade.evade();
  ticks(evade, 0.72);
  ticks(stay, 0.72);
  assert.ok(stay.heroHp < 100);
  assert.equal(evade.heroHp, 100);
  evade.pause();
  const time = evade.time,
    pos = evade.view.knight.x;
  ticks(evade, 1);
  assert.equal(evade.time, time);
  assert.equal(evade.view.knight.x, pos);
});

test("both outcomes and a new duel are reachable", () => {
  const idle = fresh();
  ticks(idle, 29);
  assert.equal(idle.mode, "defeat");
  assert.equal(idle.heroHp, 0);
  idle.reset();
  assert.equal(idle.mode, "duel");
  assert.equal(idle.heroHp, 100);
  for (let i = 0; i < 12 && idle.mode === "duel"; i++) {
    strike(idle, i === 0 ? 0.75 : 0);
    ticks(idle, 1);
  }
  assert.equal(idle.mode, "victory");
  assert.equal(idle.foeHp, 0);
  idle.reset();
  assert.equal(idle.foeHp, 100);
  assert.equal(idle.hits, 0);
  assert.equal(idle.input.size, 0);
});

test("both directions ease into motion, plant each boot and brake to a stop", () => {
  for (const direction of [-1, 1]) {
    const game = fresh();
    game.direction = direction;
    const planted = [0, 0],
      lifted = [0, 0],
      previous = [0, 0];
    const first = game.view.knight.x;
    game.step(dt);
    const initialSpeed = Math.abs(game.view.knight.x - first) / dt;
    assert.ok(initialSpeed > 0 && initialSpeed < 25);
    for (let i = 0; i < 84; i++) {
      game.step(dt);
      const actor = game.view.knight;
      for (const [leg, joint] of [3, 4].entries()) {
        const boot = pin(KNIGHT, actor.pose, joint, KNIGHT_SCALE);
        const x = actor.x + boot.x;
        if (i > 35) {
          if (Math.abs(x - previous[leg]) < 0.08) planted[leg]++;
          lifted[leg] = Math.max(
            lifted[leg],
            pin(KNIGHT, fixed(0), joint, KNIGHT_SCALE).y - boot.y
          );
        }
        previous[leg] = x;
      }
    }
    assert.ok(planted.every((frames) => frames >= 10));
    assert.ok(lifted.every((height) => height > 10));
    const released = game.view.knight.x;
    game.direction = 0;
    ticks(game, 0.12);
    const stopped = game.view.knight.x;
    assert.ok(
      (stopped - released) * direction > 2 && Math.abs(stopped - released) < 12
    );
    ticks(game, 0.12);
    assert.equal(game.view.knight.x, stopped);
  }
});

test("walk, charge and startup keep steel straight; contact flex exceeds free flight", () => {
  for (const hold of [0, 0.24, 0.8]) {
    const game = fresh();
    game.direction = -1;
    ticks(game, 0.1);
    game.direction = 0;
    assert.equal(game.view.blade.bend, 0);
    game.press();
    for (let i = 0; i < Math.round(hold / dt); i++) {
      game.step(dt);
      assert.equal(game.view.blade.bend, 0);
    }
    let wrist = game.view.blade.grip,
      flight = 0,
      contact = 0;
    game.release();
    for (let i = 0; i < 150; i++) {
      game.step(dt);
      const blade = game.view.blade;
      const travel = Math.hypot(blade.grip.x - wrist.x, blade.grip.y - wrist.y);
      assert.ok(
        travel < (i === 0 ? 3 : 32),
        "continuous wrist through release"
      );
      wrist = blade.grip;
      if (!game.events.some((event) => event.kind === "swing"))
        assert.equal(blade.bend, 0);
      if (!game.hits) flight = Math.max(flight, Math.abs(blade.bend));
      if (blade.touching) contact = Math.max(contact, Math.abs(blade.bend));
    }
    assert.ok(flight > 0 && flight <= 13);
    assert.ok(contact > flight);
    assert.equal(game.view.blade.bend, 0);
  }
});

test("the opening demonstration starts straight and produces dust only on a simulated hit", () => {
  const game = new Duel();
  for (let i = 0; i < 180; i++) {
    assert.equal(game.view.blade.bend, 0);
    assert.equal(game.hits, 0);
    game.step(dt);
  }
  while (game.hits === 0 && game.time < 3) game.step(dt);
  assert.equal(game.hits, 1);
  assert.equal(game.mode, "title");
  assert.equal(game.view.blade.touching, true);
  assert.ok(game.events.some((event) => event.kind === "impact"));
  game.reset();
  assert.equal(game.hits, 0);
  assert.equal(game.view.blade.bend, 0);
});

test("a light tap hits within a quarter second from the opening distance", () => {
  const game = fresh();
  strike(game);
  while (!game.hits && game.time < 0.3) game.step(dt);
  assert.equal(game.hits, 1);
  assert.ok(game.time <= 0.25);
});

test("rapid input queues one follow-up swing during recovery", () => {
  const game = fresh();
  strike(game);
  ticks(game, 0.235);
  strike(game);
  strike(game);
  ticks(game, 1.1);
  assert.equal(game.events.filter(e => e.kind === "swing").length, 2);
  assert.equal(game.hits, 2);
  assert.equal(game.input.size, 0);
});

test("a buffered backstep interrupts recovery and discards the queued swing", () => {
  const game = fresh();
  strike(game);
  ticks(game, 0.15);
  strike(game);
  game.evade();
  while (!game.events.some(e => e.kind === "evade") && game.time < 0.6) game.step(dt);
  assert.ok(game.time < 0.45);
  ticks(game, 0.6);
  assert.equal(game.events.filter(e => e.kind === "swing").length, 1);
});

test("walking resumes after a gauntlet strike with the same direction still held", () => {
  const game = fresh();
  // Let the guard start its attack at close range; keep retreat held through contact.
  game.direction = 1;
  while (game.wardAction !== "active" && game.time < 5) game.step(dt);
  game.direction = -1;
  while (game.heroHp === 100 && game.time < 5) game.step(dt);
  assert.equal(game.heroHp, 76);
  assert.equal(game.direction, -1);
  ticks(game, 0.55);
  const x = game.view.knight.x;
  ticks(game, 0.12);
  assert.ok(game.view.knight.x < x - 10);
});

test("interrupted poses traverse registered cels in either direction on both figures", () => {
  for (const [name, frames, scale] of [["knight", KNIGHT, KNIGHT_SCALE],["warden", WARDEN, WARDEN_SCALE]]) {
    const track = new PoseTrack(frames, strips[name].edges, scale);
    const edges = strips[name].edges;
    for (const [key,tiles] of Object.entries(edges)) {
      assert.ok(tiles.length >= 4);
      const [a,b] = key.split("-").map(Number);
      for (const reverse of [false,true]) {
        track.reset();
        const from=track.sample("move",{a,b,t:0.55},dt);
        const dest=fixed(reverse?a:b);
        const start=track.sample("interrupt",dest,dt);
        assert.ok(Math.hypot(start.joints[2].x-from.joints[2].x,start.joints[2].y-from.joints[2].y)<3);
        let end=start;
        for(let i=0;i<70;i++) {
          end=track.sample("interrupt",dest,dt);
          if(end.a!==end.b) assert.ok(edges[end.a+"-"+end.b]);
        }
        assert.equal(end.a,dest.a);
        assert.equal(end.b,dest.b);
      }
    }
  }
});
