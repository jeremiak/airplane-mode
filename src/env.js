import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: {
		description:
			'The database connection string. Set by the Electron main process; unset in CI builds.',
		schema: (value) => value || 'app.db'
	},
	MIGRATIONS_DIR: {
		description: 'The folder of Drizzle migrations applied on startup.',
		schema: (value) => value || 'drizzle'
	},
	APP_CONFIG_PATH: {
		description:
			'The config.json the settings UI edits. Set by the Electron main process or electron.vite.config.js.',
		schema: (value) => value || undefined
	},
	APP_ACCESS_TOKEN: {
		description:
			'Token the Electron window sends so only it can see pages outside /api. Set by the Electron main process in the built app only.',
		schema: (value) => value || undefined
	}
});
