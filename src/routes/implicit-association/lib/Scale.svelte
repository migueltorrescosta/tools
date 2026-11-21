<script lang="ts">
	import { BANDS } from '#lib/implicit-association/score.js';

	let {
		d,
		labels
	}: { d: number; labels: { targets: [string, string]; attributes: [string, string] } } = $props();

	let width = $state(480);
	const PAD = 8;
	const x = $derived(
		(v: number) => PAD + ((Math.max(-1, Math.min(1, v)) + 1) / 2) * (width - 2 * PAD)
	);
	const edges = [
		-1,
		-BANDS.strong,
		-BANDS.moderate,
		-BANDS.slight,
		BANDS.slight,
		BANDS.moderate,
		BANDS.strong,
		1
	];
	const shade = [3, 2, 1, 0, 1, 2, 3];
</script>

<div class="scale" bind:clientWidth={width}>
	<svg {width} height="28" role="img" aria-label="Your D on a scale from -1 to +1">
		{#each shade as s, i (i)}
			<rect
				class="band b{s}"
				x={x(edges[i]) + 1}
				y="8"
				width={Math.max(0, x(edges[i + 1]) - x(edges[i]) - 2)}
				height="12"
				rx="2"
			/>
		{/each}
		<line class="marker" x1={x(d)} x2={x(d)} y1="2" y2="26" />
	</svg>
	<div class="ends">
		<span>{labels.targets[1]} with {labels.attributes[0]}</span>
		<span>{labels.targets[0]} with {labels.attributes[0]}</span>
	</div>
</div>

<style>
	svg {
		display: block;
	}
	.band {
		fill: var(--data-8);
	}
	.b0 {
		fill-opacity: 0.12;
	}
	.b1 {
		fill-opacity: 0.25;
	}
	.b2 {
		fill-opacity: 0.4;
	}
	.b3 {
		fill-opacity: 0.55;
	}
	.marker {
		stroke: var(--accent);
		stroke-width: 3;
		stroke-linecap: round;
	}
	.ends {
		display: flex;
		justify-content: space-between;
		gap: var(--sp-3);
		color: var(--text-muted);
		font-size: var(--text-sm);
	}
	.ends span:last-child {
		text-align: right;
	}
</style>
