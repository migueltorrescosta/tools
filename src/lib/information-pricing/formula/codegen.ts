/**
 * Compile a validated model to JavaScript source: one loop filling the shared
 * intermediate columns, then one fused loop per decision computing that
 * decision's per-decision intermediates (as locals) and its reward. The source
 * holds only numeric literals, slot indices, generated names and `Math` calls:
 * never user text. `buildKernel` checks that before calling `new Function`.
 */
import type { CompiledModel, SlotLayout } from '../model';
import type { Node } from './ast';

export type { SlotLayout };

/**
 * Fill rows `[start, end)`. `cols` follows `SlotLayout`: random inputs (model
 * order, read) then shared intermediates (evaluation order, written).
 * `rewards[d]` is written with decision d's reward. Non-finite rewards are
 * written as they come; the engine checks them.
 */
export type Kernel = (
	cols: Float64Array[],
	rewards: Float64Array[],
	start: number,
	end: number
) => void;

/** Column count the kernel expects: inputs plus shared intermediates. */
export const slotCount = (slots: SlotLayout) => slots.inputs.length + slots.shared.length;

const PREAMBLE = '"use strict";\n';

/** A JS literal for `v` that round-trips exactly. */
export function literal(v: number): string {
	if (Number.isNaN(v)) return 'NaN';
	if (v === Infinity) return 'Infinity';
	if (v === -Infinity) return '(-Infinity)';
	if (Object.is(v, -0)) return '(-0)';
	return v < 0 ? `(${String(v)})` : String(v);
}

const truthy = (s: string) => `(${s} !== 0)`;
const bool = (s: string) => `(${s} ? 1 : 0)`;
const JS_COMPARE = { '<': '<', '<=': '<=', '>': '>', '>=': '>=', '==': '===', '!=': '!==' };

/** JS for `node`; `ref` turns a symbol into a generated expression. */
function emit(node: Node, ref: (name: string) => string): string {
	const e = (n: Node) => emit(n, ref);
	switch (node.kind) {
		case 'num':
			return literal(node.value);
		case 'sym':
			return ref(node.name);
		case 'unary':
			return node.op === '-' ? `(-${e(node.arg)})` : bool(`${e(node.arg)} === 0`);
		case 'ternary':
			return `(${truthy(e(node.cond))} ? ${e(node.then)} : ${e(node.else)})`;
		case 'binary': {
			const a = e(node.left);
			const b = e(node.right);
			switch (node.op) {
				case '+':
				case '-':
				case '*':
				case '/':
					return `(${a} ${node.op} ${b})`;
				case '^':
					return `Math.pow(${a}, ${b})`;
				case 'and':
					return bool(`${truthy(a)} && ${truthy(b)}`);
				case 'or':
					return bool(`${truthy(a)} || ${truthy(b)}`);
				default:
					return bool(`${a} ${JS_COMPARE[node.op]} ${b}`);
			}
		}
		case 'call': {
			const args = node.args.map(e);
			switch (node.fn) {
				case 'if':
					return `(${truthy(args[0])} ? ${args[1]} : ${args[2]})`;
				case 'ind':
					return bool(truthy(args[0]));
				case 'clamp':
					return `Math.min(Math.max(${args[0]}, ${args[1]}), ${args[2]})`;
				case 'ln':
					return `Math.log(${args[0]})`;
				default:
					return `Math.${node.fn}(${args.join(', ')})`;
			}
		}
	}
}

/** Kernel source for `compiled`, the body of a `Kernel`. */
export function kernelSource(compiled: CompiledModel): string {
	const nSlots = slotCount(compiled.slots);
	const lines = [PREAMBLE.trimEnd()];
	for (let k = 0; k < nSlots; k++) lines.push(`const c${k} = cols[${k}];`);
	compiled.values.forEach((_, d) => lines.push(`const r${d} = rewards[${d}];`));

	const symbolRef = (name: string, decision: number | null, sharedLocal: boolean): string => {
		const r = compiled.symbols.get(name);
		switch (r?.kind) {
			case 'input':
				return `c${r.slot}[i]`;
			case 'shared':
				return sharedLocal ? `s${r.slot}` : `c${r.slot}[i]`;
			case 'constant':
				return literal(r.value);
			case 'perDecision':
				return `p${r.local}`;
			case 'decision':
				if (decision === null) break;
				return literal(decision);
		}
		throw new Error('codegen: unresolved symbol');
	};

	if (compiled.shared.length > 0) {
		lines.push('for (let i = start; i < end; i++) {');
		const ref = (name: string) => symbolRef(name, null, true);
		const base = compiled.slots.inputs.length;
		compiled.shared.forEach((s, j) => {
			const k = base + j;
			lines.push(`\tconst s${k} = ${emit(s.ast, ref)};`, `\tc${k}[i] = s${k};`);
		});
		lines.push('}');
	}
	compiled.values.forEach((value, d) => {
		const ref = (name: string) => symbolRef(name, value, false);
		lines.push('for (let i = start; i < end; i++) {');
		compiled.perDecision.forEach((p, j) => lines.push(`\tconst p${j} = ${emit(p.ast, ref)};`));
		lines.push(`\tr${d}[i] = ${emit(compiled.reward, ref)};`, '}');
	});
	return lines.join('\n');
}

const ALLOWED_WORDS =
	/^(?:[cspr]\d+|i|cols|rewards|start|end|const|let|for|Math|min|max|abs|exp|log|sqrt|floor|ceil|pow|NaN|Infinity)$/;

/** Throws unless every word and character in `source` is one the generator emits. */
export function assertGenerated(source: string): void {
	if (!source.startsWith(PREAMBLE)) throw new Error('codegen: missing preamble');
	const body = source.slice(PREAMBLE.length);
	if (!/^[\w\s.;=+\-*/<>!?:&|(),[\]{}]*$/.test(body))
		throw new Error('codegen: unexpected character');
	const words = body.replace(/(?<![\w$])\d+(?:\.\d*)?(?:e[+-]?\d+)?/g, '0').match(/[A-Za-z_]\w*/g);
	for (const word of words ?? [])
		if (!ALLOWED_WORDS.test(word)) throw new Error(`codegen: unexpected word "${word}"`);
}

/** Compile kernel source (from `kernelSource`) to a function. */
export function buildKernel(source: string): Kernel {
	assertGenerated(source);
	return new Function('cols', 'rewards', 'start', 'end', source) as Kernel;
}

/** `buildKernel(kernelSource(compiled))`. */
export const compileKernel = (compiled: CompiledModel): Kernel =>
	buildKernel(kernelSource(compiled));
