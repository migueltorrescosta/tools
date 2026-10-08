import { describe, it, expect } from 'vitest';
import {
	assignColors,
	buildTrail,
	clampMargin,
	colorMode,
	formatMoney,
	formatPercent,
	linearScale,
	logExtent,
	logScale,
	logTicks,
	MARGIN_DOMAIN,
	PALETTE_SIZE,
	percentTicks,
	trailSegments,
	trailUpTo,
	typeSlot,
	TYPE_ORDER,
	type Trail,
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
	// Rates vary per quarter so the fiscal-year mean differs from the year-end rate
	rates: Object.fromEntries(quarters.map((q, i) => [q, { USD: 2 + i / 10, GBP: 0.5 + i / 100 }]))
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

	it('derives operating margin as operating income over revenue', () => {
		expect(trail.points[0].margin).toBeCloseTo(0.1);
	});

	it('leaves margin undefined when there is no revenue', () => {
		const zero = buildTrail(
			{ ...company, points: [anchor('2000Q4', 0, -5), anchor('2001Q4', 10, -5)] },
			quarters,
			'EUR',
			fx
		);
		expect(zero.points[0].margin).toBeNull();
		expect(zero.points[zero.points.length - 1].margin).toBeCloseTo(-0.5);
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

	it('converts into the display currency at the fiscal-year mean rate', () => {
		// FY ending 2000Q4 averages 2.0, 2.1, 2.2, 2.3 = 2.15, not the year-end 2.3
		const usd = buildTrail(company, quarters, 'USD', fx);
		expect(usd.points[0].revenue).toBeCloseTo(215, 10);
		expect(usd.points[0].expenses).toBeCloseTo(193.5, 10);
		expect(usd.points[0].margin).toBeCloseTo(0.1, 12);
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

describe('linear and percent helpers', () => {
	it('maps the domain linearly, including inverted ranges', () => {
		const s = linearScale([-2, 1], [300, 0]);
		expect(s(-2)).toBe(300);
		expect(s(1)).toBe(0);
		expect(s(0)).toBeCloseTo(100);
		expect(s.domain).toEqual([-2, 1]);
	});

	it('fixes the margin domain at -200% to +100%', () => {
		expect(MARGIN_DOMAIN).toEqual([-2, 1]);
	});

	it('clamps margins to the domain and reports the side', () => {
		expect(clampMargin(0.3)).toEqual({ value: 0.3, clipped: null });
		expect(clampMargin(-7.7)).toEqual({ value: -2, clipped: 'low' });
		expect(clampMargin(1.5)).toEqual({ value: 1, clipped: 'high' });
		expect(clampMargin(-2)).toEqual({ value: -2, clipped: null });
	});

	it('emits 50% ticks with 0% as the major tick', () => {
		const ticks = percentTicks(MARGIN_DOMAIN);
		expect(ticks.map((t) => t.value)).toEqual([-2, -1.5, -1, -0.5, 0, 0.5, 1]);
		expect(ticks.filter((t) => t.major).map((t) => t.value)).toEqual([0]);
	});

	it('formats fractions as percentages', () => {
		expect(formatPercent(-1.5)).toBe('−150%');
		expect(formatPercent(0)).toBe('0%');
		expect(formatPercent(0.124, 1)).toBe('12.4%');
		expect(formatPercent(-582.99, 1)).toBe('−58,299.0%');
	});
});

describe('trailSegments', () => {
	const id = (v: number) => v;
	const pt = (revenue: number, margin: number | null, gap = false): TrailPoint => ({
		quarter: '2000Q1',
		qi: 0,
		revenue,
		expenses: 0,
		operatingIncome: 0,
		margin,
		quality: 'interpolated',
		gap
	});

	it('draws one solid path through regular points', () => {
		expect(trailSegments([pt(1, 0.1), pt(2, 0.2), pt(3, 0.3)], id, id)).toEqual([
			{ kind: 'solid', d: 'M1.0,0.1L2.0,0.2L3.0,0.3' }
		]);
	});

	it('switches to a gap segment through gap points and back', () => {
		const segs = trailSegments([pt(1, 0), pt(2, 0, true), pt(3, 0), pt(4, 0)], id, id);
		expect(segs).toEqual([
			{ kind: 'gap', d: 'M1.0,0.0L2.0,0.0L3.0,0.0' },
			{ kind: 'solid', d: 'M3.0,0.0L4.0,0.0' }
		]);
	});

	it('breaks the line where revenue is not drawable on the log axis', () => {
		const segs = trailSegments([pt(1, 0), pt(2, 0), pt(0, null), pt(4, 0), pt(5, 0)], id, id);
		expect(segs).toEqual([
			{ kind: 'solid', d: 'M1.0,0.0L2.0,0.0' },
			{ kind: 'solid', d: 'M4.0,0.0L5.0,0.0' }
		]);
	});

	it('pins off-scale margins to the edge as clipped segments', () => {
		const segs = trailSegments([pt(1, -9), pt(2, -3), pt(3, -1), pt(4, 0)], id, id);
		expect(segs).toEqual([
			{ kind: 'clipped', d: 'M1.0,-2.0L2.0,-2.0L3.0,-1.0' },
			{ kind: 'solid', d: 'M3.0,-1.0L4.0,0.0' }
		]);
	});
});

describe('colour assignment', () => {
	const trailOf = (id: string, name: string, type: string): Trail => ({
		company: { ...company, id, name, type },
		points: []
	});

	it('colours by company up to the palette size, else by industry', () => {
		expect(PALETTE_SIZE).toBe(12);
		expect(colorMode(1)).toBe('company');
		expect(colorMode(PALETTE_SIZE)).toBe('company');
		expect(colorMode(PALETTE_SIZE + 1)).toBe('industry');
	});

	it('gives every visible company a distinct slot in name order', () => {
		const tech = Array.from({ length: 11 }, (_, i) =>
			trailOf(`c${i}`, `Co ${String.fromCharCode(75 - i)}`, 'tech')
		);
		const colors = assignColors(tech);
		expect(new Set(colors.values()).size).toBe(11);
		expect(colors.get('c10')).toBe('var(--cseries-1)');
		expect(colors.get('c0')).toBe('var(--cseries-11)');
	});

	it('is deterministic regardless of input order', () => {
		const a = [trailOf('a', 'Alpha', 'tech'), trailOf('b', 'Beta', 'energy')];
		expect(assignColors(a)).toEqual(assignColors([...a].reverse()));
	});

	it('falls back to industry slots beyond the palette size', () => {
		const many = Array.from({ length: 13 }, (_, i) =>
			trailOf(`c${i}`, `Co ${i}`, i % 2 ? 'energy' : 'tech')
		);
		const colors = assignColors(many);
		expect(colors.get('c0')).toBe(`var(--series-${typeSlot('tech') + 1})`);
		expect(colors.get('c1')).toBe(`var(--series-${typeSlot('energy') + 1})`);
	});
});
