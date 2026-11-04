import { fail } from '@sveltejs/kit';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { cacheEvents } from '#lib/server/cache-events.js';
import { db } from '#lib/server/db/index.js';
import { recentActivity } from '#lib/server/request-log.js';
import { cachedResponse } from '#lib/server/db/schema.js';
import { readSettings, saveSettings } from '#lib/server/settings.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ url }) {
	const entries = await db
		.select({
			id: cachedResponse.id,
			method: cachedResponse.method,
			url: cachedResponse.url,
			status: cachedResponse.status,
			statusText: cachedResponse.statusText,
			headers: cachedResponse.headers,
			createdAt: cachedResponse.createdAt,
			size: sql`coalesce(length(${cachedResponse.body}), 0)`.mapWith(Number),
			hits: cachedResponse.hits,
			editedAt: cachedResponse.editedAt,
			fileName: cachedResponse.fileName
		})
		.from(cachedResponse)
		.orderBy(desc(cachedResponse.createdAt), desc(cachedResponse.id));

	return {
		entries: entries.map((entry) => ({
			...entry,
			headers: /** @type {[string, string][]} */ (entry.headers)
		})),
		settings: readSettings(url),
		activity: recentActivity()
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	remove: async ({ request }) => {
		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id)) return fail(400, { removeError: 'Missing cache entry id' });

		await db.delete(cachedResponse).where(eq(cachedResponse.id, id));
		cacheEvents.emit('change');
		return { removed: id };
	},

	removeMany: async ({ request }) => {
		const ids = (await request.formData())
			.getAll('id')
			.map(Number)
			.filter((id) => Number.isInteger(id));
		if (ids.length === 0) return fail(400, { removeError: 'No cached responses were selected' });

		await db.delete(cachedResponse).where(inArray(cachedResponse.id, ids));
		cacheEvents.emit('change');
		return { removedMany: ids.length };
	},

	/** Adds a site (the `https://host/` style prefix for each of its origins) to the bypass list */
	bypassSite: async ({ request, url }) => {
		const settings = readSettings(url);
		if (!settings.editable) {
			return fail(400, { bypassError: 'Settings can only be changed in the Electron app.' });
		}

		const prefixes = (await request.formData())
			.getAll('prefix')
			.map(String)
			.filter((prefix) => /^https?:\/\/[^/\s]+\/$/i.test(prefix));
		if (prefixes.length === 0) return fail(400, { bypassError: 'No site to bypass.' });

		saveSettings({ bypass: [...new Set([...settings.bypass, ...prefixes])] });
		return { bypassedSite: prefixes };
	},

	clear: async () => {
		await db.delete(cachedResponse);
		cacheEvents.emit('change');
		return { cleared: true };
	}
};
