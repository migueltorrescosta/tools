<script lang="ts" module>
	export interface RefLine {
		label: string;
		/** Label next to the line when `label` is too long for the margin. */
		short?: string;
		value: number;
		kind: 'mzi' | 'seminorm' | 'extension';
	}
</script>

<script lang="ts">
	import type { SeedTrace } from '$lib/ancilla-mzi/types';
	import { niceTicks, formatTick } from '$lib/plot';
	import { SegmentedControl } from '$lib/ui';

	let {
		traces,
		refs,
		bestSeeds,
		testId
	}: {
		traces: SeedTrace[];
		refs: RefLine[];
		/** Seed number of the best result per role, drawn thicker. */
		bestSeeds: { setup: number | null; companion: number | null };
		testId?: string;
	} = $props();

	const W = 520;
	const H = 300;
	const M = { top: 12, right: 92, bottom: 44, left: 56 };
	const innerW = W - M.left - M.right;
	const innerH = H - M.top - M.bottom;

	const shown = $derived(traces.filter((t) => t.points.length > 0));
	const hasCompanion = $derived(shown.some((t) => t.role === 'companion'));

	let scale = $state<'linear' | 'log'>('linear');
	const log = $derived(scale === 'log');

	const domain = $derived.by(() => {
		let x1 = 1;
		let y1 = 0;
		let yMin = Infinity;
		for (const t of shown)
			for (const p of t.points) {
				if (p.evaluations > x1) x1 = p.evaluations;
				if (p.qfi > y1) y1 = p.qfi;
				if (p.qfi > 0 && p.qfi < yMin) yMin = p.qfi;
			}
		// The MZI line always fits. On a linear axis bounds far above the traces
		// are noted, not drawn; on a log axis every bound fits.
		const mzi = refs.find((r) => r.kind === 'mzi')?.value ?? 0;
		y1 = Math.max(y1, mzi);
		if (mzi > 0) yMin = Math.min(yMin, mzi);
		for (const r of refs)
			if (Number.isFinite(r.value) && (log || r.value <= y1 * 1.5)) y1 = Math.max(y1, r.value);
		if (!log) return { x1, y0: 0, y1: y1 > 0 ? y1 * 1.08 : 1 };
		if (!(y1 > 0)) return { x1, y0: 0.1, y1: 1 };
		const lo = Math.max(Number.isFinite(yMin) ? yMin : y1, y1 * 1e-6);
		return {
			x1,
			y0: 10 ** Math.floor(Math.log10(lo)),
			y1: 10 ** Math.ceil(Math.log10(y1 * 1.08))
		};
	});
	const offScale = $derived(
		log ? [] : refs.filter((r) => Number.isFinite(r.value) && r.value > domain.y1)
	);

	const sx = (x: number) => M.left + (x / domain.x1) * innerW;
	/** Linear or log position; values at or below the log floor sit on the axis. */
	const sy = (y: number) => {
		const f = log
			? (Math.log10(Math.max(y, domain.y0)) - Math.log10(domain.y0)) /
				(Math.log10(domain.y1) - Math.log10(domain.y0))
			: (y - domain.y0) / (domain.y1 - domain.y0);
		return M.top + innerH - f * innerH;
	};
	const xTicks = $derived(niceTicks(0, domain.x1, 5));
	const yTicks = $derived.by(() => {
		if (!log) return niceTicks(0, domain.y1, 5);
		const lo = Math.round(Math.log10(domain.y0));
		const hi = Math.round(Math.log10(domain.y1));
		const every = Math.max(1, Math.ceil((hi - lo) / 6));
		const ticks: number[] = [];
		for (let e = lo; e <= hi; e += every) ticks.push(10 ** e);
		return ticks;
	});

	const path = (t: SeedTrace) =>
		t.points
			.map(
				(p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.evaluations).toFixed(1)},${sy(p.qfi).toFixed(1)}`
			)
			.join('');

	/** Reference labels nudged apart so close lines stay readable. */
	const refLabels = $derived.by(() => {
		const sorted = refs
			.filter((r) => Number.isFinite(r.value) && r.value <= domain.y1)
			.map((r) => ({ ...r, y: sy(r.value) }))
			.sort((a, b) => a.y - b.y);
		for (let i = 1; i < sorted.length; i++)
			if (sorted[i].y - sorted[i - 1].y < 12) sorted[i].y = sorted[i - 1].y + 12;
		return sorted;
	});

	// Hover: the best value each role has reached at the pointer's evaluation count
	let hoverX = $state<number | null>(null);
	function onMove(e: PointerEvent) {
		const svg = e.currentTarget as SVGSVGElement;
		const rect = svg.getBoundingClientRect();
		const x = ((e.clientX - rect.left) / rect.width) * W;
		hoverX = x >= M.left && x <= M.left + innerW ? x : null;
	}
	const hover = $derived.by(() => {
		if (hoverX === null) return null;
		const evals = ((hoverX - M.left) / innerW) * domain.x1;
		const bestAt = (role: 'setup' | 'companion') => {
			let best = -Infinity;
			for (const t of shown)
				if (t.role === role)
					for (const p of t.points) if (p.evaluations <= evals && p.qfi > best) best = p.qfi;
			return Number.isFinite(best) ? best : null;
		};
		return { x: hoverX, evals, setup: bestAt('setup'), companion: bestAt('companion') };
	});

	const fmt = (v: number) => String(Number(v.toPrecision(4)));
</script>

<figure class="plot" data-testid={testId}>
	<figcaption>
		<span class="title"
			><span>QFI/t² against optimiser evaluations</span>
			<SegmentedControl
				legend="Y axis"
				hideLegend
				options={[
					{ value: 'linear', label: 'Linear' },
					{ value: 'log', label: 'Log' }
				]}
				bind:value={scale}
			/></span
		>
		<span class="legend">
			<span
				><svg viewBox="0 0 18 8" aria-hidden="true"
					><line class="setup" x1="1" y1="4" x2="17" y2="4" /></svg
				>Setup seeds</span
			>
			{#if hasCompanion}
				<span
					><svg viewBox="0 0 18 8" aria-hidden="true"
						><line class="companion" x1="1" y1="4" x2="17" y2="4" /></svg
					>Companion (coupling off)</span
				>
			{/if}
			{#each refs as r (r.kind)}
				<span
					><svg viewBox="0 0 18 8" aria-hidden="true"
						><line class="ref {r.kind}" x1="1" y1="4" x2="17" y2="4" /></svg
					>{r.label}</span
				>
			{/each}
		</span>
	</figcaption>
	<svg
		viewBox="0 0 {W} {H}"
		role="img"
		aria-label="Convergence: {shown.length} seed traces{refs.length
			? `; reference lines: ${refs.map((r) => `${r.label} ${fmt(r.value)}`).join(', ')}`
			: ''}"
		onpointermove={onMove}
		onpointerleave={() => (hoverX = null)}
	>
		<g class="grid">
			{#each xTicks as t (t)}
				<line x1={sx(t)} x2={sx(t)} y1={M.top} y2={M.top + innerH} />
				<text x={sx(t)} y={M.top + innerH + 16} text-anchor="middle">{formatTick(t)}</text>
			{/each}
			{#each yTicks as t (t)}
				<line x1={M.left} x2={M.left + innerW} y1={sy(t)} y2={sy(t)} />
				<text x={M.left - 6} y={sy(t) + 4} text-anchor="end">{formatTick(t)}</text>
			{/each}
		</g>
		{#each refLabels as r (r.kind)}
			<line
				class="ref {r.kind}"
				x1={M.left}
				x2={M.left + innerW}
				y1={sy(r.value)}
				y2={sy(r.value)}
			/>
			<text class="ref-label" x={M.left + innerW + 6} y={r.y + 4}>{r.short ?? r.label}</text>
		{/each}
		{#each shown as t (`${t.role}-${t.seed}`)}
			<path
				class="trace {t.role}"
				class:best={bestSeeds[t.role] === t.seed}
				class:running={!t.done}
				d={path(t)}
			/>
		{/each}
		{#if hover}
			<line class="crosshair" x1={hover.x} x2={hover.x} y1={M.top} y2={M.top + innerH} />
		{/if}
		<text class="label" x={M.left + innerW / 2} y={H - 6} text-anchor="middle">Evaluations</text>
		<text
			class="label"
			x={14}
			y={M.top + innerH / 2}
			text-anchor="middle"
			transform="rotate(-90 14 {M.top + innerH / 2})">QFI/t²{log ? ' (log)' : ''}</text
		>
	</svg>
	<p class="readout" aria-live="off">
		{#if hover}
			At {Math.round(hover.evals)} evaluations, best setup {hover.setup === null
				? '—'
				: fmt(hover.setup)}{#if hasCompanion}, companion {hover.companion === null
					? '—'
					: fmt(hover.companion)}{/if}.
		{:else}
			Thick lines are each role's best seed. Hover to read values.
		{/if}
		{#each offScale as r (r.kind)}
			<span data-testid="off-scale-{r.kind}"> {r.label} {fmt(r.value)} lies above the plot.</span>
		{/each}
	</p>
</figure>

<style>
	.plot {
		margin: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: var(--sp-2);
		min-width: 0;
	}
	figcaption {
		display: flex;
		flex-direction: column;
		gap: var(--sp-1);
		font-size: var(--text-sm);
		font-weight: 500;
		margin-bottom: var(--sp-1);
	}
	.title {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-1) var(--sp-3);
	}
	.legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1) var(--sp-3);
		color: var(--text-muted);
		font-size: var(--text-xs);
		font-weight: 400;
	}
	.legend > span {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
	}
	.legend svg {
		width: 18px;
		height: 8px;
	}
	svg {
		width: 100%;
		height: auto;
		display: block;
		overflow: visible;
	}
	.grid line {
		stroke: var(--border);
	}
	.grid text,
	.label,
	.ref-label {
		fill: var(--text-muted);
		font-size: 11px;
		font-family: var(--font-mono);
	}
	.trace {
		fill: none;
		stroke-width: 1;
		stroke-opacity: 0.55;
	}
	.trace.best {
		stroke-width: 2.5;
		stroke-opacity: 1;
	}
	.setup {
		stroke: var(--data-1);
		stroke-width: 2;
	}
	.companion {
		stroke: var(--data-2);
		stroke-dasharray: 5 3;
		stroke-width: 2;
	}
	.trace.setup,
	.trace.companion {
		stroke-width: 1;
	}
	.trace.best.setup,
	.trace.best.companion {
		stroke-width: 2.5;
	}
	.ref {
		stroke-width: 1.5;
	}
	.ref.mzi {
		stroke: var(--data-4);
	}
	.ref.seminorm {
		stroke: var(--text-muted);
		stroke-dasharray: 6 4;
	}
	.ref.extension {
		stroke: var(--data-3);
		stroke-dasharray: 2 3;
	}
	.crosshair {
		stroke: var(--border-strong);
	}
	.readout {
		margin: var(--sp-1) 0 0;
		font-size: var(--text-xs);
		color: var(--text-muted);
	}
</style>
