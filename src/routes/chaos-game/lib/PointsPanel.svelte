<!--
	The points: a regular-polygon builder, and a table to type coordinates (the
	keyboard route besides the plot's handles), with per-point weight, jump
	ratio, rotation and matrix folded away.
-->
<script lang="ts">
	import { MAX_POINTS, polygon } from '#lib/chaos-game/engine.ts';
	import type { GamePoint, Matrix } from '#lib/chaos-game/types.ts';
	import { Button, Field, Panel, ScrollEdges } from '#lib/ui/index.ts';

	let {
		points = $bindable(),
		selected = $bindable(null),
		ratio
	}: {
		points: GamePoint[];
		selected?: number | null;
		/** The game's jump ratio, shown as the placeholder of points without their own. */
		ratio: number;
	} = $props();

	let sides = $state(3);
	let midpoints = $state(false);
	let centre = $state(false);
	const sidesValid = $derived(Number.isInteger(sides) && sides >= 3 && sides <= 12);

	const hasOptions = (p: GamePoint) =>
		p.weight !== undefined ||
		p.ratio !== undefined ||
		p.rotation !== undefined ||
		p.matrix !== undefined;
	let showOptions = $state(false);
	// Open the fold when a preset or link brings per-point options
	$effect(() => {
		if (points.some(hasOptions)) showOptions = true;
	});

	function usePolygon() {
		if (!sidesValid) return;
		points = polygon(sides, midpoints, centre);
		selected = null;
	}

	function update(i: number, patch: Partial<GamePoint>) {
		const next = { ...points[i], ...patch };
		for (const key of Object.keys(patch) as (keyof GamePoint)[])
			if (next[key] === undefined) delete next[key];
		points = points.map((p, j) => (j === i ? next : p));
	}

	/** A number from an input, or undefined when blank or not a number. */
	function read(e: Event): number | undefined {
		const v = (e.currentTarget as HTMLInputElement).value.trim();
		if (v === '') return undefined;
		const n = Number(v);
		return Number.isFinite(n) ? n : undefined;
	}

	function setCoord(i: number, key: 'x' | 'y', e: Event) {
		const v = read(e);
		if (v !== undefined) update(i, { [key]: v });
		else (e.currentTarget as HTMLInputElement).value = String(points[i][key]);
	}

	function setMatrix(i: number, j: number, e: Event) {
		const v = read(e);
		const p = points[i];
		if (v === undefined) {
			update(i, { matrix: undefined });
			return;
		}
		const base: Matrix = p.matrix ?? [1 - (p.ratio ?? ratio), 0, 0, 1 - (p.ratio ?? ratio)];
		const m = [...base] as Matrix;
		m[j] = v;
		update(i, { matrix: m });
	}

	function add() {
		const n = points.length;
		const x = n ? points.reduce((s, p) => s + p.x, 0) / n : 0;
		const y = n ? points.reduce((s, p) => s + p.y, 0) / n : 0;
		points = [...points, { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 }];
		selected = n;
	}

	function remove(i: number) {
		points = points.filter((_, j) => j !== i);
		selected = null;
	}

	const MATRIX_LABELS = ['a', 'b', 'c', 'd'];
</script>

<Panel title="Points">
	<div class="stack">
		<p class="hint">Click the plot to add a point. Drag a point to move it.</p>
		<div class="builder" data-testid="polygon-builder">
			<Field label="Sides" error={sidesValid ? undefined : 'Use 3 to 12 sides.'}>
				{#snippet children(props)}
					<input class="control" type="number" min="3" max="12" bind:value={sides} {...props} />
				{/snippet}
			</Field>
			<label class="check"><input type="checkbox" bind:checked={midpoints} /> Edge midpoints</label>
			<label class="check"><input type="checkbox" bind:checked={centre} /> Centre</label>
			<Button onclick={usePolygon} disabled={!sidesValid} data-testid="use-polygon"
				>Use polygon</Button
			>
		</div>

		<label class="check"
			><input type="checkbox" bind:checked={showOptions} data-testid="per-point" /> Per-point options</label
		>
		<ScrollEdges>
			<table class="points" data-testid="points-table">
				<thead>
					<tr>
						<th scope="col">#</th>
						<th scope="col">x</th>
						<th scope="col">y</th>
						{#if showOptions}
							<th scope="col">Weight</th>
							<th scope="col">Ratio</th>
							<th scope="col">Turn °</th>
							<th scope="col" colspan="4">Matrix (Advanced)</th>
						{/if}
						<th scope="col"><span class="sr-only">Remove</span></th>
					</tr>
				</thead>
				<tbody>
					{#each points as p, i (i)}
						<tr class:selected={selected === i}>
							<th scope="row">{i + 1}</th>
							<td
								><input
									class="control"
									type="number"
									step="any"
									value={p.x}
									aria-label="Point {i + 1} x"
									onchange={(e) => setCoord(i, 'x', e)}
									onfocus={() => (selected = i)}
								/></td
							>
							<td
								><input
									class="control"
									type="number"
									step="any"
									value={p.y}
									aria-label="Point {i + 1} y"
									onchange={(e) => setCoord(i, 'y', e)}
									onfocus={() => (selected = i)}
								/></td
							>
							{#if showOptions}
								<td
									><input
										class="control"
										type="number"
										step="any"
										min="0"
										value={p.weight ?? ''}
										placeholder="1"
										aria-label="Point {i + 1} weight"
										onchange={(e) => update(i, { weight: read(e) })}
									/></td
								>
								<td
									><input
										class="control"
										type="number"
										step="0.01"
										min="0.01"
										max="0.99"
										value={p.ratio ?? ''}
										placeholder={String(Math.round(ratio * 1000) / 1000)}
										disabled={!!p.matrix}
										aria-label="Point {i + 1} jump ratio"
										onchange={(e) => update(i, { ratio: read(e) })}
									/></td
								>
								<td
									><input
										class="control"
										type="number"
										step="any"
										value={p.rotation ?? ''}
										placeholder="0"
										disabled={!!p.matrix}
										aria-label="Point {i + 1} rotation in degrees"
										onchange={(e) => update(i, { rotation: read(e) })}
									/></td
								>
								{#each MATRIX_LABELS as m, j (m)}
									<td
										><input
											class="control matrix"
											type="number"
											step="any"
											value={p.matrix?.[j] ?? ''}
											placeholder={m}
											aria-label="Point {i + 1} matrix {m}"
											onchange={(e) => setMatrix(i, j, e)}
										/></td
									>
								{/each}
							{/if}
							<td
								><Button
									size="sm"
									variant="ghost"
									onclick={() => remove(i)}
									aria-label="Remove point {i + 1}">✕</Button
								></td
							>
						</tr>
					{/each}
				</tbody>
			</table>
		</ScrollEdges>
		{#if showOptions}
			<p class="hint">
				Weight sets how often a point is picked. Ratio and turn override the jump for that point.
				The matrix M makes each jump land at p + M(x − p), for any affine map; blank a cell to drop
				it.
			</p>
		{/if}
		<div class="cluster">
			<Button onclick={add} disabled={points.length >= MAX_POINTS} data-testid="add-point"
				>Add point</Button
			>
		</div>
	</div>
</Panel>

<style>
	.hint {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-muted);
	}

	.builder {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--sp-2) var(--sp-3);
	}

	.builder :global(.ui-field) {
		width: 5rem;
	}

	.check {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-1);
		min-height: var(--control-h);
		font-size: var(--text-sm);
	}

	/* Contains the sr-only header, which would otherwise widen the page past the scroller */
	.points {
		position: relative;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}

	.points th,
	.points td {
		padding: var(--sp-0) var(--sp-1);
		text-align: left;
	}

	.points thead th {
		font-weight: 500;
		color: var(--text-muted);
	}

	.points input {
		width: 6.5rem;
	}

	.points input.matrix {
		width: 4.5rem;
	}

	tr.selected th {
		color: var(--accent);
	}
</style>
