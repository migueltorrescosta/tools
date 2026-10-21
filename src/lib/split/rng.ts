import type { Rng } from './types';

/** Deterministic PRNG (mulberry32), for reproducible posterior draws and tests. */
export function seededRng(seed: number): Rng {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Fills `out` with standard normal draws (Box–Muller, both outputs used). */
export function fillGaussian(rng: Rng, out: Float64Array): void {
	for (let i = 0; i < out.length; i += 2) {
		const r = Math.sqrt(-2 * Math.log(rng() + 1e-300));
		const th = 2 * Math.PI * rng();
		out[i] = r * Math.cos(th);
		if (i + 1 < out.length) out[i + 1] = r * Math.sin(th);
	}
}
