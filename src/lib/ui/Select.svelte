<script lang="ts" generics="T extends string">
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import Field from './Field.svelte';

	let {
		label,
		options,
		value = $bindable(),
		hideLabel = false,
		hint,
		...rest
	}: Omit<HTMLSelectAttributes, 'value'> & {
		label: string;
		options: readonly { value: T; label: string }[];
		value: T;
		hideLabel?: boolean;
		hint?: string;
	} = $props();
</script>

<Field {label} {hideLabel} {hint}>
	{#snippet children(props)}
		<select class="control" bind:value {...props} {...rest}>
			{#each options as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	{/snippet}
</Field>
