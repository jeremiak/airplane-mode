<script>
	import { applyAction, enhance } from '$app/forms';
	import { SvelteSet } from 'svelte/reactivity';

	/**
	 * The settings cards on the admin page: the server port and the cache bypass list
	 * @type {{
	 * 	settings: import('../../routes/settings/$types').PageData['settings'],
	 * 	form: import('../../routes/settings/$types').PageProps['form']
	 * }}
	 */
	let { settings, form } = $props();

	// The bypass list: sorted for display (it's stored in the order added) and ticked for bulk removal
	/** @type {'added' | 'asc' | 'desc'} */
	let bypassSort = $state('added');
	$effect(() => {
		try {
			const saved = localStorage.getItem('airplane-mode:bypass-sort');
			if (saved === 'added' || saved === 'asc' || saved === 'desc') bypassSort = saved;
		} catch {
			// Storage unavailable: keep the default
		}
	});
	$effect(() => {
		try {
			localStorage.setItem('airplane-mode:bypass-sort', bypassSort);
		} catch {
			// Storage unavailable: only applies until the page reloads
		}
	});
	let sortedBypass = $derived(
		bypassSort === 'added'
			? settings.bypass
			: settings.bypass.toSorted((a, b) => a.localeCompare(b) * (bypassSort === 'asc' ? 1 : -1))
	);

	const selectedBypass = new SvelteSet();
	// Forget ticks for prefixes that are no longer in the list
	let selectedPrefixes = $derived(settings.bypass.filter((prefix) => selectedBypass.has(prefix)));
	let allBypassSelected = $derived(
		settings.bypass.length > 0 && selectedPrefixes.length === settings.bypass.length
	);

	const checkboxClass =
		'rounded border-slate-300 text-sky-400 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950 dark:checked:border-sky-400 dark:checked:bg-sky-400 dark:indeterminate:border-sky-400 dark:indeterminate:bg-sky-400';
	const removeButtonClass =
		'rounded-md border border-slate-300 px-2.5 py-1 text-xs whitespace-nowrap hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 disabled:hover:border-slate-700 disabled:hover:bg-transparent disabled:hover:text-inherit dark:border-slate-700 dark:hover:border-red-800 dark:hover:bg-red-950 dark:hover:text-red-300';

	const themes = [
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' },
		{ value: 'system', label: 'System default' }
	];
</script>

<form
	method="POST"
	action="?/settings"
	use:enhance={() =>
		async ({ result, update }) => {
			// After a successful save the server is moving, so show the result instead of
			// reloading data from the old address
			if (result.type === 'success') await applyAction(result);
			else await update();
		}}
	class="space-y-4 rounded-lg border border-slate-200 bg-white p-4 panel dark:border-slate-800 dark:bg-slate-900"
>
	<div class="space-y-1">
		<h3 class="text-base text-slate-50">Cache port</h3>
		<p class="text-sm text-slate-500 dark:text-slate-400">
			Saving moves the server to the new port right away.
		</p>
	</div>
	<label class="block max-w-xs space-y-1">
		<span class="text-sm font-medium">Port</span>
		<input
			type="number"
			name="port"
			min="1"
			max="65535"
			required
			value={(form && 'port' in form ? form.port : null) ?? settings.port ?? ''}
			disabled={!settings.editable || settings.overrides.includes('port')}
			class="w-full rounded-md border-slate-300 text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
		/>
	</label>

	{#if !settings.editable}
		<p class="text-sm text-slate-500 dark:text-slate-400">
			Settings can only be changed when running in Electron, with
			<code class="font-mono">npm run dev</code> or the built app.
		</p>
	{:else if settings.overrides.includes('port')}
		<p class="text-sm text-slate-500 dark:text-slate-400">
			The port is set by a <code class="font-mono">--port</code> flag or
			<code class="font-mono">PORT</code> environment variable for this launch, so it can't be changed
			here.
		</p>
	{/if}

	{#if form?.settingsError}
		<p class="text-sm text-red-600 dark:text-red-400">{form.settingsError}</p>
	{:else if form?.saved}
		<p class="text-sm text-emerald-700 dark:text-emerald-400">
			Saved. Airplane Mode is moving to
			<!-- A different origin, so not a route resolve() knows about -->
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href={form.movedTo} class="underline">{form.movedTo}</a>.
		</p>
	{/if}

	<button
		disabled={!settings.editable || settings.overrides.includes('port')}
		class="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
	>
		Save
	</button>
</form>

<div
	class="space-y-4 rounded-lg border border-slate-200 bg-white p-4 panel dark:border-slate-800 dark:bg-slate-900"
>
	<div class="space-y-1">
		<h3 class="text-base text-slate-50">Bypass the cache</h3>
		<p class="text-sm text-slate-500 dark:text-slate-400">
			Requests to URLs that start with one of these are always fetched live and never stored.
		</p>
	</div>

	{#if settings.bypass.length > 0}
		<div class="rounded-md border border-slate-200 dark:border-slate-800">
			<!-- Toolbar: select all, how many are ticked, remove them, and the sort order -->
			<div
				class="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800"
			>
				<input
					type="checkbox"
					checked={allBypassSelected}
					indeterminate={selectedPrefixes.length > 0 && !allBypassSelected}
					disabled={!settings.editable}
					onchange={(event) => {
						if (event.currentTarget.checked)
							for (const prefix of settings.bypass) selectedBypass.add(prefix);
						else selectedBypass.clear();
					}}
					aria-label="Select all bypass prefixes"
					class={checkboxClass}
				/>
				<p class="text-sm whitespace-nowrap text-slate-500 dark:text-slate-400">
					{selectedPrefixes.length > 0
						? `${selectedPrefixes.length} of ${settings.bypass.length} selected`
						: `${settings.bypass.length} ${settings.bypass.length === 1 ? 'prefix' : 'prefixes'}`}
				</p>
				<form
					method="POST"
					action="?/removeBypass"
					use:enhance={({ cancel }) => {
						const count = selectedPrefixes.length;
						if (!confirm(`Remove ${count} ${count === 1 ? 'prefix' : 'prefixes'}?`))
							return cancel();
						return async ({ result, update }) => {
							if (result.type === 'success') selectedBypass.clear();
							await update();
						};
					}}
				>
					{#each selectedPrefixes as prefix (prefix)}
						<input type="hidden" name="prefix" value={prefix} />
					{/each}
					<button
						disabled={!settings.editable || selectedPrefixes.length === 0}
						class={removeButtonClass}
					>
						Remove selected
					</button>
				</form>
				<label class="ml-auto flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
					Sort
					<select
						bind:value={bypassSort}
						class="rounded-md border-slate-300 py-1 pr-8 pl-2 text-sm dark:border-slate-700 dark:bg-slate-950"
					>
						<option value="added">Order added</option>
						<option value="asc">A–Z</option>
						<option value="desc">Z–A</option>
					</select>
				</label>
			</div>

			<ul class="divide-y divide-slate-200 dark:divide-slate-800">
				{#each sortedBypass as prefix (prefix)}
					<li class="flex items-center gap-3 px-3 py-2">
						<input
							type="checkbox"
							checked={selectedBypass.has(prefix)}
							disabled={!settings.editable}
							onchange={(event) =>
								event.currentTarget.checked
									? selectedBypass.add(prefix)
									: selectedBypass.delete(prefix)}
							aria-label={`Select ${prefix}`}
							class={checkboxClass}
						/>
						<code class="min-w-0 flex-1 font-mono text-sm break-all">{prefix}</code>
						<form method="POST" action="?/removeBypass" use:enhance>
							<input type="hidden" name="prefix" value={prefix} />
							<button disabled={!settings.editable} class={removeButtonClass}>Remove</button>
						</form>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<form
		method="POST"
		action="?/addBypass"
		use:enhance
		class="flex flex-col gap-2 sm:flex-row sm:items-end"
	>
		<label class="min-w-0 flex-1 space-y-1">
			<span class="text-sm font-medium">URL prefix</span>
			<input
				type="text"
				name="prefix"
				required
				placeholder="https://www.googleadservices.com/pagead"
				value={form && 'prefix' in form ? form.prefix : ''}
				disabled={!settings.editable}
				class="w-full rounded-md border-slate-300 font-mono text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
			/>
		</label>
		<button
			disabled={!settings.editable}
			class="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
		>
			Add
		</button>
	</form>

	{#if form?.bypassError}
		<p class="text-sm text-red-600 dark:text-red-400">{form.bypassError}</p>
	{/if}
</div>

<form
	method="POST"
	action="?/theme"
	use:enhance={() =>
		async ({ update }) => {
			await update({ reset: false });
		}}
	class="space-y-4 rounded-lg border border-slate-200 bg-white p-4 panel dark:border-slate-800 dark:bg-slate-900"
>
	<div class="space-y-1">
		<h3 id="appearance-heading" class="text-base text-slate-50">Appearance</h3>
		<p class="text-sm text-slate-500 dark:text-slate-400">
			System default switches between them with your computer's appearance setting.
		</p>
	</div>
	<!-- A segmented control: radio buttons drawn as one row of buttons, saved as soon as one is picked -->
	<fieldset
		aria-labelledby="appearance-heading"
		disabled={!settings.editable}
		class="inline-flex rounded-md border border-slate-700 p-0.5 disabled:opacity-50"
	>
		{#each themes as theme (theme.value)}
			<label
				class="rounded-[3px] px-3 py-1.5 text-sm font-semibold text-slate-300 hover:text-slate-50 has-checked:bg-sky-400 has-checked:text-slate-950 has-focus-visible:outline-2 has-focus-visible:outline-sky-400"
			>
				<input
					type="radio"
					name="theme"
					value={theme.value}
					checked={settings.theme === theme.value}
					onchange={(event) => event.currentTarget.form?.requestSubmit()}
					class="sr-only"
				/>
				{theme.label}
			</label>
		{/each}
	</fieldset>
	{#if form?.themeError}
		<p class="text-sm text-red-600 dark:text-red-400">{form.themeError}</p>
	{/if}
</form>

<form
	method="POST"
	action="?/welcome"
	use:enhance={() =>
		async ({ update }) => {
			await update({ reset: false });
		}}
	class="space-y-4 rounded-lg border border-slate-200 bg-white p-4 panel dark:border-slate-800 dark:bg-slate-900"
>
	<div class="space-y-1">
		<h3 class="text-base text-slate-50">Tutorial</h3>
		<p class="text-sm text-slate-500 dark:text-slate-400">
			The welcome tutorial opens when the app starts. Closing it turns this off.
		</p>
	</div>
	<label class="flex items-center gap-2 text-sm">
		<input
			type="checkbox"
			name="showWelcome"
			checked={settings.showWelcome}
			disabled={!settings.editable}
			onchange={(event) => event.currentTarget.form?.requestSubmit()}
			class="rounded border-slate-300 text-sky-400 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950 dark:checked:border-sky-400 dark:checked:bg-sky-400"
		/>
		Show tutorial on next launch
	</label>
	{#if form?.welcomeError}
		<p class="text-sm text-red-600 dark:text-red-400">{form.welcomeError}</p>
	{/if}
</form>

{#if settings.configPath}
	<p class="text-xs text-slate-500 dark:text-slate-400">
		Settings are stored in <code class="font-mono break-all">{settings.configPath}</code>.
	</p>
{/if}
