/** Share URLs and saved state for the Ancilla vs MZI page. No DOM imports. */
import { readJson } from '$lib/persist-gate';
import { DEFAULT_BUDGET, cloneNoise, defaultSetup, noiseless, sameNoise } from './presets';
import type {
	Budget,
	LorentzianKind,
	Pulse,
	PulseTarget,
	RegisterNoise,
	RunSnapshot,
	Setup
} from './types';

/** Every localStorage key the tool writes starts with this. */
export const STORAGE_PREFIX = 'ancilla-mzi:';
/** The last setup and budget, as a share query string. */
export const SETUP_KEY = `${STORAGE_PREFIX}setup`;
/** The last finished run, with the query string of the setup it ran. */
export const RESULT_KEY = `${STORAGE_PREFIX}result`;

export interface ShareState {
	setup: Setup;
	budget: Budget;
}

export interface SavedResult {
	/** encodeShareParams of the run's setup and budget. */
	query: string;
	snapshot: RunSnapshot;
}

// Values are joined with '_' and pulse targets are letters, so nothing needs percent-encoding.
const SEP = '_';
const KEYS = [
	'n',
	'in',
	'a',
	'cp',
	'fa',
	'fs',
	'cb',
	'pb',
	'p',
	'ns',
	'ls',
	'na',
	'la',
	'mp',
	'ah',
	'pm',
	'b'
];
const TARGET_CODE: Record<PulseTarget, string> = { A: 'A', S: 'S', both: 'B' };
const KIND_CODE: Record<LorentzianKind, string> = {
	none: 'n',
	dephasing: 'd',
	amplitudeDamping: 'a'
};

// Shortest exact form, so a setup round-trips unchanged
const num = (v: number) => String(v);
const bits = (xs: readonly boolean[]) => xs.map((x) => (x ? '1' : '0')).join('');

function encodeMarkov(n: RegisterNoise): string {
	const m = n.markov;
	return [m.dephasing, m.amplitudeDamping, m.nbar, m.depolarizing, m.transverse].map(num).join(SEP);
}

function encodeLorentzian(n: RegisterNoise): string {
	const l = n.lorentzian;
	return [KIND_CODE[l.kind], num(l.gamma), num(l.lambda)].join(SEP);
}

export function encodeShareParams({ setup: s, budget: b }: ShareState): URLSearchParams {
	const params = new URLSearchParams();
	params.set('n', `${s.nS}${SEP}${s.nA}`);
	params.set('in', s.input === 'full' ? 'f' : 's');
	params.set('a', num(s.ancillaWeight));
	params.set('cp', bits(s.coupling));
	params.set('fa', bits(s.fieldA));
	params.set('fs', bits(s.fieldS));
	params.set('cb', num(s.controlBound));
	// In units of pi, so the default 2 pi is exact
	params.set('pb', num(s.pulseBound / Math.PI));
	// Pulse times to 4 decimals, so the default t/3 doesn't fill the link with digits
	params.set(
		'p',
		s.pulses.map((p) => `${num(Number(p.time.toFixed(4)))}${TARGET_CODE[p.target]}`).join(SEP)
	);
	params.set('ns', encodeMarkov(s.noise.system));
	if (s.noise.system.lorentzian.kind !== 'none') params.set('ls', encodeLorentzian(s.noise.system));
	// No ancilla noise in the URL means "same as the system"
	if (!sameNoise(s.noise.system, s.noise.ancilla)) {
		params.set('na', encodeMarkov(s.noise.ancilla));
		if (s.noise.ancilla.lorentzian.kind !== 'none')
			params.set('la', encodeLorentzian(s.noise.ancilla));
	}
	params.set('mp', String(s.mziParticles));
	params.set('ah', num(s.ancillaHold));
	params.set('pm', String(s.pmLevels));
	params.set(
		'b',
		[b.steps, b.rounds, b.maxIter, b.seesawIter, b.workers, b.seed].map(String).join(SEP)
	);
	return params;
}

function finite(raw: string | null | undefined): number | undefined {
	if (raw === null || raw === undefined || raw.trim() === '') return undefined;
	const v = Number(raw);
	return Number.isFinite(v) ? v : undefined;
}

function int(raw: string | null | undefined, min: number, max: number): number | undefined {
	const v = finite(raw);
	return v !== undefined && Number.isInteger(v) && v >= min && v <= max ? v : undefined;
}

function nonNegative(raw: string | null | undefined): number | undefined {
	const v = finite(raw);
	return v !== undefined && v >= 0 ? v : undefined;
}

function decodeBits(raw: string | null, length: number): boolean[] | undefined {
	if (raw === null || !new RegExp(`^[01]{${length}}$`).test(raw)) return undefined;
	return [...raw].map((c) => c === '1');
}

function decodeMarkov(raw: string | null, into: RegisterNoise): boolean {
	const parts = raw?.split(SEP);
	if (!parts || parts.length !== 5) return false;
	const values = parts.map(nonNegative);
	if (values.some((v) => v === undefined)) return false;
	const [dephasing, amplitudeDamping, nbar, depolarizing, transverse] = values as number[];
	into.markov = { dephasing, amplitudeDamping, nbar, depolarizing, transverse };
	return true;
}

function decodeLorentzian(raw: string | null, into: RegisterNoise): void {
	const [code, g, l] = raw?.split(SEP) ?? [];
	const kind = (Object.keys(KIND_CODE) as LorentzianKind[]).find((k) => KIND_CODE[k] === code);
	const gamma = nonNegative(g);
	const lambda = nonNegative(l);
	if (kind && gamma !== undefined && lambda !== undefined)
		into.lorentzian = { kind, gamma, lambda };
}

function decodePulses(raw: string | null): Pulse[] | undefined {
	if (raw === null) return undefined;
	if (raw === '') return [];
	const pulses: Pulse[] = [];
	for (const part of raw.split(SEP).slice(0, 8)) {
		const m = /^(.+)([ASB])$/.exec(part);
		const time = m ? finite(m[1]) : undefined;
		if (!m || time === undefined) return undefined;
		const target = (Object.keys(TARGET_CODE) as PulseTarget[]).find(
			(t) => TARGET_CODE[t] === m[2]
		) as PulseTarget;
		pulses.push({ time, target });
	}
	return pulses;
}

/**
 * Read a setup and budget from a share URL. Missing or garbled values fall
 * back to the defaults one by one; whether the result can run is
 * validateSetup's job.
 */
export function decodeShareParams(params: URLSearchParams): ShareState {
	const setup = defaultSetup();
	const budget: Budget = { ...DEFAULT_BUDGET };

	const [rs, ra] = params.get('n')?.split(SEP) ?? [];
	const nS = int(rs, 1, 4);
	const nA = int(ra, 0, 3);
	if (nS !== undefined && nA !== undefined) {
		setup.nS = nS;
		setup.nA = nA;
	}
	const N = setup.nS + setup.nA;
	setup.mziParticles = int(params.get('mp'), 1, 8) ?? N;

	const input = params.get('in');
	if (input === 'f' || input === 's') setup.input = input === 'f' ? 'full' : 'sym';
	setup.ancillaWeight = nonNegative(params.get('a')) ?? setup.ancillaWeight;
	setup.coupling = decodeBits(params.get('cp'), 9) ?? setup.coupling;
	setup.fieldA = (decodeBits(params.get('fa'), 3) as Setup['fieldA']) ?? setup.fieldA;
	setup.fieldS = (decodeBits(params.get('fs'), 3) as Setup['fieldS']) ?? setup.fieldS;
	const cb = finite(params.get('cb'));
	if (cb !== undefined && cb > 0) setup.controlBound = cb;
	const pb = finite(params.get('pb'));
	if (pb !== undefined && pb > 0) setup.pulseBound = pb * Math.PI;
	setup.ancillaHold = nonNegative(params.get('ah')) ?? setup.ancillaHold;
	setup.pulses = decodePulses(params.get('p')) ?? setup.pulses;
	setup.pmLevels = int(params.get('pm'), 2, 3) ?? setup.pmLevels;

	const system = cloneNoise(setup.noise.system);
	if (params.has('ns') || params.has('ls')) {
		if (!decodeMarkov(params.get('ns'), system)) system.markov = noiseless().markov;
		decodeLorentzian(params.get('ls'), system);
	}
	const ancilla = cloneNoise(system);
	if (params.has('na') || params.has('la')) {
		const own = noiseless();
		decodeMarkov(params.get('na'), own);
		decodeLorentzian(params.get('la'), own);
		ancilla.markov = own.markov;
		ancilla.lorentzian = own.lorentzian;
	}
	setup.noise = { system, ancilla };

	const b = params.get('b')?.split(SEP) ?? [];
	budget.steps = int(b[0], 2, 400) ?? budget.steps;
	budget.rounds = int(b[1], 1, 50) ?? budget.rounds;
	budget.maxIter = int(b[2], 1, 1000) ?? budget.maxIter;
	budget.seesawIter = int(b[3], 1, 1000) ?? budget.seesawIter;
	budget.workers = int(b[4], 0, 16) ?? budget.workers;
	budget.seed = int(b[5], 0, 2 ** 32 - 1) ?? budget.seed;
	return { setup, budget };
}

/** True when the URL carries any share setting, so it takes priority over saved settings. */
export function hasShareParams(params: URLSearchParams): boolean {
	return KEYS.some((key) => params.has(key));
}

/** The saved run, when it has the shape the page needs. */
export function readSavedResult(storage: Pick<Storage, 'getItem'> | null): SavedResult | null {
	const saved = readJson<Partial<SavedResult>>(storage, RESULT_KEY);
	const snap = saved?.snapshot;
	if (
		typeof saved?.query !== 'string' ||
		!snap ||
		typeof snap.elapsedMs !== 'number' ||
		!Array.isArray(snap.traces) ||
		typeof snap.seedsDone !== 'object' ||
		typeof snap.best !== 'object'
	)
		return null;
	return saved as SavedResult;
}
