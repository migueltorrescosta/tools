import { describe, it, expect } from 'vitest';
import {
	cb32Encode,
	cb32Decode,
	cb32Normalize,
	codeWidth,
	isValidCode,
	permToInt,
	intToPerm,
	factorial,
	tallyResults,
	tallyFPTP,
	tallyIRV,
	tallyCondorcet,
	type Vote
} from './rank-vote';

// Helper to create vote codes from permutations
function votesFromPerms(perms: number[][]): Vote[] {
	return perms.map((perm, i) => ({
		name: `Voter ${i + 1}`,
		code: cb32Encode(permToInt(perm), codeWidth(perm.length))
	}));
}

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
			// 5 choices = 120 permutations, needs 2 chars (32^1=32 > 120? No, 32 < 120)
			expect(codeWidth(5)).toBe(2);
		});
	});

	describe('permToInt / intToPerm', () => {
		it('round-trips permutations for 3 choices', () => {
			const tests = [
				[0, 1, 2], // 0,1,2
				[0, 2, 1], // 0,2,1
				[1, 0, 2], // 1,0,2
				[1, 2, 0], // 1,2,0
				[2, 0, 1], // 2,0,1
				[2, 1, 0] // 2,1,0
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

	describe('isValidCode', () => {
		it('validates correctly', () => {
			expect(isValidCode('0', 2)).toBe(true);
			expect(isValidCode('1', 2)).toBe(true);
			expect(isValidCode('2', 2)).toBe(false); // Out of range for 2 choices (0-1 valid)
		});
	});
});

describe('Rank Vote - Tally Methods', () => {
	describe('tallyFPTP', () => {
		it('counts first choices correctly', () => {
			const choices = ['A', 'B', 'C'];
			const votes = votesFromPerms([
				[0, 1, 2], // A
				[0, 2, 1], // A
				[1, 0, 2], // B
				[2, 0, 1] // C
			]);

			const result = tallyFPTP(choices, votes);

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

			const result = tallyFPTP(choices, votes);

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

			const result = tallyResults(choices, votes);

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

			const result = tallyResults(choices, votes);

			expect(result.results[0].text).toBe('A');
			// A: 2+2+2+1 = 7, B: 1+0+2 = 3, C: 0+1+0 = 1
			expect(result.results[0].score).toBe(7);
		});
	});

	describe('tallyIRV', () => {
		it('declares winner with majority on first round', () => {
			const choices = ['A', 'B', 'C'];
			const votes = votesFromPerms([
				[0, 1, 2], // A
				[0, 2, 1], // A
				[0, 1, 2], // A
				[1, 0, 2], // B
				[2, 0, 1] // C
			]);

			const result = tallyIRV(choices, votes);

			// A has 3/5 = 60% > 50%, wins in round 1
			// Winner gets n = 3, B/C eliminated in round 1 get 1
			expect(result.results[0].text).toBe('A');
			expect(result.results[0].score).toBe(3);
		});

		it('eliminates lowest and redistributes', () => {
			const choices = ['A', 'B', 'C'];
			const votes = votesFromPerms([
				[0, 1, 2], // A
				[0, 2, 1], // A
				[1, 0, 2], // B
				[2, 0, 1], // C
				[2, 1, 0] // C
			]);

			const result = tallyIRV(choices, votes);

			// Round 1: A=2, B=1, C=2 (no majority)
			// Lowest is B with 1 vote, eliminated in round 1 -> score 1
			// Round 2: A=3, C=2 (B's vote goes to A)
			// A has 3/5 > 50% -> winner gets n = 3
			// C is final survivor -> gets n-1 = 2
			expect(result.results[0].text).toBe('A');
			expect(result.results[0].score).toBe(3); // Winner
			expect(result.results[1].score).toBe(2); // C (final survivor)
			expect(result.results[2].score).toBe(1); // B (eliminated round 1)
		});

		it('handles two-choice election', () => {
			const choices = ['A', 'B'];
			const votes = votesFromPerms([
				[0, 1], // A
				[0, 1], // A
				[1, 0] // B
			]);

			const result = tallyIRV(choices, votes);

			// A has 2/3 > 50%, wins immediately
			// Winner gets n = 2, B eliminated in round 1 gets 1
			expect(result.results[0].text).toBe('A');
			expect(result.results[0].score).toBe(2);
		});

		it('winner has n, final survivors get n-1', () => {
			const choices = ['A', 'B', 'C'];
			const votes = votesFromPerms([
				[0, 1, 2],
				[0, 2, 1],
				[1, 0, 2],
				[2, 0, 1],
				[2, 1, 0]
			]);

			const result = tallyIRV(choices, votes);

			// Winner gets n = 3
			expect(result.results[0].score).toBe(3);
			// Final survivor (last remaining before winner) gets n-1 = 2
			expect(result.results[1].score).toBe(2);
		});

		it('returns empty result for no votes', () => {
			const choices = ['A', 'B', 'C'];
			const result = tallyIRV(choices, []);

			expect(result.valid).toBe(0);
			expect(result.results[0].score).toBe(0);
		});

		it('all candidates get non-zero score when multiple rounds needed', () => {
			const choices = ['A', 'B', 'C'];
			const votes = votesFromPerms([
				[0, 1, 2], // A
				[0, 2, 1], // A
				[1, 0, 2], // B
				[2, 0, 1], // C
				[2, 1, 0] // C
			]);

			const result = tallyIRV(choices, votes);

			// All should have non-zero scores
			expect(result.results.every((r) => r.score > 0)).toBe(true);
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

			const result = tallyIRV(choices, votes);

			// Round 1: A=2, B=1, C=1, D=2. B and C tie for last with no earlier
			// round to break it. A wins whichever goes first, so both are
			// eliminated together in round 1 (score 1, shared rank).
			// Round 2: A=4 > 3 -> winner gets n = 4; D survives with n-1 = 3.
			expect(result.tie).toBeUndefined();
			const byText = Object.fromEntries(result.results.map((r) => [r.text, r]));
			expect(byText.A.score).toBe(4);
			expect(byText.A.rank).toBe(1);
			expect(byText.D.score).toBe(3);
			expect(byText.B.score).toBe(1);
			expect(byText.C.score).toBe(1);
			expect(byText.B.rank).toBe(byText.C.rank);
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

		it('gives each candidate a unique score when every tie is broken', () => {
			const result = tallyIRV(['A', 'B', 'C', 'D'], votesFromPerms(backwardBallots));
			expect(result.tie).toBeUndefined();
			const byText = Object.fromEntries(result.results.map((r) => [r.text, r.score]));
			expect(byText).toEqual({ C: 4, A: 3, B: 2, D: 1 });
			expect(result.results.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
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
			const ab = tallyIRV(['A', 'B', 'C'], votesFromPerms(tiedBallots));
			// Same ballots with A and B listed in swapped positions
			const swapped = tiedBallots.map((p) => p.map((c) => (c === 0 ? 1 : c === 1 ? 0 : c)));
			const ba = tallyIRV(['B', 'A', 'C'], votesFromPerms(swapped));

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
					])
				);
				expect(result.results.map((r) => r.rank)).toEqual([1, 1]);
				expect(result.tie).toEqual([0, 1]);
			}
		});

		it('breaks a bottom tie backward using the previous round, not list order', () => {
			const swapMap = [1, 0, 2, 3];
			const swapped = tallyIRV(
				['B', 'A', 'C', 'D'],
				votesFromPerms(backwardBallots.map((p) => p.map((c) => swapMap[c])))
			);
			expect(swapped.tie).toBeUndefined();
			const byText = Object.fromEntries(swapped.results.map((r) => [r.text, r.score]));
			expect(byText).toEqual({ C: 4, A: 3, B: 2, D: 1 });
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

			const result = tallyCondorcet(choices, votes);

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

			const result = tallyCondorcet(choices, votes);

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

			const result = tallyCondorcet(choices, votes);

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

			const result = tallyCondorcet(choices, votes);

			// Every contest is 1-1: no winner, but no cycle either
			expect(result.condorcetWinner).toBeNull();
			expect(result.cycle).toBe(false);
		});

		it('has no Condorcet winner without votes', () => {
			const result = tallyCondorcet(['A', 'B'], []);
			expect(result.condorcetWinner).toBeNull();
			expect(result.cycle).toBe(false);
		});
	});
});
