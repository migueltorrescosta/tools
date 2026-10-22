/**
 * Model validation and compilation: symbols, formulas, the intermediates'
 * evaluation order and the shared / per-decision split, with errors located by
 * field for the editor. No DOM or Svelte imports.
 */
import {
	FUNCTIONS,
	IDENTIFIER,
	KEYWORDS,
	symbolNodes,
	type FnName,
	type Node
} from './formula/ast';
import { isFixed } from './distributions';
import { evaluate } from './formula/evaluate';
import { parse } from './formula/parse';
import { renameInFormula } from './formula/rename';
import type { Decisions, Family, Model } from './types';

export const MAX_SYMBOLS = 200;

/** Which field an error belongs to. `param` is the index into `params`. */
export type ErrorLocation =
	| { kind: 'model' }
	| { kind: 'input'; index: number; field: 'symbol' | 'params'; param?: number }
	| { kind: 'intermediate'; index: number; field: 'symbol' | 'formula' }
	| { kind: 'reward' }
	| { kind: 'decisions'; field: 'symbol' | 'values' | 'label'; index?: number };

/** A model error; `[start, end)` locates it inside the formula, when it is in one. */
export interface ModelError {
	where: ErrorLocation;
	message: string;
	start?: number;
	end?: number;
}

/** Validates one family's raw parameters (`distributions.ts` `validateParams`). */
export type ParamValidator = (
	family: Family,
	params: number[]
) => { index: number; message: string }[];

/** What a symbol resolves to once compiled; a fixed input is a `constant`, inlined by codegen. */
export type SymbolRef =
	| { kind: 'input'; slot: number }
	| { kind: 'constant'; value: number }
	| { kind: 'shared'; slot: number }
	| { kind: 'perDecision'; local: number }
	| { kind: 'decision' };

export interface CompiledIntermediate {
	symbol: string;
	/** Index in `model.intermediates`. */
	index: number;
	ast: Node;
}

/**
 * Column slots the kernel reads and writes: `cols[k]` for `k < inputs.length`
 * is random input k (model order, fixed inputs skipped, filled by the sampler); `cols[inputs.length + j]`
 * is shared intermediate j (evaluation order, filled by the kernel).
 */
export interface SlotLayout {
	inputs: string[];
	shared: string[];
}

export interface CompiledModel {
	symbols: ReadonlyMap<string, SymbolRef>;
	slots: SlotLayout;
	/** Decision-independent intermediates in evaluation order; `shared[j]` fills slot `inputs.length + j`. */
	shared: CompiledIntermediate[];
	/** Intermediates that (transitively) use the decision symbol, in evaluation order. */
	perDecision: CompiledIntermediate[];
	reward: Node;
	values: number[];
	labels: string[];
}

export type CompileResult =
	{ ok: true; compiled: CompiledModel } | { ok: false; errors: ModelError[] };

const RESERVED = new Set(['prototype', 'Infinity', 'NaN', 'undefined', 'Math']);

/** Why `name` cannot be a symbol, or null if it can. */
export function symbolProblem(name: string): string | null {
	if (name === '') return 'Symbol is empty';
	if (!IDENTIFIER.test(name))
		return 'Symbols start with a letter or _ and use only letters, digits and _';
	if (FUNCTIONS.has(name as FnName)) return `"${name}" is a function name`;
	if (KEYWORDS.has(name)) return `"${name}" is a keyword`;
	if (name.startsWith('__') || name in Object.prototype || RESERVED.has(name))
		return `"${name}" is reserved`;
	return null;
}

/** Decision labels: the template with `{symbol}` replaced by each value, or `symbol = value` when blank. */
export function decisionLabels(d: Decisions): string[] {
	const blank = d.label.trim() === '';
	return d.values.map((v) =>
		blank ? `${d.symbol} = ${v}` : d.label.replaceAll(`{${d.symbol}}`, String(v))
	);
}

type Declared =
	{ kind: 'input'; index: number } | { kind: 'intermediate'; index: number } | { kind: 'decision' };

/** The inputs the engine samples (every input but the fixed ones), in model order. */
export function randomInputs<T extends { family: Family }>(model: { inputs: T[] }): T[] {
	return model.inputs.filter((i) => !isFixed(i));
}

/** Validate and compile `model`; `validateParams` checks each input's family parameters. */
export function compileModel(model: Model, validateParams?: ParamValidator): CompileResult {
	const errors: ModelError[] = [];
	const declared = new Map<string, Declared>();

	const declare = (symbol: string, decl: Declared, where: ErrorLocation) => {
		const problem = symbolProblem(symbol);
		if (problem) errors.push({ where, message: problem });
		else if (declared.has(symbol))
			errors.push({ where, message: `"${symbol}" is already declared` });
		else declared.set(symbol, decl);
	};
	model.inputs.forEach((input, index) => {
		declare(input.symbol, { kind: 'input', index }, { kind: 'input', index, field: 'symbol' });
		input.params.forEach((p, param) => {
			if (!Number.isFinite(p))
				errors.push({
					where: { kind: 'input', index, field: 'params', param },
					message: 'Must be a finite number'
				});
		});
		if (validateParams && input.params.every(Number.isFinite))
			for (const e of validateParams(input.family, input.params))
				errors.push({
					where: { kind: 'input', index, field: 'params', param: e.index },
					message: e.message
				});
	});
	model.intermediates.forEach((m, index) =>
		declare(
			m.symbol,
			{ kind: 'intermediate', index },
			{ kind: 'intermediate', index, field: 'symbol' }
		)
	);
	const d = model.decisions;
	declare(d.symbol, { kind: 'decision' }, { kind: 'decisions', field: 'symbol' });
	const count = model.inputs.length + model.intermediates.length + 1;
	if (count > MAX_SYMBOLS)
		errors.push({
			where: { kind: 'model' },
			message: `At most ${MAX_SYMBOLS} symbols (inputs, intermediates and the decision); this model has ${count}`
		});

	// Formulas: parse, then resolve every symbol.
	const compileFormula = (text: string, where: ErrorLocation): Node | null => {
		const result = parse(text);
		if (!result.ok) {
			errors.push({ where, ...result.error });
			return null;
		}
		let ok = true;
		for (const s of symbolNodes(result.ast))
			if (!declared.has(s.name)) {
				errors.push({ where, message: `Unknown symbol "${s.name}"`, start: s.start, end: s.end });
				ok = false;
			}
		return ok ? result.ast : null;
	};
	const asts = model.intermediates.map((m, index) =>
		compileFormula(m.formula, { kind: 'intermediate', index, field: 'formula' })
	);
	const reward = compileFormula(d.reward, { kind: 'reward' });

	// Dependencies between intermediates, resolved through the declaration that owns each name.
	const deps = asts.map((ast) => {
		const out: number[] = [];
		if (ast)
			for (const name of new Set(symbolNodes(ast).map((s) => s.name))) {
				const decl = declared.get(name);
				if (decl?.kind === 'intermediate') out.push(decl.index);
			}
		return out;
	});
	for (const cycle of cycles(deps)) {
		const members = new Set(cycle);
		const path = [...cycle, cycle[0]].map((i) => model.intermediates[i].symbol).join(' → ');
		for (const index of cycle) {
			const ref = symbolNodes(asts[index]!).find((s) => {
				const decl = declared.get(s.name);
				return decl?.kind === 'intermediate' && members.has(decl.index);
			})!;
			errors.push({
				where: { kind: 'intermediate', index, field: 'formula' },
				message: `Cycle: ${path}`,
				start: ref.start,
				end: ref.end
			});
		}
	}

	// Decisions.
	if (d.values.length === 0)
		errors.push({
			where: { kind: 'decisions', field: 'values' },
			message: 'Add at least one decision value'
		});
	const seen = new Set<number>();
	d.values.forEach((v, index) => {
		if (!Number.isFinite(v))
			errors.push({
				where: { kind: 'decisions', field: 'values', index },
				message: 'Must be a finite number'
			});
		else if (seen.has(v))
			errors.push({
				where: { kind: 'decisions', field: 'values', index },
				message: `${v} is already a decision`
			});
		seen.add(v);
	});
	const labels = decisionLabels(d);
	if (new Set(labels).size < labels.length && seen.size === d.values.length)
		errors.push({
			where: { kind: 'decisions', field: 'label' },
			message: `Labels must differ; put {${d.symbol}} in the template`
		});

	if (errors.length > 0) return { ok: false, errors };

	// Evaluation order (depth-first post-order, model order) and the per-decision split.
	const order: number[] = [];
	const visited = new Set<number>();
	const visit = (i: number) => {
		if (visited.has(i)) return;
		visited.add(i);
		for (const j of deps[i]) visit(j);
		order.push(i);
	};
	model.intermediates.forEach((_, i) => visit(i));
	const isPerDecision = new Array<boolean>(asts.length).fill(false);
	for (const i of order)
		isPerDecision[i] =
			symbolNodes(asts[i]!).some((s) => s.name === d.symbol) ||
			deps[i].some((j) => isPerDecision[j]);

	const symbols = new Map<string, SymbolRef>();
	const random = randomInputs(model);
	for (const input of model.inputs)
		symbols.set(
			input.symbol,
			isFixed(input)
				? { kind: 'constant', value: input.params[0] }
				: { kind: 'input', slot: random.indexOf(input) }
		);
	symbols.set(d.symbol, { kind: 'decision' });
	const shared: CompiledIntermediate[] = [];
	const perDecision: CompiledIntermediate[] = [];
	for (const index of order) {
		const item = { symbol: model.intermediates[index].symbol, index, ast: asts[index]! };
		if (isPerDecision[index]) {
			symbols.set(item.symbol, { kind: 'perDecision', local: perDecision.length });
			perDecision.push(item);
		} else {
			symbols.set(item.symbol, { kind: 'shared', slot: random.length + shared.length });
			shared.push(item);
		}
	}
	return {
		ok: true,
		compiled: {
			symbols,
			slots: { inputs: random.map((i) => i.symbol), shared: shared.map((s) => s.symbol) },
			shared,
			perDecision,
			reward: reward!,
			values: [...d.values],
			labels
		}
	};
}

/** Strongly connected components that form cycles (size > 1, or a self-loop), via Tarjan. */
function cycles(deps: number[][]): number[][] {
	const index = new Array<number>(deps.length).fill(-1);
	const low = new Array<number>(deps.length).fill(0);
	const onStack = new Array<boolean>(deps.length).fill(false);
	const stack: number[] = [];
	const out: number[][] = [];
	let next = 0;
	const connect = (v: number) => {
		index[v] = low[v] = next++;
		stack.push(v);
		onStack[v] = true;
		for (const w of deps[v]) {
			if (index[w] < 0) {
				connect(w);
				low[v] = Math.min(low[v], low[w]);
			} else if (onStack[w]) low[v] = Math.min(low[v], index[w]);
		}
		if (low[v] !== index[v]) return;
		const component: number[] = [];
		let w: number;
		do {
			w = stack.pop()!;
			onStack[w] = false;
			component.push(w);
		} while (w !== v);
		if (component.length > 1 || deps[v].includes(v)) out.push(component.reverse());
	};
	deps.forEach((_, v) => {
		if (index[v] < 0) connect(v);
	});
	return out;
}

/**
 * Reference evaluation of one scenario with the tree-walking evaluator:
 * `inputs` are the random inputs in model order; returns the shared intermediates (evaluation
 * order) and each decision's reward. The test oracle for the generated kernel.
 */
export function evaluateRow(
	compiled: CompiledModel,
	inputs: ArrayLike<number>
): { shared: number[]; rewards: number[] } {
	const values = new Float64Array(compiled.slots.inputs.length + compiled.shared.length);
	for (let k = 0; k < compiled.slots.inputs.length; k++) values[k] = inputs[k];
	const locals = new Float64Array(compiled.perDecision.length);
	let decision = NaN;
	const env = (name: string): number => {
		const ref = compiled.symbols.get(name);
		switch (ref?.kind) {
			case 'input':
			case 'shared':
				return values[ref.slot];
			case 'constant':
				return ref.value;
			case 'perDecision':
				return locals[ref.local];
			case 'decision':
				return decision;
		}
		throw new Error(`unknown symbol ${name}`);
	};
	const base = compiled.slots.inputs.length;
	compiled.shared.forEach((s, j) => (values[base + j] = evaluate(s.ast, env)));
	const rewards = compiled.values.map((v) => {
		decision = v;
		compiled.perDecision.forEach((p, j) => (locals[j] = evaluate(p.ast, env)));
		return evaluate(compiled.reward, env);
	});
	return { shared: Array.from(values.subarray(base)), rewards };
}

/**
 * `model` with symbol `from` renamed to `to` in its declaration and, when `to`
 * is a valid symbol not yet declared, in every formula and the label template.
 */
export function renameSymbol(model: Model, from: string, to: string): Model {
	const all = [
		...model.inputs.map((i) => i.symbol),
		...model.intermediates.map((m) => m.symbol),
		model.decisions.symbol
	];
	const rewrite = symbolProblem(to) === null && !all.includes(to);
	const formula = (text: string) => (rewrite ? renameInFormula(text, from, to) : text);
	const sym = (s: string) => (s === from ? to : s);
	const d = model.decisions;
	return {
		...model,
		inputs: model.inputs.map((i) => ({ ...i, symbol: sym(i.symbol), params: [...i.params] })),
		intermediates: model.intermediates.map((m) => ({
			...m,
			symbol: sym(m.symbol),
			formula: formula(m.formula)
		})),
		decisions: {
			...d,
			symbol: sym(d.symbol),
			values: [...d.values],
			label: rewrite && d.symbol === from ? d.label.replaceAll(`{${from}}`, `{${to}}`) : d.label,
			reward: formula(d.reward)
		}
	};
}
