/** A small seeded PRNG (mulberry32), so every random choice is reproducible. */
export class Prng {
	private state: number;
	private spare: number | null = null;

	constructor(seed: number) {
		this.state = seed >>> 0;
	}

	/** Uniform in [0, 1). */
	next(): number {
		let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	/** Uniform integer in [0, n). */
	int(n: number): number {
		return Math.floor(this.next() * n);
	}

	/** Standard normal (Box-Muller). */
	normal(): number {
		if (this.spare !== null) {
			const s = this.spare;
			this.spare = null;
			return s;
		}
		const u = 1 - this.next();
		const v = this.next();
		const r = Math.sqrt(-2 * Math.log(u));
		this.spare = r * Math.sin(2 * Math.PI * v);
		return r * Math.cos(2 * Math.PI * v);
	}
}
