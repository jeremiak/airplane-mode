import { redirect } from '@sveltejs/kit';

// The old URL's trailing slash belongs to the proxied URL, not SvelteKit
export const trailingSlash = 'ignore';

/**
 * The caching proxy moved to /c/; keep old /api/cache/ links (and pages already open) working
 * @type {import('./$types').RequestHandler}
 */
export function fallback({ params, url }) {
	redirect(308, `/c/${params.url}${url.search}`);
}
