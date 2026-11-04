<script>
	import { AIRPLANE_PATH } from '#lib/airplane.js';

	// A navigation display for the welcome tutorial: the airplane flies its route from the live web
	// to the cache, drawing the route in cyan behind it. With reduced motion it's shown arrived.
	const reduced =
		typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	const route = 'M 48 50 C 170 2, 390 2, 512 40';
	// Ease in and out of the flight, as SMIL key splines
	const timing = { dur: '3.2s', begin: '0.4s', fill: 'freeze', calcMode: 'spline' };
	const ease = '0.45 0 0.35 1';
</script>

<svg
	viewBox="0 0 560 72"
	class="block w-full rounded-md border border-slate-800 bg-slate-950"
	aria-hidden="true"
>
	<!-- Range rings around the destination -->
	<g fill="none" stroke="var(--color-slate-800)" stroke-width="1">
		<circle cx="512" cy="40" r="30" />
		<circle cx="512" cy="40" r="72" />
		<circle cx="512" cy="40" r="130" stroke-dasharray="2 6" />
	</g>

	<!-- The planned route, and the part already flown -->
	<path
		d={route}
		fill="none"
		stroke="var(--color-slate-600)"
		stroke-width="1.5"
		stroke-dasharray="4 6"
	/>
	<path
		d={route}
		fill="none"
		stroke="var(--color-route)"
		stroke-width="2"
		pathLength="1"
		stroke-dasharray="1"
		stroke-dashoffset={reduced ? 0 : 1}
	>
		{#if !reduced}
			<animate
				attributeName="stroke-dashoffset"
				from="1"
				to="0"
				keyTimes="0;1"
				keySplines={ease}
				{...timing}
			/>
		{/if}
	</path>

	<!-- Waypoints -->
	<g font-family="ui-monospace, Menlo, monospace" font-size="10" letter-spacing="1">
		<path d="M48 44 L54 50 L48 56 L42 50 Z" fill="none" stroke="var(--color-slate-400)" />
		<text x="48" y="68" text-anchor="middle" fill="var(--color-slate-400)">WEB</text>
		<path
			d="M512 34 L518 40 L512 46 L506 40 Z"
			fill="var(--color-emerald-400)"
			opacity={reduced ? 1 : 0.35}
		>
			{#if !reduced}
				<animate attributeName="opacity" values="0.35;1" dur="0.6s" begin="3.6s" fill="freeze" />
			{/if}
		</path>
		<text x="512" y="62" text-anchor="middle" fill="var(--color-emerald-400)">CACHE</text>
	</g>

	<!-- The airplane: animateMotion turns it to face along the route, so it's drawn facing right -->
	<!-- Hidden until it takes off; before that animateMotion leaves it at the corner -->
	<g transform={reduced ? 'translate(512 40) rotate(17)' : undefined} opacity={reduced ? 1 : 0}>
		{#if !reduced}
			<set attributeName="opacity" to="1" begin={timing.begin} fill="freeze" />
			<animateMotion
				path={route}
				rotate="auto"
				keyPoints="0;1"
				keyTimes="0;1"
				keySplines={ease}
				{...timing}
			/>
		{/if}
		<path
			d={AIRPLANE_PATH}
			transform="rotate(90) scale(0.13)"
			fill="var(--color-slate-50)"
			stroke="var(--color-slate-950)"
			stroke-width="12"
			paint-order="stroke"
		/>
	</g>
</svg>
