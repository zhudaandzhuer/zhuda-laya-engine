import { IframeSoundAdapter } from "../../packages/core/IframeSoundAdapter.ts";
export const flush = () => new Promise((resolve) => setImmediate(resolve));
export const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
class Param {
  value = 1;
  events = [];
  setValueAtTime(v, t) {
    this.value = v;
    this.events.push(["set", v, t]);
  }
  linearRampToValueAtTime(v, t) {
    this.value = v;
    this.events.push(["linear", v, t]);
  }
  cancelScheduledValues() {}
  exponentialRampToValueAtTime(v, t) {
    this.linearRampToValueAtTime(v, t);
  }
}
export class Gain {
  gain = new Param();
  connections = [];
  disconnected = false;
  connect(node) {
    this.connections.push(node);
  }
  disconnect() {
    this.disconnected = true;
  }
}
export class Source extends Gain {
  onended = null;
  stopped = [];
  started = [];
  buffer = null;
  start(...args) {
    this.started = args;
  }
  stop(time) {
    this.stopped.push(time);
  }
  end() {
    this.onended?.();
  }
}
export class Context {
  state = "running";
  currentTime = 10;
  sampleRate = 24000;
  destination = {};
  gains = [];
  sources = [];
  mediaSources = [];
  decodes = 0;
  createGain() {
    const g = new Gain();
    this.gains.push(g);
    return g;
  }
  createBufferSource() {
    const s = new Source();
    this.sources.push(s);
    return s;
  }
  createMediaElementSource(media) {
    const s = new Gain();
    s.media = media;
    this.mediaSources.push(s);
    return s;
  }
  createBuffer() {
    return {
      duration: 2,
      numberOfChannels: 1,
      sampleRate: 24000,
      length: 48000,
    };
  }
  async decodeAudioData() {
    this.decodes++;
    return this.createBuffer();
  }
  async resume() {
    this.state = "running";
  }
  async suspend() {
    this.state = "suspended";
  }
  async close() {
    this.state = "closed";
  }
}
export class Media extends EventTarget {
  src = "";
  currentTime = 0;
  paused = true;
  plays = 0;
  loads = 0;
  result;
  play() {
    this.plays++;
    this.paused = false;
    return this.result ?? Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  load() {
    this.loads++;
  }
  removeAttribute(key) {
    if (key === "src") this.src = "";
  }
}
export function fixture(options = {}) {
  const context = new Context(),
    media = [],
    events = [];
  let releases = 0,
    opens = 0;
  const provider = {
    name: "neutral",
    async load(id) {
      return { id, bytes: new Uint8Array([1]) };
    },
    async openStream(id) {
      opens++;
      return {
        id,
        url: "https://fixture.test/" + id,
        integrity: "transport",
        delivery: "native",
        retainedBytes: 0,
        release() {
          releases++;
        },
      };
    },
  };
  const audio = new IframeSoundAdapter({
    sampleProvider: provider,
    audioContextFactory: () => context,
    mediaElementFactory: () => {
      const m = new Media();
      media.push(m);
      return m;
    },
    onVoiceEvent: (e) => events.push(e),
    ...options,
  });
  return {
    audio,
    context,
    media,
    events,
    provider,
    counts: () => ({ releases, opens }),
  };
}
