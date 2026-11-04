import { fail } from '@sveltejs/kit';
import { serverUrl, THEMES } from '#lib/server/app-settings.js';
import { isPortFree, readSettings, saveSettings } from '#lib/server/settings.js';

/** @type {import('./$types').PageServerLoad} */
export function load({ url }) {
	return { settings: readSettings(url) };
}

/** @type {import('./$types').Actions} */
export const actions = {
	settings: async ({ request, url }) => {
		const settings = readSettings(url);
		const port = Number((await request.formData()).get('port'));

		if (!settings.editable) {
			return fail(400, { settingsError: 'Settings can only be changed in the Electron app.' });
		}
		if (settings.overrides.includes('port')) {
			return fail(400, {
				settingsError:
					'The port is set by a --port flag or PORT environment variable for this launch.'
			});
		}
		if (!Number.isInteger(port) || port < 1 || port > 65535) {
			return fail(400, { settingsError: 'Enter a port between 1 and 65535.', port });
		}

		if (port !== settings.port && !(await isPortFree(port, settings.host))) {
			return fail(400, { settingsError: `Port ${port} is already in use.`, port });
		}

		saveSettings({ port });
		return { saved: true, movedTo: serverUrl({ host: settings.host, port }) };
	},

	addBypass: async ({ request, url }) => {
		const settings = readSettings(url);
		const prefix = String((await request.formData()).get('prefix') ?? '').trim();

		if (!settings.editable) {
			return fail(400, { bypassError: 'Settings can only be changed in the Electron app.' });
		}
		if (!/^https?:\/\/\S+$/i.test(prefix)) {
			return fail(400, {
				bypassError: 'Enter the start of a URL, beginning with http:// or https://',
				prefix
			});
		}
		if (settings.bypass.includes(prefix)) {
			return fail(400, { bypassError: 'That prefix is already in the list.', prefix });
		}

		saveSettings({ bypass: [...settings.bypass, prefix] });
		return { bypassAdded: prefix };
	},

	/** Closing the welcome tutorial: don't open it on the next launch */
	hideWelcome: async ({ url }) => {
		if (readSettings(url).editable) saveSettings({ showWelcome: false });
		return { welcomeHidden: true };
	},

	/** The "Show tutorial on next launch" checkbox */
	welcome: async ({ request, url }) => {
		if (!readSettings(url).editable) {
			return fail(400, { welcomeError: 'Settings can only be changed in the Electron app.' });
		}
		const showWelcome = (await request.formData()).get('showWelcome') === 'on';
		saveSettings({ showWelcome });
		return { welcomeSaved: showWelcome };
	},

	/** The Appearance choice: light, dark or the system's setting */
	theme: async ({ request, url }) => {
		if (!readSettings(url).editable) {
			return fail(400, { themeError: 'Settings can only be changed in the Electron app.' });
		}
		const theme = /** @type {import('#lib/server/app-settings.js').Theme} */ (
			String((await request.formData()).get('theme'))
		);
		if (!THEMES.includes(theme))
			return fail(400, { themeError: 'Choose Light, Dark or System default.' });
		saveSettings({ theme });
		return { themeSaved: theme };
	},

	removeBypass: async ({ request, url }) => {
		const settings = readSettings(url);
		// One prefix from its own Remove button, or several from Remove selected
		const prefixes = new Set((await request.formData()).getAll('prefix').map(String));

		if (!settings.editable) {
			return fail(400, { bypassError: 'Settings can only be changed in the Electron app.' });
		}
		if (prefixes.size === 0) return fail(400, { bypassError: 'No prefixes were selected.' });

		saveSettings({ bypass: settings.bypass.filter((existing) => !prefixes.has(existing)) });
		return { bypassRemoved: [...prefixes] };
	}
};
