import { blob, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const task = sqliteTable('task', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	title: text('title').notNull(),
	priority: integer('priority').notNull().default(1)
});

/** Upstream responses stored by the /c/[...url] proxy */
export const cachedResponse = sqliteTable(
	'cached_response',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		method: text('method').notNull(),
		url: text('url').notNull(),
		status: integer('status').notNull(),
		statusText: text('status_text').notNull(),
		/** Header [name, value] pairs, kept as a list so repeated headers like Set-Cookie survive */
		headers: text('headers', { mode: 'json' }).notNull(),
		/** Null for an empty body, which node:sqlite stores as NULL */
		body: blob('body', { mode: 'buffer' }),
		/** How many times this response has been served from the cache */
		hits: integer('hits').notNull().default(0),
		/**
		 * An uploaded file served instead of `body` until it's removed, which leaves `body` (the cached
		 * content) to be served again. `fileType` replaces the Content-Type header while it's served.
		 */
		fileBody: blob('file_body', { mode: 'buffer' }),
		fileName: text('file_name'),
		fileType: text('file_type'),
		/** When the response was last changed in the app, or null if it's as fetched */
		editedAt: integer('edited_at', { mode: 'timestamp' }),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.$defaultFn(() => new Date())
	},
	(table) => [uniqueIndex('cached_response_method_url_idx').on(table.method, table.url)]
);
