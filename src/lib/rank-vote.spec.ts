import { describe, it, expect } from 'vitest';
import {
	MAX_CHOICES,
	b64uEncode,
	b64uDecode,
	cb32Encode,
	cb32Decode,
	cb32Normalize,
	codeWidth,
	computeChecksum,
	decodeElection,
	decodeVote,
	encodeElection,
	encodeVote,
	hasDuplicateChoices,
	isValidCode,
	parseStoredVotes,
	permToInt,
	intToPerm,
	factorial,
	tallyResults,
	tallyFPTP,
	tallyIRV,
	tallyCondorcet,
	voteCodeWidth,
	votesStorageKey,
	type TallyResult,
	type Vote
} from './rank-vote';

// Election checksum used by the tally tests
const CS = 'Ab3_';

// Helper to create vote codes from permutations
function votesFromPerms(perms: number[][], cs = CS): Vote[] {
	return perms.map((perm, i) => ({
		name: `Voter ${i + 1}`,
		code: encodeVote(perm, cs)
	}));
}

// Deterministic PRNG (mulberry32) so property tests are reproducible
function rng(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function shuffle(n: number, rand: () => number): number[] {
	const a = [...Array(n).keys()];
	for (let i = n - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

const CB32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

describe('Rank Vote - Permutations', () => {
	describe('factorial', () => {
		it('calculates factorial correctly', () => {
			expect(factorial(0)).toBe(1);
			expect(factorial(1)).toBe(1);
			expect(factorial(3)).toBe(6);
			expect(factorial(5)).toBe(120);
		});
	});

	describe('codeWidth', () => {
		it('calculates required width for permutations', () => {
			// 2 choices = 2! = 2 permutations (0-1), needs 1 char in base32 (32 > 1)
			expect(codeWidth(2)).toBe(1);
			// 3 choices = 6 permutations, needs 1 char (32 > 6)
			expect(codeWidth(3)).toBe(1);
			// 4 choices = 24 permutations, needs 1 char (32 > 24)
			expect(codeWidth(4)).toBe(1);
			// 5 choices = 120 permutations, needs 2 chars (32 < 120 <= 32^2)
			expect(codeWidth(5)).toBe(2);
			// 6 choices = 720 permutations, still 2 chars (720 <= 1024)
			expect(codeWidth(6)).toBe(2);
			// 14 choices = 14! ~ 8.7e10 permutations, 32^7 ~ 3.4e10 < 14! <= 32^8
			expect(codeWidth(MAX_CHOICES)).toBe(8);
		});
	});

	describe('permToInt / intToPerm', () => {
		it('round-trips permutations for 3 choices', () => {
			const tests = [
				[0, 1, 2],
				[0, 2, 1],
				[1, 0, 2],
				[1, 2, 0],
				[2, 0, 1],
				[2, 1, 0]
			];
			for (const perm of tests) {
				const num = permToInt(perm);
				const restored = intToPerm(num, 3);
				expect(restored).toEqual(perm);
			}
		});

		it('encodes all permutations uniquely', () => {
			// Generate all 3! = 6 permutations of [0,1,2]
			const seen = new Set<number>();
			const perms: number[][] = [];
			const generate = (arr: number[], m: number[]) => {
				if (m.length === 0) {
					perms.push(arr);
					return;
				}
				for (let i = 0; i < m.length; i++) {
					generate(
						[...arr, m[i]],
						m.filter((_, j) => j !== i)
					);
				}
			};
			generate([], [0, 1, 2]);

			expect(perms.length).toBe(6);
			for (const perm of perms) {
				const num = permToInt(perm);
				expect(seen.has(num)).toBe(false);
				seen.add(num);
			}
			expect(seen.size).toBe(6);
		});

		it('round-trips random permutations of 14 choices', () => {
			const rand = rng(14);
			for (let k = 0; k < 500; k++) {
				const perm = shuffle(MAX_CHOICES, rand);
				const num = permToInt(perm);
				expect(num).toBeLessThan(factorial(MAX_CHOICES));
				expect(intToPerm(num, MAX_CHOICES)).toEqual(perm);
			}
			// Extremes of the range
			expect(intToPerm(0, MAX_CHOICES)).toEqual([...Array(MAX_CHOICES).keys()]);
			expect(intToPerm(factorial(MAX_CHOICES) - 1, MAX_CHOICES)).toEqual(
				[...Array(MAX_CHOICES).keys()].reverse()
			);
		});
	});

	describe('cb32Encode / cb32Decode', () => {
		it('encodes and decodes correctly', () => {
			expect(cb32Decode(cb32Encode(0, 1))).toBe(0);
			expect(cb32Decode(cb32Encode(5, 1))).toBe(5);
			expect(cb32Decode(cb32Encode(31, 1))).toBe(31); // Max value for 1 char
			expect(cb32Decode(cb32Encode(32, 2))).toBe(32);
		});

		it('normalizes input correctly', () => {
			expect(cb32Normalize('abc')).toBe('ABC');
			expect(cb32Normalize('1l0')).toBe('110');
			expect(cb32Normalize('IO')).toBe('10');
		});
	});
});

describe('Rank Vote - Vote codes', () => {
	it('appends one check symbol to the permutation digits', () => {
		expect(voteCodeWidth(2)).toBe(2);
		expect(voteCodeWidth(5)).toBe(3);
		expect(voteCodeWidth(MAX_CHOICES)).toBe(9);
		const code = encodeVote([2, 0, 1], CS);
		expect(code).toHaveLength(voteCodeWidth(3));
		expect(code.slice(0, -1)).toBe(cb32Encode(permToInt([2, 0, 1]), codeWidth(3)));
	});

	it('round-trips every ranking of 4 choices and random rankings of 14', () => {
		const generate = (arr: number[], m: number[]): number[][] =>
			m.length === 0
				? [arr]
				: m.flatMap((c, i) =>
						generate(
							[...arr, c],
							m.filter((_, j) => j !== i)
						)
					);
		for (const perm of generate([], [0, 1, 2, 3])) {
			expect(decodeVote(encodeVote(perm, CS), 4, CS)).toEqual(perm);
		}
		const rand = rng(7);
		for (let k = 0; k < 200; k++) {
			const perm = shuffle(MAX_CHOICES, rand);
			expect(decodeVote(encodeVote(perm, CS), MAX_CHOICES, CS)).toEqual(perm);
		}
	});

	it('rejects every single-character substitution', () => {
		for (const n of [3, 4, 6, 9]) {
			const rand = rng(n);
			for (let k = 0; k < 20; k++) {
				const code = encodeVote(shuffle(n, rand), CS);
				for (let pos = 0; pos < code.length; pos++) {
					for (const ch of CB32) {
						if (ch === code[pos]) continue;
						const typo = code.slice(0, pos) + ch + code.slice(pos + 1);
						expect(isValidCode(typo, n, CS), `${code} -> ${typo}`).toBe(false);
					}
				}
			}
		}
	});

	it('rejects a code cast for a different election', () => {
		const perm = [1, 2, 0];
		const foreign = encodeVote(perm, 'zzzz');
		expect(foreign).not.toBe(encodeVote(perm, CS));
		expect(isValidCode(foreign, 3, 'zzzz')).toBe(true);
		expect(isValidCode(foreign, 3, CS)).toBe(false);
	});

	it('rejects codes of the wrong length, out of range or with invalid characters', () => {
		const code = encodeVote([0, 1, 2], CS);
		expect(isValidCode(code, 3, CS)).toBe(true);
		// Bare permutation index without the check symbol
		expect(isValidCode(code.slice(0, -1), 3, CS)).toBe(false);
		expect(isValidCode('0' + code, 3, CS)).toBe(false);
		expect(isValidCode('', 3, CS)).toBe(false);
		expect(isValidCode('000', 3, CS)).toBe(false);
		expect(isValidCode('U' + code.slice(1), 3, CS)).toBe(false);
		// Index 6 is out of range for 3 choices whatever the check symbol
		for (const ch of CB32) expect(isValidCode('6' + ch, 3, CS)).toBe(false);
	});

	it('accepts lowercase and Crockford look-alikes after normalisation', () => {
		// Find a ranking whose code contains 0 or 1 so O / I / L can stand in
		const perm = [0, 1, 2];
		const code = encodeVote(perm, CS);
		expect(code[0]).toBe('0');
		const variant = 'o' + code.slice(1).toLowerCase();
		expect(isValidCode(variant, 3, CS)).toBe(true);
		expect(decodeVote(variant, 3, CS)).toEqual(perm);
	});
});

describe('Rank Vote - Election encoding', () => {
	it('round-trips titles and choices with unicode', async () => {
		const title = 'Lunch 🍜 — 午餐?';
		const choices = ['Ramen 🍜', 'Café', '寿司'];
		const cs = await computeChecksum(title, choices);
		const decoded = decodeElection(encodeElection(title, choices, cs));
		expect(decoded).toEqual({ v: 1, title, choices, cs });
		expect(await computeChecksum(decoded!.title, decoded!.choices)).toBe(cs);
	});

	it('produces URL-safe base64 without padding', () => {
		const bytes = new Uint8Array([0xfb, 0xff, 0xfe, 0x00, 0x3e]);
		const enc = b64uEncode(bytes);
		expect(enc).not.toMatch(/[+/=]/);
		expect(b64uDecode(enc)).toEqual(bytes);
	});

	it('detects a checksum mismatch after tampering', async () => {
		const cs = await computeChecksum('Poll', ['A', 'B']);
		expect(cs).toHaveLength(4);
		expect(await computeChecksum('Poll', ['A', 'B'])).toBe(cs);
		expect(await computeChecksum('Poll', ['B', 'A'])).not.toBe(cs);
		expect(await computeChecksum('Poll!', ['A', 'B'])).not.toBe(cs);
	});

	it('rejects malformed elections', () => {
		const enc = (data: unknown) => b64uEncode(new TextEncoder().encode(JSON.stringify(data)));
		const ok = { v: 1, title: 't', choices: ['A', 'B'], cs: 'aaaa' };
		expect(decodeElection(enc(ok))).toEqual(ok);
		expect(decodeElection(enc({ ...ok, choices: ['A'] }))).toBeNull();
		expect(
			decodeElection(enc({ ...ok, choices: Array.from({ length: 15 }, (_, i) => `C${i}`) }))
		).toBeNull();
		expect(decodeElection(enc({ ...ok, choices: ['A', '   '] }))).toBeNull();
		expect(decodeElection(enc({ ...ok, choices: ['A', 2] }))).toBeNull();
		expect(decodeElection(enc({ ...ok, v: 2 }))).toBeNull();
		expect(decodeElection(enc({ ...ok, title: ' ' }))).toBeNull();
		expect(decodeElection(enc({ ...ok, cs: undefined }))).toBeNull();
		expect(decodeElection('!!!not base64!!!')).toBeNull();
		expect(decodeElection(b64uEncode(new TextEncoder().encode('{not json')))).toBeNull();
	});

	it('rejects duplicate choices, ignoring case and surrounding whitespace', () => {
		expect(hasDuplicateChoices(['A', 'B'])).toBe(false);
		expect(hasDuplicateChoices(['X', 'X'])).toBe(true);
		expect(hasDuplicateChoices(['Pizza', ' pizza '])).toBe(true);
		const enc = b64uEncode(
			new TextEncoder().encode(JSON.stringify({ v: 1, title: 't', choices: ['X', 'X'], cs: 'a' }))
		);
		expect(decodeElection(enc)).toBeNull();
	});
});

describe('Rank Vote - Saved votes', () => {
	it('keys storage by election checksum', () => {
		expect(votesStorageKey('Ab3_')).toBe('rank-vote:votes:Ab3_');
	});

	it('keeps valid votes and drops malformed or foreign entries', () => {
		const good = votesFromPerms([
			[0, 1, 2],
			[2, 1, 0]
		]);
		const raw = JSON.stringify([
			...good,
			{ name: 'Foreign', code: encodeVote([1, 0, 2], 'zzzz') },
			{ name: '', code: good[0].code },
			{ name: 'NoCode' },
			null,
			'junk'
		]);
		expect(parseStoredVotes(raw, 3, CS)).toEqual(good);
	});

	it('normalises codes and keeps only the last vote per name', () => {
		const [first, second] = votesFromPerms([
			[0, 1, 2],
			[1, 2, 0]
		]);
		const raw = JSON.stringify([
			{ name: 'Ann', code: first.code.toLowerCase() },
			{ name: 'Bob', code: first.code },
			{ name: 'Ann', code: second.code }
		]);
		expect(parseStoredVotes(raw, 3, CS)).toEqual([
			{ name: 'Bob', code: first.code },
			{ name: 'Ann', code: second.code }
		]);
	});

	it('returns no votes for missing or corrupt storage', () => {
		expect(parseStoredVotes(null, 3, CS)).toEqual([]);
		expect(parseStoredVotes('{oops', 3, CS)).toEqual([]);
		expect(parseStoredVotes('{"name":"x"}', 3, CS)).toEqual([]);
	});
});

describe('Rank Vote - Tally Methods', () => {
	it('every method skips invalid codes', () => {
		const choices = ['A', 'B', 'C'];
		const votes: Vote[] = [
			...votesFromPerms([[1, 0, 2]]),
			{ name: 'Typo', code: 'ZZ' },
			{ name: 'Bare index', code: '0' },
			{ name: 'Foreign', code: encodeVote([0, 1, 2], 'zzzz') }
		];
		for (const tally of [tallyFPTP, tallyResults, tallyIRV, tallyCondorcet]) {
			const result = tally(choices, votes, CS);
			expect(result.valid).toBe(1);
			expect(result.results[0].text).toBe('B');
		}
	});

	describe('tallyFPTP', () => {
		it('counts first choices correctly', () => {
			const choices = ['A', 'B', 'C'];
			const votes = votesFromPerms([
				[0, 1, 2], // A
				[0, 2, 1], // A
				[1, 0, 2], // B
				[2, 0, 1] // C
			]);

			const result = tallyFPTP(choices, votes, CS);

			expect(result.valid).toBe(4);
			expect(result.results.find((r) => r.text === 'A')?.score).toBe(2);
			expect(result.results.find((r) => r.text === 'B')?.score).toBe(1);
			expect(result.results.find((r) => r.text === 'C')?.score).toBe(1);
		});

		it('handles ties correctly', () => {
			const choices = ['A', 'B'];
			const votes = votesFromPerms([
				[0, 1], // A
				[1, 0] // B
			]);

			const result = tallyFPTP(choices, votes, CS);

			expect(result.valid).toBe(2);
			// Both have 1 vote, sorted by index
			expect(result.results[0].text).toBe('A');
			expect(result.results[1].text).toBe('B');
			expect(result.results[0].rank).toBe(1);
			expect(result.results[1].rank).toBe(1); // Tie
		});
	});

	describe('tallyResults (Borda)', () => {
		it('awards points based on rank', () => {
			const choices = ['A', 'B', 'C'];
			const votes = votesFromPerms([
				[0, 1, 2],
				[0, 2, 1],
				[1, 0, 2],
				[2, 0, 1]
			]);

			const result = tallyResults(choices, votes, CS);

			expect(result.valid).toBe(4);
			// A: 2+2+1+1=6, B: 1+0+2+0=3, C: 0+1+0+2=3
			expect(result.results[0].text).toBe('A');
			expect(result.results[0].score).toBe(6);
		});

		it('handles clear winner', () => {
			const choices = ['A', 'B', 'C'];
			const votes = votesFromPerms([
				[0, 1, 2],
				[0, 2, 1],
				[0, 1, 2],
				[1, 0, 2]
			]);

			const result = tallyResults(choices, votes, CS);

			expect(result.results[0].text).toBe('A');
			// A: 2+2+2+1 = 7, B: 1+0+2 = 3, C: 0+1+0 = 1
			expect(result.results[0].score).toBe(7);
		});
	});

	describe('tallyIRV', () => {
		it('declares winner with majority on first round and ranks the rest by votes', () => {
			const choices = ['A', 'B', 'C'];
			const votes = votesFromPerms([
				[0, 1, 2], // A
				[0, 2, 1], // A
				[0, 1, 2], // A
				[1, 0, 2], // B
				[2, 0, 1] // C
			]);

			const result = tallyIRV(choices, votes, CS);

			// A has 3/5 = 60% > 50% in round 1. Nobody is eliminated, so B and C
			// are ranked by their round-1 counts (1 each, shared rank).
			expect(result.rounds).toHaveLength(1);
			expect(result.results.map((r) => [r.text, r.score, r.rank])).toEqual([
				['A', 3, 1],
				['B', 1, 2],
				['C', 1, 2]
			]);
			expect(result.results.every((r) => r.eliminatedRound === undefined)).toBe(true);
		});

		it('eliminates lowest and redistributes, reporting each round', () => {
			const choices = ['A', 'B', 'C'];
			const votes = votesFromPerms([
				[0, 1, 2], // A
				[0, 2, 1], // A
				[1, 0, 2], // B
				[2, 0, 1], // C
				[2, 1, 0] // C
			]);

			const result = tallyIRV(choices, votes, CS);

			// Round 1: A=2, B=1, C=2 (no majority) -> B eliminated
			// Round 2: A=3, C=2 (B's vote goes to A) -> A has 3/5 > 50%
			expect(result.rounds).toEqual([
				{ counts: [2, 1, 2], eliminated: [1] },
				{ counts: [3, 0, 2], eliminated: [] }
			]);
			expect(result.results.map((r) => [r.text, r.score, r.rank, r.eliminatedRound])).toEqual([
				['A', 3, 1, undefined],
				['C', 2, 2, undefined],
				['B', 1, 3, 1]
			]);
		});

		it('handles two-choice election', () => {
			const choices = ['A', 'B'];
			const votes = votesFromPerms([
				[0, 1], // A
				[0, 1], // A
				[1, 0] // B
			]);

			const result = tallyIRV(choices, votes, CS);

			// A has 2/3 > 50%, wins immediately
			expect(result.results[0].text).toBe('A');
			expect(result.results[0].score).toBe(2);
			expect(result.results[1].score).toBe(1);
		});

		it('returns empty result for no votes', () => {
			const choices = ['A', 'B', 'C'];
			const result = tallyIRV(choices, [], CS);

			expect(result.valid).toBe(0);
			expect(result.rounds).toEqual([]);
			expect(result.results[0].score).toBe(0);
		});

		it('four-choice election eliminates a harmless bottom tie together', () => {
			const choices = ['A', 'B', 'C', 'D'];
			const votes = votesFromPerms([
				[0, 1, 2, 3], // A
				[0, 2, 1, 3], // A
				[1, 0, 2, 3], // B
				[2, 0, 1, 3], // C
				[3, 0, 1, 2], // D
				[3, 1, 2, 0] // D
			]);

			const result = tallyIRV(choices, votes, CS);

			// Round 1: A=2, B=1, C=1, D=2. B and C tie for last with no earlier
			// round to break it. A wins whichever goes first, so both are
			// eliminated together in round 1 (shared rank).
			// Round 2: B and C both transfer to A: A=4 of 6 > 3 wins; D keeps 2.
			expect(result.tie).toBeUndefined();
			expect(result.rounds).toEqual([
				{ counts: [2, 1, 1, 2], eliminated: [1, 2] },
				{ counts: [4, 0, 0, 2], eliminated: [] }
			]);
			const byText = Object.fromEntries(result.results.map((r) => [r.text, r]));
			expect(byText.A.score).toBe(4);
			expect(byText.A.rank).toBe(1);
			expect(byText.D.score).toBe(2);
			expect(byText.D.rank).toBe(2);
			expect(byText.B.eliminatedRound).toBe(1);
			expect(byText.C.eliminatedRound).toBe(1);
			expect(byText.B.rank).toBe(3);
			expect(byText.C.rank).toBe(3);
		});

		// A>B>C>D x3, B>C>A>D x2, C>D>A>B x4, D>B>A>C x1
		// Round 1: A=3, B=2, C=4, D=1 -> D out (to B).
		// Round 2: A=3, B=3, C=4 -> A/B tie, broken backward by round 1
		// (B=2 < A=3) -> B out. Round 3: A=4, C=6 > 5 wins.
		const backwardBallots = [
			[0, 1, 2, 3],
			[0, 1, 2, 3],
			[0, 1, 2, 3],
			[1, 2, 0, 3],
			[1, 2, 0, 3],
			[2, 3, 0, 1],
			[2, 3, 0, 1],
			[2, 3, 0, 1],
			[2, 3, 0, 1],
			[3, 1, 0, 2]
		];

		it('ranks by survival when every tie is broken', () => {
			const result = tallyIRV(['A', 'B', 'C', 'D'], votesFromPerms(backwardBallots), CS);
			expect(result.tie).toBeUndefined();
			expect(result.rounds.map((r) => r.eliminated)).toEqual([[3], [1], []]);
			expect(result.results.map((r) => [r.text, r.score, r.rank, r.eliminatedRound])).toEqual([
				['C', 6, 1, undefined],
				['A', 4, 2, undefined],
				['B', 3, 3, 2],
				['D', 1, 4, 1]
			]);
		});

		// Ballots [A>B>C]x2, [B>A>C]x2, [C>A>B]x2, [C>B>A]x1: A and B tie at 2
		// in round 1. Whoever is dropped hands the other the win, so neither
		// list order may decide it.
		const tiedBallots = [
			[0, 1, 2],
			[0, 1, 2],
			[1, 0, 2],
			[1, 0, 2],
			[2, 0, 1],
			[2, 0, 1],
			[2, 1, 0]
		];

		it('does not let listing order decide an unresolvable elimination tie', () => {
			const ab = tallyIRV(['A', 'B', 'C'], votesFromPerms(tiedBallots), CS);
			// Same ballots with A and B listed in swapped positions
			const swapped = tiedBallots.map((p) => p.map((c) => (c === 0 ? 1 : c === 1 ? 0 : c)));
			const ba = tallyIRV(['B', 'A', 'C'], votesFromPerms(swapped), CS);

			for (const result of [ab, ba]) {
				const byText = Object.fromEntries(result.results.map((r) => [r.text, r]));
				expect(byText.A.rank).toBe(1);
				expect(byText.B.rank).toBe(1);
				expect(byText.C.rank).toBe(3);
				expect(
					result.tie?.map((i) => result.results.find((r) => r.index === i)!.text).sort()
				).toEqual(['A', 'B']);
			}
		});

		it('reports a 50/50 final round as a tie with both ranked first', () => {
			for (const choices of [
				['A', 'B'],
				['B', 'A']
			]) {
				const result = tallyIRV(
					choices,
					votesFromPerms([
						[0, 1],
						[1, 0]
					]),
					CS
				);
				expect(result.results.map((r) => r.rank)).toEqual([1, 1]);
				expect(result.tie).toEqual([0, 1]);
			}
		});

		it('breaks a bottom tie backward using the previous round, not list order', () => {
			const swapMap = [1, 0, 2, 3];
			const swapped = tallyIRV(
				['B', 'A', 'C', 'D'],
				votesFromPerms(backwardBallots.map((p) => p.map((c) => swapMap[c]))),
				CS
			);
			expect(swapped.tie).toBeUndefined();
			const byText = Object.fromEntries(swapped.results.map((r) => [r.text, r.rank]));
			expect(byText).toEqual({ C: 1, A: 2, B: 3, D: 4 });
		});
	});

	describe('tallyCondorcet', () => {
		it('finds winner who beats all others', () => {
			const choices = ['A', 'B', 'C'];
			const votes = votesFromPerms([
				[0, 1, 2], // A>B, A>C
				[0, 2, 1], // A>C, A>B
				[1, 0, 2], // B>A, B>C
				[2, 0, 1] // C>A, C>B
			]);

			const result = tallyCondorcet(choices, votes, CS);

			// Pairwise: A beats B 3-1, A beats C 3-1, B vs C 2-2
			// A is Condorcet winner with Copeland net +2
			expect(result.condorcetWinner).toBe(0);
			expect(result.cycle).toBe(false);
			expect(result.results[0].text).toBe('A');
			expect(result.results[0].score).toBe(2);
		});

		it('reports no Condorcet winner for a three-way cycle', () => {
			const choices = ['A', 'B', 'C'];
			const votes = votesFromPerms([
				[0, 1, 2], // A>B>C
				[1, 2, 0], // B>C>A
				[2, 0, 1] // C>A>B
			]);

			const result = tallyCondorcet(choices, votes, CS);

			// A beats B, B beats C, C beats A, each 2-1: Copeland all 0, all #1
			expect(result.condorcetWinner).toBeNull();
			expect(result.cycle).toBe(true);
			expect(result.results.map((r) => r.score)).toEqual([0, 0, 0]);
			expect(result.results.map((r) => r.rank)).toEqual([1, 1, 1]);
		});

		it('has no Condorcet winner even when Copeland gives a unique #1', () => {
			const choices = ['A', 'B', 'C', 'D', 'E'];
			const votes = votesFromPerms([
				[4, 3, 2, 1, 0],
				[1, 3, 0, 4, 2],
				[2, 4, 0, 1, 3],
				[0, 4, 2, 1, 3],
				[3, 1, 2, 0, 4]
			]);

			const result = tallyCondorcet(choices, votes, CS);

			// E is alone at the top of the Copeland ranking with net +2, but it
			// loses at least one head-to-head contest (a winner needs +4).
			expect(result.results[0].text).toBe('E');
			expect(result.results[0].score).toBe(2);
			expect(result.results[1].rank).toBe(2);
			expect(result.condorcetWinner).toBeNull();
			expect(result.cycle).toBe(true);
		});

		it('distinguishes pairwise ties from a cycle', () => {
			const choices = ['A', 'B', 'C'];
			const votes = votesFromPerms([
				[0, 1, 2], // A>B>C
				[2, 1, 0] // C>B>A
			]);

			const result = tallyCondorcet(choices, votes, CS);

			// Every contest is 1-1: no winner, but no cycle either
			expect(result.condorcetWinner).toBeNull();
			expect(result.cycle).toBe(false);
		});

		it('has no Condorcet winner without votes', () => {
			const result = tallyCondorcet(['A', 'B'], [], CS);
			expect(result.condorcetWinner).toBeNull();
			expect(result.cycle).toBe(false);
		});
	});

	describe('relabelling invariance', () => {
		// Listing the same choices in a different order must not change any
		// candidate's rank or score under any method. Ties are shared ranks,
		// so this holds whether or not a tie is reported.
		const rankMap = (r: TallyResult) =>
			Object.fromEntries(r.results.map((x) => [x.text, [x.rank, x.score]]));

		it('holds for random electorates', () => {
			const rand = rng(2026);
			for (let trial = 0; trial < 150; trial++) {
				const n = 2 + Math.floor(rand() * 4);
				const voters = 1 + Math.floor(rand() * 9);
				const names = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
				const ballots = Array.from({ length: voters }, () => shuffle(n, rand));
				// order[k] = original index of the choice listed at position k
				const order = shuffle(n, rand);
				const newIndex = new Array(n);
				order.forEach((orig, k) => (newIndex[orig] = k));
				const relabelled = ballots.map((b) => b.map((c) => newIndex[c]));
				const relabelledNames = order.map((orig) => names[orig]);

				for (const tally of [tallyFPTP, tallyResults, tallyIRV, tallyCondorcet]) {
					const a = tally(names, votesFromPerms(ballots), CS);
					const b = tally(relabelledNames, votesFromPerms(relabelled), CS);
					expect(rankMap(b), `${tally.name} trial ${trial}`).toEqual(rankMap(a));
				}
				const irvA = tallyIRV(names, votesFromPerms(ballots), CS);
				const irvB = tallyIRV(relabelledNames, votesFromPerms(relabelled), CS);
				expect(irvB.tie?.map((i) => relabelledNames[i]).sort()).toEqual(
					irvA.tie?.map((i) => names[i]).sort()
				);
			}
		});
	});
});
