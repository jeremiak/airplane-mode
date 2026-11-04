<script>
	/** @typedef {{ label: string, href?: string }} Crumb */

	/** @type {{ items: Crumb[] }} */
	let { items } = $props();
</script>

<nav aria-label="Breadcrumb" class="min-w-0">
	<ol class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
		{#each items as item, i (i)}
			{@const isLast = i === items.length - 1}
			<li class="flex min-w-0 items-baseline gap-2">
				{#if item.href && !isLast}
					<!-- Callers pass hrefs already built with resolve() -->
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a href={item.href} class="text-sky-400 hover:text-sky-300 hover:underline"
						>{item.label}</a
					>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{:else}
					<span
						aria-current={isLast ? 'page' : undefined}
						class="truncate text-slate-500 dark:text-slate-400"
						title={item.label}>{item.label}</span
					>
				{/if}
				{#if !isLast}
					<span aria-hidden="true" class="text-slate-400">›</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>
