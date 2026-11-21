<script lang="ts">
	import { Axis } from '#lib/ui/index.js';
	import type { DotRow } from '#lib/implicit-association/history.js';

	let { rows }: { rows: readonly DotRow[] } = $props();

	let width = $state(600);
	const PAD = { left: 12, right: 12 };
	const ROW = 52;
	const top = 8;
	const extent = $derived(
		Math.max(
			1,
			Math.ceil(Math.max(...rows.flatMap((r) => r.runs.map((s) => Math.abs(s.score.d)))) * 2) / 2
		)
	);
	const ticks = $derived(
		[...Array(Math.round(extent * 4) + 1).keys()]
			.map((i) => -extent + i * 0.5)
			.filter((t) => Math.abs(t) <= extent)
	);
	const x = $derived(
		(d: number) => PAD.left + ((d + extent) / (2 * extent)) * (width - PAD.left - PAD.right)
	);
	const height = $derived(top + rows.length * ROW + 40);
	const axisAt = $derived(top + rows.length * ROW + 4);
	const fmt = (d: number) => (d > 0 ? `+${d.toFixed(2)}` : d.toFixed(2));
	const date = (iso: string) =>
		new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
</script>

<div class="dot-plot" bind:clientWidth={width}>
	<svg
		{width}
		{height}
		role="img"
		aria-label="Your D-scores per comparison: each run as a dot, with the mean and its 95% confidence interval"
	>
		<line class="zero" x1={x(0)} x2={x(0)} y1={top} y2={axisAt} />
		{#each rows as row, i (row.key)}
			{@const y = top + i * ROW + 34}
			<text class="label" x={PAD.left} y={y - 18}
				>{row.label}{row.input === 'touch' ? ' (touch)' : ''}</text
			>
			<line class="track" x1={x(-extent)} x2={x(extent)} y1={y} y2={y} />
			{#if row.ci}
				<line
					class="ci"
					x1={x(Math.max(-extent, row.ci[0]))}
					x2={x(Math.min(extent, row.ci[1]))}
					y1={y}
					y2={y}
				/>
			{/if}
			{#each row.runs as s (s.run.id)}
				<circle class="run" class:flagged={s.score.flagged} cx={x(s.score.d)} cy={y} r="5">
					<title
						>{date(s.run.date)}: D = {fmt(s.score.d)}{s.score.flagged
							? ' (too many very fast answers; not in the mean)'
							: ''}</title
					>
				</circle>
			{/each}
			{#if row.mean !== undefined}
				<line class="mean" x1={x(row.mean)} x2={x(row.mean)} y1={y - 9} y2={y + 9}>
					<title
						>Mean D = {fmt(row.mean)}{row.ci
							? `, 95% CI ${fmt(row.ci[0])} to ${fmt(row.ci[1])}`
							: ''}</title
					>
				</line>
			{/if}
		{/each}
		<Axis
			side="bottom"
			{ticks}
			scale={x}
			at={axisAt}
			from={x(-extent)}
			to={x(extent)}
			format={(t) => (t === 0 ? '0' : fmt(t).replace('.00', '').replace(/0$/, ''))}
		/>
	</svg>
	<ul class="key" aria-label="Key">
		<li>
			<svg width="12" height="12" aria-hidden="true"><circle class="run" cx="6" cy="6" r="5" /></svg
			> A run
		</li>
		<li>
			<svg width="12" height="12" aria-hidden="true"
				><circle class="run flagged" cx="6" cy="6" r="4.5" /></svg
			> Too fast to count
		</li>
		<li>
			<svg width="16" height="12" aria-hidden="true"
				><line class="ci" x1="0" x2="16" y1="6" y2="6" /><line
					class="mean"
					x1="8"
					x2="8"
					y1="0"
					y2="12"
				/></svg
			> Mean and 95% interval
		</li>
	</ul>
</div>

<style>
	.dot-plot {
		width: 100%;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.label {
		fill: var(--text);
		font-size: var(--text-sm);
	}
	.track {
		stroke: var(--border);
		stroke-width: 1;
	}
	.zero {
		stroke: var(--border-strong);
		stroke-dasharray: 2 3;
	}
	.run {
		fill: var(--data-1);
		stroke: var(--surface);
		stroke-width: 2;
		fill-opacity: 0.85;
	}
	.run.flagged {
		fill: none;
		stroke: var(--data-1);
		stroke-width: 1.5;
	}
	.ci {
		stroke: var(--text);
		stroke-width: 2;
		stroke-linecap: round;
	}
	.mean {
		stroke: var(--text);
		stroke-width: 3;
		stroke-linecap: round;
	}
	.key {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-3);
		margin-top: var(--sp-2);
		padding: 0;
		list-style: none;
		color: var(--text-muted);
		font-size: var(--text-sm);
	}
	.key li {
		display: flex;
		align-items: center;
		gap: var(--sp-1);
	}
</style>
