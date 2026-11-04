// Service worker installed by pages served from /c/ (see src/routes/c/[...url]).
// It sends every request such a page makes (stylesheets, images, fonts, scripts, fetch() calls,
// links) through the caching proxy, so the page loads entirely from the cache.

const PREFIX = '/c/';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

	// Already going through the proxy (including relative URLs on a proxied page), this file, or
	// the admin page's long-lived event stream, which shouldn't depend on this worker staying alive
	const isOwn =
		url.origin === self.location.origin &&
		(url.pathname.startsWith(PREFIX) ||
			url.pathname === '/cache-sw.js' ||
			url.pathname === '/api/cache-events');
	if (isOwn) return;

	event.respondWith(handle(event, url));
});

/**
 * @param {FetchEvent} event
 * @param {URL} url
 */
async function handle(event, url) {
	const page = await proxiedPage(event);

	// Requests from this app's own pages are left alone
	if (!page) return fetch(event.request);

	// A root-relative URL like /css/site.css resolved against this server belongs to the proxied site
	const target =
		url.origin === self.location.origin ? new URL(url.pathname + url.search, page).href : url.href;
	const proxied = new URL(PREFIX + target, self.location.origin);

	// Keep the address bar on the proxy URL so the next page's relative URLs resolve correctly
	if (event.request.mode === 'navigate') return Response.redirect(proxied.href, 302);

	const { method, headers } = event.request;
	return fetch(proxied, {
		method,
		headers,
		body: method === 'GET' || method === 'HEAD' ? undefined : await event.request.blob()
	});
}

/**
 * The proxied URL of the page that made this request, or null if it isn't a proxied page
 * @param {FetchEvent} event
 */
async function proxiedPage(event) {
	// Navigations don't have a client yet, so fall back to the page they came from
	const client = event.clientId ? await self.clients.get(event.clientId) : undefined;
	const pageUrl = client?.url ?? event.request.referrer;
	if (!pageUrl) return null;

	const { origin, pathname, search } = new URL(pageUrl);
	if (origin !== self.location.origin || !pathname.startsWith(PREFIX)) return null;

	try {
		const raw = decodeURIComponent(pathname.slice(PREFIX.length));
		return new URL(raw.replace(/^(https?:)\/*/i, '$1//') + search);
	} catch {
		return null;
	}
}
