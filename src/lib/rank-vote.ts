// Rank Vote - Core voting logic
// Crockford Base32 for vote codes, Base64url for URL payloads

// --- Constants ---
export const MIN_CHOICES = 2;
export const MAX_CHOICES = 14;

// Crockford's Base32 alphabet (excludes I, L, O, U)
const CB32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CB32_VAL: Record<string, number> = {};
for (let i = 0; i < CB32.length; i++) CB32_VAL[CB32[i]] = i;
// Error correction mappings
CB32_VAL['O'] = 0;
CB32_VAL['I'] = 1;
CB32_VAL['L'] = 1;

// --- Factorial ---
export function factorial(n: number): number {
	let r = 1;
	for (let i = 2; i <= n; i++) r *= i;
	return r;
}

// Number of Crockford Base32 digits needed to encode all permutations of N items
export function codeWidth(n: number): number {
	const max = factorial(n) - 1;
	if (max === 0) return 1;
	let w = 0,
		pow = 1;
	while (pow <= max) {
		pow *= CB32.length;
		w++;
	}
	return w;
}

// --- Crockford Base32 encode/decode ---
export function cb32Encode(num: number, width: number): string {
	if (num === 0) return '0'.repeat(width);
	let r = '';
	while (num > 0) {
		r = CB32[num % CB32.length] + r;
		num = Math.floor(num / CB32.length);
	}
	return r.padStart(width, '0');
}

export function cb32Decode(str: string): number | null {
	str = str.toUpperCase();
	let n = 0;
	for (const ch of str) {
		if (!(ch in CB32_VAL)) return null;
		n = n * CB32.length + CB32_VAL[ch];
	}
	return n;
}

export function cb32Normalize(str: string): string {
	return str.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');
}

// --- Lehmer code (permutation <-> integer) ---
// Converts a ranking permutation to a unique integer in [0, N!)

export function permToInt(perm: number[]): number {
	const n = perm.length;
	const avail = [...Array(n).keys()];
	let num = 0;
	for (let i = 0; i < n; i++) {
		const idx = avail.indexOf(perm[i]);
		num = num * (n - i) + idx;
		avail.splice(idx, 1);
	}
	return num;
}

export function intToPerm(num: number, n: number): number[] {
	const avail = [...Array(n).keys()];
	const perm: number[] = [];
	for (let i = n - 1; i >= 0; i--) {
		const f = factorial(i);
		const idx = Math.floor(num / f);
		num = num % f;
		perm.push(avail[idx]);
		avail.splice(idx, 1);
	}
	return perm;
}

// --- Base64url ---
// Standard base64 with + -> -, / -> _, padding stripped. Handles unicode via TextEncoder.

export function b64uEncode(bytes: Uint8Array): string {
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64uDecode(str: string): Uint8Array {
	str = str.replace(/-/g, '+').replace(/_/g, '/');
	while (str.length % 4) str += '=';
	const bin = atob(str);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return bytes;
}

// --- Election data ---

export interface Election {
	v: 1;
	title: string;
	choices: string[];
	cs: string; // checksum
}

export async function computeChecksum(title: string, choices: string[]): Promise<string> {
	const canonical = JSON.stringify({ title, choices });
	const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
	return b64uEncode(new Uint8Array(hash)).slice(0, 4);
}

export function encodeElection(title: string, choices: string[], cs: string): string {
	return b64uEncode(new TextEncoder().encode(JSON.stringify({ v: 1, title, choices, cs })));
}

export function decodeElection(b64: string): Election | null {
	try {
		const data = JSON.parse(new TextDecoder().decode(b64uDecode(b64)));
		if (data.v !== 1 || typeof data.title !== 'string' || !data.title.trim()) return null;
		if (
			!Array.isArray(data.choices) ||
			data.choices.length < MIN_CHOICES ||
			data.choices.length > MAX_CHOICES
		)
			return null;
		if (data.choices.some((c: unknown) => typeof c !== 'string' || !c.trim())) return null;
		if (hasDuplicateChoices(data.choices)) return null;
		if (typeof data.cs !== 'string') return null;
		return data;
	} catch {
		return null;
	}
}

// --- Duplicate choices ---
// Choices that differ only in case or surrounding whitespace look identical
// on the ballot, so voters could not tell them apart.
export function hasDuplicateChoices(choices: string[]): boolean {
	return new Set(choices.map((c) => c.trim().toLowerCase())).size !== choices.length;
}

// --- Vote codes ---
// A vote code is the Lehmer index of the ranking in Crockford Base32
// (codeWidth(n) digits) followed by one check symbol. The check symbol is a
// Luhn mod 32 digit computed over the election checksum followed by the
// index digits. Luhn mod N with even N catches every single-character
// substitution and most adjacent transpositions, and folding in the
// checksum rejects most codes cast for a different election.

const B64U = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function luhnCheckDigit(digits: number[]): number {
	const N = CB32.length;
	let factor = 2;
	let sum = 0;
	for (let i = digits.length - 1; i >= 0; i--) {
		const addend = factor * digits[i];
		sum += Math.floor(addend / N) + (addend % N);
		factor = factor === 2 ? 1 : 2;
	}
	return (N - (sum % N)) % N;
}

function checkSymbol(payload: string, cs: string): string {
	const salt: number[] = [];
	for (const ch of cs) {
		const v = Math.max(0, B64U.indexOf(ch));
		salt.push(v >> 5, v & 31);
	}
	const digits = [...payload].map((ch) => CB32_VAL[ch]);
	return CB32[luhnCheckDigit([...salt, ...digits])];
}

/** Length of a full vote code (index digits plus check symbol) for n choices. */
export function voteCodeWidth(n: number): number {
	return codeWidth(n) + 1;
}

/** Encode a ranking (choice indices, best first) as a vote code for this election. */
export function encodeVote(perm: number[], cs: string): string {
	const payload = cb32Encode(permToInt(perm), codeWidth(perm.length));
	return payload + checkSymbol(payload, cs);
}

/**
 * Decode a vote code into a ranking, or null when it is the wrong length,
 * out of range, or fails the check symbol. Input is normalised first, so
 * lowercase and the Crockford look-alikes O, I and L are accepted.
 */
export function decodeVote(code: string, numChoices: number, cs: string): number[] | null {
	const norm = cb32Normalize(code);
	if (norm.length !== voteCodeWidth(numChoices)) return null;
	const payload = norm.slice(0, -1);
	const num = cb32Decode(payload);
	if (num === null || num >= factorial(numChoices)) return null;
	if (checkSymbol(payload, cs) !== norm[norm.length - 1]) return null;
	return intToPerm(num, numChoices);
}

export function isValidCode(code: string, numChoices: number, cs: string): boolean {
	return decodeVote(code, numChoices, cs) !== null;
}

// --- Color palette ---
// 14 futuristic/neon colors for visual distinction
// Using cyan/magenta/blue/purple palette to match the futuristic theme
export const COLOR_PALETTE = [
	{ bg: 'rgba(0, 245, 255, 0.15)', border: 'var(--futuristic-cyan)' }, // Cyan
	{ bg: 'rgba(255, 0, 255, 0.15)', border: 'var(--futuristic-magenta)' }, // Magenta
	{ bg: 'rgba(0, 128, 255, 0.15)', border: 'var(--futuristic-blue)' }, // Blue
	{ bg: 'rgba(138, 43, 226, 0.15)', border: '#8a2be2' }, // Purple
	{ bg: 'rgba(0, 255, 127, 0.15)', border: '#00ff7f' }, // Spring green
	{ bg: 'rgba(255, 165, 0, 0.15)', border: '#ffa500' }, // Orange
	{ bg: 'rgba(255, 20, 147, 0.15)', border: '#ff1493' }, // Deep pink
	{ bg: 'rgba(64, 224, 208, 0.15)', border: '#40e0d0' }, // Turquoise
	{ bg: 'rgba(255, 215, 0, 0.15)', border: '#ffd700' }, // Gold
	{ bg: 'rgba(50, 205, 50, 0.15)', border: '#32cd32' }, // Lime green
	{ bg: 'rgba(255, 69, 0, 0.15)', border: '#ff4500' }, // Orange red
	{ bg: 'rgba(147, 112, 219, 0.15)', border: '#9370db' }, // Medium purple
	{ bg: 'rgba(0, 191, 255, 0.15)', border: '#00bfff' }, // Deep sky blue
	{ bg: 'rgba(255, 127, 80, 0.15)', border: '#ff7f50' } // Coral
];

export function choiceColor(index: number) {
	return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

export function colorStyle(index: number): string {
	const color = choiceColor(index);
	return `background:${color.bg};border-left-color:${color.border}`;
}

// --- Votes ---

export interface Vote {
	name: string;
	code: string;
}

export interface Result {
	text: string;
	score: number;
	index: number;
	rank: number;
	/** IRV only: the round the candidate was eliminated in (1-based). */
	eliminatedRound?: number;
}

export interface TallyResult {
	results: Result[];
	valid: number;
	/**
	 * IRV only: candidate indices that share first place because an
	 * elimination tie could not be broken and different resolutions elect
	 * different winners. Absent when the winner is unique.
	 */
	tie?: number[];
}

// Rankings of every vote whose code is valid for this election
function decodeBallots(n: number, votes: Vote[], cs: string): number[][] {
	const ballots: number[][] = [];
	for (const v of votes) {
		const perm = decodeVote(v.code, n, cs);
		if (perm) ballots.push(perm);
	}
	return ballots;
}

// Competition ranking ("1224") over results already sorted best first
function assignRanks(results: Result[], same: (a: Result, b: Result) => boolean) {
	for (let i = 0; i < results.length; i++) {
		results[i].rank = i === 0 || !same(results[i], results[i - 1]) ? i + 1 : results[i - 1].rank;
	}
}

function rankByScore(choices: string[], scores: number[]): Result[] {
	const results: Result[] = choices.map((text, i) => ({
		text,
		score: scores[i],
		index: i,
		rank: 0
	}));
	results.sort((a, b) => b.score - a.score || a.index - b.index);
	assignRanks(results, (a, b) => a.score === b.score);
	return results;
}

// --- Borda count tally ---
// rank 0 (top) = N-1 points, rank N-1 = 0 points

export function tallyResults(choices: string[], votes: Vote[], cs: string): TallyResult {
	const n = choices.length;
	const ballots = decodeBallots(n, votes, cs);
	const scores = new Array(n).fill(0);
	for (const perm of ballots) {
		for (let r = 0; r < n; r++) {
			scores[perm[r]] += n - 1 - r;
		}
	}
	return { results: rankByScore(choices, scores), valid: ballots.length };
}

// --- First Past The Post (FPTP) ---
// Count first choices only; most votes wins

export function tallyFPTP(choices: string[], votes: Vote[], cs: string): TallyResult {
	const n = choices.length;
	const ballots = decodeBallots(n, votes, cs);
	const firstChoiceVotes = new Array(n).fill(0);
	for (const perm of ballots) firstChoiceVotes[perm[0]]++;
	return { results: rankByScore(choices, firstChoiceVotes), valid: ballots.length };
}

// --- Instant Runoff Voting (IRV) ---
// Eliminate lowest, redistribute until someone has >50%.
// Score: the candidate's vote count in the last round they took part in.
// Ranking: winner (or tied winners) first, then by how long a candidate
// survived, then by that last-round count.
//
// Ties for last place never depend on the order choices were listed in:
// 1. Backward tie-break: among the tied, keep only those lowest in the
//    previous round, then the round before, and so on.
// 2. If still tied, explore every way of resolving the tie. When all lead to
//    the same winner, the tied candidates are eliminated together (they share
//    a rank). Otherwise the count stops and every possible winner shares
//    first place, reported in `tie`.

export interface IRVRound {
	/** First-choice counts among candidates still active (0 for eliminated ones). */
	counts: number[];
	/** Candidates eliminated at the end of this round; empty in the final round. */
	eliminated: number[];
}

export interface IRVResult extends TallyResult {
	rounds: IRVRound[];
}

function firstChoiceCounts(ballots: number[][], active: (i: number) => boolean, n: number) {
	const counts = new Array(n).fill(0);
	for (const ballot of ballots) {
		for (const choice of ballot) {
			if (active(choice)) {
				counts[choice]++;
				break;
			}
		}
	}
	return counts;
}

// Every candidate that can win IRV from the given active set under some
// resolution of the remaining last-place ties. Memoised by active bitmask.
function irvPossibleWinners(
	ballots: number[][],
	n: number,
	mask: number,
	memo: Map<number, number[]>
): number[] {
	const cached = memo.get(mask);
	if (cached) return cached;
	const isActive = (i: number) => (mask & (1 << i)) !== 0;
	const active: number[] = [];
	for (let i = 0; i < n; i++) if (isActive(i)) active.push(i);

	let winners: number[];
	const counts = firstChoiceCounts(ballots, isActive, n);
	const majority = active.find((c) => counts[c] > ballots.length / 2);
	if (majority !== undefined) {
		winners = [majority];
	} else if (active.length === 1) {
		winners = active;
	} else {
		const minCount = Math.min(...active.map((c) => counts[c]));
		const found = new Set<number>();
		for (const c of active) {
			if (counts[c] !== minCount) continue;
			for (const w of irvPossibleWinners(ballots, n, mask & ~(1 << c), memo)) found.add(w);
		}
		winners = [...found].sort((a, b) => a - b);
	}
	memo.set(mask, winners);
	return winners;
}

export function tallyIRV(choices: string[], votes: Vote[], cs: string): IRVResult {
	const n = choices.length;
	const ballots = decodeBallots(n, votes, cs);
	const valid = ballots.length;

	if (valid === 0) {
		const results: Result[] = choices.map((text, i) => ({ text, score: 0, index: i, rank: 0 }));
		return { results, valid: 0, rounds: [] };
	}

	const active = new Set<number>();
	for (let i = 0; i < n; i++) active.add(i);

	const eliminationRound = new Array(n).fill(0);
	const lastCount = new Array(n).fill(0);
	const rounds: IRVRound[] = [];
	const memo = new Map<number, number[]>();
	let winner: number | null = null;
	let tie: number[] | undefined;

	while (active.size > 0) {
		// Count first-choice votes among active candidates
		const counts = firstChoiceCounts(ballots, (c) => active.has(c), n);
		for (const c of active) lastCount[c] = counts[c];
		const round: IRVRound = { counts, eliminated: [] };
		rounds.push(round);

		// Every ballot ranks every candidate, so a majority of valid ballots
		// is a majority of continuing ballots
		for (const choice of active) {
			if (counts[choice] > valid / 2) {
				winner = choice;
				break;
			}
		}
		if (winner !== null) break;

		if (active.size === 1) {
			winner = Array.from(active)[0];
			break;
		}

		// Find lowest
		const minCount = Math.min(...Array.from(active).map((c) => counts[c]));
		let tied = Array.from(active).filter((c) => counts[c] === minCount);

		// Backward tie-break through earlier rounds, most recent first
		for (let r = rounds.length - 2; r >= 0 && tied.length > 1; r--) {
			const earlier = rounds[r].counts;
			const low = Math.min(...tied.map((c) => earlier[c]));
			tied = tied.filter((c) => earlier[c] === low);
		}

		if (tied.length > 1) {
			let mask = 0;
			for (const c of active) mask |= 1 << c;
			const possible = irvPossibleWinners(ballots, n, mask, memo);
			if (possible.length > 1) {
				tie = possible;
				break;
			}
			// Order among the tied cannot change the winner: drop them together
		}

		round.eliminated = tied;
		for (const c of tied) {
			active.delete(c);
			eliminationRound[c] = rounds.length;
		}
	}

	const first = (i: number) => i === winner || (tie?.includes(i) ?? false);
	// Survivors outrank anyone eliminated; later eliminations outrank earlier ones
	const stage = (i: number) => (eliminationRound[i] === 0 ? Infinity : eliminationRound[i]);

	const results: Result[] = choices.map((text, i) => ({
		text,
		score: lastCount[i],
		index: i,
		rank: 0,
		...(eliminationRound[i] > 0 ? { eliminatedRound: eliminationRound[i] } : {})
	}));
	results.sort(
		(a, b) =>
			Number(first(b.index)) - Number(first(a.index)) ||
			stage(b.index) - stage(a.index) ||
			b.score - a.score ||
			a.index - b.index
	);
	assignRanks(results, (a, b) =>
		first(a.index) && first(b.index)
			? true
			: first(a.index) === first(b.index) &&
				stage(a.index) === stage(b.index) &&
				a.score === b.score
	);

	return tie ? { results, valid, rounds, tie } : { results, valid, rounds };
}

// --- Condorcet winner + Copeland ranking ---
// Pairwise comparisons. The Condorcet winner beats every other candidate
// head to head and may not exist. The ranking is Copeland (pairwise wins
// minus pairwise losses), which can put a non-Condorcet candidate first.

export interface CondorcetResult extends TallyResult {
	/** Candidate index that beats every other head to head, or null. */
	condorcetWinner: number | null;
	/**
	 * True when every candidate loses at least one head-to-head contest, so the
	 * strict majority preferences contain a cycle. False when there is a
	 * Condorcet winner or the absence of one is due to pairwise ties only.
	 */
	cycle: boolean;
}

export function tallyCondorcet(choices: string[], votes: Vote[], cs: string): CondorcetResult {
	const n = choices.length;
	const ballots = decodeBallots(n, votes, cs);
	const valid = ballots.length;

	// Pairwise matrix: pairwise[i][j] = votes for i over j
	const pairwise = Array.from({ length: n }, () => new Array(n).fill(0));

	for (const ballot of ballots) {
		for (let i = 0; i < n; i++) {
			for (let j = i + 1; j < n; j++) {
				const rankI = ballot.indexOf(i);
				const rankJ = ballot.indexOf(j);
				if (rankI < rankJ) {
					pairwise[i][j]++;
				} else {
					pairwise[j][i]++;
				}
			}
		}
	}

	// Count wins for each candidate
	const wins = new Array(n).fill(0);
	const losses = new Array(n).fill(0);

	for (let i = 0; i < n; i++) {
		for (let j = 0; j < n; j++) {
			if (i !== j && pairwise[i][j] > pairwise[j][i]) {
				wins[i]++;
			} else if (i !== j && pairwise[i][j] < pairwise[j][i]) {
				losses[i]++;
			}
		}
	}

	// Condorcet winner beats all others; there is at most one
	let condorcetWinner: number | null = null;
	if (valid > 0) {
		for (let i = 0; i < n; i++) if (wins[i] === n - 1) condorcetWinner = i;
	}
	const cycle = valid > 0 && condorcetWinner === null && losses.every((l) => l > 0);

	// Copeland ranking: net pairwise wins
	const results = rankByScore(
		choices,
		wins.map((w, i) => w - losses[i])
	);

	return { results, valid, condorcetWinner, cycle };
}

// --- Saved votes ---
// The tally page keeps entered votes in localStorage per election so a
// reload or a trip to the vote page does not lose them.

export function votesStorageKey(cs: string): string {
	return `rank-vote:votes:${cs}`;
}

/**
 * Parse saved votes, keeping only well-formed entries with a code valid for
 * this election and the last entry for each name. Never throws.
 */
export function parseStoredVotes(raw: string | null, numChoices: number, cs: string): Vote[] {
	if (!raw) return [];
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		return [];
	}
	if (!Array.isArray(data)) return [];
	const byName = new Map<string, Vote>();
	for (const item of data) {
		if (typeof item !== 'object' || item === null) continue;
		const { name, code } = item as Record<string, unknown>;
		if (typeof name !== 'string' || !name.trim() || typeof code !== 'string') continue;
		if (!isValidCode(code, numChoices, cs)) continue;
		byName.delete(name);
		byName.set(name, { name, code: cb32Normalize(code) });
	}
	return [...byName.values()];
}
