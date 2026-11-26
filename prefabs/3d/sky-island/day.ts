// The island's hour and weather as they move: the clock, the weather eased toward
// the chosen one, and lightning in a storm (a flash, then thunder later the farther
// the bolt). Feed `mix` and `flash` to skyAt() of 3d/day-look. No engine here.
import { approach } from '../math.ts';
import type { Weather, WeatherMix } from '../day-look.ts';

export interface IslandDay {
  /** 0..24. */
  hour: number;
  /** The weather it is turning to (eased over a few seconds). */
  weather: Weather;
  /** Whether the hour moves on its own. */
  clockRuns: boolean;
  /** Hours a second while the clock runs: 0.08 is a five-minute day, 1/3600 real time. */
  hoursPerSecond: number;
  /** The weather now, 0..1 each. */
  readonly mix: WeatherMix;
  /** Lightning, 1 at the bolt and fading over a quarter second. */
  readonly flash: number;
  /** Changes the weather at once, without easing (a fixed view, a check). */
  setWeatherNow(weather: Weather): void;
  /** Moves the clock, the weather and the lightning on by dt seconds. */
  step(dt: number): void;
}

export interface IslandDayOptions {
  hour: number;
  weather: Weather;
  clockRuns: boolean;
  hoursPerSecond?: number;
  /** The game's seeded random source (bolt timing and distance). */
  rand: () => number;
  /** A bolt struck: `far` 0 (overhead) .. 1 (far off). Thunder is heard 150 + far × 2200 ms later. */
  onBolt?: (far: number) => void;
}

const amounts = (w: Weather): WeatherMix => ({ rain: w === 'rain' ? 1 : 0, storm: w === 'storm' ? 1 : 0, mist: w === 'mist' ? 1 : 0 });

export function createIslandDay(options: IslandDayOptions): IslandDay {
  const mix: WeatherMix = { rain: 0, storm: 0, mist: 0 };
  let flash = 0,
    nextBolt = 4;
  const day: IslandDay = {
    hour: options.hour,
    weather: options.weather,
    clockRuns: options.clockRuns,
    hoursPerSecond: options.hoursPerSecond ?? 0.08,
    mix,
    get flash() {
      return flash;
    },
    setWeatherNow(weather) {
      day.weather = weather;
      Object.assign(mix, amounts(weather));
    },
    step(dt) {
      if (day.clockRuns) day.hour = (day.hour + dt * day.hoursPerSecond) % 24;
      const goal = amounts(day.weather);
      mix.rain = approach(mix.rain, goal.rain, 0.5, dt);
      mix.storm = approach(mix.storm, goal.storm, 0.5, dt);
      mix.mist = approach(mix.mist, goal.mist, 0.5, dt);
      if (mix.storm > 0.5) {
        nextBolt -= dt;
        if (nextBolt <= 0) {
          flash = 1;
          nextBolt = 3 + options.rand() * 7;
          // drawn even when nobody listens, so the game's random sequence does not depend on it
          const far = options.rand();
          options.onBolt?.(far);
        }
      }
      flash = Math.max(0, flash - dt * 4);
    },
  };
  Object.assign(mix, amounts(options.weather));
  return day;
}
