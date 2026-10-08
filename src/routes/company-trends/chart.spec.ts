import { describe, it, expect } from 'vitest';
import {
	assignColors,
	buildTrail,
	clampMargin,
	colorMode,
	drawTrail,
	formatMoney,
	formatPercent,
	HIT_RADIUS,
	latestUpTo,
	linearScale,
	logExtent,
	logScale,
	logTicks,
	MARGIN_DOMAIN,
	nearestHit,
	PALETTE_SIZE,
	percentTicks,
	pointSources,
	resolveHit,
	REVENUE_FLOOR,
	revenueDomain,
	tooltipPlacement,
	trailSegments,
	trailUpTo,
	typeSlot,
	TYPE_ORDER,
	type Trail,
	type TrailPoint
} from '$lib/company-trends/chart';
import type { FxTable } from '$lib/company-trends/fx';
import type { Company } from '$lib/company-trends/schema';
import { DEFAULT_COMPANY_IDS } from '$lib/company-trends/filter';
import { quarterRange, type CompanyPoint } from '$lib/company-trends/series';
import bundled from './data/companies.json';

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

describe('latestUpTo (table rows)', () => {
	const trail = buildTrail(company, quarters, 'EUR', fx);

	it('picks the latest point at or before the quarter', () => {
		expect(latestUpTo(trail, 5)?.quarter).toBe('2001Q2');
		expect(latestUpTo(trail, 3)?.quarter).toBe('2000Q4');
	});

	it('keeps a company whose data ended before the quarter at its last point', () => {
		expect(latestUpTo(trail, 40)?.quarter).toBe('2003Q4');
	});

	it('leaves out a company that has not started yet', () => {
		expect(latestUpTo(trail, 2)).toBeUndefined();
	});
});

describe('drawTrail', () => {
	const x = (v: number) => v;
	const y = (v: number) => v;

	it('breaks the line at a zero-revenue anchor between drawable ones', () => {
		const zeroMid = buildTrail(
			{
				...company,
				points: [anchor('2000Q4', 100, 10), anchor('2001Q4', 0, -5), anchor('2002Q4', 300, 30)]
			},
			quarters,
			'EUR',
			fx
		);
		const d = drawTrail(zeroMid, 15);
		expect(d.path.some((p) => p.quarter === '2001Q4')).toBe(true);
		expect(d.points.some((p) => p.quarter === '2001Q4')).toBe(false);
		const segs = trailSegments(d.path, x, y);
		expect(segs).toHaveLength(2);
		expect(segs.every((s) => s.kind === 'solid')).toBe(true);
		expect(d.head?.quarter).toBe('2002Q4');
	});

	it('marks a trail ended only once the quarter is past its last point', () => {
		const trail = buildTrail(company, quarters, 'EUR', fx);
		expect(drawTrail(trail, 15).ended).toBe(false);
		expect(drawTrail(trail, 16).ended).toBe(true);
		expect(drawTrail(trail, 16).head?.quarter).toBe('2003Q4');
	});

	it('has no head before the first point', () => {
		const d = drawTrail(buildTrail(company, quarters, 'EUR', fx), 2);
		expect(d.points).toEqual([]);
		expect(d.head).toBeNull();
		expect(d.ended).toBe(false);
	});
});

describe('nearestHit', () => {
	const ident = (v: number) => v;
	const trail = buildTrail(company, quarters, 'EUR', fx);
	const at = (
		quarter: string,
		revenue: number,
		margin: number,
		quality: TrailPoint['quality']
	): TrailPoint => ({
		quarter,
		qi: 0,
		revenue,
		expenses: 0,
		operatingIncome: 0,
		margin,
		quality,
		gap: false
	});

	it('prefers an anchor over an interpolated point at equal distance, in either order', () => {
		const interp = at('2001Q1', 10, 0, 'interpolated');
		const anchorPt = at('2001Q4', 20, 0, 'reported');
		const head = at('2003Q4', 1000, 0, 'reported');
		for (const points of [
			[interp, anchorPt, head],
			[anchorPt, interp, head]
		]) {
			expect(nearestHit([{ trail, points, head }], 15, 0, ident, ident)?.point).toBe(anchorPt);
		}
	});

	it('treats an interpolated head like an anchor', () => {
		const interp = at('2001Q1', 10, 0, 'interpolated');
		const head = at('2001Q2', 20, 0, 'interpolated');
		expect(nearestHit([{ trail, points: [interp, head], head }], 15, 0, ident, ident)?.point).toBe(
			head
		);
	});

	it('still picks a clearly closer interpolated point over an anchor', () => {
		const interp = at('2001Q1', 10, 0, 'interpolated');
		const anchorPt = at('2001Q4', 20, 0, 'reported');
		const hit = nearestHit(
			[{ trail, points: [anchorPt, interp], head: null }],
			13,
			0,
			ident,
			ident
		);
		expect(hit?.point).toBe(interp);
	});

	it('returns null beyond the hit radius', () => {
		const p = at('2001Q4', 0, 0, 'reported');
		const drawn = [{ trail, points: [p], head: p }];
		expect(nearestHit(drawn, HIT_RADIUS - 0.5, 0, ident, ident)?.point).toBe(p);
		expect(nearestHit(drawn, HIT_RADIUS, 0, ident, ident)).toBeNull();
	});

	it('hit-tests off-scale margins where they are drawn, pinned to the axis edge', () => {
		const p = at('2001Q4', 0, -9, 'reported');
		expect(nearestHit([{ trail, points: [p], head: p }], 0, -2, ident, ident)?.point).toBe(p);
	});
});

describe('tooltipPlacement', () => {
	it('positions in percent and flips away from the right and bottom edges', () => {
		expect(tooltipPlacement(100, 100, 1000, 500)).toEqual({
			left: 10,
			top: 20,
			flipX: false,
			flipY: false
		});
		expect(tooltipPlacement(600, 275, 1000, 500)).toMatchObject({ flipX: false, flipY: false });
		expect(tooltipPlacement(601, 276, 1000, 500)).toMatchObject({ flipX: true, flipY: true });
	});
});

describe('revenueDomain', () => {
	it('raises the lower bound to the floor and keeps at least one decade', () => {
		expect(revenueDomain([0.05, 38, 600000])).toEqual([REVENUE_FLOOR, 1e6]);
		expect(revenueDomain([0.05, 2])).toEqual([REVENUE_FLOOR, 100]);
		expect(revenueDomain([250, 7200])).toEqual([100, 10000]);
		expect(revenueDomain([0, -1])).toBeNull();
	});

	it('keeps Tesla FY2007 from stretching the default selection axis', () => {
		const qs = quarterRange('2000Q1', '2026Q4');
		const defaults = (bundled.companies as unknown as Company[]).filter((c) =>
			DEFAULT_COMPANY_IDS.includes(c.id)
		);
		expect(defaults.map((c) => c.id)).toContain('tesla');
		for (const currency of ['EUR', 'USD', 'GBP'] as const) {
			const trails = defaults.map((c) => buildTrail(c, qs, currency, bundled.fx as FxTable));
			const values = trails.flatMap((t) => t.points.map((p) => p.revenue));
			// Unfloored, Tesla's USD 0.073m filing pulls the axis down to 0.01
			expect(logExtent(values)![0]).toBeLessThan(0.1);
			expect(revenueDomain(values)).toEqual([10, 1e6]);
		}
	});
});

describe('pointSources', () => {
	const trail = buildTrail(company, quarters, 'EUR', fx);
	const at = (q: string) => trail.points.find((p) => p.quarter === q)!;

	it('cites the anchor itself', () => {
		expect(pointSources(trail, at('2001Q4'))).toEqual([
			{ quarter: '2001Q4', source: 'report 2001Q4', sourceUrl: 'https://example.com/2001Q4' }
		]);
	});

	it('cites both bracketing anchors of an interpolated point', () => {
		expect(pointSources(trail, at('2002Q2')).map((s) => s.sourceUrl)).toEqual([
			'https://example.com/2001Q4',
			'https://example.com/2003Q4'
		]);
	});
});

describe('resolveHit', () => {
	const drawnAt = (currency: 'EUR' | 'USD', qi: number, companies = [company]) =>
		companies.map((c) => {
			const trail = buildTrail(c, quarters, currency, fx);
			return { trail, points: trailUpTo(trail, qi) };
		});
	const sel = { companyId: 'acme', quarter: '2000Q4' };

	it('re-resolves a selection in the new currency', () => {
		const eur = resolveHit(drawnAt('EUR', 15), sel)!;
		const usd = resolveHit(drawnAt('USD', 15), sel)!;
		expect(eur.point.revenue).toBe(100);
		expect(usd.point.revenue).toBeCloseTo(215, 10);
		expect(usd.point.quarter).toBe('2000Q4');
		expect(usd.trail.company.id).toBe('acme');
	});

	it('returns null when the company is no longer drawn', () => {
		expect(resolveHit(drawnAt('EUR', 15, []), sel)).toBeNull();
	});

	it('returns null when the current quarter is before the selection', () => {
		expect(resolveHit(drawnAt('EUR', 2), sel)).toBeNull();
		expect(resolveHit(drawnAt('EUR', 3), sel)?.point.quarter).toBe('2000Q4');
	});

	it('returns null without a selection or for an unknown quarter', () => {
		expect(resolveHit(drawnAt('EUR', 15), null)).toBeNull();
		expect(resolveHit(drawnAt('EUR', 15), { companyId: 'acme', quarter: '1999Q4' })).toBeNull();
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

	it('promotes the unit when rounding carries to 1000', () => {
		expect(formatMoney(999.6, 'EUR')).toBe('€1B');
		expect(formatMoney(999_960, 'USD')).toBe('$1T');
		expect(formatMoney(-999.6, 'GBP')).toBe('−£1B');
		expect(formatMoney(999.4, 'EUR')).toBe('€999M');
		expect(formatMoney(99.996, 'EUR')).toBe('€100M');
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
		const { colors } = assignColors(tech);
		expect(new Set(colors.values()).size).toBe(11);
		expect(colors.get('c10')).toBe('var(--cseries-1)');
		expect(colors.get('c0')).toBe('var(--cseries-11)');
	});

	it('is deterministic regardless of input order', () => {
		const a = [trailOf('a', 'Alpha', 'tech'), trailOf('b', 'Beta', 'energy')];
		expect(assignColors(a).colors).toEqual(assignColors([...a].reverse()).colors);
	});

	it('falls back to industry slots beyond the palette size', () => {
		const many = Array.from({ length: 13 }, (_, i) =>
			trailOf(`c${i}`, `Co ${i}`, i % 2 ? 'energy' : 'tech')
		);
		const { colors } = assignColors(many);
		expect(colors.get('c0')).toBe(`var(--series-${typeSlot('tech') + 1})`);
		expect(colors.get('c1')).toBe(`var(--series-${typeSlot('energy') + 1})`);
	});

	it('keeps existing colours when a company is added or removed', () => {
		const base = [
			trailOf('b', 'Beta', 'tech'),
			trailOf('d', 'Delta', 'tech'),
			trailOf('f', 'Foxtrot', 'tech')
		];
		const first = assignColors(base);
		// "Alpha" sorts first: by name rank it would push every other company down a slot.
		const added = assignColors([trailOf('a', 'Alpha', 'tech'), ...base], first.slots);
		for (const t of base)
			expect(added.colors.get(t.company.id)).toBe(first.colors.get(t.company.id));
		expect(added.colors.get('a')).toBe('var(--cseries-4)');

		// Removing Delta frees its slot for the next newcomer; the others stay put.
		const removed = assignColors(
			[
				trailOf('a', 'Alpha', 'tech'),
				trailOf('b', 'Beta', 'tech'),
				trailOf('f', 'Foxtrot', 'tech')
			],
			added.slots
		);
		expect(removed.colors.get('a')).toBe(added.colors.get('a'));
		expect(removed.colors.get('f')).toBe(added.colors.get('f'));
		const readded = assignColors(
			[...base, trailOf('a', 'Alpha', 'tech'), trailOf('c', 'Charlie', 'tech')],
			removed.slots
		);
		expect(readded.colors.get('c')).toBe(first.colors.get('d'));
		expect(readded.colors.get('d')).toBe('var(--cseries-5)');
	});

	it('remembers company slots across an industry-coloured interlude', () => {
		const few = [trailOf('b', 'Beta', 'tech'), trailOf('z', 'Zulu', 'tech')];
		const first = assignColors(few);
		const many = Array.from({ length: 13 }, (_, i) => trailOf(`c${i}`, `Aa ${i}`, 'tech'));
		const industry = assignColors([...few, ...many], first.slots);
		expect(industry.colors.get('b')).toBe(`var(--series-${typeSlot('tech') + 1})`);
		const back = assignColors([trailOf('a', 'Alpha', 'tech'), ...few], industry.slots);
		expect(back.colors.get('b')).toBe(first.colors.get('b'));
		expect(back.colors.get('z')).toBe(first.colors.get('z'));
	});
});
