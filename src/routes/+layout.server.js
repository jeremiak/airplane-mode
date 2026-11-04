import { count } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { cachedResponse } from '#lib/server/db/schema.js';
import { readSettings } from '#lib/server/settings.js';

/**
 * Readouts for the status strip under the header. Pages that refresh on cache changes (via
 * invalidateAll) refresh these too.
 * @type {import('./$types').LayoutServerLoad}
 */
export async function load({ url }) {
	const settings = readSettings(url);
	const [{ cached }] = await db.select({ cached: count() }).from(cachedResponse);

	return {
		status: { server: settings.url, cached, bypass: settings.bypass.length },
		showWelcome: settings.showWelcome,
		theme: settings.theme
	};
}
