import { timingSafeEqual } from 'node:crypto';
import { APP_ACCESS_TOKEN } from '$app/env/private';
import { readSettings } from '#lib/server/settings.js';

/**
 * Paths any browser can use: the caching proxy (/c), the API, and the service worker that proxied
 * pages install
 */
function isPublic(/** @type {string} */ pathname) {
	return (
		['/c', '/api'].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
		pathname === '/cache-sw.js'
	);
}

/** @param {string | null} token */
function isElectron(token) {
	if (!APP_ACCESS_TOKEN || !token) return false;
	const [a, b] = [Buffer.from(token), Buffer.from(APP_ACCESS_TOKEN)];
	return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Everything outside /api, such as the admin page, is only for the Electron window, which sends
 * the access token with each request (see electron/main/index.js). The token is only set in the
 * built app, so in `npm run dev` and `npm run dev:web` every page is open to any browser.
 * @type {import('@sveltejs/kit/hooks').Handle}
 */
export async function handle({ event, resolve }) {
	if (
		APP_ACCESS_TOKEN &&
		!isPublic(event.url.pathname) &&
		!isElectron(event.request.headers.get('x-airplane-mode-token'))
	) {
		return new Response('This page is only available in the Airplane Mode app.', {
			status: 403,
			headers: { 'content-type': 'text/plain; charset=utf-8' }
		});
	}
	// Pages start in the chosen theme, so they don't flash the other one while loading
	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace('%airplane.theme%', readSettings(event.url).theme)
	});
}
