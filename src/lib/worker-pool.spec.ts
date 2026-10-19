import { describe, expect, it } from 'vitest';
import { defaultWorkerCount } from './worker-pool';

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
