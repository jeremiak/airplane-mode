import { error, redirect } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import { AIRPLANE_PATH } from '#lib/airplane.js';
import { cacheEvents } from '#lib/server/cache-events.js';
import { db } from '#lib/server/db/index.js';
import { cachedResponse } from '#lib/server/db/schema.js';
import { logActivity } from '#lib/server/request-log.js';
import { bypassesCache } from '#lib/server/settings.js';
import { parseTargetUrl } from '#lib/server/target-url.js';

/**
 * Request headers that are not forwarded upstream:
 * - hop-by-hop headers and `host`, which describe the connection to this server
 * - conditional headers, which could make the upstream reply 304 with no body to cache
 * - `accept-encoding`, so fetch() only negotiates encodings it can decode
 * - headers the Electron app adds for this server, which mustn't leak to other sites
 */
const SKIPPED_REQUEST_HEADERS = new Set([
	'connection',
	'keep-alive',
	'proxy-authorization',
	'te',
	'trailer',
	'transfer-encoding',
	'upgrade',
	'host',
	'content-length',
	'if-none-match',
	'if-modified-since',
	'if-match',
	'if-unmodified-since',
	'if-range',
	'accept-encoding',
	'x-airplane-mode-token',
	'x-airplane-mode-protocol'
]);

/** Response headers that no longer describe the stored body, which fetch() has already decoded */
const SKIPPED_RESPONSE_HEADERS = new Set([
	'connection',
	'keep-alive',
	'transfer-encoding',
	'content-encoding',
	'content-length'
]);

/** Response headers dropped when serving, because they would stop the page working through the proxy */
const UNSERVED_RESPONSE_HEADERS = new Set([
	'content-security-policy',
	'content-security-policy-report-only',
	'clear-site-data',
	'referrer-policy'
]);

/** Statuses that must not have a response body */
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

const PREFIX = '/c/';

/**
 * Injected into proxied HTML. It installs static/cache-sw.js, which sends the page's other requests
 * (CSS, images, fetch() calls) through the proxy, and reloads the first visit once it's in control.
 * Clicked links to other sites are also sent through the proxy.
 */
const INJECTED_SCRIPT = `<script>(() => {
	const sw = navigator.serviceWorker;
	if (sw) {
		if (!sw.controller) {
			sw.addEventListener('controllerchange', () => location.reload(), { once: true });
		}
		// Registering again on every page also picks up a newer version of the worker
		sw.register('/cache-sw.js', { scope: '/' });
	}
	addEventListener('click', (event) => {
		const link = event.target instanceof Element && event.target.closest('a[href]');
		if (link && /^https?:$/.test(link.protocol) && link.origin !== location.origin) {
			link.href = '${PREFIX}' + link.href;
		}
	}, true);
})();</script>`;

// The proxied URL decides the trailing slash, not SvelteKit
export const trailingSlash = 'ignore';

/**
 * Proxies any HTTP method to the URL after /c/, caching the first response per method and
 * URL in SQLite and serving later requests from the cache. The URL can be raw
 * (/c/https://example.com/page?q=1), percent-encoded, or without a scheme (/c/example.com),
 * which means https.
 * @type {import('./$types').RequestHandler}
 */
export async function fallback({ params, request, url: requestUrl }) {
	// A raw URL's query string lands in this request's own query string, not in the param
	const target = parseTargetUrl(params.url + requestUrl.search);
	if (!target) {
		error(400, 'The path after /c/ must be a URL such as https://example.com/ or example.com');
	}

	const method = request.method;
	const url = target.href;

	// Serve pages from one canonical, unencoded address (e.g. https://example.com/ with its trailing
	// slash) so the browser resolves the page's relative URLs against the right directory
	const canonical = PREFIX + url;
	if (
		(method === 'GET' || method === 'HEAD') &&
		requestUrl.pathname + requestUrl.search !== canonical
	) {
		redirect(308, canonical);
	}

	// URLs matching a bypass prefix in the settings are always fetched live and never stored
	const bypass = bypassesCache(url);

	if (!bypass) {
		const [cached] = await db
			.select()
			.from(cachedResponse)
			.where(and(eq(cachedResponse.method, method), eq(cachedResponse.url, url)))
			.limit(1);

		if (cached) {
			await db
				.update(cachedResponse)
				.set({ hits: sql`${cachedResponse.hits} + 1` })
				.where(eq(cachedResponse.id, cached.id));
			// The admin list shows how often each response is served
			cacheEvents.emit('change');
			const served = withUploadedFile(cached);
			logActivity({
				kind: 'hit',
				method,
				url,
				status: cached.status,
				size: served.body?.length ?? 0,
				entryId: cached.id,
				detail: cached.fileBody ? `uploaded ${cached.fileName ?? 'file'}` : undefined
			});
			return respond(served, method, 'HIT');
		}
	}

	const headers = new Headers();
	for (const [name, value] of request.headers) {
		if (!SKIPPED_REQUEST_HEADERS.has(name)) headers.append(name, value);
	}

	let upstream;
	try {
		upstream = await fetch(url, {
			method,
			headers,
			body: method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer(),
			// Cache redirects as they are, so the browser follows them through the proxy
			redirect: 'manual'
		});
	} catch (cause) {
		// Not in the cache and the site can't be reached: offline, or the site is down
		return notCached(url, method, request, bypass, /** @type {Error} */ (cause));
	}

	const entry = {
		method,
		url,
		status: upstream.status,
		statusText: upstream.statusText,
		headers: [...upstream.headers].filter(([name]) => !SKIPPED_RESPONSE_HEADERS.has(name)),
		body: Buffer.from(await upstream.arrayBuffer())
	};

	/** @type {Omit<import('#lib/server/request-log.js').Activity, 'id' | 'time'>} */
	const activity = {
		kind: 'live',
		method,
		url,
		status: upstream.status,
		size: entry.body.length
	};

	if (bypass) {
		activity.kind = 'bypass';
	} else if (upstream.status >= 500) {
		// Don't pin a temporary upstream failure in the cache
		activity.detail = 'server error, not cached';
	} else {
		try {
			const inserted = await db
				.insert(cachedResponse)
				.values(entry)
				.onConflictDoNothing()
				.returning({ id: cachedResponse.id });
			if (inserted.length > 0) {
				cacheEvents.emit('change');
				activity.kind = 'cached';
				activity.entryId = inserted[0].id;
			} else {
				activity.detail = 'another request cached it first';
			}
		} catch (cause) {
			// Still give the page the response, even if it couldn't be cached
			console.error(`Could not cache ${method} ${url}:`, cause);
			activity.detail = 'couldn’t be stored';
		}
	}
	logActivity(activity);

	return respond(entry, method, bypass ? 'BYPASS' : 'MISS');
}

/**
 * A cached response as it's served: with its uploaded file, if it has one, in place of the cached
 * content, and the file's type as the Content-Type
 * @param {typeof cachedResponse.$inferSelect} entry
 */
function withUploadedFile(entry) {
	if (!entry.fileBody) return entry;
	const headers = /** @type {[string, string][]} */ (entry.headers).filter(
		([name]) => name !== 'content-type'
	);
	if (entry.fileType) headers.push(['content-type', entry.fileType]);
	return { ...entry, headers, body: entry.fileBody };
}

/**
 * @param {{ url: string, status: number, statusText: string, headers: unknown, body: Buffer | null }} entry
 * @param {string} method
 * @param {'HIT' | 'MISS' | 'BYPASS'} cacheStatus
 */
function respond(entry, method, cacheStatus) {
	const headers = new Headers();
	for (const [name, value] of /** @type {[string, string][]} */ (entry.headers)) {
		if (!UNSERVED_RESPONSE_HEADERS.has(name)) headers.append(name, value);
	}
	headers.set('x-cache', cacheStatus);

	const location = headers.get('location');
	if (location) {
		headers.set('location', PREFIX + new URL(location, entry.url).href);
	}

	let body = entry.body ?? Buffer.alloc(0);
	if (headers.get('content-type')?.includes('text/html')) {
		body = injectScript(body);
	}

	const hasBody = method !== 'HEAD' && !NULL_BODY_STATUSES.has(entry.status);
	return new Response(hasBody ? new Uint8Array(body) : null, {
		status: entry.status,
		statusText: entry.statusText,
		headers
	});
}

/**
 * Adds INJECTED_SCRIPT before </head> (or </body>). Works on latin1, which maps bytes one-to-one,
 * so the page's own encoding is left untouched whatever it is.
 * @param {Buffer} body
 */
function injectScript(body) {
	const html = body.toString('latin1');
	const index = html.search(/<\/head>|<\/body>/i);
	const at = index === -1 ? html.length : index;
	return Buffer.from(html.slice(0, at) + INJECTED_SCRIPT + html.slice(at), 'latin1');
}

/**
 * The response when a URL isn't cached and can't be fetched. Browsers get a short page explaining
 * it; anything else gets plain text.
 * @param {string} url
 * @param {string} method
 * @param {Request} request
 * @param {boolean} bypass
 * @param {Error} cause
 */
function notCached(url, method, request, bypass, cause) {
	// fetch() puts the network error (ENOTFOUND, ECONNREFUSED, ...) on the cause
	const reason = /** @type {{ code?: string }} */ (cause.cause)?.code ?? cause.message;
	logActivity({ kind: 'failed', method, url, detail: `${reason}${bypass ? ', bypassed' : ''}` });
	const what = bypass
		? 'matches a bypass prefix in the settings, so it’s always fetched live'
		: 'isn’t in the cache';
	const message = `${url} ${what}, and it couldn’t be fetched (${reason}). Airplane Mode may be offline, or the site may be down.`;
	const headers = { 'x-cache': bypass ? 'BYPASS' : 'MISS', 'cache-control': 'no-store' };

	if (!request.headers.get('accept')?.includes('text/html')) {
		return new Response(`Not cached: ${message}\n`, {
			status: 504,
			headers: { ...headers, 'content-type': 'text/plain; charset=utf-8' }
		});
	}

	/** @param {string} text */
	const escape = (text) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

	return new Response(
		`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not cached · Airplane Mode</title>
<style>
	/* The app's design tokens (src/routes/layout.css), dark and light */
	:root { color-scheme: dark; --screen: #0d1117; --panel: #171d25; --line: #252d38; --text: #e8edf2; --muted: #aab5c2; --link: #3fd4f5; --amber: #ffc94d; --stand: #ffc94d; --plane: #364050; --plane-edge: #667384; }
	@media (prefers-color-scheme: light) {
		:root { color-scheme: light; --screen: #f3eedf; --panel: #fffdf6; --line: #e0d7c3; --text: #13213a; --muted: #434b59; --link: #1a62ad; --amber: #915400; --stand: #c98a12; --plane: #e0d7c3; --plane-edge: #736d5e; }
	}
	body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--screen); color: var(--text); font: 16px/1.5 system-ui, sans-serif; }
	main { max-width: 34rem; margin: 1.5rem; padding: 1.5rem; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); }
	.light { display: inline-block; padding: 0.1rem 0.45rem; border-radius: 2px; background: var(--amber); color: var(--screen); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.08em; }
	h1 { margin: 0.75rem 0 0.5rem; font-size: 1.1rem; }
	p { margin: 0 0 1rem; color: var(--muted); }
	code { color: var(--link); word-break: break-all; }
	a { color: var(--link); }
	.apron { display: block; width: 100%; max-width: 15rem; margin-bottom: 1rem; border: 1px solid var(--line); border-radius: 4px; background: var(--screen); }
	/* The anti-collision beacon flashes, as it does on an airplane waiting to go */
	.beacon { animation: beacon 1.6s steps(1) infinite; }
	@keyframes beacon { 0% { opacity: 1; } 10% { opacity: 0.12; } }
	@media (prefers-reduced-motion: reduce) { .beacon { animation: none; } }
</style>
</head>
<body>
<main>
	<!-- Grounded: parked nose-in at stand C (for /c/), red and green wingtip lights on -->
	<svg class="apron" viewBox="0 0 240 128" aria-hidden="true">
		<path d="M120 128 V16" stroke="var(--stand)" stroke-opacity="0.45" stroke-width="2" stroke-dasharray="8 6" />
		<path d="M100 12 H140" stroke="var(--stand)" stroke-width="3" />
		<text x="150" y="16" fill="var(--stand)" font-family="ui-monospace, Menlo, monospace" font-size="10" letter-spacing="1">C</text>
		<path d="${AIRPLANE_PATH}" transform="translate(120 70) scale(0.5)" fill="var(--plane)" stroke="var(--plane-edge)" stroke-width="3" stroke-linejoin="round" />
		<circle cx="74" cy="84" r="2.5" fill="#ff5c5c" style="filter: drop-shadow(0 0 3px #ff5c5c)" />
		<circle cx="166" cy="84" r="2.5" fill="#3ddc84" style="filter: drop-shadow(0 0 3px #3ddc84)" />
		<circle class="beacon" cx="120" cy="66" r="3" fill="#ff5c5c" style="filter: drop-shadow(0 0 5px #ff5c5c)" />
	</svg>
	<span class="light">NOT CACHED</span>
	<h1>This page isn’t available offline yet</h1>
	<p><code>${escape(url)}</code> ${escape(what)}, and it couldn’t be fetched (${escape(reason)}).</p>
	<p>Airplane Mode may be offline, or the site may be down. Once you’re connected, <a href="">try again</a> and it will be cached for next time.</p>
</main>
</body>
</html>
`,
		{ status: 504, headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } }
	);
}
