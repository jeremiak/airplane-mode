<script>
	let { data } = $props();
</script>

<h1 class="text-xl text-slate-50">About</h1>

<div
	class="prose prose-sm max-w-none rounded-lg border border-slate-200 bg-white p-4 panel dark:border-slate-800 dark:bg-slate-900 prose-code:before:content-none prose-code:after:content-none"
>
	<p>
		Airplane Mode is an easy-to-use and easy-to-edit HTTP cache that keeps a copy of anything you
		load through it, so you can keep working when a site is slow, changing or offline.
	</p>
	<p>The idea is to make web development easier by helping you:</p>
	<ul>
		<li>
			inspect HTTP requests and save them for when you don't have access to the internet
		</li>
		<li>modify an API response</li>
		<li>avoid incurring too many third-party API requests during development</li>
	</ul>
	<p>
		To add a resource to the cache, preprend <code class="font-mono break-all"
			>{data.settings.url}/c/</code
		>
		to any URL and request it through a browser. Then, the next time the URL is requested the resource
		gets served from Airplane Mode instead of the internet.
	</p>
	<p>You can edit any resource once it's been added to the cache.</p>
	<p>
		If you like Airplane Mode, please consider
		<!-- A new window, which the Electron app opens in the default browser instead of in the app -->
		<a href="https://buymeacoffee.com/jeremiak/e/594368" target="_blank" rel="noreferrer"
			>supporting its development</a
		>.
	</p>
</div>
