<script>
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
	import CollapseToggle from './CollapseToggle.svelte';

	/** @typedef {import('#lib/server/request-log.js').Activity} Activity */

	/**
	 * A live log of what the cache is doing: each request it serves, fetches, bypasses or can't
	 * load, and each change made in the app. Collapsible, and remembers whether it's open.
	 * @type {{ initial: Activity[] }}
	 */
	let { initial } = $props();

	/** @type {SvelteMap<number, Activity>} Events that arrived over the live connection since the page loaded */
	const received = new SvelteMap();

	/** Events up to this time are hidden by "Clear" (the server keeps them) */
	let clearedAt = $state(0);
	/** Expanded each time the app opens; collapsing it lasts until the app is closed */
	let open = $state(true);

	const OPEN_KEY = 'airplane-mode:request-log-open';
	const CLEARED_KEY = 'airplane-mode:request-log-cleared';

	onMount(() => {
		try {
			// sessionStorage starts empty with each launch of the app
			open = sessionStorage.getItem(OPEN_KEY) !== 'false';
			localStorage.removeItem(OPEN_KEY); // Left by versions that remembered it across launches
			clearedAt = Number(localStorage.getItem(CLEARED_KEY)) || 0;
		} catch {
			// Storage unavailable: open, showing everything
		}

		const events = new EventSource('/api/cache-events');
		events.addEventListener('activity', (event) => {
			/** @type {Activity} */
			const activity = JSON.parse(event.data);
			received.set(activity.id, activity);
		});
		return () => events.close();
	});

	/** Newest first; the page's data refreshes too, so merge the two by id */
	let shown = $derived(
		[...new Map([...initial, ...received.values()].map((event) => [event.id, event])).values()]
			.filter((event) => event.time > clearedAt)
			.sort((a, b) => b.id - a.id)
	);

	/** @param {boolean} value */
	function setOpen(value) {
		open = value;
		try {
			sessionStorage.setItem(OPEN_KEY, String(value));
		} catch {
			// Not remembered, which is fine
		}
	}

	function clear() {
		clearedAt = shown[0]?.time ?? Date.now();
		try {
			localStorage.setItem(CLEARED_KEY, String(clearedAt));
		} catch {
			// Cleared until the page reloads
		}
	}

	/** How each kind of event is labelled, explained and coloured */
	const kinds = {
		hit: {
			label: 'From cache',
			help: 'Served from the cache, without using the network',
			class: 'text-emerald-400'
		},
		cached: {
			label: 'Cached',
			help: 'Fetched from the site and stored in the cache',
			class: 'text-sky-400'
		},
		live: {
			label: 'Live',
			help: 'Fetched from the site, but not stored',
			class: 'text-slate-300'
		},
		bypass: {
			label: 'Bypassed',
			help: 'Fetched live and not stored, because it matches a bypass prefix in Settings',
			class: 'text-slate-300'
		},
		failed: {
			label: 'Failed',
			help: 'Not in the cache, and the site couldn’t be reached',
			class: 'bg-red-400 text-slate-950'
		},
		edited: {
			label: 'Edited',
			help: 'Changed in Airplane Mode',
			class: 'text-amber-300'
		}
	};

	// 24-hour, like a cockpit clock, and short enough for the sidebar
	const timeFormat = new Intl.DateTimeFormat(undefined, {
		hourCycle: 'h23',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});

	/** @param {number} bytes */
	function formatSize(bytes) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}
</script>

<!-- md and up: a sidebar beside the cache that collapses into a narrow rail on the left (its width
     animates, so it slides in and out from the side). Smaller: a full-width panel above the cache. -->
<section
	aria-labelledby="request-log-heading"
	class={[
		'shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white panel md:flex md:max-h-full md:flex-col md:transition-[width] md:duration-200 dark:border-slate-800 dark:bg-slate-900',
		open ? 'md:w-[21rem] xl:w-96' : 'md:w-12'
	]}
>
	<!-- The heading lines up with the other panels' headings and the controls sit on the right;
	     collapsed into the rail, the toggle sits on top with the heading running down beneath it -->
	<div
		class={[
			'flex items-center gap-2 px-4 py-2.5',
			!open && 'md:flex-col-reverse md:gap-3 md:px-0 md:py-3'
		]}
	>
		<h2
			id="request-log-heading"
			class={[
				'min-w-0 flex-1 text-base whitespace-nowrap text-slate-50',
				!open && 'md:flex-none md:[writing-mode:vertical-rl]'
			]}
		>
			Request log
		</h2>
		{#if open && shown.length > 0}
			<button
				type="button"
				onclick={clear}
				class="rounded-md border border-slate-700 px-2.5 py-1 text-xs hover:bg-slate-800"
			>
				Clear
			</button>
		{/if}
		<CollapseToggle
			{open}
			side="left"
			controls="request-log-events"
			name="the request log"
			ontoggle={() => setOpen(!open)}
		/>
	</div>

	{#if open}
		<!-- Scrolls on its own: a short box when stacked, the column's full height beside the list -->
		<div id="request-log-events" class="md:min-h-0 md:overflow-y-auto">
			{#if shown.length === 0}
				<p class="px-4 pb-4 text-sm text-slate-400">Nothing yet.</p>
			{:else}
				<ol
					class="max-h-64 divide-y divide-slate-800/70 overflow-y-auto text-xs md:max-h-none md:overflow-visible"
					aria-live="polite"
				>
					{#each shown as event (event.id)}
						{@const kind = kinds[event.kind]}
						<li class="space-y-0.5 px-4 py-1.5">
							<!-- Fixed-width columns, so statuses and sizes line up from row to row (each row is
							     its own grid); sizes are right-aligned on the unit -->
							<div class="grid grid-cols-[6.5rem_3ch_9ch_minmax(0,1fr)] items-baseline gap-x-2">
								<span
									class={['rounded-sm px-1.5 text-center annunciator', kind.class]}
									title={kind.help}>{kind.label}</span
								>
								<span class="font-mono text-slate-500">{event.status ?? ''}</span>
								<span class="text-right font-mono whitespace-nowrap text-slate-500">
									{event.size === undefined ? '' : formatSize(event.size)}
								</span>
								<time
									datetime={new Date(event.time).toISOString()}
									class="truncate text-right font-mono text-slate-500"
								>
									{timeFormat.format(event.time)}
								</time>
							</div>
							<p class="min-w-0 truncate" title={event.url}>
								{#if event.method}
									<span class="font-mono font-semibold text-slate-300">{event.method}</span>
								{/if}
								{#if event.url && event.entryId}
									<a
										href={resolve('/entries/[id]', { id: String(event.entryId) })}
										class="font-mono text-slate-200 hover:text-sky-400 hover:underline"
										>{event.url}</a
									>
								{:else if event.url}
									<span class="font-mono text-slate-200">{event.url}</span>
								{/if}
								{#if event.detail}
									<span class="text-slate-500">{event.url ? '· ' : ''}{event.detail}</span>
								{/if}
							</p>
						</li>
					{/each}
				</ol>
			{/if}
		</div>
	{/if}
</section>
