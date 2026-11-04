<script>
	import { resolve } from '$app/paths';

	/**
	 * A walkthrough shown while the cache is empty. Opening the example caches it, which (through the
	 * page's live updates) replaces this guide with the list.
	 * @type {{ serverUrl: string }}
	 */
	let { serverUrl } = $props();

	let site = $state('example.com');
	let copied = $state(false);

	let proxied = $derived(`${serverUrl}/c/${site.trim() || 'example.com'}`);

	async function copy() {
		await navigator.clipboard.writeText(proxied);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	const stepClass = 'grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-2';
	const numberClass =
		'flex size-8 items-center justify-center rounded-full border border-sky-400/50 font-mono text-sm font-bold text-sky-400';
	const buttonClass =
		'flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm whitespace-nowrap hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800';
	const iconProps = {
		viewBox: '0 0 24 24',
		class: 'size-4',
		fill: 'none',
		stroke: 'currentColor',
		'stroke-width': 2,
		'stroke-linecap': /** @type {const} */ ('round'),
		'stroke-linejoin': /** @type {const} */ ('round'),
		'aria-hidden': /** @type {const} */ (true)
	};
</script>

<section
	aria-labelledby="getting-started-heading"
	class="space-y-6 rounded-lg border border-slate-200 bg-white p-5 panel dark:border-slate-800 dark:bg-slate-900"
>
	<div class="space-y-1">
		<h2 id="getting-started-heading" class="text-base text-slate-50">Getting started</h2>
		<p class="text-sm text-slate-500 dark:text-slate-400">
			Airplane Mode keeps a copy of anything you load through it, so you can keep working when a
			site is slow, changing or offline.
		</p>
	</div>

	<ol class="space-y-6">
		<li class={stepClass}>
			<span class={numberClass} aria-hidden="true">1</span>
			<div class="space-y-3">
				<div>
					<h3 class="text-sm text-slate-50">
						Create the cache URL
					</h3>
					<p class="text-sm text-slate-500 dark:text-slate-400">
						Enter a site below to get its Airplane Mode address. The scheme is optional and the default is https.
					</p>
				</div>
				<label class="block max-w-md">
					<span class="sr-only">Site to cache</span>
					<input
						bind:value={site}
						spellcheck="false"
						autocomplete="off"
						class="w-full rounded-md border-slate-300 font-mono text-sm dark:border-slate-700 dark:bg-slate-950"
					/>
				</label>
				<div class="flex flex-wrap items-center gap-2">
					<code
						class="min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm break-all text-sky-700 dark:border-slate-800 dark:bg-slate-950 dark:text-sky-400"
						>{proxied}</code
					>
					<!-- A full URL on this server, which may be opened outside the app -->
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a href={proxied} target="_blank" rel="noreferrer" class={buttonClass}>
						<!-- The same "opens elsewhere" arrow as Open in browser -->
						<svg {...iconProps}>
							<path
								d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
							/>
						</svg>
						Open
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
					<button type="button" onclick={copy} class={buttonClass}>
						<!-- Two sheets while copying, a check once it's on the clipboard -->
						<svg {...iconProps}>
							{#if copied}
								<path d="M5 12.5l4.5 4.5L19 7.5" />
							{:else}
								<rect x="8" y="8" width="12" height="12" rx="1.5" />
								<path
									d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"
								/>
							{/if}
						</svg>
						{copied ? 'Copied' : 'Copy'}
					</button>
				</div>
			</div>
		</li>

		<li class={stepClass}>
			<span class={numberClass} aria-hidden="true">2</span>
			<div>
				<h3 class="text-sm text-slate-50">Browse as usual</h3>
				<p class="text-sm text-slate-500 dark:text-slate-400">
					The page's stylesheets, images, scripts and data requests are cached too, and links stay
					inside Airplane Mode. Each response shows up in the list above as it's cached.
				</p>
			</div>
		</li>

		<li class={stepClass}>
			<span class={numberClass} aria-hidden="true">3</span>
			<div>
				<h3 class="text-sm text-slate-50">Edit, refresh or bypass</h3>
				<p class="text-sm text-slate-500 dark:text-slate-400">
					Use <strong class="text-slate-700 dark:text-slate-200">Edit</strong> to change a
					response's status, headers or content, and
					<strong class="text-slate-700 dark:text-slate-200">Remove</strong> to fetch a fresh copy
					next time. To keep things like analytics live and out of the cache, add them under
					<a href={resolve('/settings')} class="text-sky-700 hover:underline dark:text-sky-400"
						>Settings → Bypass the cache</a
					>.
				</p>
			</div>
		</li>
	</ol>
</section>
