/**
 * 「灰燼之庭」 (Ashfall Courtyard) as one call: boots the engine in the page's #game, loads the
 * courtyard prefab and the sounds, and runs the duel — a fixed 1/120 s simulation
 * (ZhudaSimulationClock, at most 16 steps a frame) on the runtime's "duel" layer, dust and
 * sound for each combat event, then the picture and the controls every frame. The page
 * must already have the markup and styles of court-page.ts (mountCourtPage builds them).
 *
 * The same order of work as the original game's src/Main.ts; only the asset base is an
 * option (the module's assets/ are served at common/2d/ashfall-duel/assets/ after sync).
 */
import {
  IframeSoundAdapter,
  ZhudaEngine,
  ZhudaPrefabLibrary,
  ZhudaSimulationClock,
  type PrefabInstance,
} from "zhuda-laya-engine";
import { Duel } from "./combat.ts";
import { Controls } from "./interface.ts";
import { HEIGHT, WIDTH } from "./motion.ts";
import { ASHFALL_ASSETS, createAssetProvider, definitions } from "./prefabs.ts";
import { Battlefield } from "./render.ts";

/** The fixed simulation step. */
export const DUEL_STEP = 1 / 120;

export interface AshfallDuelOptions {
  /** Where this module's assets/ are served (default ./common/2d/ashfall-duel/assets/). */
  assets?: string;
  /** Aborting it releases everything (also done on pagehide). */
  signal?: AbortSignal;
  /** Called at the end of every frame, after the picture and the controls are updated. */
  onFrame?: () => void;
}

export interface AshfallDuel {
  context: Awaited<ReturnType<typeof ZhudaEngine.boot>>;
  game: Duel;
  picture: Battlefield;
  controls: Controls;
  audio: IframeSoundAdapter;
  arena: PrefabInstance;
  /** The canvas size the camera frames for (CSS pixels). */
  readonly viewport: { width: number; height: number };
  /** While true the duel does not advance (the picture stays); for tools and frozen views. */
  frozen: boolean;
  /** Runs the loop body for `seconds` of 1/120 s steps at once (simulation, dust, sound), then draws. */
  simulate(seconds: number): void;
  /** Draws the picture and the meters for the current state. */
  draw(): void;
  dispose(): void;
}

/**
 * Starts the duel on the title screen (its attract demo swings at the warden). Resolves
 * once the first frame is scheduled; on failure the page shows 「城門載入失敗。」 with a
 * reload button and the promise rejects.
 */
export async function startAshfallDuel(
  container: HTMLElement,
  options: AshfallDuelOptions = {}
): Promise<AshfallDuel> {
  const lifetime = new AbortController();
  const release: (() => void)[] = [];
  const dispose = () => {
    lifetime.abort();
    for (const fn of release.splice(0).reverse()) fn();
  };
  window.addEventListener("pagehide", dispose, { once: true });
  options.signal?.addEventListener("abort", dispose, { once: true });
  try {
    let viewport = { width: WIDTH, height: HEIGHT };
    let resized = true;
    const context = await ZhudaEngine.boot({
      container,
      width: WIDTH,
      height: HEIGHT,
      designSize: { width: WIDTH, height: HEIGHT },
      scaleMode: "full",
      onResize(size) {
        viewport = size;
        resized = true;
      },
      dprCap: 2,
      targetFPS: 60,
      features: ["core", "2d", "ui"],
      bgColor: "#25251f",
      antialias: true,
      signal: lifetime.signal,
    });
    release.push(() => context.dispose());
    const provider = createAssetProvider(options.assets ?? ASHFALL_ASSETS);
    release.push(() => provider.dispose());
    const library = new ZhudaPrefabLibrary({
      provider,
      definitions,
      timeoutMs: 25000,
    });
    release.push(() => library.dispose());
    const arena = await library.instantiate("ashfall.courtyard", {
      parent: context.rootScene,
      state: "impact",
      signal: lifetime.signal,
    });
    const picture = new Battlefield(arena);
    const game = new Duel();
    release.push(() => game.input.dispose());
    const audio = new IframeSoundAdapter({
      sampleProvider: provider,
      maxActiveVoices: 14,
      voiceOverflow: "fifo",
    });
    release.push(() => audio.dispose());
    const controls = new Controls(
      game,
      audio,
      lifetime.signal,
      () => picture.clear(),
      (point) => picture.worldAt(point)
    );
    const fixed = new ZhudaSimulationClock(DUEL_STEP, 16);
    const layers = context.runtime.layers;
    layers.defineLayer("duel");
    const stepOnce = (step: number) => {
      game.step(step);
      for (const event of game.events.splice(0)) {
        picture.burst(event);
        controls.play(event);
      }
      picture.advance(step);
    };
    const handle: AshfallDuel = {
      context,
      game,
      picture,
      controls,
      audio,
      arena,
      get viewport() {
        return viewport;
      },
      frozen: false,
      simulate(seconds) {
        for (let n = 0; n < Math.round(seconds / DUEL_STEP); n++) stepOnce(DUEL_STEP);
        handle.draw();
      },
      draw() {
        picture.draw(game.view, game.time, viewport);
        controls.update();
      },
      dispose,
    };
    picture.draw(game.view, 0, viewport);
    controls.update();
    context.runtime.start(() => {
      const dt = layers.scaledDeltas.get("duel") ?? 0;
      if (game.mode !== "paused" && !handle.frozen) {
        fixed.advance(dt, stepOnce);
      }
      if ((game.mode !== "paused" && !handle.frozen) || resized) {
        picture.draw(game.view, game.time, viewport);
        resized = false;
      }
      controls.update();
      options.onFrame?.();
    });
    return handle;
  } catch (error) {
    if (lifetime.signal.aborted) throw error;
    dispose();
    const stage = document.getElementById("theatre"),
      status = document.getElementById("load-status");
    if (stage && status) {
      stage.dataset.mode = "error";
      status.textContent = "城門載入失敗。";
      const retry = document.createElement("button");
      retry.className = "iron-button";
      retry.textContent = "重新載入";
      retry.onclick = () => location.reload();
      status.append(retry);
    }
    throw error;
  }
}
