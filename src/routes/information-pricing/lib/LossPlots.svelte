<script lang="ts">
	import type { LossDistribution } from '$lib/information-pricing/analysis';
	import { formatTick, niceTicks } from '$lib/plot';
	import Axis from './Axis.svelte';
	import { dataColour, linear, type Money } from './format';

	let {
		distributions,
		decisions,
		money,
		part,
		maximized = false
	}: {
		distributions: readonly LossDistribution[];
		/** Decision labels, model order. */
		decisions: readonly string[];
		money: Money;
		/** Box plots or histograms, one decision a row, on the same x range. */
		part: 'box' | 'hist';
		/** In a full-window overlay: the rows grow to fill the height given. */
		maximized?: boolean;
	} = $props();

	let width = $state(560);
	/** Height the overlay leaves for the plot (maximized only). */
	let room = $state(0);
	const W = $derived(Math.max(280, width));
	const longest = $derived(Math.max(...decisions.map((d) => d.length), 4));
	const M = $derived({ left: Math.min(120, 14 + longest * 7), right: 64 });
	const AXIS = 40;
	const n = $derived(Math.max(1, distributions.length));
	/** Row heights: fixed inline, grown to fill when maximized. */
	const ROW = $derived(maximized ? Math.max(22, (room - 8 - AXIS) / n) : 22);
	const HIST = $derived(maximized ? Math.max(30, (room - AXIS) / n - 4) : 30);
	/** Box, whisker and EOL marks thicken with the row, up to 2.5×. */
	const k = $derived(Math.min(2.5, ROW / 22));
	const boxH = $derived(distributions.length * ROW + 8 + AXIS);
	const histH = $derived(distributions.length * (HIST + 4) + AXIS);
	/** The inline height, the least the overlay gives. */
	const minH = $derived(part === 'box' ? n * 22 + 8 + AXIS : n * 34 + AXIS);

	/** Shared x range: zero to the widest whisker or expected loss, in display units. */
	const xMax = $derived.by(() => {
		let hi = 0;
		for (const d of distributions)
			hi = Math.max(hi, money.scale(d.box.whiskerHigh), money.scale(d.expectedLoss));
		return hi > 0 ? hi * 1.05 : 1;
	});
	const sx = $derived(linear(0, xMax, M.left, W - M.right));
	const ticks = $derived(niceTicks(0, xMax, Math.max(3, Math.floor(W / 110))));
	const unitTitle = $derived(money.unit ? `Opportunity loss (${money.unit})` : 'Opportunity loss');
	const x = (v: number) => sx(money.scale(v));

	/** Histogram as a step outline, clipped to the shared x range. */
	function steps(d: LossDistribution, top: number): string {
		const { edges, counts } = d.histogram;
		let peak = 0;
		for (let i = 0; i < counts.length; i++)
			if (money.scale(edges[i]) <= xMax) peak = Math.max(peak, counts[i]);
		if (!(peak > 0)) return '';
		const sy = linear(0, peak, top + HIST, top);
		const base = (top + HIST).toFixed(1);
		let path = `M${x(edges[0]).toFixed(1)},${base}`;
		for (let i = 0; i < counts.length; i++) {
			const a = Math.min(x(edges[i]), sx(xMax));
			const b = Math.min(x(edges[i + 1]), sx(xMax));
			const y = sy(Math.min(counts[i], peak)).toFixed(1);
			path += `L${a.toFixed(1)},${y}L${b.toFixed(1)},${y}`;
			if (money.scale(edges[i + 1]) > xMax) break;
		}
		const end = Math.min(x(edges[edges.length - 1]), sx(xMax));
		return `${path}L${end.toFixed(1)},${base}Z`;
	}
</script>

{#if part === 'box'}
	<figure class="chart" class:maximized bind:clientWidth={width}>
		<figcaption>Box 25–75%, whiskers 5–95%, dashed line and number: expected loss</figcaption>
		<div
			class="area"
			style:min-height={maximized ? `${minH}px` : undefined}
			bind:clientHeight={room}
		>
			<svg
				viewBox="0 0 {W} {boxH}"
				width={W}
				height={boxH}
				role="img"
				aria-label="Box plots of the opportunity loss per decision. {distributions
					.map(
						(d) =>
							`${decisions[d.decision]}: median ${money.format(d.box.median)}, EOL ${money.format(d.expectedLoss)}`
					)
					.join('; ')}."
			>
				<Axis
					side="bottom"
					{ticks}
					scale={sx}
					at={boxH - AXIS}
					from={M.left}
					to={W - M.right}
					format={formatTick}
					grid={[4, boxH - AXIS]}
					title={unitTitle}
				/>
				{#each distributions as d, i (d.decision)}
					{@const y = 6 + i * ROW + ROW / 2}
					{@const c = dataColour(d.decision)}
					<text class="name" x={M.left - 8} y={y + 4} text-anchor="end"
						>{decisions[d.decision]}</text
					>
					<line x1={x(d.box.whiskerLow)} x2={x(d.box.whiskerHigh)} y1={y} y2={y} stroke={c} />
					<line
						x1={x(d.box.whiskerLow)}
						x2={x(d.box.whiskerLow)}
						y1={y - 5 * k}
						y2={y + 5 * k}
						stroke={c}
					/>
					<line
						x1={x(d.box.whiskerHigh)}
						x2={x(d.box.whiskerHigh)}
						y1={y - 5 * k}
						y2={y + 5 * k}
						stroke={c}
					/>
					<rect
						class="box"
						x={x(d.box.q1)}
						y={y - 7 * k}
						width={Math.max(1, x(d.box.q3) - x(d.box.q1))}
						height={14 * k}
						stroke={c}
						fill={c}
					/>
					<line
						class="median"
						x1={x(d.box.median)}
						x2={x(d.box.median)}
						y1={y - 7 * k}
						y2={y + 7 * k}
						stroke={c}
					/>
					<line
						class="eol"
						x1={x(d.expectedLoss)}
						x2={x(d.expectedLoss)}
						y1={y - 10 * k}
						y2={y + 10 * k}
					/>
					<text class="eol-label" x={W - M.right + 6} y={y + 4}>{money.format(d.expectedLoss)}</text
					>
				{/each}
			</svg>
		</div>
	</figure>
{:else}
	<figure class="chart" class:maximized bind:clientWidth={width}>
		<figcaption>Dashed line: expected loss</figcaption>
		<div
			class="area"
			style:min-height={maximized ? `${minH}px` : undefined}
			bind:clientHeight={room}
		>
			<svg
				viewBox="0 0 {W} {histH}"
				width={W}
				height={histH}
				role="img"
				aria-label="Histogram of the opportunity loss for each decision, with its expected loss as a dashed line."
			>
				<Axis
					side="bottom"
					{ticks}
					scale={sx}
					at={histH - AXIS}
					from={M.left}
					to={W - M.right}
					format={formatTick}
					grid={[2, histH - AXIS]}
					title={unitTitle}
				/>
				{#each distributions as d, i (d.decision)}
					{@const top = 4 + i * (HIST + 4)}
					{@const c = dataColour(d.decision)}
					<text class="name" x={M.left - 8} y={top + HIST / 2 + 4} text-anchor="end"
						>{decisions[d.decision]}</text
					>
					<line class="row-base" x1={M.left} x2={W - M.right} y1={top + HIST} y2={top + HIST} />
					<path class="hist" d={steps(d, top)} fill={c} stroke={c} />
					<line
						class="eol"
						x1={x(d.expectedLoss)}
						x2={x(d.expectedLoss)}
						y1={top}
						y2={top + HIST}
					/>
				{/each}
			</svg>
		</div>
	</figure>
{/if}

<style>
	/* Maximized: the plot fills the height left under the caption; absolutely placed, so
	   its size never feeds back into the room measured for it. */
	.maximized {
		display: flex;
		flex-direction: column;
	}
	.maximized .area {
		position: relative;
		flex: 1 1 0;
	}
	.maximized .area svg {
		position: absolute;
		inset: 0;
	}
	.name {
		fill: var(--text);
		font-size: 12px;
	}
	.box {
		fill-opacity: 0.25;
		stroke-width: 1.5;
	}
	.median {
		stroke-width: 2.5;
	}
	.eol {
		stroke: var(--text);
		stroke-width: 1.5;
		stroke-dasharray: 4 3;
	}
	.eol-label {
		fill: var(--text);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
	}
	.hist {
		fill-opacity: 0.3;
		stroke-width: 1.2;
	}
	.row-base {
		stroke: var(--border);
	}
</style>
