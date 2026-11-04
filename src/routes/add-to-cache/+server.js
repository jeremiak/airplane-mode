import { json } from '@sveltejs/kit';
import { addToCache } from '#lib/server/add-to-cache.js';

/**
 * Used by the "Add to cache" panel under the header, which is on every page, so it can't post to
 * one page's form action. Outside /api, so only the Electron window can use it (see hooks.server.js).
 * @type {import('./$types').RequestHandler}
 */
export async function POST({ request, fetch }) {
	const { url } = await request.json();
	const result = await addToCache(String(url ?? ''), fetch);
	return json(result, { status: result.ok ? 200 : 400 });
}
