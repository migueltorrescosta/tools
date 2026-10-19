/**
 * Fair MZI baseline (port of the Python `mzi_baseline`, `mzi_window_baseline`
 * and `mzi_detuned_window_baseline`): all n particles, input optimised by the
 * see-saw over the full space and over Sym, window t' ≤ t optimised, and,
 * when some channel isn't phase covariant, a static bias δ J_z^T optimised
 * with it. Standard inputs are each taken at their own best window.
 *
 * Search scheme. QFI(t', δ) is maximised by coordinate ascent: a 12-point
 * window grid then golden-section refinement around the best grid point
 * (as `mzi_window_baseline`), at δ = 0; when a bias is allowed, then a bias
 * grid {0, ±B/16, ±B/8, ±B/4, ±B/2, ±B} at that window with golden-section
 * refinement, then the window search again at the new bias, then a last bias
 * refinement. Search points use warm-started see-saws (NOON, product and the
 * previous optimum); the final window, and t' = 1, get the full multistart
 * (NOON, product, the Sym optimum and random inputs) with more iterations.
 */
import type { Prng } from '$lib/symbolic-regression/prng';
import type { Budget, MziResult, Readouts, Setup } from './types';
import { type CVec, outer, rectApply, vzeros } from './linalg';
import { buildMzi, kronAll, su2, type MziProblem } from './build';
import type { HoldMap } from './hold';
import { qfiOfState, randomState, seesaw, type SeesawResult } from './qfi';
import { symmetricBasis } from './register';
import { goldenSection, nelderMead } from './minimise';
import { maxReadouts, readouts } from './readouts';

export interface MziOptions {
	/** Window grid points. */
	nGrid?: number;
	/** See-saw iterations per search point. */
	searchIter?: number;
	/** See-saw iterations of the final evaluations. */
	preciseIter?: number;
	/** Random see-saw starts of the final evaluations (per space). */
	nRandom?: number;
	/** Golden-section tolerance on the window. */
	windowTol?: number;
	/** OAT (μ, θ) grid per axis before Nelder–Mead. */
	oatGrid?: number;
	readoutStarts?: number;
}

const popcount = (x: number) => {
	let c = 0;
	for (; x; x &= x - 1) c++;
	return c;
};

function applyQubitOp(u: ReturnType<typeof kronAll>, v: CVec): CVec {
	return rectApply({ rows: u.n, cols: u.n, re: u.re, im: u.im }, v);
}

/** Product |+⟩^n, NOON and twin-Fock (Dicke n/2 rotated by π/2 about x), qubit-space vectors. */
export function standardStates(n: number): { product: CVec; noon: CVec; twinFock: CVec } {
	const dim = 2 ** n;
	const product = vzeros(dim);
	product.re.fill(1 / Math.sqrt(dim));
	const noon = vzeros(dim);
	noon.re[0] = noon.re[dim - 1] = Math.SQRT1_2;
	const sym = symmetricBasis(n);
	const dicke = vzeros(dim);
	const m = Math.floor(n / 2);
	for (let i = 0; i < dim; i++) dicke.re[i] = sym.re[i * (n + 1) + m];
	const rx = kronAll(Array.from({ length: n }, () => su2([Math.PI / 2, 0, 0])));
	return { product, noon, twinFock: applyQubitOp(rx, dicke) };
}

/** One-axis twisted state exp(−i θ J_x) exp(−i μ J_z² / 2) |+⟩^n. */
export function oatState(n: number, mu: number, theta: number): CVec {
	const dim = 2 ** n;
	const v = vzeros(dim);
	const a = 1 / Math.sqrt(dim);
	for (let i = 0; i < dim; i++) {
		const jz = n / 2 - popcount(i);
		const phi = -0.5 * mu * jz * jz;
		v.re[i] = a * Math.cos(phi);
		v.im[i] = a * Math.sin(phi);
	}
	return applyQubitOp(kronAll(Array.from({ length: n }, () => su2([theta, 0, 0]))), v);
}

/** OAT with (μ, θ) optimised for the hold: grid over [0, π]² then Nelder–Mead. */
export function bestOat(
	hold: HoldMap,
	p: MziProblem,
	grid = 6
): { qfi: number; mu: number; theta: number } {
	const q = (x: number[]) => qfiOfState(hold, p.isoFull, oatState(p.n, x[0], x[1]));
	let best = { val: -Infinity, x: [0, 0] };
	for (let i = 0; i < grid; i++) {
		for (let j = 0; j < grid; j++) {
			const x = [(Math.PI * i) / (grid - 1), (Math.PI * j) / (grid - 1)];
			const v = q(x);
			if (v > best.val) best = { val: v, x };
		}
	}
	const res = nelderMead((x) => -q(x), best.x, { maxIter: 60, xatol: 1e-5, fatol: 1e-10 });
	const top = -res.f > best.val ? { val: -res.f, x: res.x } : best;
	return { qfi: top.val, mu: top.x[0], theta: top.x[1] };
}

/** ψ in the Dicke basis of Sym(n) → qubit space. */
function fromSym(n: number, psi: CVec): CVec {
	return rectApply(symmetricBasis(n), psi);
}

/** Qubit-space ψ → its Dicke-basis components (the vector need not be symmetric). */
function toSym(n: number, v: CVec): CVec {
	const sym = symmetricBasis(n);
	const out = vzeros(n + 1);
	for (let i = 0; i < sym.rows; i++) {
		for (let m = 0; m <= n; m++) {
			const w = sym.re[i * (n + 1) + m];
			out.re[m] += w * v.re[i];
			out.im[m] += w * v.im[i];
		}
	}
	return out;
}

function bestOf(rs: SeesawResult[]): SeesawResult {
	return rs.reduce((a, b) => (b.qfi > a.qfi ? b : a));
}

interface Point {
	window: number;
	bias: number;
	qfi: number;
	psi: CVec;
}

const now = () => performance.now();

/** The fair MZI baseline of a setup; `budget.steps` sets the Strang steps when the hold isn't exact. */
export function computeMzi(
	setup: Setup,
	budget: Pick<Budget, 'steps'>,
	prng: Prng,
	{
		nGrid = 12,
		searchIter = 100,
		preciseIter = 1000,
		nRandom = 2,
		windowTol = 1e-3,
		oatGrid = 6,
		readoutStarts = 4
	}: MziOptions = {}
): { result: MziResult; timings: Record<string, number> } {
	const t0 = now();
	const p = buildMzi(setup, budget.steps);
	const { n } = p;
	const std = standardStates(n);
	let warm: CVec | null = null;

	/** Full-space optimum at (t', δ), warm-started. */
	const search = (window: number, bias: number): Point => {
		const hold = p.hold(window, bias);
		const starts = [std.noon, std.product, ...(warm ? [warm] : [])];
		const best = bestOf(starts.map((s) => seesaw(hold, p.isoFull, s, searchIter, 1e-6)));
		warm = best.psi;
		return { window, bias, qfi: best.qfi, psi: best.psi };
	};

	const windowSearch = (bias: number): { best: Point; grid: number[] } => {
		const grid = Array.from({ length: nGrid }, (_, k) => (k + 1) / nGrid);
		const pts = grid.map((w) => search(w, bias));
		let best = pts.reduce((a, b) => (b.qfi > a.qfi ? b : a));
		if (best.window < 1) {
			const step = 1 / nGrid;
			let cand: Point = best;
			goldenSection(
				(w) => {
					const pt = search(w, bias);
					if (pt.qfi > cand.qfi) cand = pt;
					return -pt.qfi;
				},
				Math.max(best.window - step, 1e-3),
				Math.min(best.window + step, 1),
				windowTol
			);
			if (cand.qfi > best.qfi) best = cand;
		}
		return { best, grid };
	};

	const B = p.biasBound;
	const biasGrid = [0, 1 / 16, 1 / 8, 1 / 4, 1 / 2, 1].flatMap((f) =>
		f === 0 ? [0] : [f * B, -f * B]
	);
	/** Best bias at a window: optional grid, then golden section on the neighbouring grid cell. */
	const biasSearch = (window: number, around: Point | null): Point => {
		let best: Point = around ?? search(window, 0);
		if (!around) {
			for (const b of biasGrid) {
				if (b === 0) continue;
				const pt = search(window, b);
				if (pt.qfi > best.qfi) best = pt;
			}
		}
		const sorted = [...biasGrid].sort((a, b) => a - b);
		const i = sorted.indexOf(
			sorted.reduce((a, b) => (Math.abs(b - best.bias) < Math.abs(a - best.bias) ? b : a))
		);
		const lo = sorted[Math.max(0, i - 1)];
		const hi = sorted[Math.min(sorted.length - 1, i + 1)];
		let cand: Point = best;
		goldenSection(
			(b) => {
				const pt = search(window, b);
				if (pt.qfi > cand.qfi) cand = pt;
				return -pt.qfi;
			},
			Math.min(lo, best.bias),
			Math.max(hi, best.bias),
			1e-3 * Math.max(1, B)
		);
		return cand.qfi > best.qfi ? cand : best;
	};

	const timings: Record<string, number> = {};
	let { best, grid } = windowSearch(0);
	if (p.biasAllowed) {
		const b1 = biasSearch(best.window, null);
		const w2 = windowSearch(b1.bias);
		best = w2.best.qfi >= b1.qfi ? w2.best : b1;
		grid = w2.grid;
		best = biasSearch(best.window, best);
	}
	timings.search = now() - t0;

	/** Converged optimum at (t', δ): Sym multistart, then full multistart including the Sym optimum. */
	const precise = (window: number, bias: number, extra: CVec[]) => {
		const hold = p.hold(window, bias);
		const symStarts = [
			toSym(n, std.noon),
			toSym(n, std.product),
			...Array.from({ length: nRandom }, () => randomState(n + 1, prng))
		];
		const sym = bestOf(symStarts.map((s) => seesaw(hold, p.isoSym, s, preciseIter)));
		const fullStarts = [
			std.noon,
			std.product,
			fromSym(n, sym.psi),
			...extra,
			...Array.from({ length: nRandom }, () => randomState(2 ** n, prng))
		];
		const full = bestOf(fullStarts.map((s) => seesaw(hold, p.isoFull, s, preciseIter)));
		const psi = full.qfi >= sym.qfi ? full.psi : fromSym(n, sym.psi);
		return { hold, sym: sym.qfi, full: Math.max(full.qfi, sym.qfi), psi };
	};

	const opt = precise(best.window, best.bias, [best.psi]);
	timings.precise = now() - t0 - timings.search;
	let fixed = opt.full;
	let fixedBias = best.bias;
	if (best.window !== 1) {
		let at1: Point = search(1, best.bias);
		if (p.biasAllowed) at1 = biasSearch(1, null);
		fixed = precise(1, at1.bias, [at1.psi]).full;
		fixedBias = at1.bias;
	}
	timings.fixed = now() - t0 - timings.search - timings.precise;

	// Standard states, each at its own best window on the grid (at the chosen bias)
	const standard = { product: 0, noon: 0, twinFock: 0, oat: 0 };
	for (const w of grid) {
		const hold = p.hold(w, best.bias);
		standard.product = Math.max(standard.product, qfiOfState(hold, p.isoFull, std.product));
		standard.noon = Math.max(standard.noon, qfiOfState(hold, p.isoFull, std.noon));
		standard.twinFock = Math.max(standard.twinFock, qfiOfState(hold, p.isoFull, std.twinFock));
		standard.oat = Math.max(standard.oat, bestOat(hold, p, oatGrid).qfi);
	}
	timings.standard = now() - t0 - timings.search - timings.precise - timings.fixed;

	// Readouts at both candidate windows (the chosen one is not known yet): the
	// best over the standard inputs and the optimum
	const holds = best.window === 1 ? [opt.hold] : [opt.hold, p.hold(1, fixedBias)];
	let ro: Readouts | null = null;
	for (const hold of holds) {
		const oat = bestOat(hold, p, oatGrid);
		const states = [std.product, std.noon, std.twinFock, oatState(n, oat.mu, oat.theta), opt.psi];
		for (const s of states) {
			const { rho, drho } = hold.forward(outer(rectApply(p.isoFull, s)));
			const r = readouts(rho, drho, n, 0, prng, readoutStarts);
			ro = ro ? maxReadouts(ro, r) : r;
		}
	}
	timings.readouts =
		now() - t0 - timings.search - timings.precise - timings.fixed - timings.standard;
	timings.total = now() - t0;

	// t' = 1 is a window too: keep it when its converged optimum is higher
	const atOpt = opt.full >= fixed;
	const result: MziResult = {
		particles: n,
		qfiOpt: atOpt ? opt.full : fixed,
		qfiSym: opt.sym,
		window: atOpt ? best.window : 1,
		bias: atOpt ? best.bias : fixedBias,
		qfiFixedWindow: fixed,
		standard,
		readouts: ro as Readouts
	};
	return { result, timings };
}
