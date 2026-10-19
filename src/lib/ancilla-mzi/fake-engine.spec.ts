import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAncillaEngine } from './fake-engine';
import { DEFAULT_BUDGET, applyPreset, defaultSetup } from './presets';
import type { RunEvent } from './types';

function run(ticks: number, setup = defaultSetup()) {
	const engine = new FakeAncillaEngine({ tickMs: 250, ticksPerSeed: 4 });
	const events: RunEvent[] = [];
	engine.subscribe((e) => events.push(e));
	engine.start(setup, DEFAULT_BUDGET);
	vi.advanceTimersByTime(250 * ticks);
	return { engine, events };
}

describe('FakeAncillaEngine', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('emits progress every tick with growing traces and metrics once a seed finishes', () => {
		const { events, engine } = run(10);
		expect(events).toHaveLength(10);
		const last = events.at(-1);
		if (last?.type !== 'progress') throw new Error('expected progress');
		expect(last.snapshot.seedsDone.setup).toBe(2);
		expect(last.snapshot.seedsDone.companion).toBe(2);
		expect(last.snapshot.metrics?.Rint).not.toBeNull();
		expect(last.snapshot.metrics?.bounds.channelExtension).not.toBeNull();
		expect(last.snapshot.best.setup?.params).toHaveLength(15 + 6 * 2);
		engine.dispose();
	});

	it('is deterministic for a fixed seed', () => {
		const a = run(9).events.at(-1);
		const b = run(9).events.at(-1);
		expect(a).toEqual(b);
	});

	it('stops, then continues with the seed counter kept', () => {
		const { engine, events } = run(5);
		engine.stop();
		expect(events.at(-1)?.type).toBe('stopped');
		vi.advanceTimersByTime(2000);
		expect(events.at(-1)?.type).toBe('stopped');
		engine.continue();
		vi.advanceTimersByTime(250 * 4);
		const last = events.at(-1);
		expect(last?.type === 'progress' && last.snapshot.seedsDone.setup).toBe(2);
		engine.dispose();
	});

	it('runs no companion without a coupling, and reports invalid setups', () => {
		const { events, engine } = run(5, applyPreset(defaultSetup(), 'local'));
		const last = events.at(-1);
		expect(last?.type === 'progress' && last.snapshot.metrics?.Rint).toBeNull();
		engine.dispose();
		const bad = run(1, { ...defaultSetup(), nS: 9 });
		expect(bad.events[0].type).toBe('error');
	});
});
