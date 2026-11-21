import { describe, expect, it } from 'vitest';
import { PRESETS } from './presets';
import {
	categoryErrors,
	contentId,
	decodeShare,
	encodeShare,
	isWordOnly,
	merge,
	parseBackup,
	type Backup
} from './storage';
import type { Comparison, Run } from './types';

const words = (label: string, list: string[]) => ({
	label,
	items: list.map((text) => ({ kind: 'word' as const, text }))
});
const custom: Pick<Comparison, 'targets' | 'attributes'> = {
	targets: [
		words('Tea', ['oolong', 'matcha', 'chai', 'earl grey']),
		words('Café', ['latte', 'mocha', 'ristretto', 'lungo'])
	],
	attributes: [
		words('Morning', ['dawn', 'sunrise', 'breakfast', 'alarm']),
		words('Night', ['moon', 'stars', 'midnight', 'dusk'])
	]
};

describe('share links', () => {
	it('round-trip a word-only comparison, accents included, with a stable id', () => {
		const back = decodeShare(encodeShare(custom))!;
		expect(back.targets).toEqual(custom.targets);
		expect(back.attributes).toEqual(custom.attributes);
		expect(back.id).toBe(contentId(custom));
		expect(back.custom).toBe(true);
	});

	it('reject malformed or too-short payloads', () => {
		expect(decodeShare('not-base64!')).toBeNull();
		const short = {
			...custom,
			targets: [words('Tea', ['oolong']), custom.targets[1]] as Comparison['targets']
		};
		expect(decodeShare(encodeShare(short))).toBeNull();
	});

	it('only word-only comparisons are shareable', () => {
		expect(isWordOnly(custom)).toBe(true);
		expect(isWordOnly(PRESETS.find((p) => p.id === 'race-white-black')!)).toBe(false);
	});
});

describe('categoryErrors', () => {
	it('needs a name and 4 to 8 items', () => {
		expect(categoryErrors(words('', ['a', 'b', 'c', 'd']))).toEqual(['Name every category.']);
		expect(categoryErrors(words('X', ['a']))).toEqual(['Give X 4 to 8 items.']);
		expect(categoryErrors(words('X', ['a', 'b', 'c', 'd']))).toEqual([]);
	});
});

describe('backups', () => {
	const run = (id: string, date: string) => ({ id, date }) as Run;
	it('merge by id and keep runs in date order', () => {
		const a: Backup = { version: 1, runs: [run('1', '2026-01-02')], custom: [] };
		const b: Backup = {
			version: 1,
			runs: [run('1', '2026-01-02'), run('2', '2026-01-01')],
			custom: []
		};
		expect(merge(a, b).runs.map((r) => r.id)).toEqual(['2', '1']);
	});
	it('parse only version 1 files', () => {
		expect(parseBackup('{"version":1,"runs":[],"custom":[]}')).toEqual({
			version: 1,
			runs: [],
			custom: []
		});
		expect(parseBackup('{"version":2}')).toBeNull();
		expect(parseBackup('nope')).toBeNull();
	});
});

describe('presets', () => {
	it('have 4 to 8 items per category and unique ids', () => {
		for (const p of PRESETS)
			for (const c of [...p.targets, ...p.attributes]) expect(categoryErrors(c)).toEqual([]);
		expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
	});
});
