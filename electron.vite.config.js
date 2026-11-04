import { defineConfig } from 'electron-vite';
import { resolve } from 'node:path';
import { appPlugins } from './vite.config.js';

export default defineConfig(({ command }) => {
	if (command === 'serve') {
		// Shared by the SvelteKit dev server (this process) and Electron (spawned with this
		// environment), so the settings UI and the main process agree on the port
		process.env.APP_CONFIG_PATH ??= resolve('.dev/config.json');
	}

	return {
		main: {
			build: {
				lib: { entry: resolve('electron/main/index.js') }
			}
		},
		preload: {
			build: {
				lib: { entry: resolve('electron/preload/index.js') },
				rolldownOptions: {
					// CommonJS so the preload can run with Electron's sandbox enabled
					output: { format: 'cjs', entryFileNames: '[name].cjs' }
				}
			}
		},
		// The renderer is the SvelteKit app. electron-vite only runs it as the dev server;
		// production builds go through `vite build` (SvelteKit's multi-environment build),
		// which writes the server to build/ via adapter-node.
		renderer:
			command === 'serve'
				? {
						root: '.',
						plugins: appPlugins(),
						// Internal only: Electron serves the app on the configured port and passes
						// requests through to this server (see devServerHandlers in electron/main)
						server: { port: 5173, strictPort: true },
						// Unused by the SvelteKit dev server, but electron-vite requires an input
						build: { rolldownOptions: { input: resolve('src/app.html') } }
					}
				: undefined
	};
});
