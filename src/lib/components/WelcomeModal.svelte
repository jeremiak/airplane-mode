<script>
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import FlightRoute from './FlightRoute.svelte';

	/**
	 * The welcome tutorial, shown when the app opens until it's closed once. Closing it (with the
	 * button or Escape) turns off "Show tutorial on next launch" in the settings.
	 * @type {{ serverUrl: string, onclose: () => void }}
	 */
	let { serverUrl, onclose } = $props();

	/** @type {HTMLDialogElement} */
	let dialog;

	onMount(() => {
		dialog.showModal();
		// Focusing the button scrolls a tall dialog to it; start at the top, where the route is
		dialog.scrollTop = 0;
	});

	async function dismiss() {
		onclose();
		await fetch(resolve('/settings') + '?/hideWelcome', {
			method: 'POST',
			body: new FormData(),
			headers: { 'x-sveltekit-action': 'true' }
		});
	}

	const steps = $derived([
		{
			title: 'Put the cache URL in front of any URL',
			text: `Open ${serverUrl}/c/example.com in any browser. The scheme is optional; without one it uses https.`
		},
		{
			title: 'Browse as usual',
			text: "Everything the page loads (styles, images, scripts and data) is cached too, so it keeps working when the site is slow, changing or you're offline."
		},
		{
			title: 'Edit, refresh or bypass',
			text: 'Change a cached response’s status, headers or content, remove it to fetch a fresh copy, or keep things like analytics live in Settings.'
		}
	]);
</script>

<dialog
	bind:this={dialog}
	onclose={dismiss}
	aria-labelledby="welcome-heading"
	class="m-auto w-[min(40rem,calc(100%-2rem))] rounded-lg border border-slate-200 bg-white p-0 text-slate-900 panel backdrop:bg-black/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
>
	<div class="space-y-4 p-6">
		<FlightRoute />
		<div class="space-y-1">
			<h2 id="welcome-heading" class="text-lg text-slate-50">Welcome to Airplane Mode</h2>
			<p class="text-sm text-slate-500 dark:text-slate-400">
				An easy-to-use and easy-to-edit HTTP cache for local web development made to help you:
			</p>
			<ul
				class="list-disc space-y-1 py-1 pl-5 text-sm text-slate-500 marker:text-slate-600 dark:text-slate-400"
			>
				<li>
					<strong>inspect</strong> HTTP requests and save them for when you don't have access to the internet
				</li>
				<li><strong>modify</strong> an API response</li>
				<li><strong>limit</strong> third-party API requests during development</li>
			</ul>
			<p class="text-sm text-slate-500 dark:text-slate-400">Here's how it works.</p>
		</div>

		<ol class="space-y-4">
			{#each steps as step, i (step.title)}
				<li class="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3">
					<span
						class="flex size-8 items-center justify-center rounded-full border border-sky-400/50 font-mono text-sm font-bold text-sky-400"
						aria-hidden="true">{i + 1}</span
					>
					<div>
						<h3 class="text-sm text-slate-50 normal-case">{step.title}</h3>
						<p class="text-sm text-slate-500 dark:text-slate-400">{step.text}</p>
					</div>
				</li>
			{/each}
		</ol>

		<div class="flex flex-wrap items-center justify-between gap-3">
			<p class="text-xs text-slate-500 dark:text-slate-400">
				You can show this again from Settings.
			</p>
			<form method="dialog">
				<!-- svelte-ignore a11y_autofocus -->
				<button
					autofocus
					class="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
				>
					Get started
				</button>
			</form>
		</div>
	</div>
</dialog>
