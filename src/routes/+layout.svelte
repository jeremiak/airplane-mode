<script>
	import '@fontsource/b612/400.css';
	import '@fontsource/b612/700.css';
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import AddToCache from '#lib/components/AddToCache.svelte';
	import Airplane from '#lib/components/Airplane.svelte';
	import WelcomeModal from '#lib/components/WelcomeModal.svelte';

	/** @type {import('./$types').LayoutProps} */
	let { data, children } = $props();

	// The welcome tutorial opens when the app launches with its setting on. sessionStorage starts
	// empty each time the app opens, so the first page of a launch marks it; reloading, or turning
	// the setting back on mid-session, doesn't pop it up, and it shows on the next launch instead.
	let welcomeOpen = $state(false);
	onMount(() => {
		try {
			if (sessionStorage.getItem('airplane-mode:launched')) return;
			sessionStorage.setItem('airplane-mode:launched', '1');
		} catch {
			// Storage unavailable: treat this page as the start of a launch
		}
		welcomeOpen = data.showWelcome;
	});

	// Whether this machine has a network connection, for the status strip
	let online = $state(true);
	$effect(() => {
		const update = () => (online = navigator.onLine);
		update();
		addEventListener('online', update);
		addEventListener('offline', update);
		return () => {
			removeEventListener('online', update);
			removeEventListener('offline', update);
		};
	});

	// An airplane flies across the status strip when something new is cached. One at a time: a
	// page loading dozens of resources sends one flight, not dozens.
	let flight = $state(0);
	let inFlight = false;
	/** The cached count last seen, or -1 before the first */
	let lastCached = -1;
	$effect(() => {
		const cached = data.status.cached;
		if (lastCached >= 0 && cached > lastCached && !inFlight) {
			inFlight = true;
			flight++;
		}
		lastCached = cached;
	});

	// The theme from Settings. The server writes it into the page (hooks.server.js), so this only
	// matters when it's changed while the app is open.
	$effect(() => {
		document.documentElement.dataset.theme = data.theme;
	});

	// The header's height, as --header-height on <html>, so a page can fill exactly the rest of the
	// window (the cache page does). It changes when the status strip wraps on narrow windows.
	/** @type {HTMLElement} */
	let header;
	$effect(() => {
		const observer = new ResizeObserver(() =>
			document.documentElement.style.setProperty('--header-height', `${header.offsetHeight}px`)
		);
		observer.observe(header);
		return () => observer.disconnect();
	});

	let path = $derived(page.url.pathname);

	/** Whether the Add to cache panel under the status strip is open */
	let addOpen = $state(false);

	/** Whether the menu is open on small screens; on wider ones the links are always shown */
	let menuOpen = $state(false);

	// Close the menu after moving to another page
	$effect(() => {
		void path;
		menuOpen = false;
	});

	/** @param {boolean} active */
	const current = (active) => (active ? 'page' : undefined);

	// Small screens: full-width rows in the dropdown panel, the current one marked on the left.
	// md and up: tabs, the current one underlined in cyan like a selected page on a cockpit display.
	const linkClass =
		'block border-l-2 border-transparent px-4 py-3 text-sm font-bold tracking-wider text-slate-300 uppercase hover:bg-slate-800 hover:text-slate-50 aria-[current=page]:border-sky-400 aria-[current=page]:text-sky-400 md:border-0 md:border-b-2 md:px-3 md:py-2 md:hover:bg-transparent';
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') {
			menuOpen = false;
			addOpen = false;
		}
	}}
/>

<div class="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
	<header
		bind:this={header}
		class="sticky top-0 z-10 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
	>
		<div class="mx-auto flex max-w-5xl items-center justify-between gap-6 px-4 py-3">
			<div class="min-w-0">
				<a
					href={resolve('/')}
					class="group flex items-center gap-2 text-lg font-bold tracking-[0.12em] whitespace-nowrap text-slate-50 uppercase sm:text-xl"
				>
					<!-- The app icon's airplane, which climbs a little on hover -->
					<Airplane
						class="size-5 rotate-45 text-sky-400 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
					/>
					Airplane Mode
				</a>
				<p class="mt-0.5 text-xs text-slate-400">
					An easy-to-use and easy-to-edit HTTP cache for local web development
				</p>
			</div>

			<nav aria-label="Main">
				<button
					type="button"
					aria-expanded={menuOpen}
					aria-controls="main-menu"
					onclick={() => (menuOpen = !menuOpen)}
					aria-label={menuOpen ? 'Close menu' : 'Open menu'}
					class="rounded-md border border-slate-700 p-2 text-slate-200 hover:border-slate-500 hover:text-slate-50 aria-expanded:border-sky-400 aria-expanded:text-sky-400 md:hidden"
				>
					<svg
						viewBox="0 0 24 24"
						class="size-5"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						{#if menuOpen}
							<path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
						{:else}
							<path d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round" />
						{/if}
					</svg>
				</button>

				<ul
					id="main-menu"
					class={[
						'absolute inset-x-0 top-full border-b border-slate-700 bg-slate-900 shadow-lg shadow-black/40',
						'md:static md:flex md:gap-1 md:border-0 md:bg-transparent md:shadow-none',
						menuOpen ? 'block' : 'hidden'
					]}
				>
					<li>
						<a
							href={resolve('/')}
							aria-current={current(path === '/' || path.startsWith('/entries/'))}
							class={linkClass}>Cache</a
						>
					</li>
					<li>
						<a
							href={resolve('/settings')}
							aria-current={current(path === '/settings')}
							class={linkClass}>Settings</a
						>
					</li>
					<li>
						<a href={resolve('/about')} aria-current={current(path === '/about')} class={linkClass}
							>About</a
						>
					</li>
				</ul>
			</nav>
		</div>

		<!-- Status strip, like the mode readout along the top of a cockpit display -->
		<div class="relative overflow-hidden border-t border-slate-800 bg-slate-950/70">
			{#if flight}
				{#key flight}
					<div
						class="pointer-events-none absolute inset-y-0 left-0 flex animate-flyover items-center"
						onanimationend={() => (inFlight = false)}
						aria-hidden="true"
					>
						<span
							class="h-px w-24 bg-gradient-to-r from-transparent to-sky-400 [mask-image:repeating-linear-gradient(to_right,#000_0_6px,transparent_6px_10px)]"
						></span>
						<Airplane class="size-3.5 rotate-90 text-sky-400" />
					</div>
				{/key}
			{/if}
			<div class="mx-auto flex max-w-5xl items-center gap-4 px-4">
				<dl
					class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-5 gap-y-1 py-1.5 text-[0.7rem] tracking-wider uppercase"
				>
					<div class="flex items-baseline gap-2">
						<dt class="text-slate-500">Cache</dt>
						<dd class="font-mono text-sky-400 normal-case">{data.status.server}/c/*</dd>
					</div>
					<div class="flex items-baseline gap-2">
						<dt class="text-slate-500">Cached</dt>
						<dd class="font-mono text-emerald-400">{data.status.cached}</dd>
					</div>
					<div class="flex items-baseline gap-2">
						<dt class="text-slate-500">Bypass</dt>
						<dd class="font-mono text-slate-100">{data.status.bypass}</dd>
					</div>
					<div class="flex items-baseline gap-2">
						<dt class="text-slate-500">Network</dt>
						<!-- An annunciator light: green when connected, lit amber when not -->
						<dd
							class={[
								'rounded-sm px-1.5 annunciator',
								online
									? 'text-emerald-400'
									: 'bg-amber-300 text-slate-950 shadow-[0_0_8px_rgb(255_201_77/0.5)]'
							]}
						>
							{online ? 'Online' : 'Offline'}
						</dd>
					</div>
				</dl>
				<!-- Opens the Add to cache panel below the strip, from any page -->
				<button
					type="button"
					aria-expanded={addOpen}
					aria-controls="add-to-cache-panel"
					onclick={() => (addOpen = !addOpen)}
					class={[
						// Plain text, not outlined, so it doesn't read as a status light like Online.
						// The + turns into × while the panel is open.
						'flex shrink-0 items-center gap-1 py-1.5 text-[0.7rem] font-bold tracking-wider uppercase hover:underline',
						addOpen ? 'text-slate-50' : 'text-sky-400 hover:text-sky-300'
					]}
				>
					<svg
						viewBox="0 0 24 24"
						class={['size-3 transition-transform', addOpen && 'rotate-45']}
						fill="none"
						stroke="currentColor"
						stroke-width="3"
						stroke-linecap="round"
						aria-hidden="true"
					>
						<path d="M12 5v14M5 12h14" />
					</svg>
					Add to cache
				</button>
			</div>
		</div>

		<!-- Floats over the page below the strip, under the button that opens it, so nothing moves.
		     Its background is the status strip's colour, made opaque. -->
		{#if addOpen}
			<div class="pointer-events-none absolute inset-x-0 top-full">
				<div class="mx-auto flex max-w-5xl justify-end px-4 pt-2">
					<div
						id="add-to-cache-panel"
						role="dialog"
						aria-labelledby="add-to-cache-heading"
						transition:fly={{ y: -8, duration: 150 }}
						class="pointer-events-auto w-full max-w-3xl space-y-3 rounded-lg border border-slate-700 bg-[color-mix(in_srgb,var(--color-slate-950)_70%,var(--color-slate-900))] p-4 shadow-2xl panel shadow-black/50"
					>
						<div class="flex items-center gap-2">
							<h2 id="add-to-cache-heading" class="min-w-0 flex-1 text-base text-slate-50">
								Add to cache
							</h2>
							<button
								type="button"
								aria-label="Close Add to cache"
								title="Close"
								onclick={() => (addOpen = false)}
								class="rounded-md border border-slate-700 p-1 text-slate-300 hover:bg-slate-800 hover:text-slate-50"
							>
								<svg
									viewBox="0 0 24 24"
									class="size-4"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									stroke-linecap="round"
									aria-hidden="true"
								>
									<path d="M6 6l12 12M18 6L6 18" />
								</svg>
							</button>
						</div>
						<AddToCache serverUrl={data.status.server} />
					</div>
				</div>
			</div>
		{/if}
	</header>

	<!-- Dims the page behind the Add to cache panel; clicking it closes the panel -->
	{#if addOpen}
		<button
			type="button"
			aria-label="Close Add to cache"
			tabindex="-1"
			transition:fade={{ duration: 150 }}
			class="fixed inset-0 z-[5] cursor-default bg-black/40"
			onclick={() => (addOpen = false)}
		></button>
	{/if}

	<!-- Clicking outside the open menu closes it -->
	{#if menuOpen}
		<button
			type="button"
			aria-label="Close menu"
			tabindex="-1"
			class="fixed inset-0 z-[5] cursor-default md:hidden"
			onclick={() => (menuOpen = false)}
		></button>
	{/if}

	<main class="mx-auto max-w-5xl space-y-6 px-4 py-8">
		{@render children()}
	</main>

	{#if welcomeOpen}
		<WelcomeModal serverUrl={data.status.server} onclose={() => (welcomeOpen = false)} />
	{/if}
</div>
