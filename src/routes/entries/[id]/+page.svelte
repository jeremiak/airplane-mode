<script>
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { fade } from 'svelte/transition';
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import CodeEditor from '#lib/components/CodeEditor.svelte';
	import HeadersEditor from '#lib/components/HeadersEditor.svelte';

	/** @type {import('./$types').PageProps} */
	let { data, form } = $props();

	// The "Saved" (or "File removed") message shows for 7 seconds, then fades out
	let savedVisible = $state(false);
	$effect(() => {
		if (!form?.saved && !form?.fileRemoved) return;
		savedVisible = true;
		const timer = setTimeout(() => (savedVisible = false), 7000);
		return () => clearTimeout(timer);
	});

	// Follows the stored code (or a rejected entry) until it's edited, so the standard text beside
	// the field updates as you type
	let status = $derived(
		String((form && 'status' in form ? form.status : null) ?? data.entry.status)
	);

	const dateFormat = new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short'
	});
</script>

<svelte:head>
	<title>Airplane Mode</title>
</svelte:head>

<Breadcrumbs
	items={[{ label: 'Cache', href: resolve('/') }, { label: `Edit ${data.entry.url}` }]}
/>

<div class="space-y-1">
	<!-- The proxy expects the raw URL, which resolve() would percent-encode -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a
		href={`/c/${data.entry.url}`}
		target="_blank"
		rel="noreferrer"
		class="block font-mono text-sm break-all text-sky-700 hover:underline dark:text-sky-400"
	>
		{data.entry.url}
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
	<p class="text-xs text-slate-500 dark:text-slate-400">
		<span class="font-mono font-semibold text-slate-700 dark:text-slate-300"
			>{data.entry.method}</span
		>
		· {data.entry.status}
		{data.entry.statusText} · Stored {dateFormat.format(data.entry.createdAt)}
	</p>
</div>

<form
	method="POST"
	action="?/save"
	enctype="multipart/form-data"
	use:enhance={({ formElement }) =>
		async ({ result, update }) => {
			// Keep what was typed; the textareas show the saved values after the reload
			await update({ reset: false });
			// The file is stored now, so don't upload it again on the next save
			if (result.type === 'success') {
				const file = formElement.querySelector('input[type="file"]');
				if (file instanceof HTMLInputElement) file.value = '';
			}
		}}
	class="space-y-6 rounded-lg border border-slate-200 bg-white p-4 panel dark:border-slate-800 dark:bg-slate-900"
>
	<fieldset class="space-y-1">
		<legend class="text-sm font-medium">Status</legend>
		<span class="block text-xs text-slate-500 dark:text-slate-400">
			A code from 200 to 599. It's served with the standard text for that code.
		</span>
		<div class="flex flex-wrap items-center gap-3">
			<label class="w-28">
				<span class="sr-only">Status code</span>
				<input
					type="number"
					name="status"
					min="200"
					max="599"
					required
					bind:value={status}
					class="w-full rounded-md border-slate-300 font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
				/>
			</label>
			<span class="text-sm text-slate-500 dark:text-slate-400">
				{data.statusTexts[Number(status)] ?? (status ? 'Unknown status' : '')}
			</span>
		</div>
	</fieldset>

	<!-- Fresh rows for each entry; across saves they keep what was typed -->
	{#key data.entry.id}
		<HeadersEditor headers={data.entry.headers} />
	{/key}

	{#if data.entry.file}
		<!-- While a file is uploaded it's served instead of the content below, which is kept -->
		<div
			class="flex flex-wrap items-center gap-3 rounded-md border border-sky-400/50 bg-sky-950 px-3 py-2.5"
		>
			<p class="min-w-0 flex-1 text-sm text-slate-200">
				Serving the uploaded file
				<strong class="font-mono break-all text-slate-50">{data.entry.file.name}</strong>
				({[data.entry.file.type, `${data.entry.file.size.toLocaleString()} bytes`]
					.filter(Boolean)
					.join(', ')}) instead of the cached content below. Remove it to serve the cached content
				again.
			</p>
			<!-- Submits this form to the removeFile action, which ignores the other fields -->
			<button
				formaction="?/removeFile"
				formnovalidate
				class="rounded-md border border-slate-700 px-3 py-1.5 text-sm whitespace-nowrap hover:border-red-800 hover:bg-red-950 hover:text-red-300"
			>
				Remove file
			</button>
		</div>
	{/if}

	{#if data.text !== null}
		<!-- A fresh editor for each entry; across saves it keeps what was typed -->
		{#key data.entry.id}
			<CodeEditor name="content" value={data.text} contentType={data.contentType} />
		{/key}
	{:else}
		<div class="space-y-1">
			<p class="text-sm font-medium">Content</p>
			<p class="text-sm text-slate-500 dark:text-slate-400">
				Binary content ({data.entry.size.toLocaleString()} bytes), which can't be edited as text. Upload
				a file below to serve instead.
			</p>
		</div>
	{/if}

	<label class="block space-y-1">
		<span class="text-sm font-medium">
			{data.entry.file ? 'Upload a different file' : 'Serve a file instead'}
		</span>
		<span class="block text-xs text-slate-500 dark:text-slate-400">
			Optional. The file is served in place of the cached content, with its own content type, until
			you remove it. The cached content is kept.
		</span>
		<input
			type="file"
			name="file"
			class="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm dark:file:bg-slate-800 dark:file:text-slate-100"
		/>
	</label>

	{#if form?.error}
		<p class="text-sm text-red-600 dark:text-red-400">{form.error}</p>
	{:else if form?.fileRemoved && savedVisible}
		<p out:fade={{ duration: 600 }} class="text-sm text-emerald-700 dark:text-emerald-400">
			File removed. The next request for this URL gets the cached content.
		</p>
	{:else if form?.saved && savedVisible}
		<p out:fade={{ duration: 600 }} class="text-sm text-emerald-700 dark:text-emerald-400">
			{form.uploaded
				? `Saved. The next request for this URL gets ${form.uploaded}.`
				: 'Saved. The next request for this URL gets the edited response.'}
		</p>
	{/if}

	<div class="flex gap-2">
		<button
			class="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
		>
			Save
		</button>
		<a
			href={resolve('/')}
			class="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
		>
			Back
		</a>
	</div>
</form>
