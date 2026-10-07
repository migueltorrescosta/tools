import { describe, it, expect } from 'vitest';
import {
	buildTrail,
	formatMoney,
	logExtent,
	logScale,
	logTicks,
	trailSegments,
	trailUpTo,
	typeSlot,
	TYPE_ORDER,
	type TrailPoint
} from '$lib/company-trends/chart';
import type { FxTable } from '$lib/company-trends/fx';
import type { Company } from '$lib/company-trends/schema';
import { quarterRange, type CompanyPoint } from '$lib/company-trends/series';

const anchor = (quarter: string, revenue: number, operatingIncome: number): CompanyPoint => ({
	quarter,
	revenue,
	operatingIncome,
	quality: 'reported',
	source: `report ${quarter}`,
	sourceUrl: `https://example.com/${quarter}`
});

const quarters = quarterRange('2000Q1', '2003Q4');
const fx: FxTable = {
	base: 'EUR',
	rates: Object.fromEntries(quarters.map((q) => [q, { USD: 2, GBP: 0.5 }]))
};

const company: Company = {
	id: 'acme',
	name: 'Acme',
	type: 'tech',
	reportingCurrency: 'USD',
	country: 'US',
	// 2000Q4 -> 2001Q4 is regular annual cadence; 2001Q4 -> 2003Q4 skips a year (gap).
	points: [anchor('2000Q4', 100, 10), anchor('2001Q4', 200, 20), anchor('2003Q4', 400, 40)]
};

describe('typeSlot', () => {
	it('gives each known type a fixed slot in declaration order', () => {
		TYPE_ORDER.forEach((type, i) => expect(typeSlot(type)).toBe(i));
	});

	it('folds unknown types into the last slot', () => {
		expect(typeSlot('shipping')).toBe(TYPE_ORDER.length - 1);
	});
});

describe('buildTrail', () => {
	const trail = buildTrail(company, quarters, 'EUR', fx);

	it('densifies anchors onto every quarter between first and last anchor', () => {
		expect(trail.points.map((p) => p.quarter)).toEqual(quarterRange('2000Q4', '2003Q4'));
	});

	it('derives expenses as revenue minus operating income', () => {
		expect(trail.points[0].expenses).toBe(90);
	});

	it('records the bracketing anchors for interpolated points', () => {
		const mid = trail.points.find((p) => p.quarter === '2001Q2')!;
		expect(mid.quality).toBe('interpolated');
		expect(mid.from).toBe('2000Q4');
		expect(mid.to).toBe('2001Q4');
		expect(mid.gap).toBe(false);
	});

	it('flags points inside spans wider than the annual cadence as gaps', () => {
		const inGap = trail.points.find((p) => p.quarter === '2002Q4')!;
		expect(inGap.gap).toBe(true);
		expect(trail.points.find((p) => p.quarter === '2003Q4')!.gap).toBe(false);
	});

	it('keeps provenance on anchors', () => {
		expect(trail.points[0].source).toBe('report 2000Q4');
		expect(trail.points[0].sourceUrl).toBe('https://example.com/2000Q4');
	});

	it('converts into the display currency at each quarter rate', () => {
		const usd = buildTrail(company, quarters, 'USD', fx);
		expect(usd.points[0].revenue).toBe(200);
		expect(usd.points[0].expenses).toBe(180);
	});

	it('cuts a trail at a quarter index', () => {
		expect(trailUpTo(trail, 4).map((p) => p.quarter)).toEqual(['2000Q4', '2001Q1']);
	});
});

describe('log scale helpers', () => {
	it('maps decades linearly onto the range', () => {
		const s = logScale([1, 100], [0, 200]);
		expect(s(1)).toBe(0);
		expect(s(10)).toBeCloseTo(100);
		expect(s(100)).toBeCloseTo(200);
	});

	it('supports inverted ranges for y axes', () => {
		const s = logScale([10, 1000], [300, 0]);
		expect(s(10)).toBe(300);
		expect(s(1000)).toBeCloseTo(0);
	});

	it('rejects non-positive domains', () => {
		expect(() => logScale([0, 10], [0, 1])).toThrow();
	});

	it('computes decade-rounded extents ignoring non-positive values', () => {
		expect(logExtent([35, 0, -4, 7200])).toEqual([10, 10000]);
		expect(logExtent([100])).toEqual([100, 1000]);
		expect(logExtent([0, -1])).toBeNull();
	});

	it('emits 1-2-5 ticks for narrow domains and decades for wide ones', () => {
		expect(logTicks([10, 1000]).map((t) => t.value)).toEqual([10, 20, 50, 100, 200, 500, 1000]);
		const wide = logTicks([1, 1e6]);
		expect(wide.map((t) => t.value)).toEqual([1, 10, 100, 1000, 10000, 100000, 1e6]);
		expect(wide.every((t) => t.major)).toBe(true);
	});
});

describe('formatMoney', () => {
	it('formats millions compactly with currency symbols', () => {
		expect(formatMoney(350, 'USD')).toBe('$350M');
		expect(formatMoney(1234, 'EUR')).toBe('€1.23B');
		expect(formatMoney(274515, 'GBP')).toBe('£275B');
		expect(formatMoney(2_400_000, 'EUR')).toBe('€2.4T');
		expect(formatMoney(-56.4, 'EUR')).toBe('−€56.4M');
	});
});

describe('trailSegments', () => {
	const id = (v: number) => v;
	const pt = (revenue: number, expenses: number, gap = false): TrailPoint => ({
		quarter: '2000Q1',
		qi: 0,
		revenue,
		expenses,
		operatingIncome: revenue - expenses,
		quality: 'interpolated',
		gap
	});

	it('draws one solid path through regular points', () => {
		expect(trailSegments([pt(1, 1), pt(2, 2), pt(3, 3)], id, id)).toEqual([
			{ kind: 'solid', d: 'M1.0,1.0L2.0,2.0L3.0,3.0' }
		]);
	});

	it('switches to a gap segment through gap points and back', () => {
		const segs = trailSegments([pt(1, 1), pt(2, 2, true), pt(3, 3), pt(4, 4)], id, id);
		expect(segs).toEqual([
			{ kind: 'gap', d: 'M1.0,1.0L2.0,2.0L3.0,3.0' },
			{ kind: 'solid', d: 'M3.0,3.0L4.0,4.0' }
		]);
	});

	it('breaks the line at values that cannot be drawn on log axes', () => {
		const segs = trailSegments([pt(1, 1), pt(2, 2), pt(3, -1), pt(4, 4), pt(5, 5)], id, id);
		expect(segs).toEqual([
			{ kind: 'solid', d: 'M1.0,1.0L2.0,2.0' },
			{ kind: 'solid', d: 'M4.0,4.0L5.0,5.0' }
		]);
	});
});
