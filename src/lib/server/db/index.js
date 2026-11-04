import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { DatabaseSync } from 'node:sqlite';
import { DATABASE_URL, MIGRATIONS_DIR } from '$app/env/private';

if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = new DatabaseSync(DATABASE_URL);

export const db = drizzle({ client });

// The packaged app starts with an empty database, so bring it up to date on startup
migrate(db, { migrationsFolder: MIGRATIONS_DIR });
