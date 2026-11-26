// prefabs copy (2d/ashfall-duel/source/tools/): the four sounds of 「灰燼之庭」 from the
// engine's fixed synthesizer. Only the output path changed (../../assets/sound/ of the module).
// Run from prefabs: node 2d/ashfall-duel/source/tools/bake-audio.mjs
import { writeFile } from "node:fs/promises";
import { renderZhudaSynthWav } from "zhuda-laya-engine";

const tone = (frequencyHz, endFrequencyHz, gain, releaseSec, startSec = 0) => ({
  type: "tone",
  frequencyHz,
  endFrequencyHz,
  gain,
  startSec,
  envelope: { attackSec: 0.002, releaseSec },
});
const noise = (
  color,
  gain,
  lowpassHz,
  highpassHz,
  attackSec,
  releaseSec,
  startSec = 0,
) => ({
  type: "noise",
  color,
  gain,
  lowpassHz,
  highpassHz,
  startSec,
  envelope: { attackSec, releaseSec },
});
const sounds = {
  impact: [
    0.46,
    [
      noise("brown", 1.1, 1400, 32, 0.002, 0.16),
      tone(116, 47, 0.62, 0.13),
      tone(296, 224, 0.16, 0.15),
      tone(685, 607, 0.1, 0.19),
      tone(1398, 1354, 0.045, 0.09),
      noise("white", 0.35, 3800, 540, 0.001, 0.078),
      noise("pink", 0.23, 1450, 220, 0.009, 0.13, 0.056),
      tone(406, 369, 0.07, 0.15, 0.052),
    ],
  ],
  swing: [
    0.34,
    [
      noise("pink", 0.92, 2340, 125, 0.064, 0.19),
      noise("brown", 0.44, 960, 45, 0.052, 0.13, 0.025),
    ],
  ],
  step: [
    0.2,
    [
      noise("brown", 0.8, 1250, 45, 0.002, 0.1),
      tone(79, 44, 0.27, 0.075),
      noise("pink", 0.35, 1975, 600, 0.007, 0.09, 0.028),
    ],
  ],
  evade: [
    0.35,
    [
      noise("brown", 0.9, 1175, 50, 0.035, 0.22),
      noise("pink", 0.4, 1700, 290, 0.065, 0.15, 0.035),
    ],
  ],
};
for (const [id, [durationSec, layers]] of Object.entries(sounds)) {
  const data = renderZhudaSynthWav({
    schemaVersion: 1,
    id,
    durationSec,
    sampleRate: 32000,
    seed: 273,
    peak: 0.86,
    layers,
  });
  await writeFile(
    new URL("../../assets/sound/" + id + ".wav", import.meta.url),
    data,
  );
}
