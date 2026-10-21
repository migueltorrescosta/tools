import { describe, it, expect } from 'vitest';
import { parseCsv } from './csv';
import { buildDataset } from './dataset';
import { predictionsCsv } from './export';

describe('predictionsCsv', () => {
	const parsed = parseCsv('x;"a, b";y\n1;p;2\n;q;3\n3;"say ""hi""";6\n');
	const built = buildDataset(parsed, 2, [{ index: 0, categorical: false }]);

	it('keeps every row and column, adds the prediction and the split', () => {
		const csv = predictionsCsv(parsed, built, Float64Array.from([2.5, 6]), [1]);
		expect(csv).toBe(
			[
				'x,"a, b",y,y_predicted,split',
				'1,p,2,2.5,train',
				',q,3,,dropped',
				'3,"say ""hi""",6,6,validation',
				''
			].join('\n')
		);
		expect(parseCsv(csv).rows.map((r) => r.length)).toEqual([5, 5, 5]);
	});

	it('renames the new columns when the header already has them', () => {
		const taken = parseCsv('x,y,y_predicted,split\n1,2,0,a\n');
		const b = buildDataset(taken, 1, [{ index: 0, categorical: false }]);
		const header = predictionsCsv(taken, b, Float64Array.from([NaN]), []).split('\n')[0];
		expect(header).toBe('x,y,y_predicted,split,y_predicted_2,split_2');
	});
});
