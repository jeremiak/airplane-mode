import { cacheEvents } from '#lib/server/cache-events.js';

/**
 * Server-sent events stream with a `change` event each time the cache changes, used by the admin
 * page to refresh its list, and an `activity` event (as JSON) for each new request log entry.
 * @type {import('./$types').RequestHandler}
 */
export function GET({ request }) {
	const encoder = new TextEncoder();
	/** @type {() => void} */
	let stop;

	const stream = new ReadableStream({
		start(controller) {
			/** @param {string} chunk */
			const send = (chunk) => controller.enqueue(encoder.encode(chunk));
			const onChange = () => send('event: change\ndata: {}\n\n');
			/** @param {import('#lib/server/request-log.js').Activity} activity */
			const onActivity = (activity) =>
				send(`event: activity\ndata: ${JSON.stringify(activity)}\n\n`);

			// A comment every so often keeps idle connections from being dropped
			const heartbeat = setInterval(() => send(': heartbeat\n\n'), 25_000);

			stop = () => {
				clearInterval(heartbeat);
				cacheEvents.off('change', onChange);
				cacheEvents.off('activity', onActivity);
			};

			cacheEvents.on('change', onChange);
			cacheEvents.on('activity', onActivity);
			request.signal.addEventListener('abort', () => stop());
			send(': connected\n\n');
		},
		cancel() {
			stop();
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache'
		}
	});
}
