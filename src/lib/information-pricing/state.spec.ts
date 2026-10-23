import { describe, expect, it } from 'vitest';
import { createPersistGate } from '$lib/persist-gate';
import { PRESETS, presetModel } from './presets';
import {
	AUTOSAVE_KEY,
	MAX_INFLATED_BYTES,
	STORAGE_PREFIX,
	decodeModel,
	encodeModel,
	loadSaved,
	parseEnvelope,
	saveModel,
	serialiseModel
} from './state';

function memoryStorage(entries: Record<string, string> = {}) {
	const map = new Map(Object.entries(entries));
	return {
		map,
		getItem: (k: string) => map.get(k) ?? null,
		setItem: (k: string, v: string) => void map.set(k, v)
	};
}

function base64Url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

/** Deflate arbitrary text the way encodeModel does. */
async function deflate(text: string): Promise<string> {
	const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));
	return base64Url(new Uint8Array(await new Response(stream).arrayBuffer()));
}

const envelope = (patch: (m: Record<string, unknown>) => void) => {
	const model = JSON.parse(JSON.stringify(presetModel('airline-share-buyback')));
	patch(model);
	return { v: 2, model };
};

const errorOf = (value: unknown) => {
	const r = parseEnvelope(value);
	return r.ok ? null : r.error;
};

describe('share link', () => {
	it('round-trips every preset', async () => {
		for (const { model } of PRESETS) {
			const text = await encodeModel(model);
			expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
			expect(await decodeModel(text)).toEqual({ ok: true, model });
		}
	});

	it('round-trips awkward text and numbers', async () => {
		const model = presetModel('blank');
		model.inputs[0].name = 'Ünïcode "quoted", 𝔁 & ✓';
		model.inputs[0].params = [-Number.MIN_VALUE, 0.1 + 0.2];
		model.decisions.unit = 'M€';
		expect(await decodeModel(await encodeModel(model))).toEqual({ ok: true, model });
	});

	it('rejects bad base64, corrupt deflate and bad JSON', async () => {
		expect(await decodeModel('abc+/')).toMatchObject({ ok: false });
		expect(await decodeModel('abcde')).toMatchObject({ ok: false });
		expect(await decodeModel('AAAA')).toMatchObject({ ok: false });
		expect(await decodeModel('')).toMatchObject({ ok: false });
		expect(await decodeModel(await deflate('{"v":1,'))).toEqual({
			ok: false,
			error: 'The link does not hold valid JSON.'
		});
	});

	it('rejects a wrong version', async () => {
		const model = presetModel('blank');
		const text = await deflate(JSON.stringify({ v: 3, model }));
		expect(await decodeModel(text)).toEqual({ ok: false, error: 'Unsupported version 3.' });
		expect(errorOf({ v: 1, model })).toBe('Unsupported version 1.');
	});

	it('rejects oversized payloads before and after inflating', async () => {
		expect(await decodeModel('A'.repeat(600 * 1024))).toEqual({
			ok: false,
			error: 'The link is too long.'
		});
		// A zip bomb: a few kB that inflate past the cap
		const bomb = await deflate(' '.repeat(MAX_INFLATED_BYTES + 1));
		expect(bomb.length).toBeLessThan(5000);
		expect(await decodeModel(bomb)).toEqual({
			ok: false,
			error: 'The link is corrupt or too large.'
		});
	});
});

describe('parseEnvelope', () => {
	it('rejects wrong shapes with a path', () => {
		expect(errorOf(null)).toBe('The saved data must be an object.');
		expect(errorOf({ model: {} })).toBe('Unsupported version none.');
		expect(errorOf({ v: 2, model: [] })).toBe('model must be an object.');
		expect(
			errorOf(envelope((m) => ((m.inputs as { params: number[] }[])[6].params = [1, 2])))
		).toBe('inputs[6].params has more than 1 entries.');
		expect(errorOf(envelope((m) => ((m.inputs as { family: string }[])[1].family = 'gamma')))).toBe(
			'inputs[1].family is not a known distribution.'
		);
		expect(errorOf(envelope((m) => ((m.inputs as { params: number[] }[])[0].params = [1])))).toBe(
			'inputs[0].params must have 2 values.'
		);
		expect(
			errorOf(envelope((m) => ((m.inputs as { params: unknown[] }[])[0].params = [1, '2'])))
		).toBe('inputs[0].params[1] must be a finite number.');
		expect(errorOf(envelope((m) => ((m.inputs as { symbol: string }[])[0].symbol = '')))).toBe(
			'inputs[0].symbol is empty.'
		);
		expect(errorOf(envelope((m) => ((m.inputs as { name: unknown }[])[0].name = 3)))).toBe(
			'inputs[0].name must be text.'
		);
		expect(
			errorOf(
				envelope((m) => ((m.intermediates as { formula: string }[])[0].formula = 'x'.repeat(2001)))
			)
		).toBe('intermediates[0].formula is longer than 2000 characters.');
		expect(errorOf(envelope((m) => ((m.decisions as { values: number[] }).values = [])))).toBe(
			'decisions.values is empty.'
		);
		expect(errorOf(envelope((m) => ((m.decisions as { unit?: string }).unit = undefined)))).toBe(
			'decisions.unit must be text.'
		);
	});

	it('enforces the seed, samples and symbol caps', () => {
		expect(errorOf(envelope((m) => (m.seed = 1.5)))).toBe('seed must be a whole number.');
		expect(errorOf(envelope((m) => (m.samples = 0)))).toMatch(/^samples must be/);
		expect(errorOf(envelope((m) => (m.samples = 1_000_001)))).toMatch(/^samples must be/);
		expect(errorOf(envelope((m) => (m.samples = 2.5)))).toMatch(/^samples must be/);
		expect(errorOf(envelope((m) => (m.samples = 1_000_000)))).toBeNull();
		const fixed = Array.from({ length: 199 }, (_, i) => ({
			symbol: `c${i}`,
			name: '',
			family: 'fixed',
			params: [i]
		}));
		expect(errorOf(envelope((m) => (m.inputs = fixed)))).toBe(
			'The model declares more than 200 symbols.'
		);
	});

	it('keeps only known fields', () => {
		const r = parseEnvelope(
			JSON.parse(
				JSON.stringify(envelope((m) => (m.extra = 1))).replace(
					'"model":{',
					'"model":{"__proto__":{"x":1},'
				)
			)
		);
		expect(r).toEqual({ ok: true, model: presetModel('airline-share-buyback') });
	});
});

describe('autosave', () => {
	it('saves through the gate once open and loads back', () => {
		const storage = memoryStorage();
		const gate = createPersistGate(storage);
		const model = presetModel('distribution-centre');
		saveModel(gate, model);
		expect(storage.map.size).toBe(0);
		gate.open();
		saveModel(gate, model);
		expect(AUTOSAVE_KEY.startsWith(STORAGE_PREFIX)).toBe(true);
		expect(storage.map.get(AUTOSAVE_KEY)).toBe(serialiseModel(model));
		expect(loadSaved(storage)).toEqual(model);
	});

	it('returns null when absent, corrupt or invalid', () => {
		expect(loadSaved(null)).toBeNull();
		expect(loadSaved(memoryStorage())).toBeNull();
		expect(loadSaved(memoryStorage({ [AUTOSAVE_KEY]: '{bad' }))).toBeNull();
		expect(loadSaved(memoryStorage({ [AUTOSAVE_KEY]: '{"v":1,"model":{}}' }))).toBeNull();
	});
});
