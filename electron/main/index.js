import {
	app,
	BrowserWindow,
	dialog,
	Menu,
	nativeTheme,
	Notification,
	screen,
	session,
	shell
} from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
	findFreePort,
	isPortFree,
	loadSettings,
	saveConfig,
	serverUrl
} from '../../src/lib/server/app-settings.js';
// electron-vite copies this next to the build and resolves it to a file path
import icon from '../../resources/icon.png?asset';

useDataDirectory('airplane-mode', ['airplane-mode-gui', 'Airplane Mode']);

/**
 * Keep the app's data (config.json, app.db and the window's storage) in `name` under the
 * system's app data directory (on macOS, ~/Library/Application Support), rather than in one named
 * after package.json or the product name. The first launch moves an earlier directory there, so
 * settings and the cache carry over. Runs before the app is ready, while nothing has the
 * directory open.
 * @param {string} name
 * @param {string[]} previousNames Directories earlier versions used, checked in order
 */
function useDataDirectory(name, previousNames) {
	const appData = app.getPath('appData');
	const directory = path.join(appData, name);
	if (!fs.existsSync(directory)) {
		const previous = previousNames
			.map((previousName) => path.join(appData, previousName))
			.find((candidate) => fs.existsSync(path.join(candidate, 'config.json')));
		if (previous) {
			try {
				fs.renameSync(previous, directory);
			} catch (error) {
				console.error(`Could not move ${previous} to ${directory}:`, error);
			}
		}
	}
	app.setPath('userData', directory);
}

/** @type {http.Server | undefined} */
let server;
/** @type {{ host: string, port: number } | undefined} */
let listening;
/** @type {string} */
let appUrl;

/**
 * Where the server settings live. `npm run dev` points this at a project-local file (see
 * electron.vite.config.js) so the dev server and this process share it.
 */
function configPath() {
	return process.env.APP_CONFIG_PATH ?? path.join(app.getPath('userData'), 'config.json');
}

/**
 * @typedef {{
 * 	requestListener: http.RequestListener,
 * 	upgradeListener?: (req: http.IncomingMessage, socket: import('node:stream').Duplex, head: Buffer) => void
 * }} Handlers
 */

/**
 * @param {Handlers} handlers
 * @param {string} host
 * @param {number} port
 */
async function listen({ requestListener, upgradeListener }, host, port) {
	const next = http.createServer(requestListener);
	if (upgradeListener) next.on('upgrade', upgradeListener);

	await new Promise((resolve, reject) => {
		next.once('error', reject);
		next.listen(port, host, () => resolve(undefined));
	}).catch((error) => {
		throw new Error(`Could not start the server on ${host}:${port}: ${error.message}`, {
			cause: error
		});
	});

	const url = serverUrl({ host, port });
	console.log(`Server listening on ${url}`);
	return next;
}

/** The SvelteKit server (adapter-node output in build/), run inside this process */
async function sveltekitHandlers() {
	// Keep the SQLite database with the app's data unless one is configured
	process.env.DATABASE_URL ??= path.join(app.getPath('userData'), 'app.db');
	process.env.MIGRATIONS_DIR ??= path.join(import.meta.dirname, '../../drizzle');
	// adapter-node assumes https unless a protocol header says otherwise, which would make
	// SvelteKit's CSRF check reject form posts from our http:// pages
	process.env.PROTOCOL_HEADER = 'x-airplane-mode-protocol';
	// Room for uploads on the edit page (adapter-node's default is 512K)
	process.env.BODY_SIZE_LIMIT ??= '100M';
	// Only requests carrying this token can see pages outside /api (see src/hooks.server.js).
	// It's only set for the built app, so `npm run dev` stays open to any browser.
	process.env.APP_ACCESS_TOKEN ??= randomUUID();

	const handlerPath = path.join(import.meta.dirname, '../../build/handler.js');
	const { handler } = await import(pathToFileURL(handlerPath).href);

	return {
		/** @type {http.RequestListener} */
		requestListener: (req, res) => {
			// Always set here, so clients can't spoof it
			req.headers['x-airplane-mode-protocol'] = 'http';
			handler(req, res, () => {
				res.statusCode = 404;
				res.end('Not found');
			});
		}
	};
}

/**
 * In `npm run dev`, pass everything through to the SvelteKit dev server that electron-vite runs,
 * including the WebSocket that hot reloading uses, so the app is served on the configured port.
 * @param {string} devServerUrl
 */
function devServerHandlers(devServerUrl) {
	const target = new URL(devServerUrl);
	const port = Number(target.port);

	return {
		/** @type {http.RequestListener} */
		requestListener: (req, res) => {
			const upstream = http.request(
				{ host: target.hostname, port, method: req.method, path: req.url, headers: req.headers },
				(response) => {
					res.writeHead(response.statusCode ?? 502, response.rawHeaders);
					response.pipe(res);
				}
			);
			upstream.on('error', (error) => {
				res.writeHead(502).end(`Dev server unavailable: ${error.message}`);
			});
			req.pipe(upstream);
		},
		/**
		 * @param {http.IncomingMessage} req
		 * @param {import('node:stream').Duplex} socket
		 * @param {Buffer} head
		 */
		upgradeListener: (req, socket, head) => {
			const upstream = net.connect(port, target.hostname, () => {
				const headers = [];
				for (let i = 0; i < req.rawHeaders.length; i += 2) {
					headers.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
				}
				upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${headers.join('\r\n')}\r\n\r\n`);
				upstream.write(head);
				socket.pipe(upstream).pipe(socket);
			});
			upstream.on('error', () => socket.destroy());
			socket.on('error', () => upstream.destroy());
		}
	};
}

/** Serve the app on the configured address, and move it whenever config.json changes */
async function startServer() {
	const file = configPath();
	process.env.APP_CONFIG_PATH = file;

	// electron-vite sets ELECTRON_RENDERER_URL to its SvelteKit dev server in `npm run dev`
	const devServerUrl = !app.isPackaged && process.env.ELECTRON_RENDERER_URL;
	const handlers = devServerUrl ? devServerHandlers(devServerUrl) : await sveltekitHandlers();

	const settings = loadSettings(file);
	nativeTheme.themeSource = settings.theme;
	const { host } = settings;
	let { port } = settings;

	// If the saved port is taken (say by another dev server), move to a free one and save it so the
	// settings page shows where the app is. A port set by --port or PORT was chosen for this launch,
	// so that one is left alone and a clash is reported instead.
	if (!settings.overrides.includes('port') && !(await isPortFree(port, host))) {
		const freePort = await findFreePort(port + 1, host);
		console.log(`Port ${port} is in use, so using ${freePort} instead`);
		saveConfig(file, { port: freePort });
		if (Notification.isSupported()) {
			new Notification({
				title: 'Airplane Mode moved to another port',
				body: `Port ${port} was already in use, so Airplane Mode is now at ${serverUrl({ host, port: freePort })}.`
			}).show();
		}
		port = freePort;
	}

	server = await listen(handlers, host, port);
	listening = { host, port };
	console.log(`Settings: ${file}`);

	// Whether from the settings UI or a text editor
	fs.watchFile(file, { interval: 1000 }, () => moveServer(handlers));

	return serverUrl({ host, port });
}

/** @param {Handlers} handlers */
async function moveServer(handlers) {
	let settings;
	try {
		settings = loadSettings(configPath());
	} catch (error) {
		console.error(error);
		return;
	}
	// The window's title bar and the page's prefers-color-scheme follow the Appearance setting
	nativeTheme.themeSource = settings.theme;
	const { host, port } = settings;
	if (host === listening?.host && port === listening?.port) return;

	// Start on the new address before closing the old one, so a failure leaves the app reachable
	let next;
	try {
		next = await listen(handlers, host, port);
	} catch (error) {
		console.error(error);
		return;
	}
	const previous = server;
	server = next;
	listening = { host, port };
	appUrl = serverUrl({ host, port });
	previous?.close();
	previous?.closeAllConnections();

	for (const win of BrowserWindow.getAllWindows()) {
		const current = new URL(win.webContents.getURL());
		win.loadURL(new URL(current.pathname + current.search, appUrl).href);
	}
}

/**
 * A window size for the screen the pointer is on: roomy (up to 1440 × 1000) where it fits in 90%
 * of the screen's usable area, otherwise filling that much of it, and the screen's full usable
 * area on screens smaller than 1200 × 800
 */
function windowSize() {
	const { workAreaSize } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
	/** @param {number} preferred @param {number} minimum @param {number} available */
	const fit = (preferred, minimum, available) =>
		Math.min(available, Math.max(minimum, Math.min(preferred, Math.round(available * 0.9))));
	return {
		width: fit(1440, 1200, workAreaSize.width),
		height: fit(1000, 800, workAreaSize.height)
	};
}

/** @param {string} [pathname] The app route to open, such as /settings */
function createWindow(pathname = '/') {
	const win = new BrowserWindow({
		// A blank title bar, like other Mac apps; the app's name is in the page header
		title: '',
		icon,
		...windowSize(),
		show: false,
		webPreferences: {
			preload: path.join(import.meta.dirname, '../preload/index.cjs')
		}
	});

	win.once('ready-to-show', () => win.show());
	// Keep the title bar blank instead of showing each page's <title>
	win.on('page-title-updated', (event) => event.preventDefault());

	// Open external links in the user's browser instead of a new Electron window
	win.webContents.setWindowOpenHandler(({ url }) => {
		shell.openExternal(url);
		return { action: 'deny' };
	});

	win.loadURL(new URL(pathname, appUrl).href);
}

/**
 * Show an app route, such as /settings, in the current window, or a new one if none is open
 * @param {string} pathname
 */
function openRoute(pathname) {
	const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
	if (!win) return createWindow(pathname);
	win.loadURL(new URL(pathname, appUrl).href);
	win.show();
}

/** The application menu, with About and Settings opening the app's own pages */
function buildMenu() {
	const isMac = process.platform === 'darwin';
	/** @type {Electron.MenuItemConstructorOptions} */
	const about = { label: 'About Airplane Mode', click: () => openRoute('/about') };
	/** @type {Electron.MenuItemConstructorOptions} */
	const settings = {
		label: isMac ? 'Settings…' : 'Settings',
		accelerator: 'CmdOrCtrl+,',
		click: () => openRoute('/settings')
	};

	/** @type {Electron.MenuItemConstructorOptions[]} */
	const template = isMac
		? [
				{
					label: 'Airplane Mode',
					submenu: [
						about,
						{ type: 'separator' },
						settings,
						{ type: 'separator' },
						{ role: 'services' },
						{ type: 'separator' },
						{ role: 'hide', label: 'Hide Airplane Mode' },
						{ role: 'hideOthers' },
						{ role: 'unhide' },
						{ type: 'separator' },
						{ role: 'quit', label: 'Quit Airplane Mode' }
					]
				},
				{ role: 'editMenu' },
				{ role: 'viewMenu' },
				{ role: 'windowMenu' }
			]
		: [
				{ label: 'File', submenu: [settings, { type: 'separator' }, { role: 'quit' }] },
				{ role: 'editMenu' },
				{ role: 'viewMenu' },
				{ role: 'windowMenu' },
				{ role: 'help', submenu: [about] }
			];

	return Menu.buildFromTemplate(template);
}

app.whenReady().then(async () => {
	// The packaged app gets its icon from the bundle; without one, the dock shows Electron's
	if (!app.isPackaged) app.dock?.setIcon(icon);

	try {
		appUrl = await startServer();
	} catch (error) {
		dialog.showErrorBox('Airplane Mode could not start', String(error));
		app.exit(1);
		return;
	}

	// Electron's requests to the app carry the access token, which is how the app tells this
	// window apart from a regular browser
	session.defaultSession.webRequest.onBeforeSendHeaders(
		{ urls: ['http://*/*'] },
		(details, callback) => {
			const token = process.env.APP_ACCESS_TOKEN;
			if (token && new URL(details.url).origin === new URL(appUrl).origin) {
				details.requestHeaders['x-airplane-mode-token'] = token;
			}
			callback({ requestHeaders: details.requestHeaders });
		}
	);

	Menu.setApplicationMenu(buildMenu());
	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => server?.close());
