// Every 2D scene or game the viewer can open. Add a preset here when a module is added to
// prefabs/2d, and give it `views` worth opening (states, screens, moments).
import type { ScenePreset } from './preset.ts';
import { stageCheck } from './presets/stage-check.ts';
import { dungeonSpin } from './presets/dungeon-spin.ts';
import { cascadeSlot } from './presets/cascade-slot.ts';
import { ashfallDuel } from './presets/ashfall-duel.ts';
import { spineTights } from './presets/spine-tights.ts';

export const PRESETS: ScenePreset[] = [ashfallDuel, dungeonSpin, cascadeSlot, spineTights, stageCheck];
