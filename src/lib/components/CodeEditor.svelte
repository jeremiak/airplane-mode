<script>
	import { onMount } from 'svelte';
	import { basicSetup } from 'codemirror';
	import { Compartment } from '@codemirror/state';
	import { EditorView, keymap } from '@codemirror/view';
	import { css } from '@codemirror/lang-css';
	import { html } from '@codemirror/lang-html';
	import { javascript } from '@codemirror/lang-javascript';
	import { json } from '@codemirror/lang-json';
	import { xml } from '@codemirror/lang-xml';
	import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
	import { tags } from '@lezer/highlight';

	/**
	 * A code editor (CodeMirror) for a form field. The text is submitted through a hidden input
	 * named `name`; until the editor loads, a plain textarea stands in.
	 * @type {{ name: string, value: string, contentType?: string, label?: string }}
	 */
	let { name, value = $bindable(), contentType = '', label = 'Content' } = $props();

	/**
	 * The editor language and Prettier parser for a Content-Type
	 * @param {string} type
	 */
	function languageFor(type) {
		const t = type.toLowerCase();
		if (t.includes('html')) return { label: 'HTML', extension: html(), parser: 'html' };
		if (t.includes('css')) return { label: 'CSS', extension: css(), parser: 'css' };
		// json-stringify always expands objects, which is what minified API responses need
		if (t.includes('json')) return { label: 'JSON', extension: json(), parser: 'json-stringify' };
		if (t.includes('javascript') || t.includes('ecmascript')) {
			return { label: 'JavaScript', extension: javascript(), parser: 'babel' };
		}
		if (t.includes('svg') || t.includes('xml')) return { label: 'XML', extension: xml() };
		return { label: 'Plain text', extension: [] };
	}

	const language = $derived(languageFor(contentType));

	/** @type {HTMLDivElement} */
	let container;
	/** @type {EditorView | undefined} */
	let view = $state();
	let wrap = $state(true);
	let formatting = $state(false);
	let formatError = $state('');

	const wrapSetting = new Compartment();

	/** Cockpit display colours: the design tokens in src/routes/layout.css, so they follow the theme */
	const display = {
		screen: 'var(--color-slate-950)',
		panel: 'var(--color-slate-900)',
		line: 'var(--color-slate-800)',
		border: 'var(--color-slate-700)',
		dim: 'var(--color-slate-500)',
		text: 'var(--color-slate-100)',
		bright: 'var(--color-slate-50)',
		cyan: 'var(--color-sky-400)',
		green: 'var(--color-emerald-400)',
		magenta: 'var(--color-fuchsia-400)',
		amber: 'var(--color-amber-300)'
	};

	const displayTheme = [
		EditorView.theme(
			{
				'&': { color: display.text, backgroundColor: display.screen },
				'.cm-content': { caretColor: display.cyan },
				'.cm-cursor, .cm-dropCursor': { borderLeft: `2px solid ${display.cyan}` },
				'.cm-gutters': {
					backgroundColor: display.panel,
					color: display.dim,
					borderRight: `1px solid ${display.border}`
				},
				'.cm-activeLine': {
					backgroundColor: `color-mix(in srgb, ${display.line} 60%, transparent)`
				},
				'.cm-activeLineGutter': { backgroundColor: display.line, color: display.bright },
				'&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
					backgroundColor: `${display.border} !important`
				},
				'.cm-matchingBracket': { color: display.bright, outline: `1px solid ${display.cyan}` },
				'.cm-searchMatch': {
					backgroundColor: `color-mix(in srgb, ${display.amber} 20%, transparent)`
				},
				'.cm-foldPlaceholder': {
					backgroundColor: display.line,
					border: 'none',
					color: display.green
				},
				'.cm-panels': { backgroundColor: display.panel, color: display.text },
				'.cm-tooltip': { backgroundColor: display.panel, border: `1px solid ${display.border}` }
			},
			// CodeMirror's own defaults (like the search panel) follow the theme the editor opens in
			{
				dark:
					typeof matchMedia === 'undefined' || matchMedia('(prefers-color-scheme: dark)').matches
			}
		),
		syntaxHighlighting(
			HighlightStyle.define([
				{ tag: [tags.keyword, tags.operatorKeyword, tags.modifier], color: display.magenta },
				{ tag: [tags.tagName, tags.typeName, tags.className], color: display.cyan },
				{ tag: [tags.attributeName, tags.propertyName], color: display.green },
				{ tag: [tags.string, tags.special(tags.string), tags.regexp], color: display.amber },
				{ tag: [tags.number, tags.bool, tags.null, tags.atom, tags.unit], color: display.cyan },
				{
					tag: [tags.function(tags.variableName), tags.definition(tags.variableName)],
					color: display.green
				},
				{ tag: [tags.comment, tags.meta], color: display.dim, fontStyle: 'italic' },
				{ tag: [tags.angleBracket, tags.punctuation, tags.bracket], color: display.dim },
				{ tag: tags.heading, color: display.bright, fontWeight: 'bold' },
				{ tag: tags.invalid, color: display.magenta, textDecoration: 'underline' }
			])
		)
	];

	onMount(() => {
		view = new EditorView({
			parent: container,
			doc: value,
			extensions: [
				basicSetup,
				language.extension,
				displayTheme,
				wrapSetting.of(EditorView.lineWrapping),
				keymap.of([{ key: 'Shift-Alt-f', run: () => (format(), true) }]),
				EditorView.contentAttributes.of({ 'aria-label': label }),
				EditorView.updateListener.of((update) => {
					if (update.docChanged) value = update.state.doc.toString();
				}),
				EditorView.theme({
					'&': { height: '60vh', fontSize: '0.8rem' },
					'.cm-scroller': { fontFamily: 'var(--font-mono)' }
				})
			]
		});

		return () => view?.destroy();
	});

	$effect(() => {
		view?.dispatch({ effects: wrapSetting.reconfigure(wrap ? EditorView.lineWrapping : []) });
	});

	/** Reformat the content with Prettier, which is only downloaded the first time it's used */
	async function format() {
		if (!view || !language.parser || formatting) return;
		formatting = true;
		formatError = '';
		try {
			const [prettier, ...plugins] = await Promise.all([
				import('prettier/standalone'),
				import('prettier/plugins/html'),
				import('prettier/plugins/postcss'),
				import('prettier/plugins/babel'),
				import('prettier/plugins/estree')
			]);
			const formatted = await prettier.format(view.state.doc.toString(), {
				parser: language.parser,
				plugins: plugins.map((plugin) => /** @type {any} */ (plugin).default ?? plugin)
			});
			view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: formatted } });
		} catch (error) {
			formatError = `Couldn't format: ${String(/** @type {Error} */ (error).message).split('\n')[0]}`;
		} finally {
			formatting = false;
		}
	}
</script>

<div class="space-y-2">
	<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
		<span class="text-sm font-medium">{label}</span>
		<span
			class="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
			>{language.label}</span
		>
		<div class="ml-auto flex items-center gap-4">
			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					bind:checked={wrap}
					class="rounded border-slate-300 text-sky-400 dark:border-slate-700 dark:bg-slate-950 dark:checked:border-sky-400 dark:checked:bg-sky-400 dark:indeterminate:border-sky-400 dark:indeterminate:bg-sky-400"
				/>
				Wrap lines
			</label>
			<button
				type="button"
				onclick={format}
				disabled={!view || !language.parser || formatting}
				title={language.parser
					? 'Format with Prettier (Shift+Alt+F)'
					: `Formatting isn't available for ${language.label}`}
				class="rounded-md border border-slate-300 px-2.5 py-1 text-sm hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-transparent dark:border-slate-700 dark:hover:bg-slate-800"
			>
				{formatting ? 'Formatting…' : 'Format'}
			</button>
		</div>
	</div>

	{#if formatError}
		<p class="text-sm text-red-600 dark:text-red-400">{formatError}</p>
	{/if}

	<div
		bind:this={container}
		class="overflow-hidden rounded-md border border-slate-300 dark:border-slate-700"
		class:hidden={!view}
	></div>

	{#if view}
		<input type="hidden" {name} {value} />
	{:else}
		<textarea
			{name}
			rows="20"
			spellcheck="false"
			bind:value
			aria-label={label}
			class="w-full rounded-md border-slate-300 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
		></textarea>
	{/if}
</div>
