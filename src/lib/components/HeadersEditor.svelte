<script>
	import { tick, untrack } from 'svelte';

	/**
	 * Name/value rows for editing response headers. Each row submits a `headerName` and a
	 * `headerValue` field, in order, so the server can pair them back up.
	 * @type {{ headers: [string, string][] }}
	 */
	let { headers } = $props();

	let nextId = 0;
	// Starts from the stored headers; after that the rows are edited here
	let rows = $state(untrack(() => headers.map(([name, value]) => ({ id: nextId++, name, value }))));

	/** @type {HTMLDivElement} */
	let list;

	async function add() {
		rows.push({ id: nextId++, name: '', value: '' });
		await tick();
		// Put the cursor in the new row's name field
		/** @type {HTMLInputElement | null} */ (
			list.querySelector(':scope > [data-row]:last-of-type input')
		)?.focus();
	}

	/** @param {number} id */
	function remove(id) {
		rows = rows.filter((row) => row.id !== id);
	}

	// Suggestions for the name field; any other name can be typed too
	const commonHeaders = [
		'access-control-allow-headers',
		'access-control-allow-methods',
		'access-control-allow-origin',
		'cache-control',
		'content-disposition',
		'content-language',
		'content-security-policy',
		'content-type',
		'etag',
		'expires',
		'last-modified',
		'location',
		'set-cookie',
		'vary'
	];

	const fieldClass =
		'min-w-0 rounded-md border-slate-300 font-mono text-xs dark:border-slate-700 dark:bg-slate-950';
</script>

<fieldset class="space-y-2">
	<legend class="text-sm font-medium">Response headers</legend>
	<p class="text-xs text-slate-500 dark:text-slate-400">
		Content-Length, Content-Encoding and Transfer-Encoding are worked out when serving, so they're
		ignored here. Rows with no name and no value are skipped.
	</p>

	<div bind:this={list} class="space-y-2">
		{#if rows.length > 0}
			<div
				class="hidden grid-cols-[minmax(0,2fr)_minmax(0,3fr)_2rem] gap-2 text-xs text-slate-500 sm:grid dark:text-slate-400"
				aria-hidden="true"
			>
				<span>Name</span>
				<span>Value</span>
			</div>
		{/if}

		{#each rows as row, i (row.id)}
			<div
				data-row
				class="grid grid-cols-[minmax(0,1fr)_2rem] gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_2rem]"
			>
				<input
					name="headerName"
					bind:value={row.name}
					list="common-headers"
					placeholder="Name"
					spellcheck="false"
					autocomplete="off"
					aria-label={`Header ${i + 1} name`}
					class={[fieldClass, 'col-start-1 row-start-1 sm:col-start-auto sm:row-start-auto']}
				/>
				<input
					name="headerValue"
					bind:value={row.value}
					placeholder="Value"
					spellcheck="false"
					autocomplete="off"
					aria-label={`Header ${i + 1} value`}
					class={[fieldClass, 'col-start-1 row-start-2 sm:col-start-auto sm:row-start-auto']}
				/>
				<button
					type="button"
					onclick={() => remove(row.id)}
					aria-label={`Remove ${row.name || `header ${i + 1}`}`}
					title="Remove header"
					class="col-start-2 row-start-1 flex items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:border-red-300 hover:bg-red-50 hover:text-red-700 sm:col-start-auto sm:row-start-auto dark:border-slate-700 dark:text-slate-400 dark:hover:border-red-800 dark:hover:bg-red-950 dark:hover:text-red-300"
				>
					<svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2"
						><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" /></svg
					>
				</button>
			</div>
		{:else}
			<p class="text-sm text-slate-500 dark:text-slate-400">No headers.</p>
		{/each}
	</div>

	<button
		type="button"
		onclick={add}
		class="rounded-md border border-slate-300 px-2.5 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
	>
		+ Add header
	</button>

	<datalist id="common-headers">
		{#each commonHeaders as name (name)}
			<option value={name}></option>
		{/each}
	</datalist>
</fieldset>
