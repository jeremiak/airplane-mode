<script>
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { SvelteSet } from 'svelte/reactivity';
	import Airplane from '#lib/components/Airplane.svelte';
	import CacheEntry from '#lib/components/CacheEntry.svelte';
	import RequestLog from '#lib/components/RequestLog.svelte';
	import GettingStarted from '#lib/components/GettingStarted.svelte';

	/** @type {import('./$types').PageProps} */
	let { data, form } = $props();

	let filter = $state('');

	let method = $state('');
	/** A range like "4xx", an exact code like "404", or "" for any */
	let status = $state('');
	/** @typedef {'newest' | 'oldest' | 'most-served' | 'url-asc' | 'url-desc'} SortOrder */
	/** @typedef {(typeof data.entries)[number]} Entry */

	/** @type {SortOrder} */
	let sort = $state('newest');

	/** Ids of the entries ticked for a bulk action */
	const selected = new SvelteSet();

	// Refresh the list whenever the server reports a cache change. A page load can cache dozens of
	// resources at once, so changes that arrive during a refresh are folded into one more refresh.
	$effect(() => {
		let refreshing = false;
		let pending = false;

		async function refresh() {
			if (refreshing) {
				pending = true;
				return;
			}
			refreshing = true;
			do {
				pending = false;
				await invalidateAll();
			} while (pending);
			refreshing = false;
		}

		const events = new EventSource('/api/cache-events');
		events.addEventListener('change', refresh);

		// Also catch up when coming back to the app, in case a change was missed while away
		const onVisible = () => document.visibilityState === 'visible' && refresh();
		addEventListener('focus', refresh);
		document.addEventListener('visibilitychange', onVisible);

		return () => {
			events.close();
			removeEventListener('focus', refresh);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});

	// Filter choices come from what's actually in the cache
	let methods = $derived([...new Set(data.entries.map((entry) => entry.method))].sort());
	// Ranges are always offered; exact codes come from what's cached
	const statusRanges = ['2xx', '3xx', '4xx', '5xx'];
	let statusCodes = $derived(
		[...new Map(data.entries.map((entry) => [entry.status, entry.statusText]))].sort(
			([a], [b]) => a - b
		)
	);

	/** @param {Entry} entry */
	function matchesStatus(entry) {
		if (!status) return true;
		if (status.endsWith('xx')) return String(entry.status)[0] === status[0];
		return entry.status === Number(status);
	}

	/** @type {Record<SortOrder, (a: Entry, b: Entry) => number>} */
	const comparers = {
		newest: (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id,
		oldest: (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id,
		'url-asc': (a, b) => a.url.localeCompare(b.url) || a.method.localeCompare(b.method),
		'url-desc': (a, b) => b.url.localeCompare(a.url) || a.method.localeCompare(b.method),
		// Most often served from the cache first; ties go to the newest
		'most-served': (a, b) =>
			b.hits - a.hits || b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id
	};

	let entries = $derived(
		data.entries
			.filter(
				(entry) =>
					entry.url.toLowerCase().includes(filter.trim().toLowerCase()) &&
					(!method || entry.method === method) &&
					matchesStatus(entry)
			)
			.toSorted(comparers[sort])
	);

	let filtersActive = $derived(filter.trim() !== '' || method !== '' || status !== '');

	// Bulk actions only apply to entries the filters show, so nothing hidden is removed by surprise
	let selectedEntries = $derived(entries.filter((entry) => selected.has(entry.id)));
	let allSelected = $derived(entries.length > 0 && selectedEntries.length === entries.length);

	function toggleAll() {
		for (const entry of entries) {
			if (allSelected) selected.delete(entry.id);
			else selected.add(entry.id);
		}
	}

	/** @param {string} url */
	const hostOf = (url) => {
		try {
			return new URL(url).host;
		} catch {
			return url;
		}
	};

	// Grouped by site: one group per host, in the order the sort puts their first response
	let groupBySite = $state(true);
	$effect(() => {
		try {
			const saved = localStorage.getItem('airplane-mode:group-by-site');
			if (saved !== null) groupBySite = saved === 'true';
		} catch {
			// Storage unavailable: keep the default
		}
	});
	/** @param {boolean} value */
	function setGroupBySite(value) {
		groupBySite = value;
		try {
			localStorage.setItem('airplane-mode:group-by-site', String(value));
		} catch {
			// Storage unavailable: only applies until the page reloads
		}
	}

	let groups = $derived(
		Object.entries(Object.groupBy(entries, (entry) => hostOf(entry.url))).map(
			([host, hostEntries]) => ({ host, entries: /** @type {Entry[]} */ (hostEntries) })
		)
	);

	/** Hosts whose group is collapsed */
	const collapsed = new SvelteSet();
	let anyGroupOpen = $derived(groups.some((group) => !collapsed.has(group.host)));

	function toggleAllGroups() {
		if (anyGroupOpen) for (const group of groups) collapsed.add(group.host);
		else collapsed.clear();
	}

	/**
	 * The bypass prefixes for a site: one per origin among its responses, like https://host/
	 * @param {Entry[]} groupEntries
	 */
	const sitePrefixes = (groupEntries) => [
		...new Set(groupEntries.map((entry) => `${new URL(entry.url).origin}/`))
	];

	/** @param {Entry[]} groupEntries */
	function toggleGroup(groupEntries) {
		const all = groupEntries.every((entry) => selected.has(entry.id));
		for (const entry of groupEntries) {
			if (all) selected.delete(entry.id);
			else selected.add(entry.id);
		}
	}

	function clearFilters() {
		filter = '';
		method = '';
		status = '';
	}

	const checkboxClass =
		'rounded border-slate-300 text-sky-400 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950 dark:checked:border-sky-400 dark:checked:bg-sky-400 dark:indeterminate:border-sky-400 dark:indeterminate:bg-sky-400';
	const fieldClass =
		'w-full rounded-md border-slate-300 text-sm dark:border-slate-700 dark:bg-slate-900';
	const dangerButtonClass =
		'rounded-md border border-slate-300 px-2.5 py-1 text-xs whitespace-nowrap hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 disabled:hover:border-slate-300 disabled:hover:bg-transparent disabled:hover:text-inherit dark:border-slate-700 dark:hover:border-red-800 dark:hover:bg-red-950 dark:hover:text-red-300';

	/** @param {number} count */
	const responses = (count) => `${count} ${count === 1 ? 'response' : 'responses'}`;

	/** @param {string} url */
	function isBypassed(url) {
		return data.settings.bypass.some((prefix) => url.startsWith(prefix));
	}
</script>

<!-- From md up the page fills the window exactly (the layout measures the header into
     --header-height; 4rem is <main>'s padding), and the request log and the list each scroll on
     their own up to the same height, so the page itself doesn't scroll -->
<section
	aria-labelledby="cache-heading"
	class="space-y-4 md:flex md:h-[calc(100dvh-var(--header-height,8rem)-4rem)] md:flex-col"
>
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 id="cache-heading" class="text-xl text-slate-50">Cache</h1>
		</div>
	</div>

	<!-- Side by side from md up, the request log on the left; stacked on smaller windows -->
	<div class="flex flex-col gap-4 md:min-h-0 md:flex-1 md:flex-row md:items-start">
		<RequestLog initial={data.activity} />

		<!-- A container, so the filters lay out by the width this column actually gets -->
		<div class="@container min-w-0 flex-1 space-y-4 md:flex md:max-h-full md:flex-col">
			{#if form?.removeError}
				<p class="text-sm text-red-600 dark:text-red-400">{form.removeError}</p>
			{/if}
			{#if form?.bypassError}
				<p class="text-sm text-red-600 dark:text-red-400">{form.bypassError}</p>
			{/if}

			<!-- An empty cache shows only the walkthrough; the list and its controls come with the first entry -->
			{#if data.entries.length === 0}
				<div class="md:min-h-0 md:overflow-y-auto">
					<GettingStarted serverUrl={data.settings.url} />
				</div>
			{:else}
				<!-- One row when there's room; otherwise the URL filter on its own row above the menus -->
				<div
					class="grid shrink-0 gap-2 @xs:grid-cols-3 @3xl:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
				>
					<label class="@xs:col-span-3 @3xl:col-span-1">
						<span class="sr-only">Filter by URL</span>
						<input
							type="search"
							placeholder="Filter by URL"
							bind:value={filter}
							class={fieldClass}
						/>
					</label>
					<label>
						<span class="sr-only">Filter by method</span>
						<select bind:value={method} class={fieldClass}>
							<option value="">All methods</option>
							{#each methods as option (option)}
								<option value={option}>{option}</option>
							{/each}
						</select>
					</label>
					<label>
						<span class="sr-only">Filter by status</span>
						<select bind:value={status} class={fieldClass}>
							<option value="">All statuses</option>
							<optgroup label="Ranges">
								{#each statusRanges as range (range)}
									<option value={range}>{range}</option>
								{/each}
							</optgroup>
							{#if statusCodes.length > 0}
								<optgroup label="Codes">
									{#each statusCodes as [code, text] (code)}
										<option value={String(code)}>{code} {text}</option>
									{/each}
								</optgroup>
							{/if}
						</select>
					</label>
					<label>
						<span class="sr-only">Sort</span>
						<select bind:value={sort} class={fieldClass}>
							<option value="newest">Newest first</option>
							<option value="oldest">Oldest first</option>
							<option value="url-asc">URL A → Z</option>
							<option value="url-desc">URL Z → A</option>
							<option value="most-served">Most served</option>
						</select>
					</label>
				</div>

				<div
					class="overflow-hidden rounded-lg border border-slate-200 bg-white panel md:flex md:min-h-0 md:flex-col dark:border-slate-800 dark:bg-slate-900"
				>
					<div
						class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800"
					>
						<input
							type="checkbox"
							checked={allSelected}
							indeterminate={selectedEntries.length > 0 && !allSelected}
							disabled={entries.length === 0}
							onchange={toggleAll}
							aria-label="Select all shown responses"
							class="rounded border-slate-300 text-sky-400 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950 dark:checked:border-sky-400 dark:checked:bg-sky-400 dark:indeterminate:border-sky-400 dark:indeterminate:bg-sky-400"
						/>
						<p class="text-sm whitespace-nowrap text-slate-500 dark:text-slate-400">
							{#if selectedEntries.length > 0}
								<span class="text-slate-900 dark:text-slate-100"
									>{selectedEntries.length} selected</span
								>
								·
							{/if}
							{filtersActive
								? `Showing ${entries.length} of ${responses(data.entries.length)}`
								: responses(data.entries.length)}
							{#if filtersActive}
								·
								<button
									type="button"
									onclick={clearFilters}
									class="text-sky-700 hover:underline dark:text-sky-400">Clear filters</button
								>
							{/if}
						</p>

						<!-- Compact controls, so they share one row with the count beside the request log -->
						<div class="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
							<label
								class="flex items-center gap-2 text-sm whitespace-nowrap text-slate-500 dark:text-slate-400"
							>
								<input
									type="checkbox"
									checked={groupBySite}
									onchange={(event) => setGroupBySite(event.currentTarget.checked)}
									class={checkboxClass}
								/>
								Group by site
							</label>
							{#if groupBySite && groups.length > 0}
								<button
									type="button"
									onclick={toggleAllGroups}
									class="text-sm whitespace-nowrap text-sky-700 hover:underline dark:text-sky-400"
								>
									{anyGroupOpen ? 'Collapse all' : 'Expand all'}
								</button>
							{/if}
							<div class="flex gap-2">
								<form
									method="POST"
									action="?/removeMany"
									use:enhance={({ cancel }) => {
										if (!confirm(`Remove ${responses(selectedEntries.length)}?`)) return cancel();
										const removed = selectedEntries.map((entry) => entry.id);
										return async ({ result, update }) => {
											// Selections hidden by the filters stay ticked
											if (result.type === 'success') for (const id of removed) selected.delete(id);
											await update();
										};
									}}
								>
									{#each selectedEntries as entry (entry.id)}
										<input type="hidden" name="id" value={entry.id} />
									{/each}
									<button disabled={selectedEntries.length === 0} class={dangerButtonClass}>
										Remove selected
									</button>
								</form>
								<form
									method="POST"
									action="?/clear"
									use:enhance={({ cancel }) => {
										if (!confirm(`Remove all ${responses(data.entries.length)}?`)) cancel();
										return async ({ update }) => {
											selected.clear();
											await update();
										};
									}}
								>
									<button disabled={data.entries.length === 0} class={dangerButtonClass}>
										Clear cache
									</button>
								</form>
							</div>
						</div>
					</div>

					<!-- The toolbar stays put while the responses scroll -->
					<div class="md:min-h-0 md:overflow-y-auto">
						{#if entries.length === 0}
							<p
								class="flex flex-col items-center gap-3 px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
							>
								<!-- Circling, with nowhere to land -->
								<Airplane class="size-8 rotate-90 text-slate-700" />
								No cached responses match the filters.
							</p>
						{:else if groupBySite}
							<ul class="divide-y divide-slate-200 dark:divide-slate-800">
								{#each groups as group (group.host)}
									{@const groupSelected = group.entries.filter((entry) =>
										selected.has(entry.id)
									).length}
									{@const open = !collapsed.has(group.host)}
									<li>
										<div class="flex items-center gap-3 bg-slate-50 px-4 py-2 dark:bg-slate-950/40">
											<input
												type="checkbox"
												checked={groupSelected === group.entries.length}
												indeterminate={groupSelected > 0 && groupSelected < group.entries.length}
												onchange={() => toggleGroup(group.entries)}
												aria-label={`Select all responses from ${group.host}`}
												class={checkboxClass}
											/>
											<button
												type="button"
												aria-expanded={open}
												onclick={() =>
													open ? collapsed.add(group.host) : collapsed.delete(group.host)}
												class="flex min-w-0 flex-1 items-center gap-2 text-left"
											>
												<svg
													viewBox="0 0 24 24"
													class={[
														'size-4 shrink-0 text-slate-500 transition-transform',
														open && 'rotate-90'
													]}
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													aria-hidden="true"><path d="M9 6l6 6-6 6" stroke-linecap="round" /></svg
												>
												<span class="truncate font-mono text-sm text-slate-900 dark:text-slate-100"
													>{group.host}</span
												>
												<span class="shrink-0 text-xs text-slate-500 dark:text-slate-400">
													{responses(group.entries.length)}
												</span>
											</button>
											{#if sitePrefixes(group.entries).every( (prefix) => data.settings.bypass.includes(prefix) )}
												<span
													class="shrink-0 text-xs text-slate-500 dark:text-slate-400"
													title="This site is in the bypass list in Settings"
												>
													Bypassed
												</span>
											{:else if data.settings.editable}
												<form method="POST" action="?/bypassSite" use:enhance class="shrink-0">
													{#each sitePrefixes(group.entries) as prefix (prefix)}
														<input type="hidden" name="prefix" value={prefix} />
													{/each}
													<button
														title={`Always fetch ${sitePrefixes(group.entries).join(' and ')} live and never cache it`}
														class="rounded-md border border-slate-300 px-2.5 py-1 text-xs whitespace-nowrap hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
													>
														Bypass site
													</button>
												</form>
											{/if}
										</div>
										{#if open}
											<ul
												class="divide-y divide-slate-200 border-t border-slate-200 dark:divide-slate-800 dark:border-slate-800"
											>
												{#each group.entries as entry (entry.id)}
													<CacheEntry
														{entry}
														bypassed={isBypassed(entry.url)}
														selected={selected.has(entry.id)}
														onselect={(checked) =>
															checked ? selected.add(entry.id) : selected.delete(entry.id)}
													/>
												{/each}
											</ul>
										{/if}
									</li>
								{/each}
							</ul>
						{:else}
							<ul class="divide-y divide-slate-200 dark:divide-slate-800">
								{#each entries as entry (entry.id)}
									<CacheEntry
										{entry}
										bypassed={isBypassed(entry.url)}
										selected={selected.has(entry.id)}
										onselect={(checked) =>
											checked ? selected.add(entry.id) : selected.delete(entry.id)}
									/>
								{/each}
							</ul>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
</section>
