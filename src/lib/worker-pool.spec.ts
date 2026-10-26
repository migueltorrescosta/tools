import { describe, expect, it } from 'vitest';
import { MAX_WORKERS, clampWorkers, defaultWorkerCount } from './worker-pool';

describe('defaultWorkerCount', () => {
	it('uses hardwareConcurrency − 1, between 1 and 4', () => {
		expect(defaultWorkerCount(1)).toBe(1);
		expect(defaultWorkerCount(2)).toBe(1);
		expect(defaultWorkerCount(3)).toBe(2);
		expect(defaultWorkerCount(4)).toBe(3);
		expect(defaultWorkerCount(16)).toBe(4);
		expect(defaultWorkerCount(NaN)).toBe(1);
		expect(defaultWorkerCount()).toBeGreaterThanOrEqual(1);
	});
});

describe('clampWorkers', () => {
	it('floors into 1..MAX_WORKERS', () => {
		expect(clampWorkers(3.7)).toBe(3);
		expect(clampWorkers(0)).toBe(1);
		expect(clampWorkers(-5)).toBe(1);
		expect(clampWorkers(10_000)).toBe(MAX_WORKERS);
		expect(clampWorkers(NaN)).toBe(1);
		expect(clampWorkers(Infinity)).toBe(1);
	});
});
