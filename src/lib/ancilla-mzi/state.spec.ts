import { describe, expect, it } from 'vitest';
import { DEFAULT_BUDGET, applyPreset, defaultSetup, detectPreset, noiseless } from './presets';
import {
	RESULT_KEY,
	SETUP_KEY,
	STORAGE_PREFIX,
	decodeShareParams,
	encodeShareParams,
	hasShareParams,
	readSavedResult,
	type ShareState
} from './state';
import type { RunSnapshot, Setup } from './types';

function memoryStorage(entries: Record<string, string>): Storage {
	const map = new Map(Object.entries(entries));
	return {
		get length() {
			return map.size;
		},
		key: (i) => [...map.keys()][i] ?? null,
		getItem: (k) => map.get(k) ?? null,
		setItem: (k, v) => void map.set(k, v),
		removeItem: (k) => void map.delete(k),
		clear: () => map.clear()
	};
}

function custom(): Setup {
	const s = applyPreset({ ...defaultSetup(), nS: 2, nA: 2, mziParticles: 3 }, 'local+S');
	s.input = 'full';
	s.ancillaWeight = 1.25;
	s.coupling[8] = true;
	s.fieldS = [true, false, true];
	s.controlBound = 7.5;
	s.pulseBound = 3 * Math.PI;
	s.pulses = [
		{ time: 0.1, target: 'A' },
		{ time: 0.5, target: 'S' },
		{ time: 1 / 3 + 0.4, target: 'both' }
	];
	s.ancillaHold = 2;
	s.pmLevels = 2;
	s.noise.system.markov = {
		dephasing: 0.5,
		amplitudeDamping: 0.25,
		nbar: 1,
		depolarizing: 0.1,
		transverse: 0.2
	};
	s.noise.system.lorentzian = { kind: 'dephasing', gamma: 2, lambda: 3 };
	s.noise.ancilla = noiseless();
	s.noise.ancilla.lorentzian = { kind: 'dephasing', gamma: 1, lambda: 0.5 };
	return s;
}

const roundTrip = (state: ShareState) =>
	decodeShareParams(new URLSearchParams(encodeShareParams(state).toString()));

describe('share params', () => {
	it('round-trips a custom setup and budget', () => {
		const state = {
			setup: custom(),
			budget: { ...DEFAULT_BUDGET, steps: 32, seed: 9, workers: 2 }
		};
		const back = roundTrip(state);
		expect(back.budget).toEqual(state.budget);
		// Pulse times come back to 4 decimals
		state.setup.pulses[2].time = 0.7333;
		expect(back).toEqual(state);
	});

	it('rounds pulse times to 4 decimals and still detects the preset', () => {
		const state = { setup: defaultSetup(), budget: { ...DEFAULT_BUDGET } };
		const params = encodeShareParams(state);
		expect(params.get('p')).toBe('0.3333A_0.6667A');
		expect(params.has('na')).toBe(false);
		const back = roundTrip(state);
		expect(back.setup.pulses.map((p) => p.time)).toEqual([0.3333, 0.6667]);
		expect(detectPreset(back.setup)).toBe('active');
		expect({ ...back.setup, pulses: [] }).toEqual({ ...state.setup, pulses: [] });
	});

	it('needs no percent-encoding', () => {
		const query = encodeShareParams({ setup: custom(), budget: DEFAULT_BUDGET }).toString();
		expect(query).not.toContain('%');
	});

	it('falls back to defaults for missing or garbled values', () => {
		const empty = decodeShareParams(new URLSearchParams(''));
		expect(empty).toEqual({ setup: defaultSetup(), budget: DEFAULT_BUDGET });
		const garbage = decodeShareParams(
			new URLSearchParams('n=9_x&in=q&a=-1&cp=12&fa=1&cb=0&pb=x&p=0.5Q&ns=1_2&b=1_x_0&mp=zz&pm=7')
		);
		const d = defaultSetup();
		expect(garbage.setup).toEqual({ ...d, noise: { system: noiseless(), ancilla: noiseless() } });
		expect(garbage.budget).toEqual(DEFAULT_BUDGET);
	});

	it('defaults the MZI to all N particles', () => {
		const s = decodeShareParams(new URLSearchParams('n=3_1'));
		expect([s.setup.nS, s.setup.nA, s.setup.mziParticles]).toEqual([3, 1, 4]);
	});

	it('detects share params', () => {
		expect(hasShareParams(new URLSearchParams('n=1_1'))).toBe(true);
		expect(hasShareParams(new URLSearchParams('utm=1'))).toBe(false);
	});
});

describe('saved state', () => {
	const snapshot: RunSnapshot = {
		elapsedMs: 1000,
		seedsDone: { setup: 2, companion: 0 },
		mzi: null,
		best: { setup: null, companion: null },
		traces: [],
		metrics: null
	};

	it('keeps every key under the prefix', () => {
		expect([SETUP_KEY, RESULT_KEY].every((k) => k.startsWith(STORAGE_PREFIX))).toBe(true);
	});

	it('reads a saved result and rejects corrupt ones', () => {
		const good = memoryStorage({ [RESULT_KEY]: JSON.stringify({ query: 'n=1_1', snapshot }) });
		expect(readSavedResult(good)?.snapshot).toEqual(snapshot);
		expect(readSavedResult(memoryStorage({ [RESULT_KEY]: '{bad' }))).toBeNull();
		expect(readSavedResult(memoryStorage({ [RESULT_KEY]: '{"query":"x"}' }))).toBeNull();
		expect(readSavedResult(null)).toBeNull();
	});
});
