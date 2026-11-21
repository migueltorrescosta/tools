<script lang="ts">
	import type { Association } from '#lib/implicit-association/history.js';
	import { band } from '#lib/implicit-association/score.js';

	/**
	 * One section per attribute pair, with every comparison that used it as a dumbbell between
	 * its two groups. Each group sits D/2 towards the attribute it goes with, so the length is
	 * D. Colour depth shows the strength band; opacity shows confidence (marks only, so names
	 * keep their contrast).
	 */
	let { items }: { items: readonly Association[] } = $props();

	let width = $state(600);
	const ROW = 50;
	const SIDE = 56;
	const sections = $derived.by(() => {
		const m = new Map<string, Association[]>();
		for (const a of items) {
			const k = JSON.stringify(a.labels.attributes);
			m.set(k, [...(m.get(k) ?? []), a]);
		}
		return [...m.values()].map((list) =>
			[...list].sort((a, b) => Math.abs(b.mean) - Math.abs(a.mean))
		);
	});
	const mid = $derived(width / 2);
	const half = $derived((width - 2 * SIDE) / 2);
	/** Higher means nearer the first attribute (left). */
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
</script>

<div class="dumbbell" bind:clientWidth={width}>
	{#each sections as list (JSON.stringify(list[0].labels.attributes))}
		{@const attr = list[0].labels.attributes}
		<svg
			class="section"
			height={list.length * ROW + 24}
			role="img"
			aria-label="Groups between {attr[0]} and {attr[1]}"
			data-testid="section"
		>
			<text class="end" x="0" y="14">{attr[0]}</text>
			<text class="end" x={width} y="14" text-anchor="end">{attr[1]}</text>
			<line class="axis" x1={SIDE} x2={width - SIDE} y1="10" y2="10" />
			<line class="centre" x1={mid} x2={mid} y1="4" y2={list.length * ROW + 20} />
			{#each list as a, i (JSON.stringify(a.labels.targets))}
				{@const y = i * ROW + 42}
				{@const p0 = x(a.mean / 2)}
				{@const p1 = x(-a.mean / 2)}
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
						text-anchor={p0 < p1 ? 'end' : 'start'}>{a.labels.targets[0]}</text
					>
					<text
						class="name"
						x={p1 + (p1 <= p0 ? -10 : 10)}
						y={y + 4}
						text-anchor={p1 <= p0 ? 'end' : 'start'}>{a.labels.targets[1]}</text
					>
					<text class="value" x={(p0 + p1) / 2} y={y + 19} text-anchor="middle"
						>{Math.abs(a.mean).toFixed(2)} · {runs(a.n)}</text
					>
				</g>
			{/each}
		</svg>
	{/each}
	<ul class="key" aria-label="Key">
		<li>
			<span class="sw s1"></span><span class="sw s2"></span><span class="sw s3"></span>
			Slight, moderate, strong
		</li>
		<li>
			<span class="sw s3 c0"></span><span class="sw s3 c1"></span><span class="sw s3"></span>
			Fewer than 3 runs, direction unclear, direction clear
		</li>
	</ul>
</div>

<style>
	.dumbbell {
		width: 100%;
		display: grid;
		gap: var(--sp-3);
	}
	/* The SVG fills the column; the measured width only places the marks, so measuring
	   never resizes what is measured. */
	.section {
		display: block;
		width: 100%;
		overflow: visible;
	}
	.end {
		fill: var(--text);
		font-size: var(--text-sm);
		font-weight: 600;
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
	/* Strength: from grey (no clear association) to full blue (strong), visible in both themes. */
	.s0 {
		--c: color-mix(in oklab, var(--data-1) 15%, var(--text-muted));
	}
	.s1 {
		--c: color-mix(in oklab, var(--data-1) 45%, var(--text-muted));
	}
	.s2 {
		--c: color-mix(in oklab, var(--data-1) 75%, var(--text-muted));
	}
	.s3 {
		--c: var(--data-1);
	}
	/* Confidence: fainter marks until three runs agree on a direction. */
	.c0 {
		opacity: 0.4;
	}
	.c1 {
		opacity: 0.65;
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
	.key {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-1) var(--sp-4);
		padding: 0;
		list-style: none;
		color: var(--text-muted);
		font-size: var(--text-sm);
	}
	.key li {
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}
	.sw {
		display: inline-block;
		width: 14px;
		height: 10px;
		border-radius: 2px;
		background: var(--c);
	}
</style>
