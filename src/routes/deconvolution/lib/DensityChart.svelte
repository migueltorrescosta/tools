<script lang="ts" module>
	export interface Curve {
		key: string;
		label: string;
		colour: string;
		xs: ArrayLike<number>;
		/** Density values at `xs`. */
		ys: ArrayLike<number>;
		dashed?: boolean;
	}
	export interface Stems {
		key: string;
		label: string;
		colour: string;
		x: ArrayLike<number>;
		/** Probability of each point mass (right-hand axis). */
		p: ArrayLike<number>;
	}
	export interface Band {
		key: string;
		label: string;
		colour: string;
		xs: ArrayLike<number>;
		lower: ArrayLike<number>;
		upper: ArrayLike<number>;
	}
</script>

<script lang="ts">
	import { Axis, Legend } from '$lib/ui';
	import { formatTick, linear, linePath, niceTicks } from '$lib/plot';

	let {
		title,
		histogram,
		histogramLabel = 'Sample of Z',
		curves = [],
		stems = [],
		bands = [],
		xRange,
		xLabel = 'Value',
		testId,
		summary
	}: {
		title: string;
		histogram?: { edges: ArrayLike<number>; density: ArrayLike<number> };
		histogramLabel?: string;
		curves?: readonly Curve[];
		stems?: readonly Stems[];
		bands?: readonly Band[];
		xRange: [number, number];
		xLabel?: string;
		testId?: string;
		/** Text alternative read by screen readers. */
		summary: string;
	} = $props();

	let width = $state(560);
	const W = $derived(Math.max(280, width));
	const H = $derived(Math.round(Math.min(360, Math.max(220, W * 0.5))));
	const M = $derived({ top: 10, right: stems.length ? 52 : 16, bottom: 44, left: 56 });

	const [x0, x1] = $derived(xRange);
	const inX = (x: number) => x >= x0 && x <= x1;

	const yMax = $derived.by(() => {
		let hi = 0;
		if (histogram)
			for (let i = 0; i < histogram.density.length; i++) hi = Math.max(hi, histogram.density[i]);
		for (const c of curves)
			for (let i = 0; i < c.xs.length; i++) if (inX(c.xs[i])) hi = Math.max(hi, c.ys[i]);
		for (const b of bands)
			for (let i = 0; i < b.xs.length; i++) if (inX(b.xs[i])) hi = Math.max(hi, b.upper[i]);
		return hi > 0 ? hi * 1.08 : 1;
	});
	const pMax = $derived.by(() => {
		let hi = 0;
		for (const s of stems)
			for (let i = 0; i < s.p.length; i++) if (inX(s.x[i])) hi = Math.max(hi, s.p[i]);
		return hi > 0 ? hi * 1.08 : 1;
	});

	const sx = $derived(linear(x0, x1, M.left, W - M.right));
	const sy = $derived(linear(0, yMax, H - M.bottom, M.top));
	const sp = $derived(linear(0, pMax, H - M.bottom, M.top));
	const xTicks = $derived(niceTicks(x0, x1, Math.max(3, Math.floor(W / 90))));
	const yTicks = $derived(niceTicks(0, yMax, 4));
	const pTicks = $derived(niceTicks(0, pMax, 4));

	function clipped(xs: ArrayLike<number>, ys: ArrayLike<number>, scale: (v: number) => number) {
		const px: number[] = [];
		const py: number[] = [];
		for (let i = 0; i < xs.length; i++) {
			if (!inX(xs[i])) continue;
			px.push(sx(xs[i]));
			py.push(scale(Math.min(ys[i], yMax)));
		}
		return linePath(px, py);
	}

	function area(b: Band): string {
		const top: string[] = [];
		const bottom: string[] = [];
		for (let i = 0; i < b.xs.length; i++) {
			if (!inX(b.xs[i])) continue;
			top.push(`${sx(b.xs[i]).toFixed(1)},${sy(Math.min(b.upper[i], yMax)).toFixed(1)}`);
			bottom.unshift(`${sx(b.xs[i]).toFixed(1)},${sy(b.lower[i]).toFixed(1)}`);
		}
		return top.length ? `M${top.join('L')}L${bottom.join('L')}Z` : '';
	}

	const bars = $derived.by(() => {
		if (!histogram) return [];
		const out: { x: number; w: number; y: number; h: number }[] = [];
		for (let i = 0; i < histogram.density.length; i++) {
			const a = Math.max(histogram.edges[i], x0);
			const b = Math.min(histogram.edges[i + 1], x1);
			if (!(b > a)) continue;
			const y = sy(histogram.density[i]);
			out.push({ x: sx(a), w: Math.max(0.5, sx(b) - sx(a)), y, h: H - M.bottom - y });
		}
		return out;
	});

	const legend = $derived([
		...(histogram ? [{ key: 'hist', label: histogramLabel, colour: 'var(--border-strong)' }] : []),
		...bands.map((b) => ({ key: `band-${b.key}`, label: b.label, colour: b.colour, dashed: true })),
		...curves.map((c) => ({ key: c.key, label: c.label, colour: c.colour, dashed: c.dashed })),
		...stems.map((s) => ({ key: s.key, label: `${s.label} (point masses)`, colour: s.colour }))
	]);
</script>

<figure class="chart" bind:clientWidth={width} data-testid={testId}>
	<figcaption>{title}</figcaption>
	<svg viewBox="0 0 {W} {H}" width={W} height={H} role="img" aria-label={summary}>
		<Axis
			side="bottom"
			ticks={xTicks}
			scale={sx}
			at={H - M.bottom}
			from={M.left}
			to={W - M.right}
			format={formatTick}
			title={xLabel}
		/>
		<Axis
			side="left"
			ticks={yTicks}
			scale={sy}
			at={M.left}
			from={M.top}
			to={H - M.bottom}
			format={formatTick}
			title="Density"
			grid={[M.left, W - M.right]}
		/>
		{#if stems.length}
			<g class="right">
				{#each pTicks as t (t)}
					<text x={W - M.right + 7} y={sp(t) + 4}>{formatTick(t)}</text>
				{/each}
				<line class="base" x1={W - M.right} x2={W - M.right} y1={M.top} y2={H - M.bottom} />
				<text
					class="title"
					x={W - 8}
					y={(M.top + H - M.bottom) / 2}
					text-anchor="middle"
					transform="rotate(90 {W - 8} {(M.top + H - M.bottom) / 2})">Probability</text
				>
			</g>
		{/if}
		{#each bars as b, i (i)}
			<rect class="bar" x={b.x} y={b.y} width={b.w} height={b.h} />
		{/each}
		{#each bands as b (b.key)}
			<path class="band" d={area(b)} fill={b.colour} />
		{/each}
		{#each curves as c (c.key)}
			<path
				class="curve"
				d={clipped(c.xs, c.ys, sy)}
				stroke={c.colour}
				stroke-dasharray={c.dashed ? '5 4' : undefined}
				data-testid="curve-{c.key}"
			/>
		{/each}
		{#each stems as s (s.key)}
			<g data-testid="stems-{s.key}">
				{#each Array.from(s.x) as x, i (i)}
					{#if inX(x) && s.p[i] > pMax * 2e-3}
						<line
							x1={sx(x)}
							x2={sx(x)}
							y1={H - M.bottom}
							y2={sp(s.p[i])}
							stroke={s.colour}
							class="stem"
						/>
						<circle cx={sx(x)} cy={sp(s.p[i])} r="2.5" fill={s.colour} />
					{/if}
				{/each}
			</g>
		{/each}
	</svg>
	<Legend items={legend} label="{title}: legend" />
</figure>

<style>
	.chart {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
		min-width: 0;
	}
	figcaption {
		font-size: var(--text-sm);
		color: var(--text-muted);
	}
	svg {
		display: block;
		max-width: 100%;
		height: auto;
	}
	.bar {
		fill: var(--surface-2);
		stroke: var(--border-strong);
		stroke-width: 0.5;
	}
	.band {
		opacity: 0.22;
	}
	.curve {
		fill: none;
		stroke-width: 2;
	}
	.stem {
		stroke-width: 1.5;
	}
	.right text {
		fill: var(--text-muted);
		font-size: 11px;
		font-family: var(--font-mono);
	}
	.right .title {
		font-family: var(--font-sans);
		font-size: 12px;
	}
	.right .base {
		stroke: var(--border-strong);
	}
</style>
