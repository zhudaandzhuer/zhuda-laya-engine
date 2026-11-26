// Every scene the viewer can open. Add a preset here when a 3D module is added to
// prefabs/3d, and give it `views` worth opening (time, weather, states).
import type { ScenePreset } from './preset.ts';
import { naturePack } from './presets/nature-pack.ts';
import { gardenIsland } from './presets/garden-island.ts';
import { skyIsland } from './presets/sky-island.ts';
import { homeIsland } from './presets/home-island.ts';
import { stickman } from './presets/stickman.ts';
import { stickmanGarage } from './presets/stickman-garage.ts';
import { seasidePier } from './presets/seaside-pier.ts';
import { layeredHosiery } from './presets/layered-hosiery.ts';
import { modelStand } from './presets/model-stand.ts';

export const PRESETS: ScenePreset[] = [skyIsland, homeIsland, gardenIsland, naturePack, seasidePier, stickman, stickmanGarage, layeredHosiery, modelStand];
