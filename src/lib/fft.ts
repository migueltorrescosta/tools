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

/** Linear convolution of two real sequences (length a.length + b.length − 1). */
export function convolve(a: ArrayLike<number>, b: ArrayLike<number>): Float64Array {
	const out = a.length + b.length - 1;
	const n = nextPow2(out);
	const ar = new Float64Array(n);
	const ai = new Float64Array(n);
	const br = new Float64Array(n);
	const bi = new Float64Array(n);
	for (let i = 0; i < a.length; i++) ar[i] = a[i];
	for (let i = 0; i < b.length; i++) br[i] = b[i];
	fft(ar, ai);
	fft(br, bi);
	for (let i = 0; i < n; i++) {
		const r = ar[i] * br[i] - ai[i] * bi[i];
		ai[i] = ar[i] * bi[i] + ai[i] * br[i];
		ar[i] = r;
	}
	fft(ar, ai, true);
	const res = new Float64Array(out);
	for (let i = 0; i < out; i++) res[i] = ar[i] / n;
	return res;
}
