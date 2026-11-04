<script>
	import { AIRPLANE_PATH } from '#lib/airplane.js';

	/**
	 * The app icon's airplane, seen from above and pointing up. Turn it with rotate classes; it's
	 * filled with the current text colour.
	 * @type {{ class?: import('svelte/elements').ClassValue }}
	 */
	let { class: className } = $props();
</script>

<svg viewBox="-100 -100 200 200" class={className} aria-hidden="true">
	<path fill="currentColor" d={AIRPLANE_PATH} />
</svg>
