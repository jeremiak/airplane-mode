import { cacheEvents } from './cache-events.js';

/**
 * What happened to a request or a cached response:
 * - hit: served from the cache
 * - cached: fetched and stored
 * - live: fetched but not stored (a server error, or another request stored it first)
 * - bypass: fetched live because it matches a bypass prefix
 * - failed: not cached and couldn't be fetched
 * - edited: changed in the app (removing a response isn't logged)
 * @typedef {'hit' | 'cached' | 'live' | 'bypass' | 'failed' | 'edited'} ActivityKind
 */

/**
 * @typedef {{
 * 	id: number,
 * 	time: number,
 * 	kind: ActivityKind,
 * 	method?: string,
 * 	url?: string,
 * 	status?: number,
 * 	size?: number,
 * 	entryId?: number,
 * 	detail?: string
 * }} Activity
 */

/** How many recent events are kept; older ones drop off the end */
const LIMIT = 300;

/** On globalThis for the same reason as cacheEvents: one log, even across dev reloads */
const store = /** @type {{ __airplaneModeRequestLog?: { events: Activity[], nextId: number } }} */ (
	globalThis
);
const log = (store.__airplaneModeRequestLog ??= { events: [], nextId: 1 });

/**
 * Records an event in the request log and sends it to open admin pages as an 'activity' event
 * @param {Omit<Activity, 'id' | 'time'>} event
 */
export function logActivity(event) {
	const activity = { id: log.nextId++, time: Date.now(), ...event };
	log.events.push(activity);
	if (log.events.length > LIMIT) log.events.splice(0, log.events.length - LIMIT);
	cacheEvents.emit('activity', activity);
}

/** The recent events, oldest first */
export function recentActivity() {
	return [...log.events];
}
