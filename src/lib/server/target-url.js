/**
 * The absolute http(s) URL meant by what's typed after /c/ or into the "Add to cache" box, or null
 * if it isn't one. Some clients collapse the `//` after the scheme, so it's restored, and a URL
 * with no scheme at all (example.com) means https.
 * @param {string} input
 */
export function parseTargetUrl(input) {
	const withScheme = /^https?:/i.test(input)
		? input.replace(/^(https?:)\/*/i, '$1//')
		: `https://${input}`;
	try {
		const url = new URL(withScheme);
		return url.hostname ? url : null;
	} catch {
		return null;
	}
}
