<script lang="ts">
	import { tick } from 'svelte';
	import {
		complete,
		type Completion,
		type Suggestion
	} from '$lib/information-pricing/formula/complete';
	import { Field } from '$lib/ui';
	import { scrollFocus } from './scroll-focus';

	const uid = $props.id();

	let {
		label = 'Formula',
		name,
		value,
		onchange,
		symbols,
		error,
		hideLabel = false,
		testId
	}: {
		label?: string;
		/** Accessible name, e.g. "Formula for Rev". */
		name?: string;
		value: string;
		onchange: (value: string) => void;
		/** Symbols the formula may use, offered by autocomplete. */
		symbols: readonly string[];
		/** The formula's first error; `start`/`end` place the caret. */
		error?: { message: string; start?: number; end?: number };
		/** Keep the label for screen readers only (a column header names the field). */
		hideLabel?: boolean;
		testId?: string;
	} = $props();

	let input = $state<HTMLInputElement>();
	let completion = $state.raw<Completion | null>(null);
	let active = $state(0);

	const listId = `formula-list-${uid}`;
	const optionId = (i: number) => `formula-opt-${uid}-${i}`;

	/** Suggestions worth showing: none when the only one is exactly what is typed. */
	const options = $derived.by(() => {
		const list = completion?.suggestions ?? [];
		if (list.length === 1 && list[0].insert === completion?.prefix) return [];
		return list.slice(0, 12);
	});
	const open = $derived(options.length > 0);

	/** Caret line under the formula: `^` at the error, `~` over the rest of its span. */
	const caret = $derived.by(() => {
		if (!error || error.start === undefined) return null;
		const start = Math.min(error.start, value.length);
		const span = Math.max(1, (error.end ?? start + 1) - start);
		return ' '.repeat(start) + '^' + '~'.repeat(span - 1);
	});

	function refresh() {
		if (!input) return;
		const caretAt = input.selectionStart ?? input.value.length;
		completion = complete(input.value, caretAt, symbols);
		active = 0;
	}

	function close() {
		completion = null;
	}

	async function accept(s: Suggestion) {
		if (!completion || !input) return;
		const { start, end } = completion;
		const next = value.slice(0, start) + s.insert + value.slice(end);
		const at = start + s.insert.length;
		close();
		onchange(next);
		await tick();
		input.focus();
		input.setSelectionRange(at, at);
	}

	function onkeydown(e: KeyboardEvent) {
		if (!open) return;
		switch (e.key) {
			case 'ArrowDown':
				active = (active + 1) % options.length;
				break;
			case 'ArrowUp':
				active = (active - 1 + options.length) % options.length;
				break;
			case 'Enter':
			case 'Tab':
				void accept(options[active]);
				break;
			case 'Escape':
				close();
				break;
			default:
				return;
		}
		e.preventDefault();
	}
</script>

<Field {label} {hideLabel} error={error?.message}>
	{#snippet children(props)}
		<div class="combo">
			<input
				bind:this={input}
				class="control mono"
				type="text"
				role="combobox"
				autocomplete="off"
				spellcheck="false"
				aria-label={name}
				aria-autocomplete="list"
				aria-expanded={open}
				aria-controls={listId}
				aria-activedescendant={open ? optionId(active) : undefined}
				data-testid={testId}
				{value}
				oninput={(e) => {
					onchange(e.currentTarget.value);
					refresh();
				}}
				{onkeydown}
				onblur={close}
				onclick={close}
				{...props}
			/>
			<ul id={listId} role="listbox" aria-label="Suggestions" class="list" hidden={!open}>
				{#each options as s, i (s.label)}
					<li
						id={optionId(i)}
						role="option"
						aria-selected={i === active}
						class:active={i === active}
						onpointerdown={(e) => {
							e.preventDefault();
							void accept(s);
						}}
					>
						<span class="mono">{s.label}</span><span class="kind">{s.kind}</span>
					</li>
				{/each}
			</ul>
		</div>
	{/snippet}
</Field>
{#if caret !== null}
	<pre
		class="caret"
		use:scrollFocus={`Error position in ${name ?? label}`}
		data-testid={testId ? `${testId}-caret` : undefined}>{value}
<span class="mark">{caret}</span></pre>
{/if}

<style>
	.combo {
		position: relative;
	}
	.mono {
		font-family: var(--font-mono);
	}
	.list {
		position: absolute;
		z-index: 5;
		top: calc(100% + 2px);
		left: 0;
		min-width: 12rem;
		max-width: 100%;
		max-height: 14rem;
		overflow-y: auto;
		margin: 0;
		padding: var(--sp-1) 0;
		list-style: none;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		box-shadow: 0 4px 12px rgb(0 0 0 / 0.15);
	}
	.list[hidden] {
		display: none;
	}
	li {
		display: flex;
		justify-content: space-between;
		gap: var(--sp-3);
		padding: var(--sp-1) var(--sp-2);
		font-size: var(--text-sm);
		cursor: pointer;
	}
	li.active {
		background: var(--accent-bg);
		color: var(--text);
	}
	.kind {
		color: var(--text-muted);
		font-size: var(--text-xs);
	}
	.caret {
		margin: var(--sp-1) 0 0;
		padding: var(--sp-1) var(--sp-2);
		overflow-x: auto;
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		line-height: 1.3;
		color: var(--text-muted);
		background: var(--surface-2);
		border-radius: var(--radius-sm);
	}
	.mark {
		color: var(--danger-text);
		font-weight: 700;
	}
</style>
