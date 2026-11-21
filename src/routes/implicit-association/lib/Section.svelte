<script lang="ts">
	import type { Association, Section } from '#lib/implicit-association/history.js';
	import { band } from '#lib/implicit-association/score.js';

	/**
	 * One axis, its ends named, with a dumbbell per comparison. Each dumbbell's first name sits
	 * lean / 2 towards the first end, so its length is the mean D. Colour depth shows the
	 * strength band; opacity shows confidence (marks only, so names keep their contrast).
	 */
	let { section }: { section: Section } = $props();

	let width = $state(320);
	const ROW = 50;
	const SIDE = 8;
	const mid = $derived(width / 2);
	const half = $derived(width / 2 - SIDE);
	/** Positive means towards the first end (left). */
	const x = $derived((p: number) => mid - Math.max(-1, Math.min(1, p)) * half);

	/** 0: fewer than 3 runs; 1: the 95% interval still includes 0; 2: the direction is clear. */
	const confidence = (a: Association) => (!a.ci ? 0 : a.ci[0] > 0 || a.ci[1] < 0 ? 2 : 1);
	const CONFIDENCE = ['fewer than 3 runs', 'direction not yet clear', 'direction clear'];
	const STRENGTH = { none: 0, slight: 1, moderate: 2, strong: 3 } as const;
	const runs = (n: number) => `${n} run${n === 1 ? '' : 's'}`;
	const sentence = (a: Association) => {
		const [t, at] = [a.labels.targets, a.labels.attributes];
		const b = band(a.mean);
		const head =
			b === 'none'
				? `${t[0]} and ${t[1]}: no clear association with ${at[0]}`
				: `${a.mean >= 0 ? t[0] : t[1]} goes with ${at[0]} (${b})`;
		const ci = a.ci ? `, 95% interval ${a.ci[0].toFixed(2)} to ${a.ci[1].toFixed(2)}` : '';
		return `${head}: D ${Math.abs(a.mean).toFixed(2)} over ${runs(a.n)}, ${CONFIDENCE[confidence(a)]}${ci}`;
	};
	const [end0, end1] = $derived(section.ends);
</script>

<div class="section" bind:clientWidth={width}>
	<div class="ends"><span>{end0}</span><span>{end1}</span></div>
	<svg
		height={section.dumbbells.length * ROW + 8}
		role="img"
		aria-label="Between {end0} and {end1}"
		data-testid="section"
	>
		<line class="axis" x1={SIDE} x2={width - SIDE} y1="2" y2="2" />
		<line class="centre" x1={mid} x2={mid} y1="0" y2={section.dumbbells.length * ROW + 4} />
		{#each section.dumbbells as d, i (JSON.stringify(d.names))}
			{@const a = d.association}
			{@const y = i * ROW + 28}
			{@const p0 = x(d.lean / 2)}
			{@const p1 = x(-d.lean / 2)}
			{@const c = confidence(a)}
			<g data-testid="dumbbell" data-confidence={c} data-strength={band(a.mean)}>
				<title>{sentence(a)}</title>
				<g class="marks s{STRENGTH[band(a.mean)]} c{c}">
					<line class="link" x1={p0} x2={p1} y1={y} y2={y} />
					<circle class="dot" cx={p0} cy={y} r="6" />
					<circle class="dot" cx={p1} cy={y} r="6" />
				</g>
				<text
					class="name"
					x={p0 + (p0 < p1 ? -10 : 10)}
					y={y + 4}
					text-anchor={p0 < p1 ? 'end' : 'start'}>{d.names[0]}</text
				>
				<text
					class="name"
					x={p1 + (p1 <= p0 ? -10 : 10)}
					y={y + 4}
					text-anchor={p1 <= p0 ? 'end' : 'start'}>{d.names[1]}</text
				>
				<text class="value" x={(p0 + p1) / 2} y={y + 19} text-anchor="middle"
					>{Math.abs(a.mean).toFixed(2)} · {runs(a.n)}</text
				>
			</g>
		{/each}
	</svg>
</div>

<style>
	.section {
		min-width: 0;
	}
	.ends {
		display: flex;
		justify-content: space-between;
		font-size: var(--text-sm);
		font-weight: 600;
		margin-bottom: var(--sp-1);
	}
	/* The SVG fills the column; the measured width only places the marks, so measuring never
	   resizes what is measured. */
	svg {
		display: block;
		width: 100%;
		overflow: visible;
	}
	.name {
		fill: var(--text);
		font-size: var(--text-xs);
	}
	.value {
		fill: var(--text-muted);
		font-size: var(--text-xs);
		font-variant-numeric: tabular-nums;
	}
	.axis {
		stroke: var(--border-strong);
	}
	.centre {
		stroke: var(--border);
		stroke-dasharray: 2 3;
	}
	/* Strength: fades towards the background for weaker associations (lighter in light mode,
	   dimmer in dark mode), full blue when strong. */
	.s0 {
		--c: color-mix(in oklab, var(--data-1) 40%, var(--surface-2));
	}
	.s1 {
		--c: color-mix(in oklab, var(--data-1) 58%, var(--surface-2));
	}
	.s2 {
		--c: color-mix(in oklab, var(--data-1) 75%, var(--surface-2));
	}
	.s3 {
		--c: var(--data-1);
	}
	/* Confidence: fainter marks until three runs agree on a direction. */
	.c0 {
		opacity: 0.55;
	}
	.c1 {
		opacity: 0.75;
	}
	.link {
		stroke: var(--c);
		stroke-width: 4;
		stroke-linecap: round;
	}
	.dot {
		fill: var(--c);
		stroke: var(--surface);
		stroke-width: 2;
	}
</style>
