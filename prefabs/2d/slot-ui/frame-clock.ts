// Waits and tweens driven by the game's frame loop instead of setTimeout, so pause, hidden
// tabs, accelerate and a virtual clock (prefabs/tools/detplay.mjs) all apply to the show.
// Call update(seconds) once per frame (context.runtime.start((dt) => clock.update(dt))).
// Pure TypeScript.

export type Ease = (t: number) => number;
export const linear: Ease = (t) => t;
export const easeOutQuad: Ease = (t) => 1 - (1 - t) * (1 - t);
export const easeInQuad: Ease = (t) => t * t;
export const easeOutBack: Ease = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);

interface Task {
  elapsed: number;
  duration: number;
  step?: (t: number) => void;
  ease: Ease;
  resolve: () => void;
}

export class FrameClock {
  /** Seconds since the clock started. */
  time = 0;
  /** 1 = real time; 2 plays twice as fast (accelerate). */
  speed = 1;
  private tasks = new Set<Task>();

  update(seconds: number): void {
    const dt = Math.max(0, seconds) * this.speed;
    this.time += dt;
    for (const task of [...this.tasks]) {
      task.elapsed += dt * 1000;
      const t = task.duration <= 0 ? 1 : Math.min(1, task.elapsed / task.duration);
      task.step?.(task.ease(t));
      if (t >= 1) {
        this.tasks.delete(task);
        task.resolve();
      }
    }
  }

  /** Resolves after ms of clock time (0: on the next update). */
  wait(ms: number): Promise<void> {
    return this.tween(ms, undefined);
  }

  /** Calls step(eased t) every frame for ms, with t = 1 last; resolves after that. */
  tween(ms: number, step: ((t: number) => void) | undefined, ease: Ease = linear): Promise<void> {
    return new Promise((resolve) => this.tasks.add({ elapsed: 0, duration: ms, step, ease, resolve }));
  }

  /** Finishes every running wait and tween now (their last step runs). */
  finishAll(): void {
    for (const task of [...this.tasks]) {
      task.step?.(task.ease(1));
      this.tasks.delete(task);
      task.resolve();
    }
  }

  get pending(): number {
    return this.tasks.size;
  }
}
