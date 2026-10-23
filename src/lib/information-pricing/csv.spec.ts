import { describe, expect, it } from 'vitest';
import { csvField, csvHeader, scenariosCsv } from './csv';
import type { Scenarios } from './types';

function scenarios(n: number): Scenarios {
	const col = (f: (i: number) => number) => Float64Array.from({ length: n }, (_, i) => f(i));
	const rewards = [col((i) => i * 0.1), col((i) => 1 / (i + 3))];
	return {
		n,
		inputs: [
			{ symbol: 'N', column: col((i) => i) },
			{ symbol: 'P', column: col((i) => Math.PI * i) }
		],
		intermediates: [{ symbol: 'Delta', column: col((i) => -(i + 1) / 7) }],
		decisions: ['8 trucks', '1,000 "M€"'],
		rewards,
		optimal: col((i) => Math.max(rewards[0][i], rewards[1][i]))
	};
}

const text = (s: Scenarios, chunkRows?: number) => [...scenariosCsv(s, { chunkRows })].join('');

describe('csvField', () => {
	it('quotes only fields that need it', () => {
		expect(csvField('plain M€')).toBe('plain M€');
		expect(csvField('a,b')).toBe('"a,b"');
		expect(csvField('say "hi"')).toBe('"say ""hi"""');
		expect(csvField('two\nlines')).toBe('"two\nlines"');
	});
});

describe('scenariosCsv', () => {
	it('writes babslell columns with quoted headers', () => {
		const s = scenarios(4);
		expect(csvHeader(s)).toEqual([
			'N',
			'P',
			'Delta',
			'8 trucks',
			'1,000 "M€"',
			'8 trucks Opportunity Loss',
			'1,000 "M€" Opportunity Loss',
			'Optimal Reward'
		]);
		const lines = text(s).split('\r\n');
		expect(lines[0]).toBe(
			'N,P,Delta,8 trucks,"1,000 ""M€""",8 trucks Opportunity Loss,"1,000 ""M€"" Opportunity Loss",Optimal Reward'
		);
		expect(lines).toHaveLength(6);
		expect(lines[5]).toBe('');
	});

	it('uses display names when given', () => {
		const names = new Map([
			['N', 'Number of Packages'],
			['P', '']
		]);
		expect(csvHeader(scenarios(1), names).slice(0, 3)).toEqual([
			'Number of Packages',
			'P',
			'Delta'
		]);
	});

	it('round-trips every number and derives losses', () => {
		const s = scenarios(25);
		const rows = text(s, 7)
			.trimEnd()
			.split('\r\n')
			.slice(1)
			.map((l) => l.split(',').map(Number));
		expect(rows).toHaveLength(25);
		rows.forEach((r, i) => {
			expect(r).toEqual([
				s.inputs[0].column[i],
				s.inputs[1].column[i],
				s.intermediates[0].column[i],
				s.rewards[0][i],
				s.rewards[1][i],
				s.optimal[i] - s.rewards[0][i],
				s.optimal[i] - s.rewards[1][i],
				s.optimal[i]
			]);
			expect(Math.min(r[5], r[6])).toBe(0);
		});
	});

	it('chunks by whole rows, header first', () => {
		const chunks = [...scenariosCsv(scenarios(25), { chunkRows: 10 })];
		expect(chunks).toHaveLength(4);
		expect(chunks.map((c) => c.split('\r\n').length - 1)).toEqual([1, 10, 10, 5]);
		expect(text(scenarios(25), 10)).toBe(text(scenarios(25)));
		expect([...scenariosCsv(scenarios(0))]).toHaveLength(1);
	});
});
