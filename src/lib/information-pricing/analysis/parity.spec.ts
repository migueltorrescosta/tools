import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateParams } from '../distributions';
import { compileKernel } from '../formula/codegen';
import { compileModel } from '../model';
import { presetModel, type PresetId } from '../presets';
import { assemble } from '../simulate';
import type { Scenarios } from '../types';
import {
	analyse,
	formatThreshold,
	lossMatrix,
	optimalDecisionPerGroup,
	unitExponent,
	type InternalNode
} from './index';

/**
 * Parity with the reference implementation on fixtures written by
 * scripts/information-pricing-fixtures.py (seed 2026, 1,000 scenarios).
 * The rewards come from the presets' formulas through the compiled kernel.
 */

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

interface ExpectedNode {
	id: number;
	depth: number;
	samples: number;
	risk: number;
	decision: string;
	outOfSampleLoss: number | null;
	statusQuoLoss: number | null;
	savings: number | null;
	label: string;
	kind: 'internal' | 'leaf';
	splitInput?: string;
	thresholds?: number[];
	thresholdLabels?: string[];
	children?: number[];
	inSampleLoss?: number;
}

interface Expected {
	n: number;
	inputs: string[];
	decisions: string[];
	unit: string;
	expectedLoss: number[];
	unitExponent: number;
	displayedUnit: string;
	valueOfInformation: { bins: number[]; savings: number[][]; order: string[] };
	groups: Record<
		string,
		Record<string, { edges: number[]; labels: string[]; optimal: string[]; meanLoss: number[][] }>
	>;
	distributions: Record<
		string,
		{ deciles: number[]; bandwidth: number; grid: number[]; density: number[] }
	>;
	losses: Record<
		string,
		{
			box: Record<'q1' | 'med' | 'q3' | 'whislo' | 'whishi' | 'mean', number>;
			fliers: number;
			histogram: { edges: number[]; counts: number[] };
		}
	>;
	policyTree: {
		expectedLoss: number;
		rootExpectedLoss: number;
		valueOfInformation: number;
		statusQuo: string;
		nodes: ExpectedNode[];
	};
}

function readInputs(name: string): Map<string, Float64Array> {
	const lines = readFileSync(join(FIXTURES, `${name}.inputs.csv`), 'utf8')
		.trim()
		.split('\n');
	const header = lines[0].split(',');
	const columns = header.map(() => new Float64Array(lines.length - 1));
	for (let r = 1; r < lines.length; r++) {
		const cells = lines[r].split(',');
		for (let c = 0; c < cells.length; c++) columns[c][r - 1] = Number(cells[c]);
	}
	return new Map(header.map((h, c) => [h, columns[c]]));
}

/**
 * The preset as it was when the fixtures were generated: the presets have
 * since been retuned, but the fixtures keep the original fixed values and
 * decisions (random inputs come from the CSV, so their families don't matter).
 */
function fixtureModel(preset: PresetId) {
	const model = presetModel(preset);
	const fixed = { 'distribution-centre': 1000, 'airline-share-buyback': 950 } as const;
	for (const input of model.inputs)
		if (input.family === 'fixed') input.params = [fixed[preset as keyof typeof fixed]];
	if (preset === 'distribution-centre') model.decisions.values = [8, 9, 10, 11, 12];
	return model;
}

/**
 * Scenarios from the fixture's random inputs, with the shared intermediates
 * and rewards computed by the preset's compiled kernel.
 */
function scenarios(preset: PresetId): Scenarios {
	const x = readInputs(preset);
	const model = fixtureModel(preset);
	const result = compileModel(model, validateParams);
	if (!result.ok) throw new Error(result.errors[0].message);
	const { compiled } = result;
	const n = x.values().next().value!.length;
	const cols = compiled.slots.inputs.map((symbol) => x.get(symbol)!);
	for (let j = 0; j < compiled.slots.shared.length; j++) cols.push(new Float64Array(n));
	const rewards = compiled.labels.map(() => new Float64Array(n));
	compileKernel(compiled)(cols, rewards, 0, n);
	return assemble(
		{ inputs: compiled.slots.inputs, shared: compiled.slots.shared, decisions: compiled.labels },
		[{ cols, rewards }],
		null
	);
}

const distributionCentre = () => scenarios('distribution-centre');
const airlineShareBuyback = () => scenarios('airline-share-buyback');

/** |a − b| within `rel` of `scale` (defaults to |b|). */
function close(a: number, b: number | null, rel = 1e-9, scale = Math.abs(b ?? 0)) {
	if (b === null) {
		expect(Number.isNaN(a)).toBe(true);
		return;
	}
	expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(scale, 1e-300));
}

const PRESETS: [string, () => Scenarios, string][] = [
	['distribution-centre', distributionCentre, '€'],
	['airline-share-buyback', airlineShareBuyback, 'M€']
];

describe.each(PRESETS)('parity: %s', (name, build, unit) => {
	const expected = JSON.parse(
		readFileSync(join(FIXTURES, `${name}.expected.json`), 'utf8')
	) as Expected;
	const s = build();
	const result = analyse(s, { unit, tree: { maxDepth: 3 } });
	const eolScale = Math.min(...expected.expectedLoss);

	it('matches the expected loss per decision and the display unit', () => {
		expect(s.n).toBe(expected.n);
		result.summary.expectedLoss.forEach((v, d) => close(v, expected.expectedLoss[d], 1e-12));
		expect(unitExponent(result.summary.expectedLoss[result.summary.best])).toBe(
			expected.unitExponent
		);
		expect(result.summary.displayedUnit).toBe(expected.displayedUnit);
		expect(s.decisions[result.summary.best]).toBe(
			expected.decisions[expected.expectedLoss.indexOf(eolScale)]
		);
	});

	it('matches the value-of-information matrix and its order', () => {
		const voi = result.valueOfInformation;
		expect(voi.bins).toEqual(expected.valueOfInformation.bins);
		voi.savings.forEach((row, j) =>
			row.forEach((v, b) => close(v, expected.valueOfInformation.savings[j][b], 1e-9, eolScale))
		);
		expect(voi.order.map((j) => s.inputs[j].symbol)).toEqual(expected.valueOfInformation.order);
	});

	it('matches the optimal decision per quantile group', () => {
		const loss = lossMatrix(s);
		s.inputs.forEach(({ symbol, column }) => {
			for (const [bins, table] of Object.entries(expected.groups[symbol])) {
				const got = optimalDecisionPerGroup(column, loss, s.rewards.length, Number(bins));
				expect(Array.from(got.edges)).toEqual(table.edges);
				expect(got.groups.map((g) => g.label)).toEqual(table.labels);
				expect(got.groups.map((g) => s.decisions[g.optimal])).toEqual(table.optimal);
				got.groups.forEach((g, k) =>
					g.meanLoss.forEach((v, d) => close(v, table.meanLoss[k][d], 1e-12, eolScale))
				);
			}
		});
	});

	it('matches the deciles and the density curve', () => {
		s.inputs.forEach(({ symbol }, j) => {
			const want = expected.distributions[symbol];
			const got = result.densities[j];
			expect(Array.from(got.deciles)).toEqual(want.deciles);
			got.grid.forEach((v, k) => close(v, want.grid[k], 1e-12, Math.abs(want.grid.at(-1)!)));
			close(got.bandwidth, want.bandwidth, 1e-9);
			const peak = Math.max(...want.density);
			got.density.forEach((v, k) => close(v, want.density[k], 1e-4, peak));
		});
	});

	it('matches the box-plot statistics and histograms', () => {
		s.decisions.forEach((decision, d) => {
			const want = expected.losses[decision];
			const got = result.distributions[d];
			const scale = Math.max(want.box.whishi, eolScale);
			close(got.box.q1, want.box.q1, 1e-9, scale);
			close(got.box.median, want.box.med, 1e-9, scale);
			close(got.box.q3, want.box.q3, 1e-9, scale);
			close(got.box.whiskerLow, want.box.whislo, 1e-9, scale);
			close(got.box.whiskerHigh, want.box.whishi, 1e-9, scale);
			close(got.box.mean, want.box.mean, 1e-12);
			expect(got.box.fliersLow + got.box.fliersHigh).toBe(want.fliers);
			expect(Array.from(got.histogram.counts)).toEqual(want.histogram.counts);
			got.histogram.edges.forEach((v, k) => close(v, want.histogram.edges[k], 1e-9, scale));
		});
	});

	it('matches the policy tree', () => {
		if (!('tree' in result.tree)) throw new Error(result.tree.error);
		const { tree, view } = result.tree;
		const want = expected.policyTree;
		close(tree.rootExpectedLoss, want.rootExpectedLoss, 1e-12);
		close(tree.expectedLoss, want.expectedLoss, 1e-12);
		close(tree.valueOfInformation, want.valueOfInformation, 1e-9, want.rootExpectedLoss);
		expect(s.decisions[tree.statusQuo]).toBe(want.statusQuo);
		expect(tree.nodes.length).toBe(want.nodes.length);
		tree.nodes.forEach((node, k) => {
			const w = want.nodes[k];
			expect(node.id).toBe(w.id);
			expect(node.kind).toBe(w.kind);
			expect(node.depth).toBe(w.depth);
			expect(node.samples).toBe(w.samples);
			expect(s.decisions[node.decision]).toBe(w.decision);
			close(node.risk, w.risk, 1e-9, eolScale);
			close(node.outOfSampleLoss, w.outOfSampleLoss, 1e-9, eolScale);
			close(node.statusQuoLoss, w.statusQuoLoss, 1e-9, eolScale);
			close(node.savings, w.savings, 1e-9, eolScale);
			const lines = w.label.split('\\n');
			expect([view.nodes[k].shareLabel, view.nodes[k].savingsLabel]).toEqual(lines);
			if (node.kind === 'internal') {
				const internal = node as InternalNode;
				expect(s.inputs[internal.splitInput].symbol).toBe(w.splitInput);
				expect(internal.children).toEqual(w.children);
				internal.thresholds.forEach((t, c) => close(t, w.thresholds![c], 1e-12));
				expect(internal.thresholds.map(formatThreshold)).toEqual(w.thresholdLabels);
			} else {
				close(node.inSampleLoss, w.inSampleLoss!, 1e-9, eolScale);
			}
		});
	});
});
