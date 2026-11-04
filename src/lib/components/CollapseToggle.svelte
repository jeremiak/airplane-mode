<script>
	/**
	 * The chevron button in the top-right corner of a collapsible panel, such as the request log
	 * @type {{
	 * 	open: boolean,
	 * 	side?: 'top' | 'left',
	 * 	controls: string,
	 * 	name: string,
	 * 	ontoggle: () => void
	 * }}
	 * `controls` is the id of the content it shows and hides; `name` finishes its label, as in
	 * "Collapse the request log". `side` is where the panel collapses to: up into its heading, or (on
	 * md screens and up) into the left edge, where the chevron points left and right instead.
	 */
	let { open, side = 'top', controls, name, ontoggle } = $props();
</script>

<button
	type="button"
	aria-expanded={open}
	aria-controls={controls}
	aria-label={`${open ? 'Collapse' : 'Expand'} ${name}`}
	title={open ? 'Collapse' : 'Expand'}
	onclick={ontoggle}
	class="shrink-0 rounded-md border border-slate-700 p-1 text-slate-300 hover:bg-slate-800 hover:text-slate-50"
>
	<!-- Points down to expand and up to collapse; for the left side, right and left on md and up -->
	<svg
		viewBox="0 0 24 24"
		class={[
			'size-4 transition-transform',
			open && 'rotate-180',
			side === 'left' && (open ? 'md:rotate-90' : 'md:-rotate-90')
		]}
		fill="none"
		stroke="currentColor"
		stroke-width="2.5"
		aria-hidden="true"
	>
		<path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
	</svg>
</button>
