<script lang="ts">
	import { tick } from 'svelte';
	import { FAMILIES } from '$lib/information-pricing/distributions';
	import type { Family } from '$lib/information-pricing/types';
	import { Button } from '$lib/ui';

	/** "Add input" as a menu button: each item appends an input of that distribution. */
	let { onadd, disabled = false }: { onadd: (family: Family) => void; disabled?: boolean } =
		$props();

	const uid = $props.id();
	let wrap = $state<HTMLDivElement>();
	let open = $state(false);
	const items: HTMLButtonElement[] = $state([]);

	const trigger = () => wrap?.querySelector<HTMLButtonElement>('button[aria-haspopup]');

	async function show(at: number) {
		open = true;
		await tick();
		items.at(at)?.focus();
	}

	function hide() {
		open = false;
		trigger()?.focus();
	}

	function choose(family: Family) {
		onadd(family);
		hide();
	}

	function onTriggerKey(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			void show(e.key === 'ArrowDown' ? 0 : -1);
		}
	}

	function onMenuKey(e: KeyboardEvent) {
		const at = items.indexOf(document.activeElement as HTMLButtonElement);
		const n = FAMILIES.length;
		const go = (k: number) => items[(k + n) % n]?.focus();
		switch (e.key) {
			case 'ArrowDown':
				go(at + 1);
				break;
			case 'ArrowUp':
				go(at - 1);
				break;
			case 'Home':
				go(0);
				break;
			case 'End':
				go(n - 1);
				break;
			case 'Escape':
				hide();
				break;
			case 'Tab':
				open = false;
				return;
			default:
				return;
		}
		e.preventDefault();
	}
</script>

<div
	class="add-menu"
	bind:this={wrap}
	onfocusout={(e) => {
		if (!wrap?.contains(e.relatedTarget as Node | null)) open = false;
	}}
>
	<Button
		size="sm"
		{disabled}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-controls="add-menu-{uid}"
		onclick={() => (open ? hide() : void show(0))}
		onkeydown={onTriggerKey}>Add input <span aria-hidden="true">▾</span></Button
	>
	<div
		id="add-menu-{uid}"
		class="menu"
		role="menu"
		aria-label="Distribution of the new input"
		tabindex="-1"
		hidden={!open}
		onkeydown={onMenuKey}
	>
		{#each FAMILIES as f, k (f.family)}
			<button
				type="button"
				role="menuitem"
				tabindex="-1"
				bind:this={items[k]}
				onclick={() => choose(f.family)}>{f.name}</button
			>
		{/each}
	</div>
</div>

<style>
	.add-menu {
		position: relative;
		display: inline-block;
	}
	.menu {
		position: absolute;
		z-index: 6;
		top: calc(100% + 2px);
		left: 0;
		display: flex;
		flex-direction: column;
		min-width: 9rem;
		padding: var(--sp-1) 0;
		background: var(--surface);
		border: 1px solid var(--border-strong);
		border-radius: var(--radius);
		box-shadow: 0 4px 12px rgb(0 0 0 / 0.15);
	}
	.menu[hidden] {
		display: none;
	}
	[role='menuitem'] {
		padding: var(--sp-1) var(--sp-3);
		border: 0;
		background: transparent;
		color: var(--text);
		font: inherit;
		font-size: var(--text-sm);
		text-align: left;
		cursor: pointer;
	}
	[role='menuitem']:hover,
	[role='menuitem']:focus-visible {
		background: var(--accent-bg);
		outline: none;
		box-shadow: inset 3px 0 0 var(--accent);
	}
</style>
