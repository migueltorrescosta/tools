/**
 * Share link and autosave for the Information Pricing page: a versioned JSON
 * envelope `{v: 1, model}`, deflated and base64url-encoded for `#m=`, and
 * stored as plain JSON in localStorage. Decoding validates the shape strictly
 * but does not parse formulas (the page re-parses them). No DOM imports.
 */
import { readJson, type PersistGate } from '$lib/persist-gate';
import { familyInfo, isFamily } from './distributions';
import { MAX_FORMULA_LENGTH } from './formula/ast';
import { MAX_SYMBOLS } from './model';
import {
	MAX_SAMPLES,
	type Constant,
	type Decisions,
	type Intermediate,
	type Model,
	type RandomInput
} from './types';

/** Every localStorage key the tool writes starts with this. */
export const STORAGE_PREFIX = 'information-pricing:';
/** The last edited model, as `{v: 1, model}` JSON. */
export const AUTOSAVE_KEY = `${STORAGE_PREFIX}model`;
/** The share-link hash parameter, as in `#m=…`. */
export const HASH_PARAM = 'm';

export const VERSION = 1;
export const MAX_DECISIONS = 100;
export const MAX_SYMBOL_LENGTH = 64;
export const MAX_NAME_LENGTH = 200;
export const MAX_UNIT_LENGTH = 32;
/** Inflated JSON cap (zip-bomb guard); fits 200 formulas of 2,000 characters. */
export const MAX_INFLATED_BYTES = 512 * 1024;
/** Encoded text cap, checked before inflating. */
export const MAX_ENCODED_LENGTH = 512 * 1024;

export type DecodeResult = { ok: true; model: Model } | { ok: false; error: string };

class ShapeError extends Error {}

function fail(message: string): never {
	throw new ShapeError(message);
}

function record(value: unknown, path: string): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		fail(`${path} must be an object.`);
	}
	return value as Record<string, unknown>;
}

function array(value: unknown, path: string, max: number): unknown[] {
	if (!Array.isArray(value)) fail(`${path} must be a list.`);
	if (value.length > max) fail(`${path} has more than ${max} entries.`);
	return value;
}

function str(value: unknown, path: string, max: number): string {
	if (typeof value !== 'string') fail(`${path} must be text.`);
	if (value.length > max) fail(`${path} is longer than ${max} characters.`);
	return value;
}

function num(value: unknown, path: string): number {
	if (typeof value !== 'number' || !Number.isFinite(value))
		fail(`${path} must be a finite number.`);
	return value;
}

function symbol(value: unknown, path: string): string {
	const s = str(value, path, MAX_SYMBOL_LENGTH);
	if (!s) fail(`${path} is empty.`);
	return s;
}

function input(value: unknown, path: string): RandomInput {
	const o = record(value, path);
	if (!isFamily(o.family)) fail(`${path}.family is not a known distribution.`);
	const count = familyInfo(o.family).params.length;
	const params = array(o.params, `${path}.params`, count);
	if (params.length !== count) fail(`${path}.params must have ${count} values.`);
	return {
		symbol: symbol(o.symbol, `${path}.symbol`),
		name: str(o.name, `${path}.name`, MAX_NAME_LENGTH),
		family: o.family,
		params: params.map((p, i) => num(p, `${path}.params[${i}]`))
	};
}

function constant(value: unknown, path: string): Constant {
	const o = record(value, path);
	return {
		symbol: symbol(o.symbol, `${path}.symbol`),
		value: num(o.value, `${path}.value`),
		name: str(o.name, `${path}.name`, MAX_NAME_LENGTH)
	};
}

function intermediate(value: unknown, path: string): Intermediate {
	const o = record(value, path);
	return {
		symbol: symbol(o.symbol, `${path}.symbol`),
		name: str(o.name, `${path}.name`, MAX_NAME_LENGTH),
		formula: str(o.formula, `${path}.formula`, MAX_FORMULA_LENGTH)
	};
}

function decisions(value: unknown, path: string): Decisions {
	const o = record(value, path);
	const values = array(o.values, `${path}.values`, MAX_DECISIONS);
	if (values.length === 0) fail(`${path}.values is empty.`);
	return {
		symbol: symbol(o.symbol, `${path}.symbol`),
		values: values.map((v, i) => num(v, `${path}.values[${i}]`)),
		label: str(o.label, `${path}.label`, MAX_NAME_LENGTH),
		reward: str(o.reward, `${path}.reward`, MAX_FORMULA_LENGTH),
		unit: str(o.unit, `${path}.unit`, MAX_UNIT_LENGTH)
	};
}

/** A fresh `Model` holding only the known fields of `value`; throws ShapeError on any mismatch. */
function model(value: unknown): Model {
	const o = record(value, 'model');
	const inputs = array(o.inputs, 'inputs', MAX_SYMBOLS).map((x, i) => input(x, `inputs[${i}]`));
	const constants = array(o.constants, 'constants', MAX_SYMBOLS).map((x, i) =>
		constant(x, `constants[${i}]`)
	);
	const intermediates = array(o.intermediates, 'intermediates', MAX_SYMBOLS).map((x, i) =>
		intermediate(x, `intermediates[${i}]`)
	);
	if (inputs.length + constants.length + intermediates.length + 1 > MAX_SYMBOLS) {
		fail(`The model declares more than ${MAX_SYMBOLS} symbols.`);
	}
	const seed = num(o.seed, 'seed');
	if (!Number.isSafeInteger(seed)) fail('seed must be a whole number.');
	const samples = num(o.samples, 'samples');
	if (!Number.isInteger(samples) || samples < 1 || samples > MAX_SAMPLES) {
		fail(`samples must be a whole number from 1 to ${MAX_SAMPLES}.`);
	}
	return {
		inputs,
		constants,
		intermediates,
		decisions: decisions(o.decisions, 'decisions'),
		seed,
		samples
	};
}

/** Validate a parsed `{v: 1, model}` envelope (share link or autosave). */
export function parseEnvelope(value: unknown): DecodeResult {
	try {
		const o = record(value, 'The saved data');
		if (o.v !== VERSION) fail(`Unsupported version ${JSON.stringify(o.v) ?? 'none'}.`);
		return { ok: true, model: model(o.model) };
	} catch (err) {
		if (err instanceof ShapeError) return { ok: false, error: err.message };
		throw err;
	}
}

/** The envelope as JSON text. */
export function serialiseModel(model: Model): string {
	return JSON.stringify({ v: VERSION, model });
}

function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array | null {
	if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
	const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

/** Inflate raw-deflate bytes, or null when they are corrupt or inflate past `max` bytes. */
async function inflate(bytes: Uint8Array, max: number): Promise<Uint8Array | null> {
	const stream = new Blob([bytes as Uint8Array<ArrayBuffer>])
		.stream()
		.pipeThrough(new DecompressionStream('deflate-raw'));
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.length;
			if (total > max) {
				await reader.cancel().catch(() => {});
				return null;
			}
			chunks.push(value);
		}
	} catch {
		return null;
	}
	const out = new Uint8Array(total);
	let offset = 0;
	for (const c of chunks) {
		out.set(c, offset);
		offset += c.length;
	}
	return out;
}

/** The share-link payload for `#m=`: deflated envelope JSON, base64url without padding. */
export async function encodeModel(model: Model): Promise<string> {
	const json = new TextEncoder().encode(serialiseModel(model));
	const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
	return toBase64Url(new Uint8Array(await new Response(stream).arrayBuffer()));
}

/** Decode and validate a share-link payload. */
export async function decodeModel(text: string): Promise<DecodeResult> {
	if (text.length > MAX_ENCODED_LENGTH) return { ok: false, error: 'The link is too long.' };
	const bytes = fromBase64Url(text);
	if (!bytes) return { ok: false, error: 'The link is not valid base64url.' };
	const inflated = await inflate(bytes, MAX_INFLATED_BYTES);
	if (!inflated) return { ok: false, error: 'The link is corrupt or too large.' };
	let value: unknown;
	try {
		value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(inflated));
	} catch {
		return { ok: false, error: 'The link does not hold valid JSON.' };
	}
	return parseEnvelope(value);
}

/** The autosaved model, or null when absent, corrupt or invalid. */
export function loadSaved(storage: Pick<Storage, 'getItem'> | null): Model | null {
	const result = parseEnvelope(readJson<unknown>(storage, AUTOSAVE_KEY));
	return result.ok ? result.model : null;
}

/** Autosave `model` through the page's persist gate (dropped until the gate opens). */
export function saveModel(gate: PersistGate, model: Model): void {
	gate.write(AUTOSAVE_KEY, serialiseModel(model));
}
