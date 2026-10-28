<script lang="ts">
	import { InfoTip } from '$lib/ui';
	import { Axis } from '$lib/ui';
	import {
		decades,
		formatLogTick,
		inputColour,
		linear,
		logDecadeBounds,
		logScale,
		placeLabels,
		type Money
	} from './format';

	/** One random input: what knowing it first saves, and how much of the profit's spread it explains. */
	export interface ScatterPoint {
		/** Model order, for the input colour. */
		j: number;
		/** The input's display name, shown next to its point. */
		name: string;
		/** Value of information at the largest bin count, native units. */
		saves: number;
		/** Share of the best decision's reward variance the input explains (Kelley's ε², 0–1). */
		share: number;
	}

	let {
		points,
		money,
		maximized = false
	}: {
		points: readonly ScatterPoint[];
		money: Money;
		/** In a full-window overlay: the chart fills the height given. */
		maximized?: boolean;
	} = $props();

	let width = $state(420);
	/** Height the overlay leaves for the chart (maximized only). */
	let room = $state(0);
	const W = $derived(Math.max(260, width));
	const MIN_H = 240;
	const H = $derived(maximized ? Math.max(MIN_H, room) : MIN_H);
	const M = { top: 10, right: 14, bottom: 40, left: 52 };
	/** About 6.5 px a character at 11 px. */
	const textWidth = (s: string) => s.length * 6.5;

	const scaled = $derived(points.map((p) => ({ ...p, x: money.scale(p.saves), y: p.share * 100 })));
	const max = (vs: number[]) => Math.max(0, ...vs.filter(Number.isFinite));
	/** Three decades under the next power of 10 above the largest value; a fallback with none. */
	const xb = $derived(logDecadeBounds(max(scaled.map((p) => p.x))) ?? [0.001, 1]);
	/** A share: linear, 0 to 100 %. */
	const yb: [number, number] = [0, 100];
	const sx = $derived(logScale(xb[0], xb[1], M.left, W - M.right));
	const sy = $derived(linear(yb[0], yb[1], H - M.bottom, M.top));

	/** Plotted points: values under the log floor (or not positive) sit on it, hollow. */
	const plotted = $derived(
		scaled.map((p) => {
			const floor = !(p.x >= xb[0]);
			return {
				...p,
				px: sx(floor ? xb[0] : p.x),
				py: sy(Math.min(100, Math.max(0, p.y))),
				floor,
				text: describe(p)
			};
		})
	);
	const labels = $derived(
		placeLabels(
			plotted.map((p) => ({ x: p.px, y: p.py, width: textWidth(p.name) })),
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
		return `${p.name}: knowing it first ${saves}; it explains ${percent(p.share)} of your profit's spread`;
	}

	/** The point in focus (hover or keyboard), shown in the readout under the chart. */
	let active = $state<number | null>(null);
</script>

<figure
	class="chart scatter"
	class:maximized
	data-testid="voi-scatter"
	data-x-bounds={xb.join(',')}
	data-y-bounds={yb.join(',')}
>
	<figcaption>
		Right: matters for the decision. Up: moves your profit.
		<span class="axes">
			<span
				>Across: value of knowing it first <InfoTip label="value of knowing it first"
					>How much better your decision gets, on average, if you learn this input before choosing.</InfoTip
				></span
			>
			<span
				>Up: share of profit spread <InfoTip label="share of profit spread"
					>How much of the ups and downs in your profit, under the recommended decision, come from
					this input alone. 100 % means it explains all of them.</InfoTip
				></span
			>
		</span>
	</figcaption>
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
			role="group"
			aria-label="Each input's value of knowing it first, on a log scale, against the share of profit spread it explains, 0 to 100 %."
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
				ticks={[0, 25, 50, 75, 100]}
				scale={sy}
				at={M.left}
				from={M.top}
				to={H - M.bottom}
				format={String}
				grid={[M.left, W - M.right]}
				title="Share of profit spread (%)"
			/>
			{#each plotted as p, i (p.j)}
				<g class="point" class:hot={active === i} style:--c={inputColour(p.j)}>
					<!-- svelte-ignore a11y_no_noninteractive_tabindex (focus shows the point's numbers) -->
					<circle
						cx={p.px}
						cy={p.py}
						r="5"
						class:floor={p.floor}
						tabindex="0"
						role="img"
						aria-label={p.text}
						data-testid="scatter-point"
						data-x={p.x}
						data-y={p.y}
						data-floor={p.floor || undefined}
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
						data-testid="scatter-label">{p.name}</text
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
	.axes {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--sp-3);
	}
	.readout {
		min-height: 2.6em;
		margin: var(--sp-1) 0 0;
		font-size: var(--text-xs);
		color: var(--text-muted);
	}
</style>
