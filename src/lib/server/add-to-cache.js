import { and, eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { cachedResponse } from './db/schema.js';
import { parseTargetUrl } from './target-url.js';

/**
 * What happened when adding a URL: `message` is shown to the person who typed it
 * @typedef {{ ok: boolean, message: string }} AddResult
 */

/**
 * Caches a URL from the "Add to cache" box by requesting it through this app's own /c/ route,
 * so it's stored exactly as if it had been opened through the proxy. Redirects are followed through
 * the proxy too, so each step along the way is cached.
 * @param {string} input What was typed: a URL, with or without the scheme
 * @param {typeof fetch} fetch SvelteKit's fetch, which can request this app's own routes
 * @returns {Promise<AddResult>}
 */
export async function addToCache(input, fetch) {
	const target = parseTargetUrl(input.trim());
	if (!input.trim() || !target) {
		return {
			ok: false,
			message: 'Enter a URL such as https://example.com/data.json or example.com.'
		};
	}
	const url = target.href;

	const [existing] = await db
		.select({ id: cachedResponse.id })
		.from(cachedResponse)
		.where(and(eq(cachedResponse.method, 'GET'), eq(cachedResponse.url, url)))
		.limit(1);
	if (existing) return { ok: true, message: `${url} is already cached.` };

	let path = `/c/${url}`;
	let response = await fetch(path, { headers: { accept: '*/*' }, redirect: 'manual' });
	for (let hop = 0; hop < 5; hop++) {
		const location = response.headers.get('location');
		if (response.status < 300 || response.status >= 400 || !location?.startsWith('/c/')) break;
		await response.body?.cancel();
		path = location;
		response = await fetch(path, { headers: { accept: '*/*' }, redirect: 'manual' });
	}
	await response.body?.cancel();
	const finalUrl = decodeURI(path.slice('/c/'.length));

	if (response.headers.get('x-cache') === 'BYPASS') {
		return {
			ok: false,
			message: `${url} matches a bypass prefix in Settings, so it isn't cached.`
		};
	}
	if (response.status === 504) {
		return {
			ok: false,
			message: `Couldn't fetch ${url}. Airplane Mode may be offline, or the site may be down.`
		};
	}
	if (response.status >= 500) {
		return {
			ok: false,
			message: `${url} returned ${response.status}, and server errors aren't cached.`
		};
	}
	return {
		ok: true,
		message:
			finalUrl !== url
				? `Cached ${url}, which redirects to ${finalUrl} (${response.status}).`
				: `Cached ${url} (${response.status}).`
	};
}
