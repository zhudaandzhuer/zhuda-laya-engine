export type ZhudaActionPhase = "startup" | "active" | "recovery" | "complete";

/** A half-open frame interval: `from` is included and `until` is excluded. */
export interface ZhudaFrameWindow {
  from: number;
  until: number;
}

export interface ZhudaActionCancelWindow extends ZhudaFrameWindow {
  actions: readonly string[];
}

export interface ZhudaActionFrameEvent {
  frame: number;
  id: string;
  payload?: unknown;
}

/** A renderer-neutral socket declaration. The model adapter resolves `bone`. */
export interface ZhudaBoneSocketDefinition {
  id: string;
  bone: string;
  offset?: { x: number; y: number; z?: number };
}

/**
 * Consumer-authored frame data for one action. The engine validates and plays
 * timing; movement, damage and animation pose remain consumer responsibilities.
 */
export interface ZhudaActionFrameSpec {
  id: string;
  frameRate: number;
  frameCount: number;
  startup: ZhudaFrameWindow;
  active: ZhudaFrameWindow;
  recovery: ZhudaFrameWindow;
  cancelWindows?: readonly ZhudaActionCancelWindow[];
  events?: readonly ZhudaActionFrameEvent[];
  sockets?: readonly ZhudaBoneSocketDefinition[];
}

function finiteInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateWindow(
  name: string,
  window: ZhudaFrameWindow | undefined,
  frameCount: number,
  errors: string[],
): window is ZhudaFrameWindow {
  if (!window || !finiteInteger(window.from) || !finiteInteger(window.until)) {
    errors.push(`${name} must contain integer from/until frames.`);
    return false;
  }
  if (window.from < 0 || window.from >= window.until || window.until > frameCount)
    errors.push(`${name} must be a non-empty interval within frameCount.`);
  return true;
}

/** Returns actionable errors instead of throwing so tools can show all issues at once. */
export function validateActionFrameSpec(spec: ZhudaActionFrameSpec): string[] {
  const errors: string[] = [];
  if (!spec || typeof spec !== "object") return ["Action frame spec is required."];
  if (typeof spec.id !== "string" || !spec.id.trim()) errors.push("id must be a non-empty string.");
  if (!finiteNumber(spec.frameRate) || spec.frameRate <= 0)
    errors.push("frameRate must be a positive finite number.");
  if (!finiteInteger(spec.frameCount) || spec.frameCount <= 0)
    errors.push("frameCount must be a positive safe integer.");
  const frameCount = finiteInteger(spec.frameCount) && spec.frameCount > 0 ? spec.frameCount : 1;
  const startupOk = validateWindow("startup", spec.startup, frameCount, errors);
  const activeOk = validateWindow("active", spec.active, frameCount, errors);
  const recoveryOk = validateWindow("recovery", spec.recovery, frameCount, errors);
  if (startupOk && spec.startup.from !== 0) errors.push("startup must begin at frame 0.");
  if (startupOk && activeOk && spec.startup.until !== spec.active.from)
    errors.push("startup must connect directly to active.");
  if (activeOk && recoveryOk && spec.active.until !== spec.recovery.from)
    errors.push("active must connect directly to recovery.");
  if (recoveryOk && spec.recovery.until !== frameCount)
    errors.push("recovery must end at frameCount.");

  if (spec.cancelWindows !== undefined) {
    if (!Array.isArray(spec.cancelWindows)) errors.push("cancelWindows must be an array.");
    else {
      for (let i = 0; i < spec.cancelWindows.length; i++) {
        const window = spec.cancelWindows[i];
        const name = `cancelWindows[${i}]`;
        if (!validateWindow(name, window, frameCount, errors)) continue;
        const cancelWindow = window as ZhudaActionCancelWindow;
        if (!Array.isArray(cancelWindow.actions) || !cancelWindow.actions.length ||
            cancelWindow.actions.some((action: unknown) => typeof action !== "string" || !action.trim()))
          errors.push(`${name}.actions must contain at least one non-empty action id.`);
      }
    }
  }

  if (spec.events !== undefined) {
    if (!Array.isArray(spec.events)) errors.push("events must be an array.");
    else {
      let previousFrame = -1;
      for (let i = 0; i < spec.events.length; i++) {
        const event = spec.events[i];
        if (!event || !finiteInteger(event.frame) || event.frame < 0 || event.frame > frameCount)
          errors.push(`events[${i}].frame must be within frameCount.`);
        else if (event.frame < previousFrame)
          errors.push("events must be ordered by non-decreasing frame.");
        else previousFrame = event.frame;
        if (!event || typeof event.id !== "string" || !event.id.trim())
          errors.push(`events[${i}].id must be a non-empty string.`);
      }
    }
  }

  if (spec.sockets !== undefined) {
    if (!Array.isArray(spec.sockets)) errors.push("sockets must be an array.");
    else {
      const ids = new Set<string>();
      for (let i = 0; i < spec.sockets.length; i++) {
        const socket = spec.sockets[i];
        if (!socket || typeof socket.id !== "string" || !socket.id.trim())
          errors.push(`sockets[${i}].id must be a non-empty string.`);
        else if (ids.has(socket.id)) errors.push(`sockets[${i}].id is duplicated.`);
        else ids.add(socket.id);
        if (!socket || typeof socket.bone !== "string" || !socket.bone.trim())
          errors.push(`sockets[${i}].bone must be a non-empty string.`);
        const offset = socket?.offset;
        if (offset && ![offset.x, offset.y, offset.z ?? 0].every(finiteNumber))
          errors.push(`sockets[${i}].offset must contain finite coordinates.`);
      }
    }
  }
  return errors;
}

/** Deterministic frame clock for one consumer-authored action. */
export class ZhudaActionStateMachine {
  readonly spec: ZhudaActionFrameSpec;
  private currentFrame = 0;
  private eventIndex = 0;
  private playing = false;

  constructor(spec: ZhudaActionFrameSpec) {
    const errors = validateActionFrameSpec(spec);
    if (errors.length) throw Error(`Invalid action frame spec: ${errors.join(" ")}`);
    this.spec = {
      ...spec,
      cancelWindows: spec.cancelWindows ? spec.cancelWindows.map((w) => ({ ...w, actions: [...w.actions] })) : undefined,
      events: spec.events ? spec.events.map((event) => ({ ...event })) : undefined,
      sockets: spec.sockets ? spec.sockets.map((socket) => ({ ...socket, offset: socket.offset ? { ...socket.offset } : undefined })) : undefined,
    };
  }

  get frame(): number { return this.currentFrame; }
  get isPlaying(): boolean { return this.playing; }
  get isComplete(): boolean { return this.currentFrame >= this.spec.frameCount; }
  get phase(): ZhudaActionPhase {
    if (this.isComplete) return "complete";
    if (this.currentFrame < this.spec.startup.until) return "startup";
    if (this.currentFrame < this.spec.active.until) return "active";
    return "recovery";
  }
  get normalizedTime(): number {
    return this.currentFrame / this.spec.frameCount;
  }
  get active(): boolean { return this.phase === "active"; }

  reset(): void {
    this.currentFrame = 0;
    this.eventIndex = 0;
    this.playing = false;
  }

  play(reset = true): void {
    if (reset) this.reset();
    if (this.isComplete) this.reset();
    this.playing = true;
  }

  stop(): void {
    this.playing = false;
  }

  advance(deltaSeconds: number): ZhudaActionFrameEvent[] {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0)
      throw Error("Invalid action delta");
    if (!this.playing || this.isComplete) return [];
    const previousFrame = this.currentFrame;
    this.currentFrame = Math.min(
      this.spec.frameCount,
      previousFrame + deltaSeconds * this.spec.frameRate,
    );
    const events: ZhudaActionFrameEvent[] = [];
    const frameEvents = this.spec.events ?? [];
    const firstAdvance = this.eventIndex === 0 && previousFrame === 0;
    while (
      this.eventIndex < frameEvents.length &&
      (frameEvents[this.eventIndex].frame > previousFrame ||
        (firstAdvance && frameEvents[this.eventIndex].frame === 0)) &&
      frameEvents[this.eventIndex].frame <= this.currentFrame
    ) {
      events.push({ ...frameEvents[this.eventIndex] });
      this.eventIndex++;
    }
    if (this.isComplete) this.playing = false;
    return events;
  }

  canCancelInto(actionId: string): boolean {
    if (typeof actionId !== "string" || !actionId.trim()) return false;
    return (this.spec.cancelWindows ?? []).some((window) =>
      this.currentFrame >= window.from &&
      this.currentFrame < window.until &&
      window.actions.includes(actionId),
    );
  }

  getSocket(id: string): ZhudaBoneSocketDefinition | null {
    const socket = (this.spec.sockets ?? []).find((candidate) => candidate.id === id);
    return socket ? { ...socket, offset: socket.offset ? { ...socket.offset } : undefined } : null;
  }
}
