import { readSettings } from '#lib/server/settings.js';

/** @type {import('./$types').PageServerLoad} */
export function load({ url }) {
	return {
		settings: readSettings(url)
	};
}
