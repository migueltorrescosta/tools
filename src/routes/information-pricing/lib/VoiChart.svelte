<script lang="ts">
	import type { ValueOfInformation } from '$lib/information-pricing/analysis';
	import { formatTick, niceTicks } from '$lib/plot';
	import Axis from './Axis.svelte';
	import { dataColour, formatNumber, linear, linePath, type Money } from './format';
	import Legend from './Legend.svelte';

	let {
		voi,
		inputs,
		money
	}: {
		voi: ValueOfInformation;
		/** Input labels, model order. */
		inputs: readonly string[];
		money: Money;
	} = $props();

	let width = $state(480);
	const W = $derived(Math.max(240, width));
	const H = 180;
	const M = { top: 8, right: 12, bottom: 34, left: 52 };

	const scaled = $derived(voi.savings.map((row) => Array.from(row, money.scale)));
	const domain = $derived.by(() => {
		let lo = 0;
		let hi = 0;
		for (const row of scaled)
			for (const v of row)
				if (Number.isFinite(v)) {
					lo = Math.min(lo, v);
					hi = Math.max(hi, v);
				}
		return { lo, hi: hi > lo ? hi * 1.05 : lo + 1 };
	});
	const sx = $derived(linear(voi.bins[0], voi.bins.at(-1)!, M.left, W - M.right));
	const sy = $derived(linear(domain.lo, domain.hi, H - M.bottom, M.top));
	const yTicks = $derived(niceTicks(domain.lo, domain.hi, 4));
	const last = $derived(voi.bins.length - 1);
	const summary = $derived(
		voi.order
			.slice(0, 3)
			.map((j) => `${inputs[j]} ${money.format(voi.savings[j][last])}`)
			.join(', ')
	);
</script>

<figure class="chart" data-testid="voi-chart">
	<figcaption>
		What knowing roughly where an input lands saves, by number of bins{money.unit
			? ` (${money.unit})`
			: ''}
	</figcaption>
	<Legend
		label="Inputs"
		items={voi.order.map((j) => ({ key: j, label: inputs[j], colour: dataColour(j) }))}
	/>
	<div bind:clientWidth={width}>
		<svg
			viewBox="0 0 {W} {H}"
			width={W}
			height={H}
			role="img"
			aria-label="Savings from knowing each input against the number of bins. At {voi.bins[
				last
			]} bins: {summary}."
		>
			<Axis
				side="bottom"
				ticks={voi.bins}
				scale={sx}
				at={H - M.bottom}
				from={M.left}
				to={W - M.right}
				format={String}
				title="Bins"
			/>
			<Axis
				side="left"
				ticks={yTicks}
				scale={sy}
				at={M.left}
				from={M.top}
				to={H - M.bottom}
				format={formatTick}
				grid={[M.left, W - M.right]}
				title={money.unit ? `Savings (${money.unit})` : 'Savings'}
			/>
			{#each voi.order as j (j)}
				<path
					d={linePath(
						voi.bins.map((b) => sx(b)),
						scaled[j].map((v) => sy(v))
					)}
					fill="none"
					stroke={dataColour(j)}
					stroke-width="1.75"
					data-testid="voi-line"
				/>
				{#each voi.bins as b, k (b)}
					{#if Number.isFinite(scaled[j][k])}
						<circle cx={sx(b)} cy={sy(scaled[j][k])} r="2" fill={dataColour(j)}>
							<title>{inputs[j]}, {b} bins: {formatNumber(scaled[j][k])} {money.unit}</title>
						</circle>
					{/if}
				{/each}
			{/each}
		</svg>
	</div>
</figure>
