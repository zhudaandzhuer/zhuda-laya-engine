/**
 * Film scene sessions for agents: one validated scene per session, changed
 * only through revision-checked, atomic operations. A failed change keeps the
 * previous scene and revision. Sessions hold data only; rendering is separate.
 */
import crypto from 'node:crypto';
import {
  parseZhudaFilmScene,
  applyZhudaFilmScenePatch,
  ZHUDA_STARTER_PROPS,
  ZHUDA_STARTER_TEXTURES,
} from './runtime.mjs';

/** What the bundled film host can build: the neutral starter props and recipes, no assets. */
export const ZHUDA_FILM_HOST_CONTEXT = Object.freeze({
  props: Object.freeze(ZHUDA_STARTER_PROPS.map((prop) => prop.id).sort()),
  recipes: Object.freeze(Object.keys(ZHUDA_STARTER_TEXTURES).sort()),
  /** No asset directory: model nodes are refused until the operator serves one. */
  assets: Object.freeze([]),
});

const MAX_SCENE_BYTES = 1024 * 1024;

export class ZhudaFilmSessions {
  #sessions = new Map();
  #maxSessions;
  #context;
  constructor({ maxSessions = 16, context = ZHUDA_FILM_HOST_CONTEXT } = {}) {
    if (!Number.isSafeInteger(maxSessions) || maxSessions < 1) throw Error('Invalid maxSessions');
    this.#maxSessions = maxSessions;
    this.#context = context;
  }
  #check(scene) {
    if (JSON.stringify(scene).length > MAX_SCENE_BYTES)
      throw Error(`Film scene exceeds ${MAX_SCENE_BYTES} bytes`);
    return parseZhudaFilmScene(scene, this.#context);
  }
  /** Validates a scene against this host without opening a session; returns the parsed scene. */
  check(scene) {
    return this.#check(scene);
  }
  #snapshot(id, entry) {
    return { sessionId: id, revision: entry.revision, scene: structuredClone(entry.scene) };
  }
  #require(id) {
    const entry = this.#sessions.get(id);
    if (!entry) throw Error(`Unknown film session: ${id}`);
    // Most recently used last, so eviction drops the oldest idle session.
    this.#sessions.delete(id);
    this.#sessions.set(id, entry);
    return entry;
  }
  #expect(entry, expectedRevision) {
    if (!Number.isSafeInteger(expectedRevision))
      throw Error('expectedRevision is required; read it from film_scene_get');
    if (expectedRevision !== entry.revision)
      throw Error(
        `Stale revision: expected ${expectedRevision}, current ${entry.revision}. Read the scene again.`,
      );
  }
  create(scene) {
    const parsed = this.#check(scene);
    if (this.#sessions.size >= this.#maxSessions)
      this.#sessions.delete(this.#sessions.keys().next().value);
    const id = crypto.randomUUID(),
      entry = { revision: 0, scene: parsed };
    this.#sessions.set(id, entry);
    return this.#snapshot(id, entry);
  }
  get(id) {
    return this.#snapshot(id, this.#require(id));
  }
  apply(id, expectedRevision, patch) {
    const entry = this.#require(id);
    this.#expect(entry, expectedRevision);
    const next = applyZhudaFilmScenePatch(entry.scene, patch, this.#context);
    this.#check(next);
    entry.scene = next;
    entry.revision++;
    return this.#snapshot(id, entry);
  }
  replace(id, expectedRevision, scene) {
    const entry = this.#require(id);
    this.#expect(entry, expectedRevision);
    entry.scene = this.#check(scene);
    entry.revision++;
    return this.#snapshot(id, entry);
  }
  close(id) {
    return this.#sessions.delete(id);
  }
  get size() {
    return this.#sessions.size;
  }
}
