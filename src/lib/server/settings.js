import { APP_CONFIG_PATH } from '$app/env/private';
import { loadSettings, saveConfig, serverUrl } from './app-settings.js';

export { isPortFree } from './app-settings.js';

/**
 * The server settings, as the Electron main process sees them. APP_CONFIG_PATH is set by the
 * main process in the built app and by electron.vite.config.js in `npm run dev`. Without it, as
 * in `npm run dev:web`, settings are read-only and describe the current request instead.
 * @param {URL} requestUrl
 */
export function readSettings(requestUrl) {
	if (!APP_CONFIG_PATH) {
		return {
			editable: false,
			configPath: null,
			overrides: /** @type {('port' | 'host')[]} */ ([]),
			bypass: /** @type {string[]} */ ([]),
			// Nowhere to remember it was closed, so don't show it
			showWelcome: false,
			theme: /** @type {import('./app-settings.js').Theme} */ ('system'),
			port: Number(requestUrl.port),
			host: requestUrl.hostname,
			url: requestUrl.origin
		};
	}

	const settings = loadSettings(APP_CONFIG_PATH);
	return { editable: true, configPath: APP_CONFIG_PATH, ...settings, url: serverUrl(settings) };
}

/**
 * Whether `url` starts with one of the bypass prefixes from the settings. Read on every request,
 * so changes apply right away.
 * @param {string} url
 */
export function bypassesCache(url) {
	if (!APP_CONFIG_PATH) return false;
	return loadSettings(APP_CONFIG_PATH).bypass.some((prefix) => url.startsWith(prefix));
}

/** @param {{ port?: number, bypass?: string[], showWelcome?: boolean, theme?: import('./app-settings.js').Theme }} changes */
export function saveSettings(changes) {
	if (!APP_CONFIG_PATH) throw new Error('Settings can only be changed in the Electron app');
	saveConfig(APP_CONFIG_PATH, changes);
}
