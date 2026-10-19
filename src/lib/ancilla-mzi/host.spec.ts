import { describe, expect, it } from 'vitest';
import { createAncillaHost, type FromWorker } from './host';
import { applyPreset, defaultSetup } from './presets';
import type { Budget } from './types';

const budget: Budget = { steps: 4, rounds: 1, maxIter: 2, seesawIter: 8, workers: 1, seed: 9 };

function host() {
	const out: FromWorker[] = [];
	return { out, handle: createAncillaHost((m) => out.push(m), { traceMs: 0 }) };
}

describe('createAncillaHost', () => {
	it('reports a task before init as an error', () => {
		const h = host();
		h.handle({ type: 'seed', role: 'setup', seed: 0 });
		expect(h.out).toEqual([{ type: 'error', message: 'task before init' }]);
	});

	it('runs a seed reproducibly, streaming its trace before the result', () => {
		const setup = applyPreset(defaultSetup(), 'active');
		const run = () => {
			const h = host();
			h.handle({ type: 'init', setup, budget });
			h.handle({ type: 'seed', role: 'setup', seed: 2 });
			return h.out;
		};
		const a = run();
		expect(a.map((m) => m.type).slice(-2)).toEqual(['trace', 'seed']);
		const traces = a.filter((m) => m.type === 'trace');
		expect(traces.at(-1)).toMatchObject({ done: true });
		const points = traces.flatMap((m) => (m.type === 'trace' ? m.points : []));
		for (let i = 1; i < points.length; i++)
			expect(points[i].evaluations).toBeGreaterThanOrEqual(points[i - 1].evaluations);
		expect(run()).toEqual(a);
	});

	it('finalises a seed result', () => {
		const h = host();
		h.handle({ type: 'init', setup: applyPreset(defaultSetup(), 'local'), budget });
		h.handle({ type: 'seed', role: 'setup', seed: 0 });
		const seed = h.out.find((m) => m.type === 'seed');
		if (seed?.type !== 'seed') throw new Error('no seed');
		h.handle({ type: 'finalise', result: seed.result });
		const fin = h.out.at(-1);
		expect(fin?.type).toBe('finalised');
		if (fin?.type !== 'finalised') return;
		expect(fin.result.qfi).toBeGreaterThanOrEqual(seed.result.qfi);
		expect(fin.result.qfiFine).toBeGreaterThan(0);
		expect(fin.result.readouts?.best).toBeGreaterThan(0);
	});
});
