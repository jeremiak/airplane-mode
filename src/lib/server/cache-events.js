import { EventEmitter } from 'node:events';

/**
 * Kept on globalThis so there's only ever one emitter: when Vite reloads server modules during
 * development, a fresh module would otherwise create a second one, and pages already listening
 * on the first would stop hearing about changes.
 */
const store = /** @type {{ __airplaneModeCacheEvents?: EventEmitter }} */ (globalThis);

/**
 * Emits 'change' whenever a response is added to or removed from the cache, and 'activity' with
 * each new request log entry (see request-log.js)
 */
export const cacheEvents = (store.__airplaneModeCacheEvents ??=
	// Every open admin page holds a listener, so don't warn past the default of 10
	new EventEmitter().setMaxListeners(0));
