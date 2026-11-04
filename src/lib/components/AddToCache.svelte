<script>
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { fade } from 'svelte/transition';
	import Airplane from './Airplane.svelte';

	/**
	 * The "Add to cache" panel, opened from the status strip on any page. Add to cache stores one URL
	 * now (through /add-to-cache); Open in browser opens it through /c/ so everything it loads is
	 * cached as it's browsed. Pages showing the cache update on their own as it changes.
	 * @type {{ serverUrl: string }}
	 */
	let { serverUrl } = $props();

	let url = $state('');
	let adding = $state(false);
	/** The last result, shown for 7 seconds @type {{ ok: boolean, message: string } | null} */
	let result = $state(null);

	/** @type {HTMLInputElement} */
	let input;
	onMount(() => input.focus());

	$effect(() => {
		if (!result) return;
		const timer = setTimeout(() => (result = null), 7000);
		return () => clearTimeout(timer);
	});

	/** @param {SubmitEvent} event */
	async function add(event) {
		event.preventDefault();
		adding = true;
		try {
			const response = await fetch('/add-to-cache', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ url })
			});
			result = await response.json();
			if (result?.ok) {
				url = '';
				// Update the status strip's count on any page (the cache page also refreshes itself)
				await invalidateAll();
			}
		} catch {
			result = { ok: false, message: 'Airplane Mode didn’t respond. Try again.' };
		} finally {
			adding = false;
		}
	}

	/**
	 * Open the typed URL through /c/ in the default browser (the Electron window sends new windows
	 * there), so the page and everything it loads are cached as it's browsed
	 */
	function openInBrowser() {
		if (!input.reportValidity()) return;
		window.open(`${serverUrl}/c/${url.trim()}`, '_blank', 'noreferrer');
	}
</script>

<form onsubmit={add} class="space-y-2">
	<p class="text-sm text-slate-400">
		Enter a URL, with or without the scheme. <strong class="text-slate-200">Add to cache</strong>
		stores just that URL now. <strong class="text-slate-200">Open in browser</strong> so the page and
		everything it loads are cached as you browse.
	</p>
	<div class="flex flex-col gap-2 sm:flex-row">
		<label class="min-w-0 flex-1">
			<span class="sr-only">URL to add to the cache</span>
			<input
				bind:this={input}
				bind:value={url}
				placeholder="example.com or https://example.com/data.json"
				spellcheck="false"
				autocomplete="off"
				required
				class="w-full rounded-md border-slate-600 font-mono text-sm dark:bg-slate-950"
			/>
		</label>
		<button
			disabled={adding}
			class="group flex items-center justify-center gap-2 rounded-md border border-transparent bg-sky-400 px-4 py-2 text-sm font-semibold whitespace-nowrap text-slate-950 hover:bg-sky-300 disabled:opacity-50"
		>
			<!-- Climbs on hover, and keeps taking off while the URL is fetched -->
			<span class={['flex', adding && 'animate-takeoff']}>
				<Airplane
					class="size-4 rotate-45 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
				/>
			</span>
			{adding ? 'Adding…' : 'Add to cache'}
		</button>
		<!-- The same size as Add to cache, outlined rather than filled -->
		<button
			type="button"
			onclick={openInBrowser}
			class="flex items-center justify-center gap-2 rounded-md border border-sky-400/60 px-4 py-2 text-sm font-semibold whitespace-nowrap text-sky-400 hover:border-sky-300 hover:bg-sky-950 hover:text-sky-300"
		>
			<svg
				viewBox="0 0 24 24"
				class="size-4"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
			</svg>
			Open in browser
		</button>
	</div>
	{#if result}
		<p
			role="status"
			out:fade={{ duration: 600 }}
			class={['text-sm', result.ok ? 'text-emerald-400' : 'text-red-400']}
		>
			{result.message}
		</p>
	{/if}
</form>
