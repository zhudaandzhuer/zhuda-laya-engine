/**
 * Guarded localStorage. Storage can be blocked (private mode, embedded frames, quota);
 * every access is wrapped, so a game simply plays without memory then.
 */

export function readJSON(key: string): unknown {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Returns false when the value could not be stored. */
export function writeJSON(key: string, value: unknown): boolean {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // nothing to forget
  }
}

export function readText(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeText(key: string, value: string): boolean {
  try {
    globalThis.localStorage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** The strings in a stored value (anything else dropped): for lists read back from storage. */
export const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []);

/** A set of ids that outlives the session, e.g. unlocked gallery pages or seen tutorials. */
export interface StoredSet {
  readonly ids: Set<string>;
  has(id: string): boolean;
  /** Adds ids; returns the ones that were new. Saves when anything changed. */
  add(...ids: string[]): string[];
}

export function storedSet(key: string): StoredSet {
  const ids = new Set(strings(readJSON(key)));
  return {
    ids,
    has: (id) => ids.has(id),
    add(...more) {
      const added = more.filter((id) => !ids.has(id));
      for (const id of added) ids.add(id);
      if (added.length) writeJSON(key, [...ids]);
      return added;
    },
  };
}
