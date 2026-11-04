import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { parseArgs } from 'node:util';

// Plain Node code shared by the Electron main process (electron/main/index.js) and the
// settings UI (settings.js), so both agree on where the server is.

export const DEFAULT_SETTINGS = { host: '127.0.0.1', port: 3000 };

/** @typedef {'system' | 'light' | 'dark'} Theme */
/** @type {Theme[]} */
export const THEMES = ['system', 'light', 'dark'];

/**
 * Server settings, highest priority first: `--port`/`--host` flags, `PORT`/`HOST` environment
 * variables, then `configPath`, which is created with the defaults if it doesn't exist.
 * @param {string} configPath
 */
export function loadSettings(configPath) {
	/** @type {{ host?: string, port?: number, bypass?: unknown, showWelcome?: unknown, theme?: unknown }} */
	let config = {};
	try {
		config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
	} catch (error) {
		if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') {
			fs.mkdirSync(path.dirname(configPath), { recursive: true });
			fs.writeFileSync(configPath, JSON.stringify(DEFAULT_SETTINGS, null, '\t') + '\n');
		} else {
			console.error(`Ignoring unreadable ${configPath}:`, error);
		}
	}

	const { values: flags } = parseArgs({
		args: process.argv.slice(1),
		options: { port: { type: 'string' }, host: { type: 'string' } },
		strict: false
	});
	const fixedPort = flags.port ?? process.env.PORT;
	const fixedHost = flags.host ?? process.env.HOST;

	const port = Number(fixedPort ?? config.port ?? DEFAULT_SETTINGS.port);
	const host = String(fixedHost ?? config.host ?? DEFAULT_SETTINGS.host);
	if (!Number.isInteger(port) || port < 0 || port > 65535) {
		throw new Error(`Invalid port "${port}" (set in --port, PORT or ${configPath})`);
	}

	return {
		host,
		port,
		/** URL prefixes that skip the cache: matching requests are always fetched live and never stored */
		bypass: Array.isArray(config.bypass)
			? config.bypass.filter((prefix) => typeof prefix === 'string')
			: [],
		/** Whether the welcome tutorial opens on the next launch; on until it's first closed */
		showWelcome: config.showWelcome !== false,
		/** @type {Theme} Light, dark, or following the system's appearance */
		theme: THEMES.includes(/** @type {Theme} */ (config.theme))
			? /** @type {Theme} */ (config.theme)
			: 'system',
		/** Settings fixed for this launch by a flag or environment variable, which config.json can't change */
		overrides: /** @type {('port' | 'host')[]} */ (
			[fixedPort !== undefined && 'port', fixedHost !== undefined && 'host'].filter(Boolean)
		)
	};
}

/**
 * The URL people use to reach the server
 * @param {{ host: string, port: number }} settings
 */
export function serverUrl({ host, port }) {
	const displayHost = ['0.0.0.0', '::'].includes(host) ? 'localhost' : host;
	return `http://${displayHost}:${port}`;
}

/**
 * Merge `changes` into `configPath`. The Electron main process watches the file and moves the server.
 * @param {string} configPath
 * @param {{ port?: number, host?: string, bypass?: string[], showWelcome?: boolean, theme?: Theme }} changes
 */
export function saveConfig(configPath, changes) {
	const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
	fs.writeFileSync(configPath, JSON.stringify({ ...config, ...changes }, null, '\t') + '\n');
}

/**
 * Whether `port` is free to serve on. It's taken if it can't be bound on `host`, or if something
 * already answers on it locally: on macOS a server bound to `localhost` (often ::1) doesn't stop
 * this app binding 127.0.0.1, but browsers opening localhost would reach that server instead.
 * @param {number} port
 * @param {string} host
 */
export async function isPortFree(port, host) {
	const [bindable, ...answering] = await Promise.all([
		canBind(port, host),
		isAnswering(port, '127.0.0.1'),
		isAnswering(port, '::1')
	]);
	return bindable && !answering.some(Boolean);
}

/**
 * The first free port from `start` upwards, or one the OS picks if none of the next 100 are free
 * @param {number} start
 * @param {string} host
 */
export async function findFreePort(start, host) {
	for (let port = start; port <= Math.min(start + 100, 65535); port++) {
		if (await isPortFree(port, host)) return port;
	}
	return new Promise((resolve, reject) => {
		const probe = net.createServer();
		probe.once('error', reject);
		probe.listen(0, host, () => {
			const { port } = /** @type {net.AddressInfo} */ (probe.address());
			probe.close(() => resolve(port));
		});
	});
}

/**
 * @param {number} port
 * @param {string} host
 * @returns {Promise<boolean>}
 */
function canBind(port, host) {
	return new Promise((resolve) => {
		const probe = net.createServer();
		probe.once('error', () => resolve(false));
		probe.listen(port, host, () => probe.close(() => resolve(true)));
	});
}

/**
 * @param {number} port
 * @param {string} host
 * @returns {Promise<boolean>}
 */
function isAnswering(port, host) {
	return new Promise((resolve) => {
		const socket = net.connect({ port, host });
		const done = (/** @type {boolean} */ answering) => {
			socket.destroy();
			resolve(answering);
		};
		socket.setTimeout(500, () => done(false));
		socket.once('connect', () => done(true));
		socket.once('error', () => done(false));
	});
}
