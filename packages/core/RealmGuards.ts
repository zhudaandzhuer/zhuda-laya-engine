/**
 * Realm ownership checks for the LayaAir global runtime.
 *
 * LayaAir 3.4.2 keeps its stage, renderer and several prototype patches in a
 * JavaScript realm singleton.  A Zhuda session may share that realm with a
 * later Zhuda session after dispose, but it must never silently attach to a
 * Laya application that was initialized by somebody else.
 */

export const ZHUDA_LAYA_REALM_MARKER = "__ZHUDA_LAYA_REALM_OWNER__";

export interface LayaRealmReport {
  layaPresent: boolean;
  initialized: boolean;
  owner: "none" | "uninitialized" | "zhuda" | "foreign";
  reason: string;
}

type RealmGlobal = typeof globalThis & {
  Laya?: {
    stage?: unknown;
    Browser?: { mainCanvas?: { source?: unknown } };
  };
  [ZHUDA_LAYA_REALM_MARKER]?: unknown;
};

/** Inspect only the observable Laya initialization state; this is side-effect free. */
export function inspectLayaRealm(value: typeof globalThis = globalThis): LayaRealmReport {
  const target = value as RealmGlobal;
  const laya = target.Laya;
  if (!laya) {
    return {
      layaPresent: false,
      initialized: false,
      owner: "none",
      reason: "Laya is not loaded in this realm.",
    };
  }

  let stage: unknown;
  let canvas: unknown;
  try {
    stage = laya.stage;
    canvas = laya.Browser?.mainCanvas?.source;
  } catch {
    return {
      layaPresent: true,
      initialized: true,
      owner: "foreign",
      reason: "Laya state could not be inspected safely; refusing to attach to an unknown realm.",
    };
  }

  const initialized = stage != null || canvas != null;
  const marker = target[ZHUDA_LAYA_REALM_MARKER];
  if (marker === "zhuda") {
    return {
      layaPresent: true,
      initialized,
      owner: "zhuda",
      reason: "This realm was initialized by Zhuda.",
    };
  }
  if (!initialized) {
    return {
      layaPresent: true,
      initialized: false,
      owner: "uninitialized",
      reason: "Laya is loaded but Laya.init has not created a stage or canvas yet.",
    };
  }
  return {
    layaPresent: true,
    initialized: true,
    owner: "foreign",
    reason: "Laya has an initialized stage or canvas without the Zhuda realm marker.",
  };
}

/** Mark a successfully created Zhuda realm without replacing any Laya global. */
export function markZhudaLayaRealm(value: typeof globalThis = globalThis): void {
  const target = value as RealmGlobal;
  const descriptor = Object.getOwnPropertyDescriptor(target, ZHUDA_LAYA_REALM_MARKER);
  if (!descriptor) {
    Object.defineProperty(target, ZHUDA_LAYA_REALM_MARKER, {
      configurable: true,
      enumerable: false,
      writable: true,
      value: "zhuda",
    });
    return;
  }
  if (descriptor.writable) target[ZHUDA_LAYA_REALM_MARKER] = "zhuda";
}

/**
 * Fail closed before Laya.init when a foreign app already owns this realm.
 * The error names the supported isolation path so an agent can recover without
 * guessing or attempting to copy a second renderer into the page.
 */
export function assertZhudaRealmAvailable(value: typeof globalThis = globalThis): LayaRealmReport {
  const report = inspectLayaRealm(value);
  if (report.owner === "foreign") {
    throw new Error(
      "ZHUDA_FOREIGN_LAYA_REALM: this page already owns an initialized Laya runtime. " +
      "Run the editor as a separate page or mount it through ZhudaRuntimeHost (iframe); " +
      "do not load a second Zhuda/Laya renderer into the existing realm.",
    );
  }
  return report;
}
