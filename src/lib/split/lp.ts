/**
 * Small dense linear-programming solver: two-phase tableau simplex with
 * Bland's rule (no cycling). Maximises cᵀx subject to linear constraints and
 * x ≥ 0. Meant for tens of variables and a few hundred rows.
 */

export type Op = '<=' | '>=' | '=';

export interface Constraint {
	coeffs: readonly number[];
	op: Op;
	rhs: number;
}

export type LpResult =
	| { status: 'optimal'; x: number[]; value: number }
	| { status: 'infeasible' }
	| { status: 'unbounded' };

const EPS = 1e-9;

export function maximize(c: readonly number[], constraints: readonly Constraint[]): LpResult {
	const nv = c.length;
	const rows = constraints.map((k) => {
		const flip = k.rhs < 0;
		const op: Op = flip ? (k.op === '<=' ? '>=' : k.op === '>=' ? '<=' : '=') : k.op;
		const coeffs = Array.from({ length: nv }, (_, j) => (flip ? -1 : 1) * (k.coeffs[j] ?? 0));
		return { coeffs, op, rhs: flip ? -k.rhs : k.rhs };
	});
	const ns = rows.filter((r) => r.op !== '=').length;
	const na = rows.filter((r) => r.op !== '<=').length;
	const nc = nv + ns + na; // column nc holds the right-hand side
	const t: number[][] = [];
	const basis: number[] = [];
	let si = nv;
	let ai = nv + ns;
	for (const r of rows) {
		const row = Array<number>(nc + 1).fill(0);
		r.coeffs.forEach((v, j) => (row[j] = v));
		row[nc] = r.rhs;
		if (r.op === '<=') {
			row[si] = 1;
			basis.push(si++);
		} else {
			if (r.op === '>=') row[si++] = -1;
			row[ai] = 1;
			basis.push(ai++);
		}
		t.push(row);
	}
	const scale = Math.max(1, ...rows.map((r) => r.rhs));

	const pivot = (r: number, col: number, d: number[]) => {
		const pr = t[r];
		const inv = 1 / pr[col];
		for (let j = 0; j <= nc; j++) pr[j] *= inv;
		for (const row of [...t, d]) {
			if (row === pr) continue;
			const f = row[col];
			if (f === 0) continue;
			for (let j = 0; j <= nc; j++) row[j] -= f * pr[j];
		}
		basis[r] = col;
	};

	/** Reduced-cost row for costs `cost` given the current basis: d_j = c_j − c_Bᵀ T_j. */
	const reduced = (cost: number[]) => {
		const d = [...cost, 0];
		t.forEach((row, r) => {
			const cb = cost[basis[r]];
			if (cb !== 0) for (let j = 0; j <= nc; j++) d[j] -= cb * row[j];
		});
		return d;
	};

	/** Runs simplex iterations over columns < `limit`; false if unbounded. */
	const run = (d: number[], limit: number): boolean => {
		for (;;) {
			let col = -1;
			for (let j = 0; j < limit; j++)
				if (d[j] > EPS) {
					col = j;
					break;
				}
			if (col < 0) return true;
			let r = -1;
			let best = Infinity;
			for (let i = 0; i < t.length; i++) {
				const a = t[i][col];
				if (a <= EPS) continue;
				const ratio = t[i][nc] / a;
				if (ratio < best - EPS || (Math.abs(ratio - best) <= EPS && basis[i] < basis[r])) {
					best = ratio;
					r = i;
				}
			}
			if (r < 0) return false;
			pivot(r, col, d);
		}
	};

	if (na > 0) {
		const cost1 = Array.from({ length: nc }, (_, j) => (j >= nv + ns ? -1 : 0));
		const d1 = reduced(cost1);
		run(d1, nc);
		const infeas = t.reduce((s, row, r) => s + (basis[r] >= nv + ns ? row[nc] : 0), 0);
		if (infeas > EPS * scale) return { status: 'infeasible' };
		// Drive artificials left in the basis (at level 0) out, or drop redundant rows.
		for (let r = t.length - 1; r >= 0; r--) {
			if (basis[r] < nv + ns) continue;
			let col = -1;
			for (let j = 0; j < nv + ns; j++)
				if (Math.abs(t[r][j]) > EPS) {
					col = j;
					break;
				}
			if (col >= 0) pivot(r, col, d1);
			else {
				t.splice(r, 1);
				basis.splice(r, 1);
			}
		}
	}
	const cost2 = Array.from({ length: nc }, (_, j) => (j < nv ? c[j] : 0));
	const d2 = reduced(cost2);
	if (!run(d2, nv + ns)) return { status: 'unbounded' };
	const x = Array<number>(nv).fill(0);
	t.forEach((row, r) => {
		if (basis[r] < nv) x[basis[r]] = row[nc];
	});
	return { status: 'optimal', x, value: x.reduce((s, v, j) => s + v * c[j], 0) };
}
