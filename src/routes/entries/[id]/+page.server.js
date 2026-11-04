import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { STATUS_CODES } from 'node:http';
import { cacheEvents } from '#lib/server/cache-events.js';
import { db } from '#lib/server/db/index.js';
import { logActivity } from '#lib/server/request-log.js';
import { cachedResponse } from '#lib/server/db/schema.js';

/** Headers that describe how the body is sent, which the server works out itself */
const IGNORED_HEADERS = new Set(['content-length', 'content-encoding', 'transfer-encoding']);

/** @param {string | undefined} id */
async function findEntry(id) {
	const [entry] = await db
		.select()
		.from(cachedResponse)
		.where(eq(cachedResponse.id, Number(id)))
		.limit(1);
	if (!entry) error(404, 'That response is not in the cache');
	return entry;
}

/**
 * The body as text, or null if it isn't valid UTF-8 (such as an image), so it can't be edited as text
 * @param {Buffer | null} body
 */
function bodyText(body) {
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(body ?? new Uint8Array());
	} catch {
		return null;
	}
}

/**
 * Pairs up the submitted `headerName` and `headerValue` fields, one pair per row
 * @param {FormData} formData
 */
function parseHeaders(formData) {
	const names = formData.getAll('headerName').map(String);
	const values = formData.getAll('headerValue').map(String);

	/** @type {[string, string][]} */
	const pairs = [];
	for (const [index, rawName] of names.entries()) {
		const name = rawName.trim().toLowerCase();
		const value = (values[index] ?? '').trim();
		if (!name && !value) continue;

		if (!name) return { error: `Header ${index + 1} needs a name.` };
		try {
			new Headers([[name, value]]);
		} catch {
			return { error: `Header ${index + 1} ("${name}") has a name or value that isn't allowed.` };
		}

		if (!IGNORED_HEADERS.has(name)) pairs.push(/** @type {[string, string]} */ ([name, value]));
	}
	return { pairs };
}

/** @type {import('./$types').PageServerLoad} */
export async function load({ params }) {
	const entry = await findEntry(params.id);
	const headers = /** @type {[string, string][]} */ (entry.headers);

	return {
		entry: {
			id: entry.id,
			method: entry.method,
			url: entry.url,
			status: entry.status,
			statusText: entry.statusText,
			createdAt: entry.createdAt,
			size: entry.body?.length ?? 0,
			headers,
			/** The uploaded file served instead of the cached content, if there is one */
			file: entry.fileBody
				? {
						name: entry.fileName ?? 'file',
						type: entry.fileType ?? '',
						size: entry.fileBody.length
					}
				: null
		},
		contentType: headers.find(([name]) => name === 'content-type')?.[1] ?? '',
		/** Standard reason phrases, shown next to the status code field */
		statusTexts: /** @type {Record<number, string>} */ ({ ...STATUS_CODES }),
		text: bodyText(entry.body)
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	save: async ({ params, request }) => {
		const entry = await findEntry(params.id);
		const formData = await request.formData();
		const content = formData.get('content');
		const file = formData.get('file');
		const statusInput = String(formData.get('status') ?? '').trim();

		/** @param {string} message */
		const invalid = (message) =>
			fail(400, {
				error: message,
				content: content?.toString(),
				status: statusInput
			});

		// Responses can only be served with a 2xx-5xx status
		const status = Number(statusInput);
		if (!Number.isInteger(status) || status < 200 || status > 599) {
			return invalid('Enter a status code between 200 and 599.');
		}
		// The server always sends the standard reason phrase for a code, so store that one
		const statusText = STATUS_CODES[status] ?? '';

		const parsed = parseHeaders(formData);
		if (parsed.error) return invalid(parsed.error);

		// The text content edits the cached body. An uploaded file is kept separately and served
		// instead of it until it's removed, so the cached content survives.
		let body = entry.body;
		if (typeof content === 'string') {
			// Browsers submit textareas with \r\n line endings, so keep the original's \n endings
			const original = bodyText(entry.body) ?? '';
			const text = original.includes('\r\n') ? content : content.replaceAll('\r\n', '\n');
			body = Buffer.from(text, 'utf8');
		}

		const upload = file instanceof File && file.size > 0 ? file : null;

		// Only a real change to the status, headers or content marks the response as edited, so
		// saving as is, or uploading a file and removing it again, leaves it as fetched
		const changed =
			status !== entry.status ||
			JSON.stringify(parsed.pairs) !== JSON.stringify(entry.headers) ||
			!(body ?? Buffer.alloc(0)).equals(entry.body ?? Buffer.alloc(0));

		await db
			.update(cachedResponse)
			.set({
				status,
				statusText,
				headers: parsed.pairs,
				body,
				...(changed && { editedAt: new Date() }),
				...(upload && {
					fileBody: Buffer.from(await upload.arrayBuffer()),
					fileName: upload.name,
					fileType: upload.type
				})
			})
			.where(eq(cachedResponse.id, entry.id));
		cacheEvents.emit('change');
		if (changed || upload) {
			logActivity({
				kind: 'edited',
				method: entry.method,
				url: entry.url,
				status,
				size: upload?.size ?? entry.fileBody?.length ?? body?.length ?? 0,
				entryId: entry.id,
				detail: upload ? `serving uploaded ${upload.name}` : undefined
			});
		}

		return { saved: true, uploaded: upload?.name };
	},

	/** Stops serving the uploaded file, so the cached content is served again */
	removeFile: async ({ params }) => {
		const entry = await findEntry(params.id);
		if (!entry.fileBody) return { fileRemoved: true };

		await db
			.update(cachedResponse)
			.set({ fileBody: null, fileName: null, fileType: null })
			.where(eq(cachedResponse.id, entry.id));
		cacheEvents.emit('change');
		logActivity({
			kind: 'edited',
			method: entry.method,
			url: entry.url,
			status: entry.status,
			size: entry.body?.length ?? 0,
			entryId: entry.id,
			detail: `removed uploaded ${entry.fileName ?? 'file'}, serving the cached content`
		});
		return { fileRemoved: true };
	}
};
