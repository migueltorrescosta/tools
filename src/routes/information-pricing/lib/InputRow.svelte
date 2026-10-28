<script lang="ts">
	import type { GroupTable, InputDensity } from '$lib/information-pricing/analysis';
	import { niceTicks } from '$lib/plot';
	import { Axis } from '$lib/ui';
	import {
		compactTick,
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

	/** One input's short row: its distribution, then the best decision per quantile group. */
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

	const H = 96;
	/** y of the x axis in both plots. */
	const AX = H - 20;

	let wd = $state(300);
	let wg = $state(300);
	const WD = $derived(Math.max(120, wd));
	const WG = $derived(Math.max(120, wg));

	const flat = $derived(!(density.max > density.min));
	const x0 = $derived(flat ? density.min - 0.5 : density.min);
	const x1 = $derived(flat ? density.max + 0.5 : density.max);
	const ticksFor = (w: number) => niceTicks(x0, x1, Math.max(3, Math.floor(w / 60)));

	// Density
	const MD = { left: 8, right: 10 };
	const sxd = $derived(linear(x0, x1, MD.left, WD - MD.right));
	const dMax = $derived(Math.max(...density.density, 0));
	const sd = $derived(linear(0, dMax > 0 ? dMax * 1.05 : 1, AX, 4));
	const area = $derived.by(() => {
		if (flat || !(dMax > 0)) return '';
		const xs = Array.from(density.grid, sxd);
		const ys = Array.from(density.density, sd);
		return `${linePath(xs, ys)}L${xs.at(-1)!.toFixed(1)},${AX}L${xs[0].toFixed(1)},${AX}Z`;
	});

	// Mean loss per decision per group, log y
	const MG = { left: 38, right: 10 };
	const BAND = { top: AX - 9, height: 7 };
	const sxg = $derived(linear(x0, x1, MG.left, WG - MG.right));
	const rows = $derived(
		groups.groups.map((g) => {
			const lo = Math.max(groups.edges[g.group], x0);
			const hi = Math.min(groups.edges[g.group + 1], x1);
			return { ...g, lo, hi, centre: (lo + hi) / 2, losses: Array.from(g.meanLoss, money.scale) };
		})
	);
	const domain = $derived(logDomain(rows.flatMap((r) => r.losses)));
	const sy = $derived(logScale(domain[0], domain[1], BAND.top - 4, 4));
	const yTicks = $derived(logTicks(domain[0], domain[1], 3));
	const D = $derived(decisions.length);
	const winners = $derived(rows.map((r) => `${r.label}: ${decisions[r.optimal]}`).join('; '));
</script>

<div class="plot" bind:clientWidth={wd}>
	<svg
		viewBox="0 0 {WD} {H}"
		width={WD}
		height={H}
		role="img"
		aria-label="Density of {label}, with deciles marked."
	>
		{#if area}<path d={area} class="density" />{/if}
		{#each density.deciles as q, k (k)}
			<line class="decile" x1={sxd(q)} x2={sxd(q)} y1={4} y2={AX} />
		{/each}
		<Axis
			side="bottom"
			ticks={ticksFor(WD)}
			scale={sxd}
			at={AX}
			from={MD.left}
			to={WD - MD.right}
			format={compactTick}
		/>
	</svg>
</div>
<div class="plot" bind:clientWidth={wg}>
	<svg
		viewBox="0 0 {WG} {H}"
		width={WG}
		height={H}
		role="img"
		aria-label="Mean loss of each decision per quantile group of {label}, log scale. Best per group: {winners}."
	>
		<Axis
			side="left"
			ticks={yTicks}
			scale={sy}
			at={MG.left}
			from={4}
			to={BAND.top - 4}
			format={formatLogTick}
			grid={[MG.left, WG - MG.right]}
		/>
		<Axis
			side="bottom"
			ticks={ticksFor(WG - MG.left)}
			scale={sxg}
			at={AX}
			from={MG.left}
			to={WG - MG.right}
			format={compactTick}
		/>
		{#each rows as r (r.group)}
			<rect
				x={sxg(r.lo)}
				y={BAND.top}
				width={Math.max(1, sxg(r.hi) - sxg(r.lo) - 1)}
				height={BAND.height}
				fill={dataColour(r.optimal)}
			>
				<title>{r.label}: best is {decisions[r.optimal]}</title>
			</rect>
		{/each}
		{#each { length: D } as _, d (d)}
			<path
				d={linePath(
					rows.map((r) => sxg(r.centre)),
					rows.map((r) => sy(r.losses[d]))
				)}
				fill="none"
				stroke={dataColour(d)}
				stroke-width="1.2"
			/>
		{/each}
		{#each rows as r (r.group)}
			{@const v = r.losses[r.optimal]}
			<circle class="winner" cx={sxg(r.centre)} cy={sy(v)} r="3.5" stroke={dataColour(r.optimal)}>
				<title
					>{r.label}: {decisions[r.optimal]} is best, mean loss {formatNumber(v)}
					{money.unit}</title
				>
			</circle>
		{/each}
	</svg>
</div>

<style>
	.plot {
		min-width: 0;
	}
	svg {
		display: block;
		overflow: visible;
	}
	.plot :global(.axis text) {
		font-size: 10px;
	}
	.density {
		fill: var(--text-muted);
		fill-opacity: 0.2;
		stroke: var(--text-muted);
		stroke-width: 1.2;
	}
	.decile {
		stroke: var(--text-muted);
		stroke-dasharray: 2 3;
	}
	.winner {
		fill: var(--surface);
		stroke-width: 2;
	}
</style>
