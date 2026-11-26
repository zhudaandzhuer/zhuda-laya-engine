// A player who does everything a session offers, for balance tests and recorded runs.
import { TASKS, bestTeam, claimAfk, claimLogin, claimTask, fight, levelAll, quickAfk, rollDay, starUp, summon, summonCost, type Save } from './idle.ts';

/** One visit: collect, summon, tidy the team, level, push stages until two losses. Returns stages cleared. */
export function session(save: Save, now: number): number {
  rollDay(save, now);
  while (claimLogin(save)) {}
  claimAfk(save, now);
  while (summonCost(save, 10) && summon(save, 10)) {}
  for (const id of Object.keys(save.heroes)) while (starUp(save, id)) {}
  save.team = bestTeam(save);
  let cleared = 0, losses = 0;
  while (losses < 2 && cleared < 200) {
    levelAll(save);
    if (fight(save).win) cleared += 1;
    else {
      losses += 1;
      if (losses === 1) quickAfk(save);
    }
  }
  for (const t of TASKS) claimTask(save, t.id);
  return cleared;
}
