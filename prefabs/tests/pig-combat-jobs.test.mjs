// The pig's callings (src/systems/combat/jobs.ts): the round of five plain attacks that ends in a heavy blow,
// kept presses, a broken round beginning again, the skill and its rest, the boxer's heat and fire, the Taoist's
// paper charms.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ATTACK_CLIPS, COMBAT, JOBS, current, isAblaze, newCombat, pressAttack, pressSkill, progress, stepCombat, switchJob } from '../systems/pig-combat/jobs.ts';

/**
 * Steps in sixtieths. `presses` are the frames at which attack is pressed (or a number: every so many seconds);
 * `skills` likewise for the skill. Returns what was begun and every event.
 */
function fight(state, seconds, presses = [], skills = []) {
  const every = (what, frame) => (typeof what === 'number' ? what > 0 && frame % Math.max(1, Math.round(what * 60)) === 0 : what.includes(frame));
  const begun = [], events = [];
  for (let frame = 0; frame < Math.round(seconds * 60); frame++) {
    for (const [what, press] of [[skills, pressSkill], [presses, pressAttack]]) {
      if (!every(what, frame)) continue;
      const pressed = press(state);
      state = pressed.state;
      events.push(...pressed.events);
    }
    const stepped = stepCombat(state, 1 / 60);
    state = stepped.state;
    events.push(...stepped.events);
  }
  for (const event of events) if (event.type === 'start') begun.push((event.skill ? '*' : '') + event.step.effect);
  return { state, begun, events };
}

test('with no calling neither button does anything', () => {
  assert.equal(pressAttack(newCombat()).refused, 'no-job');
  assert.equal(pressSkill(newCombat()).refused, 'no-job');
});

test('every calling has the same round: three blows, a roll backward, and a heavy blow to end it', () => {
  const rounds = {
    fist: ['jab', 'straight', 'hook', 'roll', 'kick'],
    ninja: ['cut', 'back-cut', 'cut', 'roll', 'chop'],
    taoist: ['jab', 'straight', 'hook', 'roll', 'ice-charm'],
  };
  for (const [job, round] of Object.entries(rounds)) {
    assert.deepEqual(JOBS[job].steps.map((step) => step.effect), round);
    assert.deepEqual(JOBS[job].steps.map((step) => !!step.heavy), [false, false, false, false, true], job + ': only the last is the heavy blow');
    assert.equal(fight(newCombat(job), 5, 0.1).begun.slice(0, 6).join(), [...round, round[0]].join(), job + ' pressed again and again');
    // The roll goes backward; the boxer and the ninja come forward again with the heavy blow, the Taoist stays.
    const [, , , roll, heavy] = JOBS[job].steps;
    assert.ok(roll.back && roll.dash && roll.advance > 0.3, job + ': the roll carries it backward');
    assert.equal(!!(heavy.advance && heavy.dash && !heavy.back), job !== 'taoist', job + ': the heavy blow');
  }
});

test('one press is one attack', () => {
  for (const job of Object.keys(JOBS)) {
    const { begun, state } = fight(newCombat(job), 2, [0]);
    assert.equal(begun.length, 1, job);
    assert.equal(state.step, -1);
  }
});

test('pressed again and again the round never stops and no blow is dropped, whatever the rhythm', () => {
  for (const every of [0.05, 0.1, 0.16, 0.22]) {
    const { events } = fight(newCombat('ninja'), 4, every);
    const starts = events.filter((event) => event.type === 'start').length,
      hits = events.filter((event) => event.type === 'hit').length;
    assert.ok(hits >= starts - 1, 'every blow lands: ' + hits + ' of ' + starts);
    assert.equal(events.filter((event) => event.type === 'end').length, 0, 'pressed every ' + every + ' s the round never stops');
  }
});

test('a round that is broken off begins again: the heavy blow is only ever the end of an unbroken round', () => {
  // press, press, press ... a pause ... press, press: the two after the pause are the first two blows again.
  const broken = fight(newCombat('taoist'), 4, [0, 12, 24, 100, 112]);
  assert.deepEqual(broken.begun, ['jab', 'straight', 'hook', 'jab', 'straight']);
  // Any pause after which an attack has ended with nothing asked for breaks it, however short past the grace.
  for (const job of Object.keys(JOBS)) {
    const first = JOBS[job].steps[0];
    const pause = Math.ceil((first.seconds + COMBAT.roundKeeps) * 60) + 2;
    const { begun } = fight(newCombat(job), 6, [0, pause, 2 * pause, 3 * pause, 4 * pause, 5 * pause]);
    assert.ok(begun.length === 6 && begun.every((effect) => effect === first.effect), job + ': pressed one at a time it is always the first blow: ' + begun);
    assert.ok(!begun.includes(JOBS[job].steps[4].effect));
  }
  // A press a hair after an attack has ended still goes on with the round.
  const first = JOBS.fist.steps[0];
  const late = Math.ceil(first.seconds * 60) + 3;
  assert.deepEqual(fight(newCombat('fist'), 2, [0, late]).begun, ['jab', 'straight']);
});

test('a press made during an attack is kept and answered when the attack lets go, not before', () => {
  let state = pressAttack(newCombat('fist')).state;
  state = stepCombat(state, 0.05).state;
  state = pressAttack(state).state;
  assert.equal(state.queued, true);
  assert.equal(state.step, 0, 'still the first blow');
  const first = JOBS.fist.steps[0];
  let begun = null;
  for (let i = 0; i < 60 && !begun; i++) {
    const stepped = stepCombat(state, 1 / 120);
    state = stepped.state;
    begun = stepped.events.find((event) => event.type === 'start');
    if (begun) assert.ok(first.seconds * first.chainFrom <= 0.05 + (i + 1) / 120 + 1e-9, 'not before the blow lets go');
  }
  assert.equal(begun.step.effect, 'straight');
});

test('the plain blows come between three and four a second, evenly; the roll and the heavy blow take longer', () => {
  for (const job of Object.keys(JOBS)) {
    const times = [];
    let state = newCombat(job);
    for (let frame = 0; frame < 240; frame++) {
      let began = false;
      if (frame % 3 === 0) {
        const pressed = pressAttack(state);
        state = pressed.state;
        began = pressed.events.some((event) => event.type === 'start');
      }
      const stepped = stepCombat(state, 1 / 60);
      state = stepped.state;
      if (began || stepped.events.some((event) => event.type === 'start')) times.push(frame);
    }
    // how long each of the round's five lasts before the next begins: blow, blow, third, roll, heavy blow
    const gaps = times.slice(1).map((time, i) => time - times[i]).slice(0, 5);
    assert.ok(gaps[0] >= 15 && gaps[0] <= 20 && Math.abs(gaps[0] - gaps[1]) <= 2, job + ': the first two alike, three to four a second: ' + gaps);
    assert.ok(gaps[2] >= 15 && gaps[2] <= 22, job + ': the third: ' + gaps);
    assert.ok(gaps[3] >= 22 && gaps[3] <= 31, job + ': the roll: ' + gaps);
    assert.ok(gaps[4] >= 28 && gaps[4] <= 44 && gaps[4] > gaps[0] * 1.6, job + ': the heavy blow holds a moment: ' + gaps);
  }
});

test('the boxer quickens blow by blow, catches fire, and cools when it stops', () => {
  const { state, events } = fight(newCombat('fist'), 5, 0.1);
  const speeds = events.filter((event) => event.type === 'start').map((event) => event.speed);
  assert.equal(speeds[0], 1);
  assert.ok(speeds[2] > speeds[1] && speeds[1] > speeds[0], 'each quicker than the last: ' + speeds.slice(0, 5));
  assert.ok(Math.max(...speeds) <= COMBAT.quickest + 1e-9);
  assert.equal(events.filter((event) => event.type === 'ablaze').length, 1, 'it catches fire once');
  assert.ok(isAblaze(state));
  const lit = events.findIndex((event) => event.type === 'ablaze');
  assert.equal(events.slice(0, lit).filter((event) => event.type === 'hit' && event.step.effect !== 'roll').length, COMBAT.ablazeAt, 'after ' + COMBAT.ablazeAt + ' blows (a roll is not a blow)');
  const rested = fight(state, COMBAT.heatKeeps + 1.5);
  assert.equal(rested.state.heat, 0);
  assert.ok(rested.events.some((event) => event.type === 'cool'));
  assert.equal(pressAttack(rested.state).events[0].speed, 1, 'and is as slow as at first');
});

test('the boxer\'s skill sets its fists alight at once, keeps them so a while, and must rest before it is done again', () => {
  const pressed = pressSkill(newCombat('fist'));
  assert.equal(pressed.events[0].step.effect, 'blaze');
  assert.equal(pressed.events[0].skill, true);
  let { state, events } = fight(pressed.state, 1);
  assert.ok(events.some((event) => event.type === 'ablaze'));
  assert.ok(isAblaze(state) && state.heat === COMBAT.mostHeat);
  assert.equal(pressSkill(state).refused, 'resting');
  ({ state } = fight(state, COMBAT.furySeconds - 2));
  assert.ok(isAblaze(state), 'still alight though it has not struck');
  ({ state } = fight(state, 4));
  assert.ok(!isAblaze(state), 'and out when the skill has worn off');
  ({ state } = fight(state, JOBS.fist.skillRest));
  assert.equal(pressSkill(state).refused, undefined);
});

test('the skill pressed in the middle of a round is done as soon as the blow lets go, before a kept attack', () => {
  let state = pressAttack(newCombat('ninja')).state;
  state = stepCombat(state, 0.05).state;
  state = pressAttack(state).state;
  state = pressSkill(state).state;
  assert.ok(state.queued && state.queuedSkill);
  assert.deepEqual(fight(state, 1.2).begun, ['*crescent'], 'the skill, and the kept attack is let go');
});

test('the ninja and the Taoist do not quicken', () => {
  for (const job of ['ninja', 'taoist']) assert.ok(fight(newCombat(job), 4, 0.1).events.filter((event) => event.type === 'start').every((event) => event.speed === 1));
});

test('the Taoist\'s round ends in an ice charm, which spends a paper; without one the round begins again instead', () => {
  let { state, begun } = fight(newCombat('taoist'), 2.6, 0.1);
  assert.deepEqual(begun.slice(0, 5), ['jab', 'straight', 'hook', 'roll', 'ice-charm']);
  assert.equal(state.papers, COMBAT.papers - 1);
  const none = fight({ ...newCombat('taoist'), papers: 0 }, 4, 0.1);
  assert.ok(!none.begun.includes('ice-charm'));
  assert.deepEqual(none.begun.slice(0, 6), ['jab', 'straight', 'hook', 'roll', 'jab', 'straight'], 'the first four, and round again');
});

test('the Taoist\'s skill is fire, thunder and then the great circle; one paper, one, then two; refused without', () => {
  let { state, begun } = fight(newCombat('taoist'), 3, [], 0.1);
  assert.deepEqual(begun.slice(0, 3), ['*charm', '*thunder-charm', '*great-charm']);
  // Cast until there is nothing to cast with.
  for (let i = 0; i < 400 && !(state.step < 0 && state.papers === 0); i++) ({ state } = fight(state, 0.1, [], 0.05));
  assert.equal(state.papers, 0);
  assert.equal(pressSkill({ ...state, skillRest: 0 }).refused, 'no-paper');
  // With one charm left and the great spell next, a plain spell is done instead.
  const one = { ...state, papers: 1, skillNext: 2, skillRest: 0 };
  assert.equal(pressSkill(one).events[0].step.effect, 'charm');
  const rested = fight({ ...state, paperClock: 0 }, COMBAT.paperSeconds * 3 + 0.2).state;
  assert.equal(rested.papers, 3, 'one back every ' + COMBAT.paperSeconds + ' s');
  assert.equal(fight(rested, 200).state.papers, COMBAT.papers, 'and no more than it carries');
});

test('taking up another calling stops the attack and keeps the charms', () => {
  let state = pressSkill({ ...newCombat('taoist'), papers: 4 }).state;
  state = switchJob(state, 'fist');
  assert.equal(state.step, -1);
  assert.equal(state.papers, 3);
  assert.equal(progress(state), 0);
  assert.equal(current(state), null);
  assert.equal(state.heat, 0);
});

test('every attack names a clip, lands before it lets go, and lets go before it ends', () => {
  assert.equal(ATTACK_CLIPS.length, 11);
  for (const job of Object.values(JOBS)) for (const step of [...job.steps, ...job.skill]) assert.ok(step.seconds > 0 && step.hitAt > 0 && step.hitAt < step.chainFrom && step.chainFrom < 1, step.clip);
});
