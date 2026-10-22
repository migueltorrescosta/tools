<script lang="ts">
	import type { ValueOfInformation } from '$lib/information-pricing/analysis';
	import Axis from './Axis.svelte';
	import {
		dash,
		decades,
		formatLogTick,
		formatNumber,
		inputColour,
		linear,
		linePath,
		logScale,
		NOISE,
		spreadLabels,
		voiBounds,
		type Money
	} from './format';

	let {
		voi,
		inputs,
		money,
		evpi,
		maximized = false
	}: {
		voi: ValueOfInformation;
		/** Input labels, model order. */
		inputs: readonly string[];
		money: Money;
		/** Expected value of perfect information, native units: the ceiling. */
		evpi: number;
		/** In a full-window overlay: the chart fills the height given. */
		maximized?: boolean;
	} = $props();

	let width = $state(480);
	/** Height the overlay leaves for the chart (maximized only). */
	let room = $state(0);
	const W = $derived(Math.max(260, width));
	const MIN_H = 220;
	const H = $derived(maximized ? Math.max(MIN_H, room) : MIN_H);
	/** Longest end label (about 6.5 px a character, at most 40% of the width); longer names are cut. */
	const maxChars = $derived(Math.min(24, Math.floor((W * 0.4 - 12) / 6.5)));
	const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s);

	const ceiling = $derived(money.scale(evpi));
	const scaled = $derived(voi.savings.map((row) => Array.from(row, money.scale)));
	const bounds = $derived(voiBounds(ceiling, scaled.flat()));
	/** Savings that sit on the log axis; the rest (≤ 0, rounding noise, below the floor) are gaps. */
	const shown = $derived(
		scaled.map((row) =>
			row.map((v) =>
				bounds && Number.isFinite(v) && v > ceiling * NOISE && v >= bounds[0]
					? Math.min(v, bounds[1])
					: NaN
			)
		)
	);
	/** Full text for the legend, `end` (cut) for the label at the line's end. */
	const labels = $derived(
		voi.order.map((j) => {
			const tail = shown[j].some(Number.isFinite) ? '' : ' (no savings)';
			return { j, text: inputs[j] + tail, end: cut(inputs[j], maxChars - tail.length) + tail };
		})
	);
	/** Room on the right for the end labels, about 6.5 px a character. */
	const right = $derived(
		Math.min(W * 0.4, 12 + 6.5 * Math.max(0, ...labels.map((l) => l.end.length)))
	);
	const M = $derived({ top: 18, right, bottom: 34, left: 52 });
	const sx = $derived(linear(voi.bins[0], voi.bins.at(-1)!, M.left, W - M.right));
	const sy = $derived(
		bounds ? logScale(bounds[0], bounds[1], H - M.bottom, M.top) : () => H - M.bottom
	);
	const yTicks = $derived(bounds ? decades(bounds[0], bounds[1]) : []);
	const last = $derived(voi.bins.length - 1);
	const paths = $derived(
		shown.map((row) =>
			linePath(
				voi.bins.map((b) => sx(b)),
				row.map((v) => sy(v))
			)
		)
	);

	/** End labels at each line's last plotted point (the floor when none), nudged apart. */
	const ends = $derived.by(() => {
		const ys = voi.order.map((j) => {
			const k = shown[j].findLastIndex(Number.isFinite);
			return k < 0 ? H - M.bottom : sy(shown[j][k]);
		});
		const spread = spreadLabels(ys, 13, M.top, H - M.bottom);
		return new Map(voi.order.map((j, i) => [j, spread[i]]));
	});

	/** The input in focus (hover or focus on its line or legend key), or a pinned one. */
	let hot = $state<number | null>(null);
	let pinned = $state<number | null>(null);
	const active = $derived(hot ?? pinned);

	const summary = $derived(
		voi.order
			.slice(0, 3)
			.map((j) => `${inputs[j]} ${money.format(voi.savings[j][last])}`)
			.join(', ')
	);
</script>

<figure class="chart voi" class:maximized data-testid="voi-chart" data-bounds={bounds?.join(',')}>
	<figcaption>
		Savings by number of bins, log scale. Dotted line: the EVPI, the most any information can save.
	</figcaption>
	{#if !bounds}
		<p class="empty" data-testid="voi-empty">
			Perfect information is worth nothing here, so there's nothing to chart.
		</p>
	{:else}
		<ul class="legend" aria-label="Inputs">
			{#each labels as { j, text } (j)}
				<li>
					<button
						type="button"
						class:dim={active !== null && active !== j}
						aria-pressed={pinned === j}
						data-testid="voi-key"
						onmouseenter={() => (hot = j)}
						onmouseleave={() => (hot = null)}
						onfocus={() => (hot = j)}
						onblur={() => (hot = null)}
						onclick={() => (pinned = pinned === j ? null : j)}
						><svg viewBox="0 0 24 10" aria-hidden="true"
							><line
								x1="1"
								y1="5"
								x2="23"
								y2="5"
								stroke={inputColour(j)}
								stroke-dasharray={dash(j) || undefined}
							/></svg
						>{text}</button
					>
				</li>
			{/each}
		</ul>
		<div
			class="area"
			style:min-height={maximized ? `${MIN_H}px` : undefined}
			bind:clientWidth={width}
			bind:clientHeight={room}
		>
			<svg
				viewBox="0 0 {W} {H}"
				width={W}
				height={H}
				role="img"
				aria-label="Savings from knowing each input against the number of bins, log scale, below the expected value of perfect information of {money.format(
					evpi
				)}. At {voi.bins[last]} bins: {summary}."
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
					format={formatLogTick}
					grid={[M.left, W - M.right]}
					title={money.unit ? `Savings (${money.unit})` : 'Savings'}
				/>
				<g class="ceiling" data-testid="voi-ceiling">
					<line x1={M.left} x2={W - M.right} y1={sy(ceiling)} y2={sy(ceiling)} />
					<text x={M.left + 4} y={sy(ceiling) - 4}>EVPI {money.format(evpi)}</text>
				</g>
				{#each voi.order as j (j)}
					<g
						class="series"
						class:dim={active !== null && active !== j}
						class:hot={active === j}
						role="presentation"
						style:--c={inputColour(j)}
						onmouseenter={() => (hot = j)}
						onmouseleave={() => (hot = null)}
					>
						<path class="hit" d={paths[j]} />
						<path
							class="line"
							d={paths[j]}
							stroke-dasharray={dash(j) || undefined}
							data-testid="voi-line"
						/>
						{#each voi.bins as b, k (b)}
							{#if Number.isFinite(shown[j][k])}
								<circle
									cx={sx(b)}
									cy={sy(shown[j][k])}
									r="2"
									data-testid="voi-point"
									data-value={shown[j][k]}
								>
									<title>{inputs[j]}, {b} bins: {formatNumber(scaled[j][k])} {money.unit}</title>
								</circle>
							{/if}
						{/each}
						<text class="end" x={W - M.right + 6} y={ends.get(j)! + 4} data-testid="voi-label"
							>{labels.find((l) => l.j === j)!.end}</text
						>
					</g>
				{/each}
			</svg>
		</div>
	{/if}
</figure>

<style>
	/* Maximized: the plot fills the height left; absolutely placed, so its size never
	   feeds back into the room measured for it. */
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
	.empty {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-0) var(--sp-2);
		margin: 0 0 var(--sp-1);
		padding: 0;
		list-style: none;
	}
	.legend button {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		padding: 1px var(--sp-1);
		font: inherit;
		font-size: var(--text-xs);
		color: var(--text-muted);
		background: none;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		cursor: pointer;
	}
	.legend button:hover,
	.legend button[aria-pressed='true'] {
		border-color: var(--border-strong);
		color: var(--text);
	}
	.legend svg {
		width: 24px;
		height: 10px;
		flex: none;
	}
	.legend line {
		stroke-width: 2.5;
	}
	.dim {
		opacity: 0.3;
	}
	.ceiling line {
		stroke: var(--text);
		stroke-width: 1;
		stroke-dasharray: 3 3;
	}
	.ceiling text {
		fill: var(--text);
		font-size: 11px;
		font-weight: 600;
	}
	.series .line {
		fill: none;
		stroke: var(--c);
		stroke-width: 1.75;
	}
	.series .hit {
		fill: none;
		stroke: transparent;
		stroke-width: 10;
	}
	.series circle {
		fill: var(--c);
	}
	.series .end {
		fill: var(--text-muted);
		font-size: 11px;
	}
	.series.hot .line {
		stroke-width: 3;
	}
	.series.hot circle {
		r: 3px;
	}
	.series.hot .end {
		fill: var(--text);
	}
	.series.hot .end {
		font-weight: 600;
	}
</style>
