import AbortControllerPolyfill, {
  AbortSignal as AbortSignalPolyfill,
} from 'abortcontroller-polyfill/src/abortcontroller.js';

if (typeof globalThis.Event === 'undefined') {
  globalThis.Event = class Event {
    constructor(type) {
      this.type = type;
    }
  };
}
// Cancellation only: never replace fetch or pretend a network request was stopped.
if (typeof globalThis.AbortController === 'undefined') {
  globalThis.AbortController = AbortControllerPolyfill;
}
if (typeof globalThis.AbortSignal === 'undefined') globalThis.AbortSignal = AbortSignalPolyfill;
if (typeof globalThis.DOMException === 'undefined') {
  globalThis.DOMException = class DOMException extends Error {
    constructor(message = '', name = 'Error') {
      super(message);
      this.name = name;
    }
  };
}
