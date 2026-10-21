import { describe, it, expect } from 'vitest';
import {
	bestFallback,
	initState,
	isCertified,
	propose,
	recordRound,
	roundCap,
	transfersFor
} from './engine';
import { Prng } from '$lib/prng';

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

/** LPT oracle: items by descending price, each to the lowest-valued group (lowest index on ties). */
function lpt(prices: readonly number[], n: number): number[][] {
	const groups = Array.from({ length: n }, () => [] as number[]);
	const vals = Array<number>(n).fill(0);
	const order = prices.map((_, k) => k).sort((a, b) => prices[b] - prices[a]);
	for (const k of order) {
		const g = vals.indexOf(Math.min(...vals));
		groups[g].push(k);
		vals[g] += prices[k];
	}
	return groups;
}

describe('split engine: first proposal', () => {
	it('equals LPT grouping, group b owned by person b, for random prices', () => {
		const prng = new Prng(3);
		const rng = () => prng.next();
		for (let trial = 0; trial < 40; trial++) {
			const n = 2 + Math.floor(rng() * 5);
			const prices = Array.from({ length: 1 + Math.floor(rng() * 12) }, () =>
				rng() < 0.3 ? 100 : Math.round(1 + rng() * 10000)
			);
			const p = propose(initState(prices, n));
			expect(p.groups).toEqual(lpt(prices, n));
			expect(p.owners).toEqual(Array.from({ length: n }, (_, i) => i));
			expect(Math.abs(sum(p.transfers))).toBeLessThan(1e-6 * sum(prices));
		}
	});

	it('splits Car 10000 and House 50000 with transfers ±20000', () => {
		const p = propose(initState([10000, 50000], 2));
		expect(p.groups).toEqual([[1], [0]]);
		expect(p.transfers[0]).toBeCloseTo(20000, 3);
		expect(p.transfers[1]).toBeCloseTo(-20000, 3);
	});
});

describe('split engine: rules', () => {
	it('certifies only permutations', () => {
		expect(isCertified([1, 0, 2], 3)).toBe(true);
		expect(isCertified([0, 0, 2], 3)).toBe(false);
		expect(isCertified([0, 1], 3)).toBe(false);
		expect(isCertified([0, 3, 1], 3)).toBe(false);
	});

	it('caps rounds at 2⌈m/n⌉ + 3', () => {
		expect(roundCap(4, 2)).toBe(7);
		expect(roundCap(20, 5)).toBe(11);
		expect(roundCap(10, 4)).toBe(9);
	});

	it('rejects groups that do not partition the items, and owners that are not a permutation', () => {
		const s = initState([10, 20, 30], 2);
		const p = propose(s);
		expect(() => recordRound(s, { ...p, groups: [[0], [1]] }, [0, 1])).toThrow();
		expect(() =>
			transfersFor(
				s,
				[
					[0, 1],
					[1, 2]
				],
				[0, 1]
			)
		).toThrow();
		expect(() => transfersFor(s, p.groups, [0, 0])).toThrow();
	});

	it('does not mutate the state or the proposal it records', () => {
		const s = initState([100, 200, 300], 2);
		const p = propose(s);
		const copy = JSON.parse(JSON.stringify(p));
		const next = recordRound(s, p, [0, 0]);
		expect(p).toEqual(copy);
		expect(s.rounds).toHaveLength(0);
		expect(next.rounds).toHaveLength(1);
		expect(propose(s)).toBe(p);
	});

	it('is deterministic', () => {
		const run = () => {
			let s = initState([300, 200, 100, 50], 3);
			for (let r = 0; r < 3; r++) s = recordRound(s, propose(s), [0, 0, 1]);
			return { p: propose(s), fb: bestFallback(s) };
		};
		expect(run()).toEqual(run());
	});
});

describe('split engine: learning', () => {
	const prices = [200000, 15000, 5000, 1000];

	it('gives the House to the person who keeps taking it at rising transfers', () => {
		let s = initState(prices, 3);
		for (let r = 0; r < 8; r++) {
			const p = propose(s);
			const house = p.groups.findIndex((g) => g.includes(0));
			s = recordRound(s, p, [house, (house + 1) % 3, (house + 1) % 3]);
		}
		expect(propose(s).groups[0]).toContain(0);
	});

	it('raises the price of a group both people keep picking', () => {
		let s = initState(prices, 2);
		let last = 0;
		for (let r = 0; r < 8; r++) {
			const p = propose(s);
			expect(p.transfers[0]).toBeGreaterThan(last);
			last = p.transfers[0];
			s = recordRound(s, p, [0, 0]);
		}
	});

	it('gains fairness while everyone keeps picking their own group', () => {
		let s = initState(prices, 3);
		let p = propose(s);
		const pFair: number[] = [];
		for (let r = 0; r < 8; r++) {
			s = recordRound(s, p, [0, 1, 2]);
			p = propose(s);
			pFair.push(bestFallback(s).pFair);
		}
		expect(pFair[7]).toBeGreaterThan(pFair[0] + 0.3);
		expect(pFair[7]).toBeGreaterThan(0.5);
		expect(bestFallback(s).residualEnvy).toBeGreaterThanOrEqual(0);
	});
});

/** Dense inverse by Gauss–Jordan with partial pivoting. */
function inverse(a: number[][]): number[][] {
	const n = a.length;
	const t = a.map((r, i) => [...r, ...r.map((_, j) => (i === j ? 1 : 0))]);
	for (let i = 0; i < n; i++) {
		let p = i;
		for (let r = i + 1; r < n; r++) if (Math.abs(t[r][i]) > Math.abs(t[p][i])) p = r;
		[t[i], t[p]] = [t[p], t[i]];
		const d = t[i][i];
		for (let j = 0; j < 2 * n; j++) t[i][j] /= d;
		for (let r = 0; r < n; r++)
			if (r !== i) {
				const f = t[r][i];
				for (let j = 0; j < 2 * n; j++) t[r][j] -= f * t[i][j];
			}
	}
	return t.map((r) => r.slice(n));
}

describe('split engine: Start claims', () => {
	const prices = [4000, 3000, 2000, 1000];

	it('learns nothing from items claimed by nobody or by everyone', () => {
		const plain = propose(initState(prices, 3));
		expect(propose(initState(prices, 3, [[], [], [], []]))).toEqual(plain);
		const all = [0, 1, 2];
		expect(propose(initState(prices, 3, [all, all, all, all]))).toEqual(plain);
	});

	it('gives singly claimed items to their claimant in round 1', () => {
		const claims = [[1], [0], [1], []];
		const p = propose(initState(prices, 2, claims));
		claims.forEach((who, k) => {
			if (who.length === 1) expect(p.groups[who[0]]).toContain(k);
		});
	});

	it('gives a jointly claimed item to one of its claimants in round 1', () => {
		for (const claims of [
			[[1, 2], [], [], []],
			[[], [0, 2], [], []],
			[[0, 1], [0, 1], [2], []]
		]) {
			const p = propose(initState(prices, 3, claims));
			claims.forEach((who, k) => {
				if (who.length === 0) return;
				const owner = p.owners[p.groups.findIndex((g) => g.includes(k))];
				expect(who).toContain(owner);
			});
		}
	});

	it('lets round picks override a claim', () => {
		let s = initState(prices, 2, [[0], [], [], []]);
		let owner = -1;
		for (let r = 0; r < 4; r++) {
			const p = propose(s);
			const g = p.groups.findIndex((items) => items.includes(0));
			owner = p.owners[g];
			s = recordRound(s, p, [1 - g, g]); // person 1 keeps taking the item
		}
		expect(owner).toBe(1);
	});

	// No rounds: P = prior precision + the Start curvature (λ_S²/4 per
	// claimant/non-claimant pair), plus, when both sides have ≥ 2 people, the
	// bound c(α² − 1)(|X| diag 1_X − 1_X 1_Xᵀ) on the smaller side X (C on a
	// tie). Compare the covariance rebuilt from the fit's factors with a
	// dense inverse of that P.
	const cases = [
		{ n: 3, claims: [[0], [0, 2], [], [1]], bounded: false },
		{ n: 4, claims: [[0, 1], [2], [0, 1, 2], []], bounded: true }
	];
	for (const { n, claims, bounded } of cases)
		it(`keeps the Laplace covariance exact for the Woodbury form (n=${n}${bounded ? ', with a 2–2 claim' : ''})`, () => {
			const m = prices.length;
			// The engine's settings: σμ = 0.3, τ = 0.4, λ_S = 2.
			const params = { sigmaMu: 0.3, tau: 0.4, lambdaStart: 2 };
			const s = initState(prices, n, claims) as unknown as {
				fit: { ut: Float64Array[]; ls: Float64Array; scale: Float64Array };
			};
			const tau2 = params.tau ** 2;
			const mu2 = params.sigmaMu ** 2;
			const c = mu2 / (tau2 * (tau2 + n * mu2));
			const a = params.lambdaStart ** 2 / 4;
			const alpha = 1 + a / c;
			const N = n * m;
			const P = Array.from({ length: N }, () => Array<number>(N).fill(0));
			for (let i = 0; i < n; i++)
				for (let j = 0; j < n; j++)
					for (let k = 0; k < m; k++) P[i * m + k][j * m + k] += (i === j ? 1 / tau2 : 0) - c;
			claims.forEach((who, k) => {
				const others = [...Array(n).keys()].filter((j) => !who.includes(j));
				for (const i of who)
					for (const j of others) {
						P[i * m + k][i * m + k] += a;
						P[j * m + k][j * m + k] += a;
						P[i * m + k][j * m + k] -= a;
						P[j * m + k][i * m + k] -= a;
					}
				const x = who.length <= others.length ? who : others;
				if (x.length >= 2 && others.length > 0 && who.length > 0)
					for (const i of x)
						for (const j of x)
							P[i * m + k][j * m + k] += c * (alpha * alpha - 1) * ((i === j ? x.length : 0) - 1);
			});
			const cov = inverse(P);
			const { ut, ls, scale } = s.fit;
			const gram = (u: Float64Array) =>
				Array.from({ length: m }, (_, r) =>
					Array.from({ length: m }, (_, q) => {
						let t = 0;
						for (let k = 0; k < m; k++) t += u[r * m + k] * u[q * m + k];
						return t;
					})
				);
			const eInv = ut.map(gram);
			const sInv = inverse(gram(ls));
			let err = 0;
			for (let i = 0; i < n; i++)
				for (let j = 0; j < n; j++)
					for (let r = 0; r < m; r++)
						for (let q = 0; q < m; q++) {
							let v = i === j ? eInv[i][r][q] : 0;
							for (let k = 0; k < m; k++)
								for (let l = 0; l < m; l++)
									v +=
										eInv[i][r][k] *
										scale[i * m + k] *
										sInv[k][l] *
										scale[j * m + l] *
										eInv[j][l][q];
							err = Math.max(err, Math.abs(v - cov[i * m + r][j * m + q]));
						}
			expect(err).toBeLessThan(1e-12);
		});
});

describe('split engine: transfersFor', () => {
	it('keeps the groups in the order given, with transfers summing to 0', () => {
		const s = initState([500, 300, 200, 100], 2);
		const groups = [
			[3, 0],
			[1, 2]
		];
		const p = transfersFor(s, groups, [1, 0]);
		expect(p.groups).toEqual(groups);
		expect(p.owners).toEqual([1, 0]);
		expect(Math.abs(sum(p.transfers))).toBeLessThan(1e-6);
		// At the prior both groups are worth their prices: 600 vs 500, so ±50.
		expect(p.transfers[0]).toBeCloseTo(50, 6);
	});
});
