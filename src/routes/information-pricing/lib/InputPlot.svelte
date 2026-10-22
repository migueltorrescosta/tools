<script lang="ts">
	import type { GroupTable, InputDensity } from '$lib/information-pricing/analysis';
	import { formatTick, niceTicks } from '$lib/plot';
	import Axis from './Axis.svelte';
	import {
		dataColour,
		formatLogTick,
		formatNumber,
		linear,
		linePath,
		logDomain,
		logScale,
		logTicks,
		type Money
	} from './format';

	let {
		label,
		density,
		groups,
		decisions,
		money
	}: {
		/** The input's label, e.g. "Number of Packages (N)". */
		label: string;
		density: InputDensity;
		groups: GroupTable;
		/** Decision labels, model order. */
		decisions: readonly string[];
		money: Money;
	} = $props();

	let width = $state(560);
	const W = $derived(Math.max(280, width));
	const M = { left: 60, right: 14 };
	const HD = 120;
	const HG = 230;
	const BAND = 14;
	const GB = { top: 8, bottom: 42 + BAND + 6 };

	const flat = $derived(!(density.max > density.min));
	const x0 = $derived(flat ? density.min - 0.5 : density.min);
	const x1 = $derived(flat ? density.max + 0.5 : density.max);
	const sx = $derived(linear(x0, x1, M.left, W - M.right));
	const xTicks = $derived(niceTicks(x0, x1, Math.max(3, Math.floor(W / 110))));

	// Density
	const dMax = $derived(Math.max(...density.density, 0));
	const sd = $derived(linear(0, dMax > 0 ? dMax * 1.05 : 1, HD - 18, 6));
	const area = $derived.by(() => {
		if (flat || !(dMax > 0)) return '';
		const xs = Array.from(density.grid, sx);
		const ys = Array.from(density.density, sd);
		return `${linePath(xs, ys)}L${xs.at(-1)!.toFixed(1)},${sd(0).toFixed(1)}L${xs[0].toFixed(1)},${sd(0).toFixed(1)}Z`;
	});

	// Mean loss per decision per group, log y
	const rows = $derived(
		groups.groups.map((g) => {
			const lo = Math.max(groups.edges[g.group], x0);
			const hi = Math.min(groups.edges[g.group + 1], x1);
			return {
				...g,
				lo,
				hi,
				centre: (lo + hi) / 2,
				losses: Array.from(g.meanLoss, money.scale)
			};
		})
	);
	const domain = $derived(logDomain(rows.flatMap((r) => r.losses)));
	const sy = $derived(logScale(domain[0], domain[1], HG - GB.bottom, GB.top));
	const yTicks = $derived(logTicks(domain[0], domain[1], 5));
	const D = $derived(decisions.length);
	const winners = $derived(rows.map((r) => `${r.label}: ${decisions[r.optimal]}`).join('; '));
</script>

<figure class="chart">
	<figcaption>{label}</figcaption>
	<div bind:clientWidth={width}>
		<svg
			viewBox="0 0 {W} {HD}"
			width={W}
			height={HD}
			role="img"
			aria-label="Density of {label}, with deciles marked."
		>
			{#if area}<path d={area} class="density" />{/if}
			{#each density.deciles as q, k (k)}
				<line class="decile" x1={sx(q)} x2={sx(q)} y1={6} y2={HD - 18} />
			{/each}
			<line class="base" x1={M.left} x2={W - M.right} y1={HD - 18} y2={HD - 18} />
			<text class="note" x={M.left - 7} y={HD - 22} text-anchor="end">density</text>
		</svg>
		<svg
			viewBox="0 0 {W} {HG}"
			width={W}
			height={HG}
			role="img"
			aria-label="Mean loss of each decision per quantile group of {label}, log scale. Best per group: {winners}."
		>
			<Axis
				side="left"
				ticks={yTicks}
				scale={sy}
				at={M.left}
				from={GB.top}
				to={HG - GB.bottom}
				format={formatLogTick}
				grid={[M.left, W - M.right]}
				title={money.unit ? `Mean loss (${money.unit})` : 'Mean loss'}
			/>
			<Axis
				side="bottom"
				ticks={xTicks}
				scale={sx}
				at={HG - GB.bottom + BAND + 6}
				from={M.left}
				to={W - M.right}
				format={formatTick}
			/>
			{#each rows as r (r.group)}
				<rect
					x={sx(r.lo)}
					y={HG - GB.bottom + 4}
					width={Math.max(1, sx(r.hi) - sx(r.lo) - 1)}
					height={BAND - 4}
					fill={dataColour(r.optimal)}
				>
					<title>{r.label}: best is {decisions[r.optimal]}</title>
				</rect>
			{/each}
			{#each { length: D } as _, d (d)}
				<path
					d={linePath(
						rows.map((r) => sx(r.centre)),
						rows.map((r) => sy(r.losses[d]))
					)}
					fill="none"
					stroke={dataColour(d)}
					stroke-width="1.5"
				/>
			{/each}
			{#each rows as r (r.group)}
				{#each r.losses as v, d (d)}
					{#if d === r.optimal}
						<circle class="winner" cx={sx(r.centre)} cy={sy(v)} r="5.5" stroke={dataColour(d)}>
							<title
								>{r.label}: {decisions[d]} is best, mean loss {formatNumber(v)} {money.unit}</title
							>
						</circle>
					{/if}
					<circle cx={sx(r.centre)} cy={sy(v)} r="2.5" fill={dataColour(d)}>
						<title>{r.label}: {decisions[d]}, mean loss {formatNumber(v)} {money.unit}</title>
					</circle>
				{/each}
			{/each}
		</svg>
	</div>
</figure>

<style>
	.density {
		fill: var(--data-1);
		fill-opacity: 0.25;
		stroke: var(--data-1);
		stroke-width: 1.5;
	}
	.decile {
		stroke: var(--text-muted);
		stroke-dasharray: 3 3;
	}
	.base {
		stroke: var(--border-strong);
	}
	.note {
		fill: var(--text-muted);
		font-size: 11px;
	}
	.winner {
		fill: none;
		stroke-width: 2;
	}
</style>
