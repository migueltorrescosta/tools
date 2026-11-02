/** Share URLs and saved state for the Chaos Game page. No DOM imports. */
import { MAX_POINTS } from './engine';
import type { ColourMode, GamePoint, Matrix, Setup } from './types';

/** Every localStorage key the tool writes starts with this. */
export const STORAGE_PREFIX = 'chaos-game:';
/** The last state, as a share query string. */
export const STATE_KEY = `${STORAGE_PREFIX}state`;

export interface ShareState {
	setup: Setup;
	colour: ColourMode;
	gamma: number;
	/** The challenge being attempted, if any. */
	challenge: string | null;
}

export const GAMMA_RANGE = { min: 0.5, max: 5 } as const;

// Fields are joined with '_' and points with '*', which URLSearchParams leaves unencoded.
const FIELD = '_';
const POINT = '*';
const num = (v: number) => String(v);

function encodePoint(p: GamePoint): string {
	const fields = [num(p.x), num(p.y), p.weight ?? '', p.ratio ?? '', p.rotation ?? ''].map(String);
	if (p.matrix) fields.push(...p.matrix.map(num));
	// Drop trailing defaults
	while (fields.length > 2 && fields[fields.length - 1] === '') fields.pop();
	return fields.join(FIELD);
}

function decodePoint(text: string): GamePoint | null {
	const f = text.split(FIELD);
	const opt = (i: number) => (f[i] === undefined || f[i] === '' ? undefined : Number(f[i]));
	const x = Number(f[0]);
	const y = Number(f[1]);
	if (f.length < 2 || f[0] === '' || f[1] === '' || !Number.isFinite(x) || !Number.isFinite(y))
		return null;
	const p: GamePoint = { x, y };
	const weight = opt(2);
	const ratio = opt(3);
	const rotation = opt(4);
	if (weight !== undefined) p.weight = weight;
	if (ratio !== undefined) p.ratio = ratio;
	if (rotation !== undefined) p.rotation = rotation;
	if (f.length === 9) {
		const m = f.slice(5).map(Number);
		if (m.every(Number.isFinite)) p.matrix = m as Matrix;
	}
	for (const v of [p.weight, p.ratio, p.rotation])
		if (v !== undefined && !Number.isFinite(v)) return null;
	return p;
}

export function encodeShareParams(s: ShareState): URLSearchParams {
	const params = new URLSearchParams();
	params.set('p', s.setup.points.map(encodePoint).join(POINT));
	params.set('r', num(s.setup.ratio));
	if (s.setup.rule.forbid.length) params.set('f', s.setup.rule.forbid.join(FIELD));
	params.set('s', num(s.setup.seed));
	params.set('c', s.colour === 'point' ? 'p' : 'd');
	params.set('g', num(s.gamma));
	if (s.challenge) params.set('ch', s.challenge);
	return params;
}

export function hasShareParams(params: URLSearchParams): boolean {
	return params.has('p');
}

/** The valid parts of a share link; the page keeps its own values for the rest. */
export interface DecodedShare {
	setup?: Partial<Setup>;
	colour?: ColourMode;
	gamma?: number;
	challenge?: string | null;
}

export function decodeShareParams(params: URLSearchParams): DecodedShare {
	const out: DecodedShare = {};
	const setup: Partial<Setup> = {};
	const p = params.get('p');
	if (p !== null) {
		const points = p === '' ? [] : p.split(POINT).map(decodePoint);
		if (points.every((q) => q !== null) && points.length <= MAX_POINTS)
			setup.points = points as GamePoint[];
	}
	const r = Number(params.get('r'));
	if (params.has('r') && r > 0 && r < 1) setup.ratio = r;
	const f = params.get('f');
	if (f !== null) {
		const forbid = f.split(FIELD).map(Number);
		if (forbid.every(Number.isInteger)) setup.rule = { forbid };
	} else if (p !== null) setup.rule = { forbid: [] };
	const seed = Number(params.get('s'));
	if (params.has('s') && Number.isInteger(seed)) setup.seed = seed;
	if (Object.keys(setup).length) out.setup = setup;
	const c = params.get('c');
	if (c === 'p' || c === 'd') out.colour = c === 'p' ? 'point' : 'density';
	const g = Number(params.get('g'));
	if (params.has('g') && g >= GAMMA_RANGE.min && g <= GAMMA_RANGE.max) out.gamma = g;
	const ch = params.get('ch');
	out.challenge = ch && /^[a-z-]+$/.test(ch) ? ch : null;
	return out;
}
