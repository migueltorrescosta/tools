/**
 * mulberry32 — a simple seeded PRNG with 32-bit state.
 * Fast, passes basic randomness tests, fully deterministic for a given seed.
 */
export class SeededRNG {
	private state: number;

	constructor(seed: number) {
		this.state = seed | 0;
	}

	/** Returns a pseudo-random number in [0, 1). */
	next(): number {
		let t = (this.state += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	/** Returns a D6 roll: 1, 2, 3, 4, 5, or 6. */
	rollD6(): number {
		return Math.floor(this.next() * 6) + 1;
	}

	/** Returns true with the given probability p. */
	rollProb(p: number): boolean {
		return this.next() < p;
	}

	/** Returns a random integer in [min, max] inclusive. */
	rollInt(min: number, max: number): number {
		return Math.floor(this.next() * (max - min + 1)) + min;
	}
}
