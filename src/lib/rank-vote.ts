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

// Character class for valid Crockford Base32 chars (after normalization)
export const CB32_CHAR_CLASS = '0-9A-HJ-KM-NP-TV-Z';

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
		if (typeof data.cs !== 'string') return null;
		return data;
	} catch {
		return null;
	}
}

// --- Vote code validation ---
export function isValidCode(code: string, numChoices: number): boolean {
	const num = cb32Decode(code);
	return num !== null && num < factorial(numChoices);
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

// --- Borda count tally ---
// rank 0 (top) = N-1 points, rank N-1 = 0 points

export interface Vote {
	name: string;
	code: string;
}

export interface Result {
	text: string;
	score: number;
	index: number;
	rank: number;
}

export interface TallyResult {
	results: Result[];
	valid: number;
}

export function tallyResults(choices: string[], votes: Vote[]): TallyResult {
	const n = choices.length;
	const scores = new Array(n).fill(0);
	let valid = 0;

	for (const v of votes) {
		const decoded = cb32Decode(v.code);
		if (!isValidCode(v.code, n) || decoded === null) continue;
		const perm = intToPerm(decoded, n);
		for (let r = 0; r < n; r++) {
			scores[perm[r]] += n - 1 - r;
		}
		valid++;
	}

	const results: Result[] = choices.map((text, i) => ({ text, score: scores[i], index: i, rank: 0 }));
	results.sort((a, b) => b.score - a.score || a.index - b.index);

	// Competition ranking for ties
	for (let i = 0; i < results.length; i++) {
		results[i].rank =
			i === 0 || results[i].score !== results[i - 1].score ? i + 1 : results[i - 1].rank;
	}

	return { results, valid };
}

// --- First Past The Post (FPTP) ---
// Count first choices only; most votes wins

export function tallyFPTP(choices: string[], votes: Vote[]): TallyResult {
	const n = choices.length;
	const firstChoiceVotes = new Array(n).fill(0);
	let valid = 0;

	for (const v of votes) {
		const decoded = cb32Decode(v.code);
		if (!isValidCode(v.code, n) || decoded === null) continue;
		const perm = intToPerm(decoded, n);
		firstChoiceVotes[perm[0]]++;
		valid++;
	}

	const results: Result[] = choices.map((text, i) => ({
		text,
		score: firstChoiceVotes[i],
		index: i,
		rank: 0
	}));
	results.sort((a, b) => b.score - a.score || a.index - b.index);

	// Competition ranking for ties
	for (let i = 0; i < results.length; i++) {
		results[i].rank =
			i === 0 || results[i].score !== results[i - 1].score ? i + 1 : results[i - 1].rank;
	}

	return { results, valid };
}

// --- Instant Runoff Voting (IRV) ---
// Eliminate lowest, redistribute until someone has >50%

export function tallyIRV(choices: string[], votes: Vote[]): TallyResult {
	const n = choices.length;
	let valid = 0;

	// Decode all valid votes into arrays of preferences
	const ballots: number[][] = [];
	for (const v of votes) {
		const decoded = cb32Decode(v.code);
		if (!isValidCode(v.code, n) || decoded === null) continue;
		ballots.push(intToPerm(decoded, n));
		valid++;
	}

	if (valid === 0) {
		const results: Result[] = choices.map((text, i) => ({ text, score: 0, index: i, rank: i + 1 }));
		return { results, valid: 0 };
	}

	// Track which candidates are still in the running
	const active = new Set<number>();
	for (let i = 0; i < n; i++) active.add(i);

	// Track rounds for each candidate
	const roundsWon: number[] = new Array(n).fill(0);

	while (active.size > 0) {
		// Count first-choice votes among active candidates
		const counts = new Array(n).fill(0);
		for (const ballot of ballots) {
			// Find first choice that's still active
			for (const choice of ballot) {
				if (active.has(choice)) {
					counts[choice]++;
					break;
				}
			}
		}

		const totalActiveVotes = Array.from(active).reduce((sum, i) => sum + counts[i], 0);
		if (totalActiveVotes === 0) break;

		// Check for winner with >50%
		for (const choice of active) {
			if (counts[choice] > totalActiveVotes / 2) {
				roundsWon[choice]++;
				active.delete(choice);
				break;
			}
		}

		// Find lowest and eliminate
		if (active.size > 0) {
			let minCount = Infinity;
			let minChoices: number[] = [];
			for (const choice of active) {
				if (counts[choice] < minCount) {
					minCount = counts[choice];
					minChoices = [choice];
				} else if (counts[choice] === minCount) {
					minChoices.push(choice);
				}
			}

			// If multiple tied for last, eliminate first by index
			if (minChoices.length === active.size) {
				// All remaining tied - all get 1 round
				for (const choice of active) {
					roundsWon[choice]++;
				}
				break;
			}

			// Eliminate the lowest (by index if tied)
			minChoices.sort((a, b) => a - b);
			active.delete(minChoices[0]);
		}
	}

	// Convert rounds won to final scores (more rounds = higher score)
	const results: Result[] = choices.map((text, i) => ({
		text,
		score: roundsWon[i],
		index: i,
		rank: 0
	}));
	results.sort((a, b) => b.score - a.score || a.index - b.index);

	// Assign ranks
	for (let i = 0; i < results.length; i++) {
		results[i].rank =
			i === 0 || results[i].score !== results[i - 1].score ? i + 1 : results[i - 1].rank;
	}

	return { results, valid };
}

// --- Condorcet Method ---
// Pairwise comparisons; winner beats all others

export function tallyCondorcet(choices: string[], votes: Vote[]): TallyResult {
	const n = choices.length;
	let valid = 0;

	// Decode all valid votes
	const ballots: number[][] = [];
	for (const v of votes) {
		const decoded = cb32Decode(v.code);
		if (!isValidCode(v.code, n) || decoded === null) continue;
		ballots.push(intToPerm(decoded, n));
		valid++;
	}

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

	// Condorcet winner has wins against all others
	const results: Result[] = choices.map((text, i) => ({
		text,
		score: wins[i] - losses[i], // Net wins
		index: i,
		rank: 0
	}));
	results.sort((a, b) => b.score - a.score || a.index - b.index);

	// Assign ranks
	for (let i = 0; i < results.length; i++) {
		results[i].rank =
			i === 0 || results[i].score !== results[i - 1].score ? i + 1 : results[i - 1].rank;
	}

	return { results, valid };
}
