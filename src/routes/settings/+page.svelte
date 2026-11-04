<script>
	import SettingsCards from '#lib/components/SettingsCards.svelte';

	/** @type {import('./$types').PageProps} */
	let { data, form } = $props();
</script>

<h1 class="text-xl text-slate-50">Settings</h1>

<SettingsCards settings={data.settings} {form} />
