<script lang="ts">
	import Axis from './Axis.svelte';
	import {
		decades,
		formatLogTick,
		inputColour,
		logDecadeBounds,
		logScale,
		placeLabels,
		type Money
	} from './format';

	/** One random input: what knowing it first saves, and how far it moves the profit. */
	export interface ScatterPoint {
		/** Model order, for the input colour. */
		j: number;
		/** Short label on the chart, e.g. the symbol. */
		label: string;
		name: string;
		/** Value of information at the largest bin count, native units. */
		saves: number;
		/** Profit swing (one SD of the expected reward under the best decision), native units. */
		swing: number;
		/** Share of the reward's variance the input explains (Kelley's ε²). */
		share: number;
	}

	let { points, money }: { points: readonly ScatterPoint[]; money: Money } = $props();

	let width = $state(420);
	const W = $derived(Math.max(260, width));
	const H = 240;
	const M = { top: 10, right: 14, bottom: 40, left: 52 };
	/** About 6.5 px a character at 11 px. */
	const textWidth = (s: string) => s.length * 6.5;

	const scaled = $derived(
		points.map((p) => ({ ...p, x: money.scale(p.saves), y: money.scale(p.swing) }))
	);
	const max = (vs: number[]) => Math.max(0, ...vs.filter(Number.isFinite));
	/** Three decades under the next power of 10 above the largest value; a fallback with none. */
	const xb = $derived(logDecadeBounds(max(scaled.map((p) => p.x))) ?? [0.001, 1]);
	const yb = $derived(logDecadeBounds(max(scaled.map((p) => p.y))) ?? [0.001, 1]);
	const sx = $derived(logScale(xb[0], xb[1], M.left, W - M.right));
	const sy = $derived(logScale(yb[0], yb[1], H - M.bottom, M.top));

	/** Plotted points: values under the floor (or not positive) sit on it, hollow. */
	const plotted = $derived(
		scaled.map((p) => {
			const floorX = !(p.x >= xb[0]);
			const floorY = !(p.y >= yb[0]);
			return {
				...p,
				px: sx(floorX ? xb[0] : p.x),
				py: sy(floorY ? yb[0] : p.y),
				floorX,
				floorY,
				text: describe(p)
			};
		})
	);
	const labels = $derived(
		placeLabels(
			plotted.map((p) => ({ x: p.px, y: p.py, width: textWidth(p.label) })),
			{ x0: M.left, x1: W, y0: 0, y1: H - M.bottom }
		)
	);

	function percent(share: number): string {
		const v = share * 100;
		if (!(v > 0)) return '0 %';
		return v < 1 ? `${Number(v.toPrecision(1))} %` : `${Math.round(v)} %`;
	}

	function describe(p: ScatterPoint): string {
		const saves = p.saves > 0 ? `saves ${money.format(p.saves)}` : 'saves nothing';
		return `${p.name}: knowing it first ${saves}; profit swings ±${money.format(p.swing)} (${percent(p.share)} of its spread)`;
	}

	/** The point in focus (hover or keyboard), shown in the readout under the chart. */
	let active = $state<number | null>(null);
</script>

<figure
	class="chart scatter"
	data-testid="voi-scatter"
	data-x-bounds={xb.join(',')}
	data-y-bounds={yb.join(',')}
>
	<figcaption>Right: matters for the decision. Up: moves your profit.</figcaption>
	<div bind:clientWidth={width}>
		<svg
			viewBox="0 0 {W} {H}"
			width={W}
			height={H}
			role="group"
			aria-label="Each input's value of knowing it first against its profit swing, both on log scales."
		>
			<Axis
				side="bottom"
				ticks={decades(xb[0], xb[1])}
				scale={sx}
				at={H - M.bottom}
				from={M.left}
				to={W - M.right}
				format={formatLogTick}
				grid={[M.top, H - M.bottom]}
				title={money.unit
					? `Value of knowing it first (${money.unit})`
					: 'Value of knowing it first'}
			/>
			<Axis
				side="left"
				ticks={decades(yb[0], yb[1])}
				scale={sy}
				at={M.left}
				from={M.top}
				to={H - M.bottom}
				format={formatLogTick}
				grid={[M.left, W - M.right]}
				title={money.unit ? `Profit swing (${money.unit}, ±1 SD)` : 'Profit swing (±1 SD)'}
			/>
			{#each plotted as p, i (p.j)}
				<g class="point" class:hot={active === i} style:--c={inputColour(p.j)}>
					<!-- svelte-ignore a11y_no_noninteractive_tabindex (focus shows the point's numbers) -->
					<circle
						cx={p.px}
						cy={p.py}
						r="5"
						class:floor={p.floorX || p.floorY}
						tabindex="0"
						role="img"
						aria-label={p.text}
						data-testid="scatter-point"
						data-x={p.x}
						data-y={p.y}
						data-px={p.px}
						data-py={p.py}
						data-floor={p.floorX || p.floorY || undefined}
						onmouseenter={() => (active = i)}
						onmouseleave={() => (active = null)}
						onfocus={() => (active = i)}
						onblur={() => (active = null)}><title>{p.text}</title></circle
					>
					<text
						x={labels[i].x}
						y={labels[i].y}
						text-anchor={labels[i].anchor}
						aria-hidden="true"
						data-testid="scatter-label">{p.label}</text
					>
				</g>
			{/each}
		</svg>
	</div>
	<p class="readout" aria-live="polite" data-testid="scatter-readout">
		{active !== null ? plotted[active].text : 'Hover or tab to a point for its numbers.'}
	</p>
</figure>

<style>
	.point circle {
		fill: var(--c);
		stroke: var(--c);
		stroke-width: 1.5;
		cursor: default;
	}
	/* Under the floor: hollow, on the floor. */
	.point circle.floor {
		fill: var(--surface);
		stroke-width: 2;
	}
	.point circle:focus-visible {
		outline: none;
		stroke: var(--text);
		stroke-width: 2.5;
	}
	.point.hot circle {
		r: 6.5px;
	}
	.point text {
		fill: var(--text);
		font-size: 11px;
		font-weight: 600;
		pointer-events: none;
	}
	.readout {
		min-height: 2.6em;
		margin: var(--sp-1) 0 0;
		font-size: var(--text-xs);
		color: var(--text-muted);
	}
</style>
