<script>
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	/**
	 * One cached response in the admin page's list
	 * @type {{
	 * 	entry: import('../../routes/$types').PageData['entries'][number],
	 * 	bypassed: boolean,
	 * 	selected?: boolean,
	 * 	onselect?: (selected: boolean) => void
	 * }}
	 */
	let { entry, bypassed, selected = false, onselect } = $props();

	const dateFormat = new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short'
	});

	/** @param {number} bytes */
	function formatSize(bytes) {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	}

	/** @param {number} status */
	function statusClass(status) {
		if (status < 300)
			return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
		if (status < 400) return 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300';
		if (status < 500) return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
		return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
	}
</script>

<li class="space-y-2 px-4 py-3">
	<div class="flex items-start gap-3">
		<input
			type="checkbox"
			checked={selected}
			onchange={(event) => onselect?.(event.currentTarget.checked)}
			aria-label={`Select ${entry.method} ${entry.url}`}
			class="mt-1 rounded border-slate-300 text-sky-400 dark:border-slate-600 dark:bg-slate-950 dark:checked:border-sky-400 dark:checked:bg-sky-400 dark:indeterminate:border-sky-400 dark:indeterminate:bg-sky-400"
		/>
		<div class="min-w-0 flex-1 space-y-1">
			<!-- The proxy expects the raw URL, which resolve() would percent-encode -->
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href={`/c/${entry.url}`}
				target="_blank"
				rel="noreferrer"
				class="block font-mono text-sm break-all text-sky-700 hover:underline dark:text-sky-400"
			>
				{entry.url}
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
			<div
				class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400"
			>
				<span class="font-mono font-semibold text-slate-700 dark:text-slate-300"
					>{entry.method}</span
				>
				<span class={`rounded-sm px-1.5 py-0.5 font-mono annunciator ${statusClass(entry.status)}`}>
					{entry.status}
					{entry.statusText}
				</span>
				{#if entry.fileName}
					<span
						class="rounded-sm bg-sky-100 px-1.5 py-0.5 annunciator text-sky-800 dark:bg-sky-950 dark:text-sky-300"
						title={`Serving the uploaded file ${entry.fileName} instead of the cached content. Remove it on the Edit page to serve the cached content again.`}
					>
						File
					</span>
				{/if}
				{#if entry.editedAt}
					<span
						class="rounded-sm bg-amber-100 px-1.5 py-0.5 annunciator text-amber-800 dark:bg-amber-950 dark:text-amber-300"
						title={`Changed in Airplane Mode on ${dateFormat.format(entry.editedAt)}. Remove it to fetch the original again.`}
					>
						Edited
					</span>
				{/if}
				{#if bypassed}
					<span
						class="rounded-sm bg-slate-200 px-1.5 py-0.5 annunciator text-slate-700 dark:bg-slate-800 dark:text-slate-300"
						title="Matches a bypass prefix in the settings, so this copy isn't used"
					>
						Bypassed
					</span>
				{/if}
				<span>{formatSize(entry.size)}</span>
				<span title="How many times this response has been served from the cache"
					>Served {entry.hits}×</span
				>
				<time datetime={entry.createdAt.toISOString()}>
					Stored {dateFormat.format(entry.createdAt)}
				</time>
			</div>
		</div>
		<a
			href={resolve('/entries/[id]', { id: String(entry.id) })}
			class="rounded-md border border-slate-300 px-2.5 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
		>
			Edit
		</a>
		<form method="POST" action="?/remove" use:enhance>
			<input type="hidden" name="id" value={entry.id} />
			<button
				class="rounded-md border border-slate-300 px-2.5 py-1 text-sm hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-slate-700 dark:hover:border-red-800 dark:hover:bg-red-950 dark:hover:text-red-300"
			>
				Remove
			</button>
		</form>
	</div>

	<details class="group ml-7 text-sm">
		<summary
			class="cursor-pointer text-xs text-slate-500 select-none hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
		>
			{entry.headers.length} headers
		</summary>
		<dl
			class="mt-2 grid grid-cols-[minmax(0,12rem)_1fr] gap-x-4 gap-y-1 rounded-md bg-slate-50 p-3 font-mono text-xs dark:bg-slate-950"
		>
			{#each entry.headers as [name, value], i (i)}
				<dt class="break-all text-slate-500 dark:text-slate-400">{name}</dt>
				<dd class="break-all">{value}</dd>
			{/each}
		</dl>
	</details>
</li>
