/** Radix-2 FFT and the linear convolution built on it. No DOM or Svelte imports. */

/** Smallest power of two ≥ n (n ≥ 1). */
export function nextPow2(n: number): number {
	let p = 1;
	while (p < n) p *= 2;
	return p;
}

/**
 * In-place iterative FFT of `re + i·im` (length a power of two).
 * `inverse` computes the unscaled inverse transform; divide by the length afterwards.
 */
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
	const n = re.length;
	if (n !== im.length || (n & (n - 1)) !== 0) throw new Error('FFT length must be a power of two');
	for (let i = 1, j = 0; i < n; i++) {
		let bit = n >> 1;
		for (; j & bit; bit >>= 1) j ^= bit;
		j ^= bit;
		if (i < j) {
			[re[i], re[j]] = [re[j], re[i]];
			[im[i], im[j]] = [im[j], im[i]];
		}
	}
	const sign = inverse ? 1 : -1;
	for (let len = 2; len <= n; len *= 2) {
		const ang = (sign * 2 * Math.PI) / len;
		const wr = Math.cos(ang);
		const wi = Math.sin(ang);
		const half = len / 2;
		for (let start = 0; start < n; start += len) {
			let cr = 1;
			let ci = 0;
			for (let k = 0; k < half; k++) {
				const a = start + k;
				const b = a + half;
				const tr = re[b] * cr - im[b] * ci;
				const ti = re[b] * ci + im[b] * cr;
				re[b] = re[a] - tr;
				im[b] = im[a] - ti;
				re[a] += tr;
				im[a] += ti;
				const nr = cr * wr - ci * wi;
				ci = cr * wi + ci * wr;
				cr = nr;
			}
		}
	}
}

/**
 * Linear convolution of two real sequences (length a.length + b.length − 1).
 * With `size`, a circular convolution of that length (a power of two) instead,
 * which matches the linear one at indices ≥ a.length + b.length − 1 − size.
 */
export function convolve(a: ArrayLike<number>, b: ArrayLike<number>, size?: number): Float64Array {
	const linear = a.length + b.length - 1;
	const n = size ?? nextPow2(linear);
	const out = Math.min(linear, n);
	// Both inputs in one complex transform: z = a + i·b, then split the spectra
	// with A_k = (Z_k + conj Z_{n−k})/2 and B_k = (Z_k − conj Z_{n−k})/2i.
	const zr = new Float64Array(n);
	const zi = new Float64Array(n);
	for (let i = 0; i < a.length; i++) zr[i % n] += a[i];
	for (let i = 0; i < b.length; i++) zi[i % n] += b[i];
	fft(zr, zi);
	const ar = new Float64Array(n);
	const ai = new Float64Array(n);
	for (let k = 0; k < n; k++) {
		const j = (n - k) % n;
		const Ar = (zr[k] + zr[j]) / 2;
		const Ai = (zi[k] - zi[j]) / 2;
		const Br = (zi[k] + zi[j]) / 2;
		const Bi = (zr[j] - zr[k]) / 2;
		ar[k] = Ar * Br - Ai * Bi;
		ai[k] = Ar * Bi + Ai * Br;
	}
	fft(ar, ai, true);
	const res = new Float64Array(out);
	for (let i = 0; i < out; i++) res[i] = ar[i] / n;
	return res;
}
