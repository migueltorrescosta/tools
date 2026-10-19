/** Small derivative-free minimisers: Nelder–Mead and golden-section search. */

export interface NelderMeadOptions {
	maxIter?: number;
	xatol?: number;
	fatol?: number;
}

/** Nelder–Mead (standard coefficients, scipy's initial simplex and stopping rule). */
export function nelderMead(
	f: (x: number[]) => number,
	x0: readonly number[],
	{ maxIter = 200 * x0.length, xatol = 1e-4, fatol = 1e-4 }: NelderMeadOptions = {}
): { x: number[]; f: number; evaluations: number } {
	const n = x0.length;
	let evaluations = 0;
	const ev = (x: number[]) => {
		evaluations++;
		return f(x);
	};
	const pts: number[][] = [x0.slice()];
	for (let i = 0; i < n; i++) {
		const p = x0.slice();
		p[i] = p[i] !== 0 ? 1.05 * p[i] : 0.00025;
		pts.push(p);
	}
	let vals = pts.map(ev);
	for (let it = 0; it < maxIter; it++) {
		const order = vals.map((_, i) => i).sort((a, b) => vals[a] - vals[b]);
		const sp = order.map((i) => pts[i]);
		const sv = order.map((i) => vals[i]);
		pts.splice(0, pts.length, ...sp);
		vals = sv;
		let xs = 0;
		let fs = 0;
		for (let i = 1; i <= n; i++) {
			fs = Math.max(fs, Math.abs(vals[i] - vals[0]));
			for (let j = 0; j < n; j++) xs = Math.max(xs, Math.abs(pts[i][j] - pts[0][j]));
		}
		if (xs <= xatol && fs <= fatol) break;
		const c = new Array<number>(n).fill(0);
		for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += pts[i][j] / n;
		const worst = pts[n];
		const along = (t: number) => c.map((cj, j) => cj + t * (worst[j] - cj));
		const xr = along(-1);
		const fr = ev(xr);
		if (fr < vals[0]) {
			const xe = along(-2);
			const fe = ev(xe);
			if (fe < fr) [pts[n], vals[n]] = [xe, fe];
			else [pts[n], vals[n]] = [xr, fr];
		} else if (fr < vals[n - 1]) {
			[pts[n], vals[n]] = [xr, fr];
		} else {
			const outside = fr < vals[n];
			const xc = along(outside ? -0.5 : 0.5);
			const fc = ev(xc);
			if (fc < (outside ? fr : vals[n])) {
				[pts[n], vals[n]] = [xc, fc];
			} else {
				for (let i = 1; i <= n; i++) {
					pts[i] = pts[i].map((v, j) => pts[0][j] + 0.5 * (v - pts[0][j]));
					vals[i] = ev(pts[i]);
				}
			}
		}
	}
	let best = 0;
	for (let i = 1; i <= n; i++) if (vals[i] < vals[best]) best = i;
	return { x: pts[best], f: vals[best], evaluations };
}

/** Golden-section search for a minimum of f on [a, b]. */
export function goldenSection(
	f: (x: number) => number,
	a: number,
	b: number,
	xatol = 1e-4
): { x: number; f: number } {
	const r = (Math.sqrt(5) - 1) / 2;
	let c = b - r * (b - a);
	let d = a + r * (b - a);
	let fc = f(c);
	let fd = f(d);
	while (b - a > xatol) {
		if (fc < fd) {
			b = d;
			d = c;
			fd = fc;
			c = b - r * (b - a);
			fc = f(c);
		} else {
			a = c;
			c = d;
			fc = fd;
			d = a + r * (b - a);
			fd = f(d);
		}
	}
	return fc < fd ? { x: c, f: fc } : { x: d, f: fd };
}
